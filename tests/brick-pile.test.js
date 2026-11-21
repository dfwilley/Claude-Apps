// Tests the rules of Brick Pile: the list of bricks, the questions sent to Claude, and the check that a building
// idea uses only bricks that are in the pile. No internet is used. Run: node tests/brick-pile.test.js
const path = require("path"), fs = require("fs"), assert = require("assert");
const dir = path.join(__dirname, "../brick-pile");
const B = require(path.join(dir, "core.js"));

// ---------- names and single pieces ----------
assert.strictEqual(B.cleanName("2X4  Brick"), "2 x 4 brick");
assert.strictEqual(B.cleanName(" 1×2 Plate "), "1 x 2 plate");
assert.strictEqual(B.cleanName("1 x 2 x 2 window"), "1 x 2 x 2 window");
assert.strictEqual(B.cleanName("<b>wheel</b>"), "b wheel /b");
assert.strictEqual(B.cleanItem({ name: "", count: 2 }), null);
assert.strictEqual(B.cleanItem({ name: "brick", count: 0 }), null);
assert.strictEqual(B.cleanItem({ name: "brick", count: "lots" }), null);
assert.deepStrictEqual(B.cleanItem({ name: "2x2 Brick", kind: "cube", color: "teal", count: 3.9 }),
  { name: "2 x 2 brick", kind: "special", color: "other", count: 3, unsure: false });
assert.strictEqual(B.hex("red"), "#C91A09");
assert.strictEqual(B.hex("no such colour"), B.hex("other"));

// ---------- the pile ----------
let pile = B.addItems(B.emptyPile(), [
  { name: "2 x 4 brick", kind: "brick", color: "red", count: 4, unsure: false },
  { name: "2x4 brick", kind: "brick", color: "red", count: 2, unsure: true },
  { name: "2 x 4 brick", kind: "brick", color: "blue", count: 1, unsure: false },
  { name: "small wheel with tire", kind: "wheel", color: "black", count: 4, unsure: false },
  { name: "nothing", kind: "brick", color: "red", count: 0 }]);
assert.strictEqual(pile.items.length, 3, "the same piece in the same colour is one line");
assert.strictEqual(pile.items[0].count, 6);
assert(pile.items[0].unsure, "a line stays marked unsure once any of it was a guess");
assert.deepStrictEqual(pile.items.map((i) => i.id), [1, 2, 3]);
assert.strictEqual(pile.added, 11);
assert.strictEqual(B.total(pile.items), 11);
// a second picture adds to the first and keeps the line numbers
pile = B.addItems(pile, [{ name: "2 x 4 brick", kind: "brick", color: "blue", count: 2 }, { name: "1 x 2 plate", kind: "plate", color: "white", count: 5 }]);
assert.deepStrictEqual(pile.items.map((i) => [i.id, i.count]), [[1, 6], [2, 3], [3, 4], [4, 5]]);
assert.strictEqual(pile.nextId, 5);
// fixing a count by hand
assert.strictEqual(B.setCount(pile, 1, 5).items[0].count, 5);
assert.strictEqual(B.setCount(pile, 1, 5).items[0].unsure, false, "a count fixed by hand is no longer a guess");
assert.strictEqual(B.setCount(pile, 2, 0).items.length, 3, "zero takes the line away");
assert.strictEqual(B.setCount(pile, 2, 5000).items[1].count, 999);
assert.strictEqual(pile.items[0].count, 6, "the pile handed in is not changed");
const groups = B.grouped(pile.items);
assert.deepStrictEqual(groups.map((g) => g.kind), ["brick", "plate", "wheel"]);
assert.deepStrictEqual(groups[0].items.map((i) => i.color), ["blue", "red"]);
assert.strictEqual(B.label(pile.items[0]), "red 2 x 4 brick");

