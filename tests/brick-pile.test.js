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
