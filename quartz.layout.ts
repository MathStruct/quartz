import { siteLayout } from "./mathstruct/preset"

// replaced by a site's own layout at build time; see quartz.config.ts
export const { sharedPageComponents, defaultContentPageLayout, defaultListPageLayout } = siteLayout(
  {
    footerLinks: {
      GitHub: "https://github.com/MathStruct/quartz",
      MathStruct: "https://mathstruct.org/",
    },
  },
)
