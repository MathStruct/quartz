import { siteConfig } from "./mathstruct/config"

/**
 * This repository is not a site: it is the Quartz that the MathStruct sites are built with.
 * A site's own config replaces this file at build time (mathstruct/site.sh). This one builds
 * Quartz's documentation in docs/ with the preset, as a smoke test: `npx quartz build -d docs`.
 */
export default siteConfig({
  pageTitle: "MathStruct Quartz",
  baseUrl: "mathstruct.org/quartz",
})
