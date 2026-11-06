/** another site whose search index is searched after this one's */
export interface SearchSite {
  /** shown on its results, e.g. "CT-ML Wiki" */
  name: string
  /** the site's base URL without protocol, as its `baseUrl`, e.g. "mathstruct.org/Sophia" */
  url: string
}

const trimUrl = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/+$/, "")

/** `sites` without the one this site is (the longest whose URL is a path prefix of `baseUrl`) */
export function sitesOtherThan(sites: SearchSite[], baseUrl: string | undefined): SearchSite[] {
  const own = trimUrl(baseUrl ?? "")
  const prefixes = sites
    .map((s) => trimUrl(s.url))
    .filter((u) => own === u || own.startsWith(u + "/"))
  const self = prefixes.sort((a, b) => b.length - a.length)[0]
  return sites.filter((s) => trimUrl(s.url) !== self)
}