// ---------- the questions ----------
// Every object in a schema must name all its fields and allow no others, or the service rejects it.
(function walk(s, where) {
  if (s.type === "object") {
    assert.strictEqual(s.additionalProperties, false, where);
    assert.deepStrictEqual(s.required.slice().sort(), Object.keys(s.properties).sort(), where);
    for (const k of Object.keys(s.properties)) walk(s.properties[k], where + "." + k);
  } else if (s.type === "array") walk(s.items, where + "[]");
  return walk;
})(B.inventorySchema(), "inventory")(B.ideasSchema(), "ideas");
const invBody = B.inventoryBody("QUJD");
assert.strictEqual(invBody.model, "claude-opus-5-5");
assert.strictEqual(invBody.messages[0].content[0].type, "image");
assert.strictEqual(invBody.messages[0].content[0].source.data, "QUJD");
const prompt = B.ideasPrompt(pile.items, "little", ["Race car"]);
assert(prompt.includes("#1: 6 x red 2 x 4 brick (brick)"));
assert(prompt.includes("18 in all") && prompt.includes("a little kid") && prompt.includes("Race car"));
assert(!B.ideasPrompt(pile.items, "kid", []).includes("already been shown"));
assert.strictEqual(B.ideasBody(pile.items, "kid", []).messages[0].content.length, 1, "no picture is sent with the ideas question");

// ---------- checking an idea against the pile ----------
const idea = B.checkIdea(pile.items, { name: "Little car", level: "easy", about: "It rolls.", steps: ["Lay two red bricks.", " ", "Add wheels."],
  parts: [{ line: 1, count: 2 }, { line: 1, count: 1 }, { line: 3, count: 4 }, { line: 99, count: 3 }, { line: 2, count: 0 }] });
assert.deepStrictEqual(idea.parts, [{ name: "2 x 4 brick", color: "red", count: 3 }, { name: "small wheel with tire", color: "black", count: 4 }]);
assert.strictEqual(idea.pieces, 7);
assert.deepStrictEqual(idea.short, []);
assert.strictEqual(idea.steps.length, 2);
const greedy = B.checkIdea(pile.items, { name: "Big wall", level: "silly", about: "", steps: ["Stack."], parts: [{ line: 2, count: 8 }] });
assert.deepStrictEqual(greedy.short, [{ name: "2 x 4 brick", color: "blue", count: 8, have: 3 }], "wanting more than the pile holds is flagged");
assert.strictEqual(greedy.level, "medium");
assert.strictEqual(B.checkIdea(pile.items, { name: "No steps", steps: [], parts: [] }), null);
assert.strictEqual(B.checkIdeas(pile.items, { ideas: [{ name: "", steps: ["x"] }, { name: "Tower", steps: ["Stack."], parts: [] }] }).length, 1);
assert.deepStrictEqual(B.checkIdeas(pile.items, null), []);

// ---------- saying what a line really is ----------
{
  let p = B.addItems(B.emptyPile(), [{ name: "small brick", kind: "brick", color: "black", count: 4, unsure: true }, { name: "wheel", kind: "wheel", color: "black", count: 2 }, { name: "large brick", kind: "brick", color: "red", count: 3, unsure: true }]);
  const renamed = B.editItem(p, 3, { name: "2x4 Brick" });
  assert.deepStrictEqual(renamed.items[2], { id: 3, name: "2 x 4 brick", kind: "brick", color: "red", count: 3, unsure: false });
  const joined = B.editItem(p, 1, { name: "wheel", kind: "wheel" });
  assert.deepStrictEqual(joined.items.map((i) => [i.id, i.name, i.count]), [[2, "wheel", 6], [3, "large brick", 3]], "a line changed into one that exists joins it");
  assert.strictEqual(B.editItem(p, 1, { name: "" }), p, "an empty name changes nothing");
  assert.strictEqual(B.editItem(p, 99, { name: "x" }), p);
}

