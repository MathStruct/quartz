/**
 * The MathStruct preset, configuration half (the layout half is ./layout.ts): everything the
 * MathStruct sites share, so that a site's own `quartz.config.ts` and `quartz.layout.ts` only
 * say what is particular to it (title, address, footer links, comment threads).
 *
 * Every plugin in this fork is switched on for every site. A plugin that a note does not use
 * costs nothing: TikZ only touches ```tikz fences, the tabs plugin only ```tabs fences, Typst
 * only runs on pages that ask for it. To give all sites a new extension, add it here.
 *
 *   // site/quartz.config.ts
 *   import { siteConfig } from "./mathstruct/config"
 *   export default siteConfig({ pageTitle: "Sophia", baseUrl: "mathstruct.org/Sophia" })
 *
 *   // site/quartz.layout.ts
 *   import { siteLayout } from "./mathstruct/layout"
 *   export const { sharedPageComponents, defaultContentPageLayout, defaultListPageLayout } =
 *     siteLayout({ footerLinks: { GitHub: "https://github.com/MathStruct/Sophia" } })
 *
 * Both files are copied to the root of the Quartz checkout by `mathstruct/site.sh`, which is why
 * the import paths are relative to that root.
 *
 * The two halves are separate modules on purpose: Quartz's worker threads load the
 * configuration but not the layout, and the configuration must not import the components (the
 * import cycle leaves them undefined in the workers).
 */
import { GlobalConfiguration, QuartzConfig } from "../quartz/cfg"
import * as Plugin from "../quartz/plugins"
import { setPeoplePages } from "../quartz/util/people"
import { ValidLocale } from "../quartz/i18n"
import { RenderEngine } from "../quartz/plugins/transformers/latex"

type DateSource = "frontmatter" | "git" | "filesystem"

export interface SiteOptions {
  pageTitle: string
  pageTitleSuffix?: string
  /** without protocol, e.g. "mathstruct.org/Sophia" */
  baseUrl: string
  locale?: ValidLocale
  /** added to the patterns every site ignores (private/, .obsidian, .tikz-cache) */
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
const ignoredEverywhere = ["private", ".obsidian", ".tikz-cache"]

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
        // black and white, with the fonts of mathstruct.org's front page; the rest of the look
        // is in quartz/styles/mathstruct.scss
        typography: {
          header: { name: "Inter Tight", weights: [400, 500, 600] },
          body: { name: "Inter", weights: [400, 500, 600], includeItalic: true },
          code: { name: "JetBrains Mono", weights: [400, 500] },
        },
        colors: {
          lightMode: {
            light: "#fafaf9",
            lightgray: "#e6e6e3",
            gray: "#a3a3a3",
            darkgray: "#363636",
            dark: "#0b0b0b",
            secondary: "#0b0b0b",
            tertiary: "#6b6b6b",
            highlight: "rgba(0, 0, 0, 0.045)",
            textHighlight: "rgba(0, 0, 0, 0.12)",
          },
          darkMode: {
            light: "#0a0a0a",
            lightgray: "#262626",
            gray: "#5e5e5c",
            darkgray: "#cfcfcd",
            dark: "#f4f4f3",
            secondary: "#f4f4f3",
            tertiary: "#9a9a98",
            highlight: "rgba(255, 255, 255, 0.06)",
            textHighlight: "rgba(255, 255, 255, 0.2)",
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
        // after CrawlLinks: `Note.zh.md` translates `Note.md` (quartz/util/translations.ts)
        Plugin.Translations(),
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
