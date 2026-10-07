import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const skins = read("app/domain/skin-catalog.json");
const cases = read("app/domain/case-catalog.json");
const source = read("reference/skin-sources.json");
const originalContents = read("app/domain/reference-case-content.json");
const contents = read("app/domain/case-content.json");
const artwork = read("reference/artwork-audit.json");
const byId = new Map(skins.map((skin) => [skin.id, skin]));
assert.equal(skins.length, 16527);
assert(skins.every((skin) => typeof skin.nameRu === "string" && skin.nameRu.length > 0));
assert.equal(byId.size, skins.length);
assert.equal(cases.length, 146);
assert.equal(new Set(cases.map((box) => box.id)).size, cases.length);
const originalSource = source.filter((item) => byId.has(item.id));
assert.equal(originalSource.length, skins.length);
for (const item of originalSource) {
  const skin = byId.get(item.id);
  assert(skin, `Missing original variant: ${item.id}`);
  assert.equal(skin.price, Math.round(item.sourcePrice * 100) / 100);
}
let occurrences = 0;
const variants = new Set();
for (const box of cases) {
  const actual = contents[box.id];
  const expected = originalContents[box.id];
  assert(actual.length > 0);
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    assert(byId.has(actual[i].skinId));
    assert.equal(actual[i].skinId, expected[i].skinId);
    assert.equal(actual[i].price, Math.round(expected[i].referencePrice * 100) / 100);
    occurrences++;
    variants.add(actual[i].skinId);
  }
}
assert.equal(occurrences, 6241);
assert.equal(variants.size, 3448);
const urls = new Set([
  ...skins.map((skin) => skin.image),
  ...cases.flatMap((box) => [box.image, box.imageBack]).filter(Boolean),
  ...read("public/reference/art/catalog.json").map((sprite) => sprite.image),
]);
for (const url of urls) {
  assert(url.startsWith("/") && !url.includes(".."));
  assert(fs.statSync(path.join(root, "public", url.slice(1))).size > 0, url);
}
for (const name of ["start", "step", "finish", "coins", "applause"]) {
  assert(fs.statSync(path.join(root, "public/reference/audio", `${name}.m4a`)).size > 0);
}
assert.equal(artwork.matchedSkins + artwork.missing.length, skins.length);
assert.equal(artwork.missingCases.length, 0);
console.log(JSON.stringify({ skins: skins.length, cases: cases.length, occurrences, distinctDrops: variants.size, verifiedImages: urls.size, originalSpriteVariants: artwork.matchedSkins, fallbackVariants: artwork.missing.length, originalSounds: 5 }, null, 2));