// ---------- counting bricks on the device (no key) ----------
const F = require(path.join(dir, "finder.js"));
assert.strictEqual(F.colourOf(201, 26, 9), "red");
assert.strictEqual(F.colourOf(120, 14, 6), "red", "the shaded side of a red brick is still red");
assert.strictEqual(F.colourOf(0, 85, 191), "blue");
assert.strictEqual(F.colourOf(242, 205, 55), "yellow");
assert.strictEqual(F.colourOf(35, 120, 65), "green");
assert.strictEqual(F.colourOf(240, 138, 28), "orange");
assert.strictEqual(F.colourOf(244, 244, 244), "white");
assert.strictEqual(F.colourOf(27, 27, 27), "black");
assert.strictEqual(F.colourOf(160, 165, 169), "light gray");
{
  // A made-up picture: a pale table, slightly uneven, with bricks painted on it as plain rectangles.
  const w = 320, h = 240, px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const k = (i * 7919) % 9; px.set([232 + k, 228 + k, 220 + k, 255], i * 4); }
  const paint = (x0, y0, bw, bh, c) => { for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) px.set([c[0], c[1], c[2], 255], (y * w + x) * 4); };
  const red = [201, 26, 9], blue = [0, 85, 191], yellow = [242, 205, 55], black = [27, 27, 27];
  paint(30, 30, 40, 20, red); paint(30, 70, 40, 20, red); paint(100, 30, 20, 40, red); // three red 2 x 4
  paint(160, 30, 20, 20, blue); paint(200, 30, 20, 20, blue); paint(240, 30, 20, 20, blue); paint(160, 80, 20, 20, blue); // four blue 2 x 2
  paint(30, 140, 20, 10, yellow); paint(70, 140, 10, 20, yellow); // two yellow 1 x 2
  paint(140, 150, 20, 20, black); // one black 2 x 2
  paint(34, 52, 40, 3, [205, 201, 194]); // a soft shadow under a brick: not a piece
  paint(250, 200, 3, 3, red); // a speck: not a piece
  const found = F.findBricks(px, w, h), got = {}; found.items.forEach((i) => { got[`${i.color} ${i.name}`] = i.count; });
  assert.deepStrictEqual(got, { "red large brick": 3, "blue medium brick": 4, "yellow small brick": 2, "black medium brick": 1 });
  assert(found.items.every((i) => i.unsure && B.cleanItem(i)), "every line is marked as a guess and fits the pile");
  assert.strictEqual(found.table, "white");
  // an empty table has no bricks, and so does a table of one flat colour
  assert.deepStrictEqual(F.findBricks(new Uint8ClampedArray(w * h * 4).fill(200), w, h).items, []);
  // a dark table with pale bricks works too
  const dark = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) dark.set([40, 42, 48, 255], i * 4);
  for (let y = 100; y < 120; y++) for (let x = 100; x < 140; x++) dark.set([244, 244, 244, 255], (y * w + x) * 4);
  assert.deepStrictEqual(F.findBricks(dark, w, h).items.map((i) => [i.color, i.count]), [["white", 1]]);
}

