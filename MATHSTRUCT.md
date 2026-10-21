# MathStruct's Quartz

This is [Quartz v4](https://quartz.jzhao.xyz) with the plugins and fixes that every
[MathStruct](https://mathstruct.org) site uses, kept in one place. Before, each site carried
its own copy of Quartz and the copies drifted apart. Now a fix or a new extension lands here
once, and every site picks it up on its next build.

| site                                                                        | repository                        | content                        |
| --------------------------------------------------------------------------- | --------------------------------- | ------------------------------ |
| [mathstruct.org](https://mathstruct.org)                                    | MathStruct/MathStruct.github.io   | `content/`                     |
| [Category Theory & ML Wiki](https://mathstruct.org/CategoryTheory-ML-Wiki/) | MathStruct/CategoryTheory-ML-Wiki | `wiki/`                        |
| [Lenticulum.jl](https://mathstruct.org/Lenticulum.jl/)                      | MathStruct/Lenticulum.jl          | staged by `docs/site/build.sh` |
| [LenticulumLM](https://mathstruct.org/LenticulumLM/)                        | MathStruct/LenticulumLM           | staged by `docs/site/build.sh` |
| [Sophia](https://mathstruct.org/Sophia/)                                    | MathStruct/Sophia                 | the repository root            |
| [Moonkale](https://mathstruct.org/Moonkale/)                                | MathStruct/Moonkale               | `markdown/`                    |

## What is added to Quartz

|                 | where                                                                 | what it does                                                                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TikZ            | `plugins/transformers/tikz.ts`, `tikzTheme.ts`                        | ` ```tikz ` fences (the Obsidian TikZJax format) compiled to SVG at build time and cached by content hash. Each diagram also gets a dark-mode variant with its colours remapped, so diagrams stay legible in dark mode and keep their hues                                                    |
| Tabs            | `plugins/transformers/tabs.ts`                                        | the Obsidian "Markdown Tabs" plugin: ` ```tabs ` blocks, e.g. the same code in Julia, Lean and Haskell. Text between the code is markdown (links, emphasis, math)                                                                                                                             |
| Typst and LaTeX | `plugins/transformers/latex.ts`                                       | math with Typst, KaTeX or MathJax, chosen per formula: a chain like `["typst", "katex"]` lets one note mix both. A page pins itself with `math: typst` or `math: latex` in its frontmatter; a ` ```typst ` fence always renders with Typst                                                    |
| Title heading   | `plugins/transformers/titleHeading.ts`                                | drops a note's leading `# <title>`, which Quartz already shows as the page title                                                                                                                                                                                                              |
| Bylines         | `components/Authors.tsx` (+ `ContentMeta`, `PageList`, `RecentNotes`) | `authors:` in the frontmatter shows "by …", linked to the person's page on mathstruct.org/people                                                                                                                                                                                              |
| Site icon       | `components/PageTitle.tsx`                                            | optional image next to the site title                                                                                                                                                                                                                                                         |
| fixes           | `ofm.ts`, `mermaid.inline.ts`, `spa.inline.ts`                        | a wikilink whose label has math or code (`[[Corelation\|$\mathbf{Corel}$]]`) no longer breaks; a Mermaid `<<trait>>` no longer swallows the diagram; links to pages on the same domain that are not part of the site (e.g. the API docs) load normally instead of being morphed into the page |
| preset          | `mathstruct/preset.ts`                                                | the shared configuration: theme, fonts, all plugins switched on, layout, giscus comments                                                                                                                                                                                                      |
| build script    | `mathstruct/site.sh`                                                  | builds one site from its config and its vault                                                                                                                                                                                                                                                 |

## How a site uses it

A site keeps only what is its own, in `site/`:

```
site/
  build.sh            fetches this repository into site/.quartz/ and calls mathstruct/site.sh
  quartz.config.ts    siteConfig({ pageTitle, baseUrl, ... })
  quartz.layout.ts    siteLayout({ footerLinks, comments, ... })
  .tikz-cache/        rendered diagrams, committed so CI only renders new ones
  static/             optional: replaces files in quartz/static/ (e.g. the site's icon.png)
```

```sh
site/build.sh            # -> site/public/
site/build.sh --serve    # live preview on http://localhost:8080
```

`site/build.sh` moves its checkout to `QUARTZ_REF` (default `main`) before every build, so a
change pushed here reaches every site the next time it is built. To hold a site at a version,
set `QUARTZ_REF` in its `build.sh` to a tag or a commit.

The options of `siteConfig` and `siteLayout` are documented in `mathstruct/preset.ts`.

## Changing it

1. Change this repository, e.g. add a plugin in `quartz/plugins/` and switch it on in
   `mathstruct/preset.ts`.
2. Try it on a site without pushing: point the site's build at this checkout,

   ```sh
   QUARTZ_DIR=~/Code/MathStruct-quartz site/build.sh --serve
   ```

3. Check `npx tsc --noEmit`, `npx prettier --check .` and `npm test`; CI runs them and builds
   Quartz's own docs (`npx quartz build -d docs`) with the preset.
4. Push to `main`. Each site picks the change up on its next deploy (or rerun the deploy
   workflow).

## Updating Quartz

This repository keeps upstream's history, so a new Quartz release is a merge:

```sh
git remote add upstream https://github.com/jackyzha0/quartz.git   # once
git fetch upstream && git merge upstream/v4
```

Our changes are small and listed above, so conflicts stay small. After merging, build a
couple of sites with `QUARTZ_DIR` before pushing.

Quartz is MIT-licensed ([LICENSE.txt](LICENSE.txt)), and so are the additions here.
