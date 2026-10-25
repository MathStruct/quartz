import { Root } from "hast"
import { visit } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"
import {
  FilePath,
  FullSlug,
  SimpleSlug,
  resolveRelative,
  simplifySlug,
  slugifyFilePath,
} from "../../util/path"
import {
  TranslationLanguage,
  translatedSlug,
  translationLanguages,
  translationSuffix,
} from "../../util/translations"

/**
 * Pairs each translation `Note.zh.md` with its original `Note.md` (util/translations.ts):
 * sets `translation` on the one and `translations` on the other, gives the translation its
 * `lang`, and points the translation's internal links at translated pages where they exist.
 * Goes after CrawlLinks, whose `data-slug` it reads.
 */
export const Translations: QuartzTransformerPlugin = () => ({
  name: "Translations",
  htmlPlugins(ctx) {
    return [
      () => (tree: Root, file) => {
        const slugs = new Set(ctx.allSlugs)
        const relativePath = file.data.relativePath!
        const slug = file.data.slug!
        const stem = relativePath.replace(/\.md$/, "")
        const lang = translationSuffix(stem)

        if (!lang) {
          const translations: Partial<Record<TranslationLanguage, FullSlug>> = {}
          for (const l of Object.keys(translationLanguages) as TranslationLanguage[]) {
            if (slugs.has(translatedSlug(slug, l))) translations[l] = translatedSlug(slug, l)
          }
          if (Object.keys(translations).length > 0) file.data.translations = translations
          return
        }

        const original = slugifyFilePath(`${stem.slice(0, -lang.length - 1)}.md` as FilePath)
        file.data.translation = { lang, original: slugs.has(original) ? original : undefined }
        const fm = file.data.frontmatter
        if (fm) {
          fm.lang ??= lang
          // the default title is the file name, `Note.zh`
          if (fm.title === file.stem) fm.title = fm.title!.slice(0, -lang.length - 1)
        }

        // a link to a page that has a translation goes to the translation
        const links = new Set<SimpleSlug>(file.data.links ?? [])
        visit(tree, "element", (node) => {
          if (node.tagName !== "a") return
          const target = node.properties?.["data-slug"]
          if (typeof target !== "string") return
          const translated = translatedSlug(target as FullSlug, lang)
          if (!slugs.has(translated)) return
          const href = String(node.properties.href ?? "")
          const anchor = href.includes("#") ? href.slice(href.indexOf("#")) : ""
          node.properties.href = resolveRelative(slug, translated) + anchor
          node.properties["data-slug"] = translated
          links.delete(simplifySlug(target as FullSlug))
          links.add(simplifySlug(translated))
        })
        file.data.links = [...links]
      },
    ]
  },
})
