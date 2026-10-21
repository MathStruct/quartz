import { slug as slugAnchor } from "github-slugger"
import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug, SimpleSlug, resolveRelative } from "../util/path"

/**
 * Byline support for the blog: reads `authors:` (or `author:`) from frontmatter,
 * accepting either a list or a comma-separated string.
 */
export function getAuthors(data: QuartzPluginData): string[] {
  const frontmatter = data.frontmatter as Record<string, unknown> | undefined
  const declared = frontmatter?.authors ?? frontmatter?.author
  if (declared === undefined || declared === null) return []

  const parts = Array.isArray(declared) ? declared : String(declared).split(",")
  return parts.map((author) => String(author).trim()).filter((author) => author.length > 0)
}

// Author names link to their pages: "Daniel Boigk" → <people>/daniel-boigk. The people pages
// live on the organisation site, so by default every site links there; the organisation site
// itself sets a site-relative "people/" (see mathstruct/preset.ts).
let people = "https://mathstruct.org/people/"
export function setPeoplePages(url: string) {
  people = url.endsWith("/") ? url : url + "/"
}
const isAbsolute = (url: string) => /^https?:\/\//.test(url)
const personPage = (author: string) => `${people}${slugAnchor(author)}`

type Props = {
  data: QuartzPluginData
  currentSlug: FullSlug
}

export function Authors({ data, currentSlug }: Props) {
  const authors = getAuthors(data)
  if (authors.length === 0) return null

  return (
    <span class="authors">
      {authors.map((author, i) => (
        <>
          {i > 0 ? ", " : ""}
          <a
            class={isAbsolute(people) ? "external" : "internal"}
            href={
              isAbsolute(people)
                ? personPage(author)
                : resolveRelative(currentSlug, personPage(author) as SimpleSlug)
            }
          >
            {author}
          </a>
        </>
      ))}
    </span>
  )
}
