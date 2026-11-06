import FlexSearch, { DefaultDocumentSearchResults } from "flexsearch"
import { ContentDetails } from "../../plugins/emitters/contentIndex"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, normalizeRelativeURLs, resolveRelative } from "../../util/path"

interface Item {
  id: number
  slug: FullSlug
  title: string
  content: string
  tags: string[]
  [key: string]: any
}

/** another site searched after this one (`SearchSite` in Search.tsx) */
interface SearchSite {
  name: string
  url: string
}

/** a result as displayed: the page's URL, and the other site it is on, if any */
interface Hit extends Item {
  url: string
  site?: SearchSite
}

// Can be expanded with things like "term" in the future
type SearchType = "basic" | "tags"
let searchType: SearchType = "basic"
let currentSearchTerm: string = ""
const encoder = (str: string): string[] => {
  const tokens: string[] = []
  let bufferStart = -1
  let bufferEnd = -1
  const lower = str.toLowerCase()

  let i = 0
  for (const char of lower) {
    const code = char.codePointAt(0)!

    const isCJK =
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0x20000 && code <= 0x2a6df)

    const isWhitespace = code === 32 || code === 9 || code === 10 || code === 13

    if (isCJK) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd))
        bufferStart = -1
      }
      tokens.push(char)
    } else if (isWhitespace) {
      if (bufferStart !== -1) {
        tokens.push(lower.slice(bufferStart, bufferEnd))
        bufferStart = -1
      }
    } else {
      if (bufferStart === -1) bufferStart = i
      bufferEnd = i + char.length
    }

    i += char.length
  }

  if (bufferStart !== -1) {
    tokens.push(lower.slice(bufferStart))
  }

  return tokens
}

const newIndex = () =>
  new FlexSearch.Document<Item>({
    encode: encoder,
    document: {
      id: "id",
      tag: "tags",
      index: [
        {
          field: "title",
          tokenize: "forward",
        },
        {
          field: "content",
          tokenize: "forward",
        },
        {
          field: "tags",
          tokenize: "forward",
        },
      ],
    },
  })
let index = newIndex()

/**
 * The other sites' indices, kept across navigations. Each is fetched from
 * `<site>/static/contentIndex.json` and indexed the first time the search opens; a site that
 * cannot be fetched (offline, not yet deployed) is left out silently.
 */
interface RemoteSite {
  site: SearchSite
  data: ContentIndex
  slugs: FullSlug[]
  index: ReturnType<typeof newIndex>
}
const remoteSites: Map<string, RemoteSite> = new Map()
const remoteLoading: Set<string> = new Set()
/** re-runs the open search when another site's index arrives (set by the current page) */
let onRemoteReady: (() => void) | null = null
const remoteResultsPerSite = 3

function siteBase(site: SearchSite): string {
  const u = site.url.replace(/\/+$/, "")
  return /^https?:\/\//.test(u) ? u : `https://${u}`
}

/** a page of another site; `index` pages are the folder itself, as Quartz links them */
function remoteUrl(site: SearchSite, slug: FullSlug): string {
  const path = slug === "index" ? "" : slug.endsWith("/index") ? slug.slice(0, -5) : slug
  return `${siteBase(site)}/${path}`
}

