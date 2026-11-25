import { joinSegments, pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { Wordmark } from "./Wordmark"

interface Options {
  /** an image next to the title, as a path from the site root (e.g. "static/icon.png") */
  icon?: string
  /**
   * Show the math∫truct wordmark: as the title itself on the organisation site (pageTitle
   * "MathStruct"), otherwise small above the site's title, linking to mathstruct.org.
   */
  wordmark?: boolean
}

export default ((opts?: Options) => {
  const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
    const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
    const baseDir = pathToRoot(fileData.slug!)
    const isOrg = title.trim().toLowerCase() === "mathstruct"

    if (opts?.wordmark && isOrg) {
      return (
        <h2 class={classNames(displayClass, "page-title", "page-title-wordmark")}>
          <a href={baseDir} aria-label={title}>
            <Wordmark height={30} label={title} />
          </a>
        </h2>
      )
    }

    return (
      <div class={classNames(displayClass, "page-title-block")}>
        {opts?.wordmark && (
          <a class="page-title-org" href="https://mathstruct.org/" aria-label="MathStruct">
            <Wordmark height={17} />
          </a>
        )}
        <h2 class="page-title">
          <a href={baseDir}>
            {opts?.icon && (
              <img
                class="page-title-icon"
                src={joinSegments(baseDir, opts.icon)}
                alt=""
                width="28"
                height="28"
              />
            )}
            {title}
          </a>
        </h2>
      </div>
    )
  }

  PageTitle.css = `
.page-title {
  font-size: 1.75rem;
  margin: 0;
  font-family: var(--titleFont);
}
.page-title a:has(.page-title-icon) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.page-title-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}
.page-title-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.page-title-org,
.page-title-wordmark a {
  display: inline-flex;
  width: fit-content;
  color: var(--dark);
  background: none;
}
.ms-wordmark {
  display: block;
  overflow: visible;
}
`

  return PageTitle
}) satisfies QuartzComponentConstructor<Options>
