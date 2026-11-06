import test, { describe } from "node:test"
import assert from "node:assert"
import { sitesOtherThan } from "./searchSites"

const sites = [
  { name: "MathStruct", url: "mathstruct.org" },
  { name: "Lenticulum.jl", url: "mathstruct.org/Lenticulum.jl" },
  { name: "LenticulumLM", url: "mathstruct.org/LenticulumLM" },
  { name: "Sophia", url: "mathstruct.org/Sophia" },
]
const names = (baseUrl: string) => sitesOtherThan(sites, baseUrl).map((s) => s.name)

describe("sitesOtherThan", () => {
  test("leaves out the site itself", () => {
    assert.deepStrictEqual(names("mathstruct.org/Sophia"), [
      "MathStruct",
      "Lenticulum.jl",
      "LenticulumLM",
    ])
  })
  test("the org site at the root is not taken for a prefix of every site", () => {
    assert.deepStrictEqual(names("mathstruct.org/LenticulumLM"), [
      "MathStruct",
      "Lenticulum.jl",
      "Sophia",
    ])
    assert.deepStrictEqual(names("mathstruct.org"), ["Lenticulum.jl", "LenticulumLM", "Sophia"])
  })
  test("a preview build leaves out the site it previews", () => {
    assert.deepStrictEqual(names("mathstruct.org/Lenticulum.jl/preview"), [
      "MathStruct",
      "LenticulumLM",
      "Sophia",
    ])
  })
  test("protocol and trailing slashes are ignored", () => {
    assert.deepStrictEqual(names("https://mathstruct.org/Sophia/"), [
      "MathStruct",
      "Lenticulum.jl",
      "LenticulumLM",
    ])
  })
  test("a site not in the list keeps all of them", () => {
    assert.strictEqual(sitesOtherThan(sites, "example.org").length, 4)
  })
})