// ---------- the built-in ideas (no key) ----------
const U = require(path.join(dir, "builds.js"));
assert(U.BUILDS.length >= 30, "at least 30 built-in builds");
assert.strictEqual(new Set(U.BUILDS.map((b) => b.id)).size, U.BUILDS.length, "build ids are all different");
B.LEVELS.forEach((lv) => assert(U.BUILDS.filter((b) => b.level === lv).length >= 5, `there are ${lv} builds`));
const over = (p, q) => p.x < q.x + q.type.w && q.x < p.x + p.type.w;
for (const b of U.BUILDS) {
  const ps = U.piecesOf(b);
  assert(b.name && b.about && ps.length >= 3 && ps.length <= 40, `${b.id}: a name, a line about it, and 3 to 40 pieces`);
  for (const p of ps) {
    assert(!ps.some((q) => q !== p && q.row === p.row && over(p, q)), `${b.id}: two pieces in layer ${p.row + 1} are in the same place`);
    assert(p.row === 0 || ps.some((q) => q.row === p.row - 1 && over(p, q)), `${b.id}: a ${p.type.name} in layer ${p.row + 1} has nothing under it`);
    assert(p.type.shape !== "wheel" || p.row === 0, `${b.id}: wheels go at the bottom`);
  }
  for (const g of Object.keys(b.like || {})) { assert(ps.some((p) => p.group === g), `${b.id}: colour group ${g} is used`); b.like[g].forEach((c) => assert(B.COLOR_NAMES.includes(c), `${b.id}: ${c}`)); }
}
assert.strictEqual(U.sizeOf({ name: "2 x 4 brick", kind: "brick" }), "large");
assert.strictEqual(U.sizeOf({ name: "2 x 3 plate", kind: "plate" }), "medium");
assert.strictEqual(U.sizeOf({ name: "1 x 2 tile", kind: "tile" }), "small");
assert.strictEqual(U.sizeOf({ name: "small brick", kind: "brick" }), "small");
assert.strictEqual(U.sizeOf({ name: "small wheel with tire", kind: "wheel" }), "wheel");
{
  // A pile with plenty of everything can make every build, with every piece the real thing.
  const kinds = [["2 x 4 brick", "brick"], ["2 x 2 brick", "brick"], ["1 x 4 brick", "brick"], ["1 x 2 brick", "brick"], ["1 x 1 brick", "brick"], ["2 x 8 plate", "plate"], ["2 x 6 plate", "plate"],
    ["2 x 4 plate", "plate"], ["2 x 2 plate", "plate"], ["1 x 2 plate", "plate"], ["2 x 2 roof slope", "slope"], ["1 x 1 round brick", "round"]];
  const raw = []; for (const c of ["red", "blue", "yellow", "green", "white"]) for (const [name, kind] of kinds) raw.push({ name, kind, color: c, count: 20 });
  raw.push({ name: "wheel", kind: "wheel", color: "black", count: 8 }, { name: "1 x 2 clear brick", kind: "brick", color: "clear", count: 8 });
  const rich = B.addItems(B.emptyPile(), raw).items;
  for (const b of U.BUILDS) {
    const { pieces, got, missing } = U.plan(b, rich);
    assert.strictEqual(missing, 0, `${b.id} can be built from a big pile`);
    pieces.forEach((p, k) => assert.strictEqual(got[k].name, p.type.name, `${b.id}: a ${p.type.name} is filled by the real thing, not ${got[k].name}`));
    for (const g of new Set(pieces.map((p) => p.group).filter(Boolean)))
      assert.strictEqual(new Set(pieces.map((p, k) => (p.group === g && !p.type.clear ? got[k].color : null)).filter(Boolean)).size, 1, `${b.id}: group ${g} is one colour`);
    const d = U.idea(b, rich);
    assert.strictEqual(d.steps.length, b.rows.length); assert.strictEqual(d.pieces, pieces.length); assert.strictEqual(d.draw.shapes.length, pieces.length);
    assert(d.draw.shapes.every((s) => s.x >= 0 && s.y >= -1e-9 && s.x + s.w <= d.draw.w && s.y + s.h <= d.draw.h + 1e-9 && s.color), `${b.id}: the picture fits its frame`);
  }
  const frog = U.idea(U.BUILDS.find((b) => b.id === "tree"), rich);
  assert(frog.parts.some((p) => p.color === "green"), "a tree's leaves are green when the pile has green");
  // The rough pile that the on-device count gives (no wheels, no slopes, no exact sizes) still gets real ideas.
  const rough = B.addItems(B.emptyPile(), [{ name: "large brick", kind: "brick", color: "red", count: 4 }, { name: "medium brick", kind: "brick", color: "blue", count: 5 },
    { name: "small brick", kind: "brick", color: "yellow", count: 3 }]).items;
  const first = U.suggest(rough, "little", [], 3);
  assert.strictEqual(first.length, 3); assert(first.every((d) => d.missing === 0 && d.level === "easy"), "a little kid gets easy builds the pile can make");
  // No idea ever uses more of a line than the pile holds.
  for (const d of U.suggest(rough, "kid", [], 99)) for (const part of d.parts) assert(part.count <= rough.find((i) => i.name === part.name && i.color === part.color).count, `${d.id} takes too many ${part.color} ${part.name}`);
  // Asking again gives different builds, and it stops when there are none left.
  const second = U.suggest(rough, "little", first.map((d) => d.id), 3);
  assert(second.every((d) => !first.some((f) => f.id === d.id)));
  assert.deepStrictEqual(U.suggest(rough, "kid", U.BUILDS.map((b) => b.id), 3), []);
  // Wheels are never faked: a car is offered as "almost" with the wheels listed as missing.
  const car = U.idea(U.BUILDS.find((b) => b.id === "car"), rough);
  assert.deepStrictEqual(car.lacking.find((p) => p.name === "wheel"), { name: "wheel", count: 2 });
  assert(car.draw.shapes.some((s) => s.s === "wheel" && s.color === null));
  assert.deepStrictEqual(U.suggest([], "kid", [], 3), [], "an empty pile gets no ideas");
}

