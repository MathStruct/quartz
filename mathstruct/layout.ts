/**
 * The MathStruct preset, layout half (the configuration half, and how a site uses both, is
 * described in ./config.ts).
 */
import { PageLayout, SharedLayout } from "../quartz/cfg"
import * as Component from "../quartz/components"
import { QuartzComponent } from "../quartz/components/types"
import { SearchSite } from "../quartz/util/searchSites"

/** a giscus thread under every page, stored in a repository's GitHub Discussions */
export interface CommentOptions {
  repo: `${string}/${string}`
  repoId: string
  category: string
  categoryId: string
}

/** the MathStruct sites; the search looks through all of them, this site's results first */
export const mathstructSites: SearchSite[] = [
  { name: "MathStruct", url: "mathstruct.org" },
  { name: "CT-ML Wiki", url: "mathstruct.org/CategoryTheory-ML-Wiki" },
  { name: "Lenticulum.jl", url: "mathstruct.org/Lenticulum.jl" },
  { name: "LenticulumLM", url: "mathstruct.org/LenticulumLM" },
  { name: "Sophia", url: "mathstruct.org/Sophia" },
  { name: "Moonkale", url: "mathstruct.org/Moonkale" },
]

export interface LayoutOptions {
  footerLinks: Record<string, string>
  /** giscus ids (from giscus.app); no comment threads without them */
  comments?: CommentOptions
  /** e.g. false on a preview build; a single note opts out with `comments: false` */
  commentsEnabled?: boolean
  /** an image next to the site title, from the site root (e.g. "static/icon.png") */
  icon?: string
  /** options for the file explorer, e.g. a sortFn */
  explorer?: Parameters<typeof Component.Explorer>[0]
  /** components at the top of the right column of content pages (e.g. latest blog posts) */
  right?: QuartzComponent[]
  /** the other sites the search looks through (default: all MathStruct sites; [] for none) */
  searchSites?: SearchSite[]
}

export function siteLayout(o: LayoutOptions): {
  sharedPageComponents: SharedLayout
  defaultContentPageLayout: PageLayout
  defaultListPageLayout: PageLayout
} {
  const comments = o.comments
    ? [
        Component.ConditionalRender({
          component: Component.Comments({
            provider: "giscus",
            options: {
              ...o.comments,
              mapping: "pathname",
              strict: true,
              reactionsEnabled: true,
              inputPosition: "bottom",
            },
          }),
          // not on the tag listings
          condition: (page) =>
            (o.commentsEnabled ?? true) && !(page.fileData.slug ?? "").startsWith("tags/"),
        }),
      ]
    : []

  const title = Component.PageTitle({ icon: o.icon })
  const search = Component.Search({ otherSites: o.searchSites ?? mathstructSites })
  const explorer = Component.Explorer(o.explorer)

  return {
    sharedPageComponents: {
      head: Component.Head(),
      header: [],
      afterBody: comments,
      footer: Component.Footer({ links: o.footerLinks }),
    },

    defaultContentPageLayout: {
      beforeBody: [
        Component.ConditionalRender({
          component: Component.Breadcrumbs(),
          condition: (page) => page.fileData.slug !== "index",
        }),
        Component.ArticleTitle(),
        // "中文" on a page with a translation, "English" on the translation
        Component.LanguageSwitch(),
        // the landing page is not an article: no date or reading time on it
        Component.ConditionalRender({
          component: Component.ContentMeta(),
          condition: (page) => page.fileData.slug !== "index",
        }),
        Component.TagList(),
      ],
      left: [
        title,
        Component.MobileOnly(Component.Spacer()),
        Component.Flex({
          components: [
            { Component: search, grow: true },
            { Component: Component.Darkmode() },
            { Component: Component.ReaderMode() },
          ],
        }),
        explorer,
      ],
      right: [
        ...(o.right ?? []),
        // a translation is not in the graph; it would be a lone node
        Component.ConditionalRender({
          component: Component.Graph(),
          condition: (page) => !page.fileData.translation,
        }),
        Component.DesktopOnly(Component.TableOfContents()),
        Component.Backlinks(),
      ],
    },

    defaultListPageLayout: {
      beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
      left: [
        title,
        Component.MobileOnly(Component.Spacer()),
        Component.Flex({
          components: [{ Component: search, grow: true }, { Component: Component.Darkmode() }],
        }),
        explorer,
      ],
      right: [],
    },
  }
}
