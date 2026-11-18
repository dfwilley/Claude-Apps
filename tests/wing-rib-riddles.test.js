// Tests the riddle list, the daily pick, the answer choices and the streak rules of Wing Rib Riddles.
// Run: node tests/wing-rib-riddles.test.js
const W = require(require("path").join(__dirname, "../wing-rib-riddles/core.js"));
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// ---------- every riddle is complete ----------
const ids = new Set(), names = new Set();
for (const it of W.ITEMS) {
  assert(/^[a-z0-9-]+$/.test(it.id), `bad id ${it.id}`);
  assert(!ids.has(it.id), `duplicate id ${it.id}`); ids.add(it.id);
  assert(!names.has(it.name), `duplicate name ${it.name}`); names.add(it.name);
  assert(W.KINDS[it.kind], `${it.id}: unknown kind`);
  assert(it.fact.length > 40 && /[.!]$/.test(it.fact), `${it.id}: fact too short or unfinished`);
  assert(it.decoys.length >= 3, `${it.id}: needs at least three wrong choices`);
  assert.strictEqual(new Set(it.decoys.map((d) => d.toLowerCase())).size, it.decoys.length, `${it.id}: repeated wrong choice`);
  assert(!it.decoys.some((d) => d.toLowerCase() === it.name.toLowerCase()), `${it.id}: the answer is among the wrong choices`);
  // the close-up window stays inside the drawing and really is a close-up
  const [x, y, s] = it.zoom;
  assert(x >= 0 && y >= 0 && x + s <= 200 && y + s <= 200, `${it.id}: close-up window leaves the drawing`);
  assert(s >= 50 && s <= 90, `${it.id}: close-up should show between a quarter and half the width`);
  // the drawing is well-formed: no leftovers from building it, every tag closed
  const pic = W.svg(it, true);
  assert(!/NaN|undefined|Infinity|\$\{/.test(pic), `${it.id}: bad value in drawing`);
  assert(pic.includes(`viewBox="${x} ${y} ${s} ${s}"`), `${it.id}: close-up viewBox`);
  assert(W.svg(it, false).includes('viewBox="0 0 200 200"'), `${it.id}: full viewBox`);
  const open = (pic.match(/<(svg|g)\b/g) || []).length, close = (pic.match(/<\/(svg|g)>/g) || []).length;
  assert.strictEqual(open, close, `${it.id}: unclosed group`);
  for (const tag of pic.match(/<(rect|circle|ellipse|path|polygon)\b[^>]*>/g) || []) assert(tag.endsWith("/>"), `${it.id}: unclosed shape ${tag}`);
  assert.strictEqual((pic.match(/<text\b/g) || []).length, (pic.match(/<\/text>/g) || []).length, `${it.id}: unclosed text`);
  assert.strictEqual((pic.match(/"/g) || []).length % 2, 0, `${it.id}: unbalanced quotes`);
  // the picture must not spell out the answer before it is given
  assert(!pic.includes(it.name), `${it.id}: the close-up gives away the answer`);
}
assert(W.ITEMS.length >= 50, "at least 50 riddles");
for (const kind of Object.keys(W.KINDS)) assert(W.ITEMS.some((it) => it.kind === kind), `no riddles of kind ${kind}`);

// ---------- the riddle of the day ----------
assert.strictEqual(W.dayNumber(new Date(2026, 0, 1)), 0);
assert.strictEqual(W.dayNumber(new Date(2026, 0, 1, 23, 59)), 0);
assert.strictEqual(W.dayNumber(new Date(2026, 10, 18)), 321);
assert.strictEqual(W.dayNumber(new Date(2027, 0, 1)), 365);
assert.strictEqual(W.dayNumber(new Date(2026, 2, 8, 12)) - W.dayNumber(new Date(2026, 2, 7, 12)), 1); // clocks change, still one day
assert.strictEqual(W.dayNumber(W.dateOfDay(321)), 321);
const n = W.ITEMS.length;
assert.strictEqual(W.dailyItem(321).id, W.dailyItem(321).id, "same day, same riddle");
for (let cycle = 0; cycle < 12; cycle++) { // every riddle comes up exactly once per pass
  const pass = new Set();
  for (let d = cycle * n; d < (cycle + 1) * n; d++) pass.add(W.dailyItem(d).id);
  assert.strictEqual(pass.size, n, `pass ${cycle} repeats a riddle`);
}
for (let d = 0; d < n * 40; d++) assert.notStrictEqual(W.dailyItem(d).id, W.dailyItem(d + 1).id, `same riddle two days running at day ${d}`);
assert.notDeepStrictEqual(Array.from({ length: n }, (_, d) => W.dailyItem(d).id), Array.from({ length: n }, (_, d) => W.dailyItem(n + d).id), "each pass is in a new order");

// ---------- four choices ----------
const slots = [0, 0, 0, 0];
for (const it of W.ITEMS) {
  for (let seed = 0; seed < 60; seed++) {
    const c = W.choicesFor(it, seed);
    assert.strictEqual(c.length, 4);
    assert.strictEqual(new Set(c).size, 4, `${it.id}: repeated choice`);
    assert.strictEqual(c.filter((x) => x === it.name).length, 1, `${it.id}: answer must appear once`);
    assert.deepStrictEqual(c, W.choicesFor(it, seed), "same seed, same choices");
    slots[c.indexOf(it.name)]++;
  }
}
for (const s of slots) assert(s > (n * 60) / 4 * 0.8, `answer position is lopsided: ${slots}`);

// ---------- more riddles ----------
const R = W.makeRng(7);
for (let i = 0; i < 200; i++) assert.notStrictEqual(W.practiceItem({}, ["cleco", "rivet"], R).id, "cleco");
const allButOne = Object.fromEntries(W.ITEMS.filter((it) => it.id !== "wing-rib").map((it) => [it.id, { r: 1, w: 0 }]));
for (let i = 0; i < 50; i++) assert.strictEqual(W.practiceItem(allButOne, [], R).id, "wing-rib", "unseen riddles come first");
const all = Object.fromEntries(W.ITEMS.map((it) => [it.id, { r: 1, w: 0 }]));
assert(W.practiceItem(all, ["cleco"], R), "still gives a riddle when all have been seen");

// ---------- streaks ----------
let s = W.recordDay(null, 10, true);
assert.deepStrictEqual(s, { last: 10, now: 1, best: 1, played: 1, right: 1 });
s = W.recordDay(s, 10, false); // a second answer the same day changes nothing
assert.deepStrictEqual(s, { last: 10, now: 1, best: 1, played: 1, right: 1 });
s = W.recordDay(s, 11, true); s = W.recordDay(s, 12, true);
assert.strictEqual(s.now, 3); assert.strictEqual(s.best, 3);
assert.strictEqual(W.liveStreak(s, 12), 3);
assert.strictEqual(W.liveStreak(s, 13), 3, "still alive the next day, before answering");
assert.strictEqual(W.liveStreak(s, 14), 0, "a missed day ends it");
s = W.recordDay(s, 14, true); // back after missing day 13
assert.strictEqual(s.now, 1); assert.strictEqual(s.best, 3);
s = W.recordDay(s, 15, false);
assert.strictEqual(s.now, 0); assert.strictEqual(s.best, 3); assert.strictEqual(s.played, 5); assert.strictEqual(s.right, 4);
s = W.recordDay(s, 16, true);
assert.strictEqual(s.now, 1, "a wrong answer yesterday does not carry a streak");
assert.strictEqual(W.liveStreak(null, 5), 0);
assert.strictEqual(W.liveStreak(W.NEW_STATS, 5), 0);

// ---------- offline list matches the files ----------
const dir = path.join(__dirname, "../wing-rib-riddles");
const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8");
const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
for (const f of shell) if (f !== "./") assert(fs.existsSync(path.join(dir, f)), `sw.js lists a missing file: ${f}`);
for (const f of ["index.html", "style.css", "core.js", "app.js", "manifest.webmanifest", "icon.svg"]) assert(shell.includes(f), `sw.js does not keep ${f} for offline use`);
assert(/const CACHE = "wrr-v\d+"/.test(sw), "cache name");

console.log(`wing-rib-riddles: all tests passed (${n} riddles)`);