// ---------- talking to the service (a stand-in, not the real one) ----------
assert(B.looksLikeKey("sk-ant-" + "a".repeat(30)) && !B.looksLikeKey("hello") && !B.looksLikeKey(""));
const reply = (status, bodyObj) => async () => ({ ok: status < 400, status, json: async () => bodyObj });
const fails = async (fn, re) => { try { await fn(); } catch (e) { assert(re.test(e.message), e.message); return; } assert.fail("should have failed"); };
(async () => {
  let sent;
  const ok = await B.ask("sk-test", invBody, async (url, opt) => { sent = { url, opt };
    return { ok: true, status: 200, json: async () => ({ stop_reason: "end_turn", usage: { input_tokens: 2000, output_tokens: 500 },
      content: [{ type: "thinking", thinking: "" }, { type: "text", text: "{\"items\":[],\"note\":\"hi\"}" }] }) }; });
  assert.strictEqual(sent.url, "https://api.anthropic.com/v1/messages");
  assert.strictEqual(sent.opt.headers["x-api-key"], "sk-test");
  assert.strictEqual(sent.opt.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.strictEqual(ok.result.note, "hi");
  assert.strictEqual(B.cost(ok.usage).toFixed(3), "0.018");
  assert.strictEqual(B.cost(null), 0);
  await fails(() => B.ask("k", invBody, reply(401, {})), /key was not accepted/);
  await fails(() => B.ask("k", invBody, reply(429, { error: { message: "slow down" } })), /busy.*slow down/);
  await fails(() => B.ask("k", invBody, reply(400, { error: { message: "Your credit balance is too low" } })), /no credit/);
  await fails(() => B.ask("k", invBody, reply(529, {})), /had a problem/);
  await fails(() => B.ask("k", invBody, reply(200, { stop_reason: "refusal", content: [] })), /declined/);
  await fails(() => B.ask("k", invBody, reply(200, { stop_reason: "max_tokens", content: [] })), /fewer bricks/);
  await fails(() => B.ask("k", invBody, reply(200, { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] })), /unreadable/);
  await fails(() => B.ask("k", invBody, async () => { throw new Error("offline"); }), /internet/);

  // ---------- pictures ----------
  assert.deepStrictEqual(B.fitSize(4032, 3024, 1568), { w: 1568, h: 1176 });
  assert.deepStrictEqual(B.fitSize(800, 600, 1568), { w: 800, h: 600 }, "a small picture is not blown up");

  // ---------- the files the app needs offline are all there, and the page may only reach Anthropic ----------
  const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8");
  for (const f of JSON.parse(sw.match(/const SHELL = (\[[^;]+\]);/)[1])) if (f !== "./") assert(fs.existsSync(path.join(dir, f)), `sw.js lists ${f}`);
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  assert(/connect-src 'self' https:\/\/api\.anthropic\.com;/.test(html), "the page may contact Anthropic and nothing else");
  for (const f of fs.readdirSync(dir)) if (/\.(js|html|json|webmanifest)$/.test(f)) assert(!/sk-ant-[\w-]{20,}/.test(fs.readFileSync(path.join(dir, f), "utf8")), `no key in ${f}`);
  console.log("brick-pile: all tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
