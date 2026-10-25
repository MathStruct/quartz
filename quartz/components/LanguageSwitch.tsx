import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { resolveRelative } from "../util/path"
import { TranslationLanguage, originalLanguage, translationLanguages } from "../util/translations"

/**
 * Next to the title: on a page with a translation a link to it (e.g. "中文"), on a
 * translation a link back to the original ("English"). Nothing on other pages. This is the
 * only way to a translation; util/translations.ts keeps it out of every listing.
 */
const LanguageSwitch: QuartzComponent = ({ fileData, displayClass }: QuartzComponentProps) => {
  const slug = fileData.slug!
  const links: { href: string; label: string; lang: string }[] = []
  const original = fileData.translation?.original
  if (original) {
    links.push({ href: resolveRelative(slug, original), label: originalLanguage.label, lang: "en" })
  }
  for (const [lang, target] of Object.entries(fileData.translations ?? {})) {
    const { label } = translationLanguages[lang as TranslationLanguage]
    links.push({ href: resolveRelative(slug, target!), label, lang })
  }
  if (links.length === 0) return null

  return (
    <p class={classNames(displayClass, "language-switch")}>
      {links.map(({ href, label, lang }) => (
        // a full page load, so that <html lang> changes with the language
        <a href={href} lang={lang} hreflang={lang} rel="alternate" data-router-ignore>
          {label}
        </a>
      ))}
    </p>
  )
}

LanguageSwitch.css = `
.language-switch {
  margin: 0.25rem 0 0 0;
  display: flex;
  gap: 0.75rem;
  font-size: 0.9rem;
}
`

export default (() => LanguageSwitch) satisfies QuartzComponentConstructor
