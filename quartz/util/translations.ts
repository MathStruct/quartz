import type { FullSlug } from "./path"

/**
 * Translations of single pages. A note `Note.md` may have a translation beside it,
 * `Note.zh.md`; its slug is `Note-zh`. A translation is reached only from its original (the
 * language switch next to the title): it is left out of the search, the graph, the explorer,
 * folder and tag listings, backlinks and recent notes, and the sitemap and RSS feed.
 */
export const translationLanguages = {
  zh: { label: "中文", locale: "zh-CN" },
} as const

export type TranslationLanguage = keyof typeof translationLanguages

export const originalLanguage = { label: "English" }

const suffix = new RegExp(`\\.(${Object.keys(translationLanguages).join("|")})$`)

/** the language of a path or link target without its `.md`, e.g. `Note.zh` -> `zh` */
export function translationSuffix(s: string): TranslationLanguage | undefined {
  return s.match(suffix)?.[1] as TranslationLanguage | undefined
}

/** `Note.zh` -> `Note-zh`; anything else unchanged */
export function translationSlug(s: string): string {
  return s.replace(suffix, "-$1")
}

/** the slug of the translation of `slug` into `lang` */
export function translatedSlug(slug: FullSlug, lang: TranslationLanguage): FullSlug {
  return `${slug}-${lang}` as FullSlug
}

export interface TranslationInfo {
  lang: TranslationLanguage
  /** the original's slug, if the original exists */
  original?: FullSlug
}

declare module "vfile" {
  interface DataMap {
    /** set on a translation */
    translation: TranslationInfo
    /** set on an original: the slugs of its translations */
    translations: Partial<Record<TranslationLanguage, FullSlug>>
  }
}

export function isTranslation(data: { translation?: TranslationInfo }): boolean {
  return data.translation !== undefined
}
