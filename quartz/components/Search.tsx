import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/search.scss"
// @ts-ignore
import script from "./scripts/search.inline"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { SearchSite, sitesOtherThan } from "../util/searchSites"

export type { SearchSite }

export interface SearchOptions {
  enablePreview: boolean
  /**
   * Further sites searched after this one, their results listed below this site's. The site
   * that is the longest prefix of this site's own `baseUrl` is left out (so a preview build at
   * `<site>/preview` leaves out `<site>`). Their indices load the first time the search opens.
   */
  otherSites: SearchSite[]
}

const defaultOptions: SearchOptions = {
  enablePreview: true,
  otherSites: [],
}

export default ((userOpts?: Partial<SearchOptions>) => {
  const Search: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const opts = { ...defaultOptions, ...userOpts }
    const searchPlaceholder = i18n(cfg.locale).components.search.searchBarPlaceholder
    return (
      <div class={classNames(displayClass, "search")}>
        <button class="search-button">
          <svg role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.9 19.7">
            <title>Search</title>
            <g class="search-path" fill="none">
              <path stroke-linecap="square" d="M18.5 18.3l-5.4-5.4" />
              <circle cx="8" cy="8" r="7" />
            </g>
          </svg>
          <p>{i18n(cfg.locale).components.search.title}</p>
        </button>
        <div class="search-container">
          <div class="search-space">
            <input
              autocomplete="off"
              class="search-bar"
              name="search"
              type="text"
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
            />
            <div
              class="search-layout"
              data-preview={opts.enablePreview}
              data-sites={JSON.stringify(sitesOtherThan(opts.otherSites, cfg.baseUrl))}
            ></div>
          </div>
        </div>
      </div>
    )
  }

  Search.afterDOMLoaded = script
  Search.css = style

  return Search
}) satisfies QuartzComponentConstructor
