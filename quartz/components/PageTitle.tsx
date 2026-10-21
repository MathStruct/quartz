import { joinSegments, pathToRoot } from "../util/path"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"

interface Options {
  /** an image next to the title, as a path from the site root (e.g. "static/icon.png") */
  icon?: string
}

export default ((opts?: Options) => {
  const PageTitle: QuartzComponent = ({ fileData, cfg, displayClass }: QuartzComponentProps) => {
    const title = cfg?.pageTitle ?? i18n(cfg.locale).propertyDefaults.title
    const baseDir = pathToRoot(fileData.slug!)
    return (
      <h2 class={classNames(displayClass, "page-title")}>
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
`

  return PageTitle
}) satisfies QuartzComponentConstructor<Options>
