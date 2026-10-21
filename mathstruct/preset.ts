/**
 * The MathStruct preset: everything the MathStruct sites share, so that a site's own
 * `quartz.config.ts` and `quartz.layout.ts` only say what is particular to it (title, address,
 * footer links, comment threads).
 *
 * Every plugin in this fork is switched on for every site. A plugin that a note does not use
 * costs nothing: TikZ only touches ```tikz fences, the tabs plugin only ```tabs fences, Typst
 * only runs on pages that ask for it. To give all sites a new extension, add it here.
 *
 *   // site/quartz.config.ts
 *   import { siteConfig } from "./mathstruct/preset"
 *   export default siteConfig({ pageTitle: "Sophia", baseUrl: "mathstruct.org/Sophia" })
 *
 *   // site/quartz.layout.ts
 *   import { siteLayout } from "./mathstruct/preset"
 *   export const { sharedPageComponents, defaultContentPageLayout, defaultListPageLayout } =
 *     siteLayout({ footerLinks: { GitHub: "https://github.com/MathStruct/Sophia" } })
 *
 * Both files are copied to the root of the Quartz checkout by `mathstruct/site.sh`, which is why
 * the import paths are relative to that root.
 */
import { GlobalConfiguration, PageLayout, QuartzConfig, SharedLayout } from "../quartz/cfg"
import * as Plugin from "../quartz/plugins"
import * as Component from "../quartz/components"
import { QuartzComponent } from "../quartz/components/types"
import { setPeoplePages } from "../quartz/components/Authors"
import { ValidLocale } from "../quartz/i18n"
import { RenderEngine } from "../quartz/plugins/transformers/latex"

type DateSource = "frontmatter" | "git" | "filesystem"

export interface SiteOptions {
  pageTitle: string
  pageTitleSuffix?: string
  /** without protocol, e.g. "mathstruct.org/Sophia" */
  baseUrl: string
  locale?: ValidLocale
  /** added to the patterns every site ignores (private/, templates/, .obsidian, .tikz-cache) */
  ignorePatterns?: string[]
  /** which date a page shows and is sorted by (default "modified"; a blog wants "created") */
  defaultDateType?: GlobalConfiguration["defaultDateType"]
  /** where page dates come from, in order (default frontmatter, git, filesystem) */
  dateSources?: DateSource[]
  /**
   * The math engines, tried in order per formula (default KaTeX only). ["typst", "katex"] lets a
   * note mix Typst and LaTeX. Whatever the default, a page can pin itself with `math: typst` or
   * `math: latex` in its frontmatter, and a ```typst fence is always rendered with Typst.
   */
  math?: RenderEngine | RenderEngine[]
  /** RSS feed (default true) */
  rss?: boolean
  /** write a CNAME file from baseUrl; only for the site that owns the custom domain */
  cname?: boolean
  /**
   * Where blog bylines link to: a person's page is <peoplePages><name-slug>. Default: the
   * organisation site's people pages. A site-relative path ("people/") for the organisation
   * site itself.
   */
  peoplePages?: string
}

/** the patterns every site ignores */
const ignoredEverywhere = ["private", "templates", ".obsidian", ".tikz-cache"]

export function siteConfig(o: SiteOptions): QuartzConfig {
  if (o.peoplePages) setPeoplePages(o.peoplePages)
  const math = o.math ?? "katex"

  return {
    configuration: {
      pageTitle: o.pageTitle,
      pageTitleSuffix: o.pageTitleSuffix ?? "",
      enableSPA: true,
      enablePopovers: true,
      analytics: null,
      locale: o.locale ?? "en-US",
      // a preview build is published at another address (set by the build script)
      baseUrl: process.env.SITE_BASEURL || o.baseUrl,
      ignorePatterns: [...ignoredEverywhere, ...(o.ignorePatterns ?? [])],
      defaultDateType: o.defaultDateType ?? "modified",
      theme: {
        fontOrigin: "googleFonts",
        cdnCaching: true,
        typography: {
          header: "Schibsted Grotesk",
          body: "Source Sans Pro",
          code: "IBM Plex Mono",
        },
        colors: {
          lightMode: {
            light: "#faf8f8",
            lightgray: "#e5e5e5",
            gray: "#b8b8b8",
            darkgray: "#4e4e4e",
            dark: "#2b2b2b",
            secondary: "#284b63",
            tertiary: "#84a59d",
            highlight: "rgba(143, 159, 169, 0.15)",
            textHighlight: "#fff23688",
          },
          darkMode: {
            light: "#161618",
            lightgray: "#393639",
            gray: "#646464",
            darkgray: "#d4d4d4",
            dark: "#ebebec",
            secondary: "#7b97aa",
            tertiary: "#84a59d",
            highlight: "rgba(143, 159, 169, 0.15)",
            textHighlight: "#b3aa0288",
          },
        },
      },
    },
    plugins: {
      transformers: [
        Plugin.FrontMatter(),
        Plugin.CreatedModifiedDate({
          priority: o.dateSources ?? ["frontmatter", "git", "filesystem"],
        }),
        // notes open with `# <note name>`, which Quartz already shows as the title
        Plugin.DropTitleHeading(),
        Plugin.SyntaxHighlighting({
          theme: { light: "github-light", dark: "github-dark" },
          keepBackground: false,
        }),
        // ```tikz fences compiled to SVG at build time, with a dark-mode variant of each, cached
        // by content hash in the site's .tikz-cache/ (committed, so CI only renders new ones)
        Plugin.TikZ({ cacheDir: ".tikz-cache" }),
        // the Obsidian "Markdown Tabs" plugin: code in several languages side by side
        Plugin.ObsidianTabs(),
        // [[wikilinks]], > [!callouts], ...
        Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
        Plugin.GitHubFlavoredMarkdown(),
        Plugin.TableOfContents(),
        // "shortest" resolves [[links]] by note name, exactly as Obsidian does
        Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
        Plugin.Description(),
        Plugin.Latex({
          renderEngine: math,
          katexOptions: { throwOnError: false, strict: false },
        }),
      ],
      filters: [Plugin.RemoveDrafts()],
      emitters: [
        Plugin.AliasRedirects(),
        Plugin.ComponentResources(),
        Plugin.ContentPage(),
        Plugin.FolderPage(),
        Plugin.TagPage(),
        Plugin.ContentIndex({ enableSiteMap: true, enableRSS: o.rss ?? true }),
        Plugin.Assets(),
        Plugin.Static(),
        ...(o.cname ? [Plugin.CNAME()] : []),
        Plugin.Favicon(),
        Plugin.NotFoundPage(),
        // Plugin.CustomOgImages() is left out: it slows the build considerably
      ],
    },
  }
}

/** a giscus thread under every page, stored in a repository's GitHub Discussions */
export interface CommentOptions {
  repo: `${string}/${string}`
  repoId: string
  category: string
  categoryId: string
}

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
            { Component: Component.Search(), grow: true },
            { Component: Component.Darkmode() },
            { Component: Component.ReaderMode() },
          ],
        }),
        explorer,
      ],
      right: [
        ...(o.right ?? []),
        Component.Graph(),
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
          components: [
            { Component: Component.Search(), grow: true },
            { Component: Component.Darkmode() },
          ],
        }),
        explorer,
      ],
      right: [],
    },
  }
}