function loadRemoteSites(sites: SearchSite[]) {
  for (const site of sites) {
    if (remoteSites.has(site.url) || remoteLoading.has(site.url)) continue
    remoteLoading.add(site.url)
    fetch(`${siteBase(site)}/static/contentIndex.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json() as Promise<ContentIndex>
      })
      .then(async (data) => {
        const idx = newIndex()
        const slugs = Object.keys(data) as FullSlug[]
        await Promise.all(
          slugs.map((slug, id) =>
            idx.addAsync(id, {
              id,
              slug,
              title: data[slug].title,
              content: data[slug].content,
              tags: data[slug].tags,
            }),
          ),
        )
        remoteSites.set(site.url, { site, data, slugs, index: idx })
        onRemoteReady?.()
      })
      .catch(() => {})
      .finally(() => remoteLoading.delete(site.url))
  }
}

const p = new DOMParser()
const fetchContentCache: Map<string, Element[]> = new Map()
const contextWindowWords = 30
const numSearchResults = 8
const numTagResults = 5

const tokenizeTerm = (term: string) => {
  const tokens = term.split(/\s+/).filter((t) => t.trim() !== "")
  const tokenLen = tokens.length
  if (tokenLen > 1) {
    for (let i = 1; i < tokenLen; i++) {
      tokens.push(tokens.slice(0, i + 1).join(" "))
    }
  }

  return tokens.sort((a, b) => b.length - a.length) // always highlight longest terms first
}

function highlight(searchTerm: string, text: string, trim?: boolean) {
  const tokenizedTerms = tokenizeTerm(searchTerm)
  let tokenizedText = text.split(/\s+/).filter((t) => t !== "")

  let startIndex = 0
  let endIndex = tokenizedText.length - 1
  if (trim) {
    const includesCheck = (tok: string) =>
      tokenizedTerms.some((term) => tok.toLowerCase().startsWith(term.toLowerCase()))
    const occurrencesIndices = tokenizedText.map(includesCheck)

    let bestSum = 0
    let bestIndex = 0
    for (let i = 0; i < Math.max(tokenizedText.length - contextWindowWords, 0); i++) {
      const window = occurrencesIndices.slice(i, i + contextWindowWords)
      const windowSum = window.reduce((total, cur) => total + (cur ? 1 : 0), 0)
      if (windowSum >= bestSum) {
        bestSum = windowSum
        bestIndex = i
      }
    }

    startIndex = Math.max(bestIndex - contextWindowWords, 0)
    endIndex = Math.min(startIndex + 2 * contextWindowWords, tokenizedText.length - 1)
    tokenizedText = tokenizedText.slice(startIndex, endIndex)
  }

  const slice = tokenizedText
    .map((tok) => {
      // see if this tok is prefixed by any search terms
      for (const searchTok of tokenizedTerms) {
        if (tok.toLowerCase().includes(searchTok.toLowerCase())) {
          const regex = new RegExp(searchTok.toLowerCase(), "gi")
          return tok.replace(regex, `<span class="highlight">$&</span>`)
        }
      }
      return tok
    })
    .join(" ")

  return `${startIndex === 0 ? "" : "..."}${slice}${
    endIndex === tokenizedText.length - 1 ? "" : "..."
  }`
}

function highlightHTML(searchTerm: string, el: HTMLElement) {
  const p = new DOMParser()
  const tokenizedTerms = tokenizeTerm(searchTerm)
  const html = p.parseFromString(el.innerHTML, "text/html")

  const createHighlightSpan = (text: string) => {
    const span = document.createElement("span")
    span.className = "highlight"
    span.textContent = text
    return span
  }

  const highlightTextNodes = (node: Node, term: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.nodeValue ?? ""
      const regex = new RegExp(term.toLowerCase(), "gi")
      const matches = nodeText.match(regex)
      if (!matches || matches.length === 0) return
      const spanContainer = document.createElement("span")
      let lastIndex = 0
      for (const match of matches) {
        const matchIndex = nodeText.indexOf(match, lastIndex)
        spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex, matchIndex)))
        spanContainer.appendChild(createHighlightSpan(match))
        lastIndex = matchIndex + match.length
      }
      spanContainer.appendChild(document.createTextNode(nodeText.slice(lastIndex)))
      node.parentNode?.replaceChild(spanContainer, node)
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as HTMLElement).classList.contains("highlight")) return
      Array.from(node.childNodes).forEach((child) => highlightTextNodes(child, term))
    }
  }

  for (const term of tokenizedTerms) {
    highlightTextNodes(html.body, term)
  }

  return html.body
}

async function setupSearch(searchElement: Element, currentSlug: FullSlug, data: ContentIndex) {
  const container = searchElement.querySelector(".search-container") as HTMLElement
  if (!container) return

  const sidebar = container.closest(".sidebar") as HTMLElement | null

  const searchButton = searchElement.querySelector(".search-button") as HTMLButtonElement
  if (!searchButton) return

  const searchBar = searchElement.querySelector(".search-bar") as HTMLInputElement
  if (!searchBar) return

  const searchLayout = searchElement.querySelector(".search-layout") as HTMLElement
  if (!searchLayout) return

  const idDataMap = Object.keys(data) as FullSlug[]
  const appendLayout = (el: HTMLElement) => {
    searchLayout.appendChild(el)
  }

  const enablePreview = searchLayout.dataset.preview === "true"
  let otherSites: SearchSite[] = []
  try {
    otherSites = JSON.parse(searchLayout.dataset.sites ?? "[]")
  } catch {}
  let preview: HTMLDivElement | undefined = undefined
  let previewInner: HTMLDivElement | undefined = undefined
  const results = document.createElement("div")
  results.className = "results-container"
  appendLayout(results)

  if (enablePreview) {
    preview = document.createElement("div")
    preview.className = "preview-container"
    appendLayout(preview)
  }

  function hideSearch() {
    container.classList.remove("active")
    searchBar.value = "" // clear the input when we dismiss the search
    if (sidebar) sidebar.style.zIndex = ""
    removeAllChildren(results)
    if (preview) {
      removeAllChildren(preview)
    }
    searchLayout.classList.remove("display-results")
    searchType = "basic" // reset search type after closing
    searchButton.focus()
  }

  function showSearch(searchTypeNew: SearchType) {
    searchType = searchTypeNew
    if (sidebar) sidebar.style.zIndex = "1"
    container.classList.add("active")
    searchBar.focus()
    loadRemoteSites(otherSites)
  }

  // when another site's index arrives, search it too for the term already typed
  onRemoteReady = () => {
    if (container.classList.contains("active") && searchBar.value !== "") void runSearch()
  }

  let currentHover: HTMLInputElement | null = null
  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "k" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const searchBarOpen = container.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("basic")
      return
    } else if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      // Hotkey to open tag search
      e.preventDefault()
      const searchBarOpen = container.classList.contains("active")
      searchBarOpen ? hideSearch() : showSearch("tags")

      // add "#" prefix for tag search
      searchBar.value = "#"
      return
    }

    if (currentHover) {
      currentHover.classList.remove("focus")
    }

    // If search is active, then we will render the first result and display accordingly
    if (!container.classList.contains("active")) return
    if (e.key === "Enter" && !e.isComposing) {
      // If result has focus, navigate to that one, otherwise pick first result
      if (results.contains(document.activeElement)) {
        const active = document.activeElement as HTMLInputElement
        if (active.classList.contains("no-match")) return
        await displayPreview(active)
        active.click()
      } else {
        const anchor = document.getElementsByClassName("result-card")[0] as HTMLInputElement | null
        if (!anchor || anchor.classList.contains("no-match")) return
        await displayPreview(anchor)
        anchor.click()
      }
    } else if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
      e.preventDefault()
      if (results.contains(document.activeElement)) {
        // If an element in results-container already has focus, focus previous one
        const currentResult = currentHover
          ? currentHover
          : (document.activeElement as HTMLInputElement | null)
        const prevResult = currentResult?.previousElementSibling as HTMLInputElement | null
        currentResult?.classList.remove("focus")
        prevResult?.focus()
        if (prevResult) currentHover = prevResult
        await displayPreview(prevResult)
      }
    } else if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault()
      // The results should already been focused, so we need to find the next one.
      // The activeElement is the search bar, so we need to find the first result and focus it.
      if (document.activeElement === searchBar || currentHover !== null) {
        const firstResult = currentHover
          ? currentHover
          : (document.getElementsByClassName("result-card")[0] as HTMLInputElement | null)
        const secondResult = firstResult?.nextElementSibling as HTMLInputElement | null
        firstResult?.classList.remove("focus")
        secondResult?.focus()
        if (secondResult) currentHover = secondResult
        await displayPreview(secondResult)
      }
    }
  }

  const formatForDisplay = (
    term: string,
    id: number,
    from: { data: ContentIndex; slugs: FullSlug[]; site?: SearchSite } = {
      data,
      slugs: idDataMap,
    },
  ): Hit => {
    const slug = from.slugs[id]
    const page = from.data[slug]
    return {
      id,
      slug,
      url: from.site ? remoteUrl(from.site, slug) : resolveUrl(slug).toString(),
      site: from.site,
      title: searchType === "tags" ? page.title : highlight(term, page.title ?? ""),
      content: highlight(term, page.content ?? "", true),
      tags: highlightTags(term.substring(1), page.tags),
    }
  }

  function highlightTags(term: string, tags: string[]) {
    if (!tags || searchType !== "tags") {
      return []
    }

    return tags
      .map((tag) => {
        if (tag.toLowerCase().includes(term.toLowerCase())) {
          return `<li><p class="match-tag">#${tag}</p></li>`
        } else {
          return `<li><p>#${tag}</p></li>`
        }
      })
      .slice(0, numTagResults)
  }

  function resolveUrl(slug: FullSlug): URL {
    return new URL(resolveRelative(currentSlug, slug), location.toString())
  }

  const resultToHTML = ({ slug, url, site, title, content, tags }: Hit) => {
    const htmlTags = tags.length > 0 ? `<ul class="tags">${tags.join("")}</ul>` : ``
    const itemTile = document.createElement("a")
    itemTile.classList.add("result-card")
    itemTile.id = site ? `${site.url}:${slug}` : slug
    itemTile.dataset.url = url
    itemTile.href = url
    const siteLabel = site ? `<span class="result-site">${site.name}</span>` : ``
    if (site) {
      // another site's page: load it normally instead of morphing it into this site
      itemTile.dataset.routerIgnore = ""
      itemTile.classList.add("other-site")
    }
    itemTile.innerHTML = `
      <h3 class="card-title">${siteLabel}${title}</h3>
      ${htmlTags}
      <p class="card-description">${content}</p>
    `
    itemTile.addEventListener("click", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    })

    const handler = (event: MouseEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      hideSearch()
    }

    async function onMouseEnter(ev: MouseEvent) {
      if (!ev.target) return
      const target = ev.target as HTMLInputElement
      await displayPreview(target)
    }

    itemTile.addEventListener("mouseenter", onMouseEnter)
    window.addCleanup(() => itemTile.removeEventListener("mouseenter", onMouseEnter))
    itemTile.addEventListener("click", handler)
    window.addCleanup(() => itemTile.removeEventListener("click", handler))

    return itemTile
  }

  async function displayResults(finalResults: Hit[]) {
    removeAllChildren(results)
    if (finalResults.length === 0) {
      results.innerHTML = `<a class="result-card no-match">
          <h3>No results.</h3>
          <p>Try another search term?</p>
      </a>`
    } else {
      const cards = finalResults.map(resultToHTML)
      // a caption above the first result from another site
      const firstOther = cards.find((c) => c.classList.contains("other-site"))
      if (firstOther) firstOther.dataset.section = "In other MathStruct vaults"
      results.append(...cards)
    }

    if (finalResults.length === 0 && preview) {
      // no results, clear previous preview
      removeAllChildren(preview)
    } else {
      // focus on first result, then also dispatch preview immediately
      const firstChild = results.firstElementChild as HTMLElement
      firstChild.classList.add("focus")
      currentHover = firstChild as HTMLInputElement
      await displayPreview(firstChild)
    }
  }

  async function fetchContent(targetUrl: string): Promise<Element[]> {
    if (fetchContentCache.has(targetUrl)) {
      return fetchContentCache.get(targetUrl) as Element[]
    }

    const contents = await fetch(targetUrl)
      .then((res) => res.text())
      .then((contents) => {
        if (contents === undefined) {
          throw new Error(`Could not fetch ${targetUrl}`)
        }
        const html = p.parseFromString(contents ?? "", "text/html")
        normalizeRelativeURLs(html, targetUrl)
        return [...html.getElementsByClassName("popover-hint")]
      })

    fetchContentCache.set(targetUrl, contents)
    return contents
  }

  async function displayPreview(el: HTMLElement | null) {
    if (!searchLayout || !enablePreview || !el || !preview) return
    const url = el.dataset.url
    if (!url) return
    const innerDiv = await fetchContent(url).then((contents) =>
      contents.flatMap((el) => [...highlightHTML(currentSearchTerm, el as HTMLElement).children]),
    )
    previewInner = document.createElement("div")
    previewInner.classList.add("preview-inner")
    previewInner.append(...innerDiv)
    preview.replaceChildren(previewInner)

    // scroll to longest
    const highlights = [...preview.getElementsByClassName("highlight")].sort(
      (a, b) => b.innerHTML.length - a.innerHTML.length,
    )
    highlights[0]?.scrollIntoView({ block: "start" })
  }

  // the search options for a typed term; sets `currentSearchTerm` and `searchType` for highlighting
  function searchOptions(raw: string) {
    currentSearchTerm = raw
    searchType = raw.startsWith("#") ? "tags" : "basic"
    if (searchType === "tags") {
      currentSearchTerm = currentSearchTerm.substring(1).trim()
      const separatorIndex = currentSearchTerm.indexOf(" ")
      if (separatorIndex != -1) {
        // search by title and content index and then filter by tag (implemented in flexsearch)
        const tag = currentSearchTerm.substring(0, separatorIndex)
        const query = currentSearchTerm.substring(separatorIndex + 1).trim()
        // set search type to basic and remove tag from term for proper highlightning and scroll
        searchType = "basic"
        currentSearchTerm = query
        return {
          opts: {
            query: query,
            // return at least 10000 documents, so it is enough to filter them by tag
            limit: Math.max(numSearchResults, 10000),
            index: ["title", "content"],
            tag: { tags: tag },
          },
          truncate: true,
        }
      }
      // default search by tags index
      return {
        opts: { query: currentSearchTerm, limit: numSearchResults, index: ["tags"] },
        truncate: false,
      }
    }
    return {
      opts: { query: currentSearchTerm, limit: numSearchResults, index: ["title", "content"] },
      truncate: false,
    }
  }

  // ids of one index's results: titles ahead of content ahead of tags
  async function searchIndex(
    idx: ReturnType<typeof newIndex>,
    q: ReturnType<typeof searchOptions>,
    limit: number,
  ): Promise<number[]> {
    const searchResults = (await idx.searchAsync(
      q.opts as any,
    )) as DefaultDocumentSearchResults<Item>
    if (q.truncate) {
      for (const searchResult of searchResults) {
        searchResult.result = searchResult.result.slice(0, numSearchResults)
      }
    }
    const getByField = (field: string): number[] => {
      const results = searchResults.filter((x) => x.field === field)
      return results.length === 0 ? [] : ([...results[0].result] as number[])
    }
    const allIds: Set<number> = new Set([
      ...getByField("title"),
      ...getByField("content"),
      ...getByField("tags"),
    ])
    return [...allIds].slice(0, limit)
  }

  async function runSearch() {
    if (!searchLayout || !index) return
    const raw = searchBar.value
    searchLayout.classList.toggle("display-results", raw !== "")
    const q = searchOptions(raw)
    const term = currentSearchTerm

    const local = (await searchIndex(index, q, Infinity)).map((id) => formatForDisplay(term, id))

    // the other sites, in the order configured: up to a few results each, interleaved by rank
    const perSite: Hit[][] = []
    for (const site of otherSites) {
      const r = remoteSites.get(site.url)
      if (!r) continue
      const ids = await searchIndex(r.index, q, remoteResultsPerSite)
      perSite.push(ids.map((id) => formatForDisplay(term, id, r)))
    }
    const others: Hit[] = []
    for (let rank = 0; rank < remoteResultsPerSite; rank++) {
      for (const hits of perSite) if (hits[rank]) others.push(hits[rank])
    }

    // a newer keystroke has started its own search
    if (searchBar.value !== raw) return
    await displayResults([...local, ...others.slice(0, numSearchResults)])
  }

  async function onType() {
    await runSearch()
  }

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => document.removeEventListener("keydown", shortcutHandler))
  searchButton.addEventListener("click", () => showSearch("basic"))
  window.addCleanup(() => searchButton.removeEventListener("click", () => showSearch("basic")))
  searchBar.addEventListener("input", onType)
  window.addCleanup(() => searchBar.removeEventListener("input", onType))

  registerEscapeHandler(container, hideSearch)
  await fillDocument(data)
}

/**
 * Fills flexsearch document with data
 * @param index index to fill
 * @param data data to fill index with
 */
let indexPopulated = false
async function fillDocument(data: ContentIndex) {
  if (indexPopulated) return
  let id = 0
  const promises: Array<Promise<unknown>> = []
  for (const [slug, fileData] of Object.entries<ContentDetails>(data)) {
    promises.push(
      index.addAsync(id++, {
        id,
        slug: slug as FullSlug,
        title: fileData.title,
        content: fileData.content,
        tags: fileData.tags,
      }),
    )
  }

  await Promise.all(promises)
  indexPopulated = true
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const currentSlug = e.detail.url
  const data = await fetchData
  const searchElement = document.getElementsByClassName("search")
  for (const element of searchElement) {
    await setupSearch(element, currentSlug, data)
  }
})
