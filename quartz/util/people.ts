// Where blog bylines link to: a person's page is <people>/<name-slug>. The people pages live on
// the organisation site, so by default every site links there; the organisation site itself
// sets a site-relative "people/" (siteConfig's `peoplePages`, mathstruct/config.ts).
let people = "https://mathstruct.org/people/"

export function setPeoplePages(url: string) {
  people = url.endsWith("/") ? url : url + "/"
}

export function peoplePages(): string {
  return people
}
