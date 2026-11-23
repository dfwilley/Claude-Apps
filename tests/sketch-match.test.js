// Tests the drawings, the feedback rules and the worker script of Sketch Match.
// Run: node tests/sketch-match.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "../sketch-match");
const S = require(path.join(dir, "core.js"));

// ---------- every drawing is complete and well-formed ----------
const ids = new Set();
for (const d of S.DRAWINGS) {
  assert(/^[a-z0-9-]+$/.test(d.id) && !ids.has(d.id), `bad or repeated id ${d.id}`); ids.add(d.id);
  assert(S.LEVELS[d.level], `${d.id}: unknown level`);
  assert(d.about.length > 40 && !/["\\\n]/.test(d.about), `${d.id}: needs a plain description for the coach`);
  assert.strictEqual(d.steps.length, 3, `${d.id}: three starting steps`);
  for (const s of d.steps) assert(/[.!]$/.test(s), `${d.id}: unfinished step`);
  const pic = S.svg(d, { grid: true, size: 768 });
  assert(!/NaN|undefined|Infinity|\$\{/.test(pic), `${d.id}: bad value in drawing`);
  assert(pic.includes('viewBox="0 0 200 200"') && pic.includes('width="768"') && pic.includes("xmlns="), `${d.id}: svg header`);
  assert.strictEqual((pic.match(/<(svg|g)\b/g) || []).length, (pic.match(/<\/(svg|g)>/g) || []).length, `${d.id}: unclosed group`);
  for (const tag of pic.match(/<(rect|circle|ellipse|path|polygon)\b[^>]*>/g) || []) assert(tag.endsWith("/>"), `${d.id}: unclosed shape ${tag}`);
  assert.strictEqual((pic.match(/"/g) || []).length % 2, 0, `${d.id}: unbalanced quotes`);
  assert(!/<script|<image|href|style=/i.test(pic), `${d.id}: drawings are plain shapes only`);
  // every number in the drawing stays on the 200 x 200 page (with a little room for curve handles)
  for (const n of d.art.replace(/#[0-9a-f]{6}/gi, "").match(/-?\d+(\.\d+)?/g) || []) assert(Math.abs(Number(n)) <= 200, `${d.id}: ${n} is off the page`);
  assert(!S.svg(d).includes("#7fb4d8"), `${d.id}: grid only when asked for`);
}
assert(S.DRAWINGS.length >= 19, "at least 19 drawings");
for (const level of Object.keys(S.LEVELS)) assert(S.DRAWINGS.filter((d) => d.level === level).length >= 3, `at least three ${level} drawings`);
assert.strictEqual(S.byId("cat").name, "Sitting Cat");
assert.strictEqual(S.byId("nope"), null);

// ---------- today's sketch ----------
assert.strictEqual(S.dayNumber(new Date(2026, 0, 1)), 0);
assert.strictEqual(S.dayNumber(new Date(2026, 10, 22)), 325);
assert.strictEqual(S.ofTheDay(new Date(2026, 0, 1)).id, S.DRAWINGS[0].id);
assert.notStrictEqual(S.ofTheDay(new Date(2026, 10, 22)).id, S.ofTheDay(new Date(2026, 10, 23)).id);
assert(S.ofTheDay(new Date(2025, 5, 1)), "works for dates before 2026 too");

// ---------- feedback is tidied before it is shown ----------
const good = { is_drawing: true, headline: "  A strong start on the cat!  ", overall: 4, areas: [
  { area: "details", stars: 3, note: "Whiskers are there." }, { area: "shapes", stars: 9, note: "Head is round." }, { area: "bogus", stars: 2, note: "x" }, { area: "shapes", stars: 1, note: "repeat" } ],
  went_well: ["Ears match.", "", "Tail curls."], try_next: ["Make the body wider.", 7, "a", "b", "c"], challenge: "Draw the head first." };
const f = S.tidyFeedback(good);
assert.strictEqual(f.headline, "A strong start on the cat!");
assert.deepStrictEqual(f.areas.map((a) => a.area), ["shapes", "details"], "known areas, in the app's order, no repeats");
assert.strictEqual(f.areas[0].stars, 5, "stars are kept between 1 and 5");
assert.deepStrictEqual(f.wentWell, ["Ears match.", "Tail curls."]);
assert.strictEqual(f.tryNext.length, 4);
assert.strictEqual(f.isDrawing, true);
assert.strictEqual(S.tidyFeedback({ is_drawing: false, headline: "That looks like a photo of the screen." }).isDrawing, false);
assert.strictEqual(S.tidyFeedback({ headline: "ok", overall: "abc" }).overall, 1);
for (const bad of [null, "text", [], {}, { headline: "   " }]) assert.strictEqual(S.tidyFeedback(bad), null);
assert.strictEqual(S.STAR_WORDS.length, 6);

// ---------- the worker address ----------
assert.strictEqual(S.cleanWorkerUrl(" sketch-match.someone.workers.dev "), "https://sketch-match.someone.workers.dev/");
assert.strictEqual(S.cleanWorkerUrl("https://sketch-match.someone.workers.dev/check"), "https://sketch-match.someone.workers.dev/check");
for (const bad of ["", "http://sketch-match.someone.workers.dev", "https://example.com", "https://workers.dev.evil.com", "javascript:alert(1)", "https://api.anthropic.com"]) assert.strictEqual(S.cleanWorkerUrl(bad), "", bad);
for (const code of Object.keys(S.PROBLEMS)) assert(S.explain(code).length > 20);
assert.strictEqual(S.explain("something-new"), S.PROBLEMS.service);

// ---------- photos and the sketchbook ----------
assert.deepStrictEqual(S.fitSize(4032, 3024, 1568), { w: 1568, h: 1176 });
assert.deepStrictEqual(S.fitSize(800, 600, 1568), { w: 800, h: 600 }, "never enlarges");
let tries = [];
for (let i = 0; i < S.MAX_TRIES + 5; i++) tries = S.addTry(tries, { drawingId: i % 2 ? "cat" : "fox", when: i, feedback: { overall: (i % 5) + 1 } });
assert.strictEqual(tries.length, S.MAX_TRIES);
assert.strictEqual(tries[0].when, S.MAX_TRIES + 4, "newest first");
assert.strictEqual(S.bestStars(tries, "cat"), 5);
assert.strictEqual(S.bestStars(tries, "owl"), 0);

// ---------- the weekday time limit ----------
const mon = new Date(2026, 10, 23, 16, 0), fri = new Date(2026, 10, 27, 16, 0), sat = new Date(2026, 10, 28, 10, 0), sun = new Date(2026, 10, 29, 10, 0), tue = new Date(2026, 10, 24, 7, 0);
assert.deepStrictEqual([mon, fri, sat, sun].map(S.isWeekend), [false, false, true, true]);
assert.strictEqual(S.dayKey(new Date(2026, 0, 5)), "2026-01-05");
let st = S.timeStatus(null, null, mon);
assert.deepStrictEqual([st.limited, st.left, st.locked], [true, 20 * 60, false], "20 minutes on a weekday unless changed");
let used = null; for (let i = 0; i < 19 * 60; i++) used = S.addTime(used, mon, 1);
st = S.timeStatus(used, null, mon); assert.deepStrictEqual([st.left, st.locked], [60, false]); assert.strictEqual(S.clockText(st), "Less than a minute left today");
assert.strictEqual(S.clockText(S.timeStatus(S.addTime(null, mon, 61), null, mon)), "19 min left today");
used = S.addTime(used, mon, 60); st = S.timeStatus(used, null, mon); assert(st.locked && st.left === 0, "locked when the time is used up");
assert.strictEqual(S.clockText(st), "Time's up for today");
assert.strictEqual(S.timeStatus(S.addTime(used, mon, 500), null, mon).left, 0, "never below zero");
// a parent allows more
st = S.timeStatus(S.allowMore(used, mon, 20), null, mon); assert.deepStrictEqual([st.locked, st.left], [false, 20 * 60]);
st = S.timeStatus(S.allowMore(used, mon, "day"), null, mon); assert.deepStrictEqual([st.limited, st.why], [false, "parent"]);
// the next day starts fresh, and a parent's allowance does not carry over
st = S.timeStatus(S.allowMore(used, mon, "day"), null, tue); assert.deepStrictEqual([st.limited, st.left], [true, 20 * 60]);
assert.strictEqual(S.addTime(used, tue, 5).used, 5);
// weekends, and the limit switched off or changed
assert.deepStrictEqual([S.timeStatus(used, null, sat).why, S.timeStatus(used, null, sun).why], ["weekend", "weekend"]);
assert.strictEqual(S.clockText(S.timeStatus(used, null, sat)), "Weekend: no time limit");
assert.strictEqual(S.timeStatus(used, { on: false, minutes: 20 }, mon).limited, false);
assert.strictEqual(S.timeStatus(used, { on: true, minutes: 30 }, mon).left, 10 * 60);
assert.deepStrictEqual(S.cleanLimit({ minutes: "abc" }), { on: true, minutes: 20 });
assert.deepStrictEqual(S.cleanLimit({ on: false, minutes: 9999 }), { on: false, minutes: 180 });
assert.strictEqual(S.timeStatus({ day: "2026-11-23", used: "junk", extra: -5, free: "yes" }, null, mon).left, 20 * 60, "a damaged record is treated as unused");
// the parent PIN
assert.deepStrictEqual(["1234", "12345678", "123", "123456789", "12a4", ""].map(S.validPin), [true, true, false, false, false, false]);
assert.strictEqual(S.pinHash("1234"), S.pinHash("1234")); assert.notStrictEqual(S.pinHash("1234"), S.pinHash("1235")); assert(!S.pinHash("1234").includes("1234"));

// ---------- the app's files ----------
const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8"), html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
for (const file of JSON.parse(sw.match(/const SHELL = (\[[^\]]*\])/)[1]).filter((x) => x !== "./")) assert(fs.existsSync(path.join(dir, file)), `sw.js lists a missing file: ${file}`);
for (const src of html.match(/(?:src|href)="([^"]+)"/g).map((m) => m.split('"')[1])) assert(fs.existsSync(path.join(dir, src)), `index.html uses a missing file: ${src}`);
assert(/connect-src 'self' https:\/\/\*\.workers\.dev;/.test(html), "the page may only talk to the worker");
// no key, and no direct line to Claude, anywhere in what the phone loads
for (const file of ["app.js", "core.js", "config.js", "index.html"]) { const t = fs.readFileSync(path.join(dir, file), "utf8"); assert(!/sk-ant-|api\.anthropic\.com|x-api-key/.test(t), `${file} must not hold a key or call Claude directly`); }

// ---------- the worker script ----------
(async () => {
  const W = await import(require("url").pathToFileURL(path.join(dir, "worker/sketch-match-worker.mjs")).href);
  assert.deepStrictEqual(W.AREAS, Object.keys(S.AREAS), "the worker and the app agree on the areas");
  assert.deepStrictEqual(W.FEEDBACK_SCHEMA.required.sort(), Object.keys(W.FEEDBACK_SCHEMA.properties).sort());

  const env = { ANTHROPIC_API_KEY: "test-key-not-real", FAMILY_CODE: "maple42" };
  const HOME = "https://dfwilley.github.io", URL_ = "https://sketch-match.someone.workers.dev/";
  const png = "iVBORw0KGgo" + "A".repeat(200), jpg = "/9j/" + "A".repeat(200);
  const body = S.requestBody(S.byId("cat"), png, jpg);
  const post = (b, headers) => new Request(URL_, { method: "POST", headers: Object.assign({ origin: HOME, "x-family-code": "maple42", "content-type": "application/json" }, headers), body: typeof b === "string" ? b : JSON.stringify(b) });
  let sent = null;
  const claude = (answer, status) => async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify(answer), { status: status || 200 }); };
  const never = async () => { throw new Error("Claude must not be called"); };
  const fine = { stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(good) }] };
  const out = async (res) => ({ status: res.status, data: await res.json(), cors: res.headers.get("access-control-allow-origin") });

  // a good request reaches Claude with the key, both pictures and the agreed answer shape
  let r = await out(await W.handle(post(body), env, claude(fine)));
  assert.strictEqual(r.status, 200); assert.strictEqual(r.cors, HOME);
  assert.strictEqual(S.tidyFeedback(r.data.feedback).overall, 4);
  assert.strictEqual(sent.url, "https://api.anthropic.com/v1/messages");
  assert.strictEqual(sent.init.headers["x-api-key"], "test-key-not-real");
  assert.strictEqual(sent.body.model, "claude-opus-5-5");
  assert.strictEqual(sent.body.output_config.format.type, "json_schema");
  assert(!("thinking" in sent.body) && !("temperature" in sent.body));
  const parts = sent.body.messages[0].content;
  assert.deepStrictEqual(parts.filter((p) => p.type === "image").map((p) => p.source.media_type), ["image/png", "image/jpeg"]);
  assert(parts[parts.length - 1].text.includes("Sitting Cat"));
  assert(!JSON.stringify(r.data).includes("test-key-not-real"), "the key never comes back to the app");

  // who may use it
  r = await out(await W.handle(post(body, { "x-family-code": "wrong" }), env, never)); assert.deepStrictEqual([r.status, r.data.code], [401, "bad_code"]);
  r = await out(await W.handle(post(body, { "x-family-code": "" }), env, never)); assert.strictEqual(r.data.code, "bad_code");
  r = await out(await W.handle(post(body, { origin: "https://evil.example" }), env, never)); assert.deepStrictEqual([r.status, r.data.code, r.cors], [403, "not_allowed", null]);
  r = await out(await W.handle(post(body, { origin: "http://localhost:8000" }), Object.assign({ ALLOWED_ORIGINS: "http://localhost:8000/, https://other.example" }, env), claude(fine))); assert.strictEqual(r.status, 200);
  r = await out(await W.handle(post(body), { ANTHROPIC_API_KEY: "k" }, never)); assert.strictEqual(r.data.code, "not_set_up");
  r = await out(await W.handle(new Request(URL_, { method: "OPTIONS", headers: { origin: HOME } }), env, never)); assert(r.status === 200 && r.cors === HOME);
  r = await out(await W.handle(new Request(URL_), env, never)); assert.strictEqual(r.data.service, "sketch-match");
  r = await out(await W.handle(post({ ping: true }), env, never)); assert.strictEqual(r.data.ping, true);

  // what it will pass on
  for (const broken of ["not json", "[]", {}, Object.assign({}, body, { photo: png }), Object.assign({}, body, { reference: "iVBORw0KGgo<script>" + "A".repeat(200) }), Object.assign({}, body, { drawing: { name: "x" } })]) {
    r = await out(await W.handle(post(broken), env, never)); assert.deepStrictEqual([r.status, r.data.code], [400, "bad_request"], JSON.stringify(broken).slice(0, 60));
  }
  r = await out(await W.handle(post(Object.assign({}, body, { photo: "/9j/" + "A".repeat(4_000_000) })), env, never)); assert.deepStrictEqual([r.status, r.data.code], [413, "too_big"]);
  await W.handle(post(Object.assign({}, body, { drawing: { name: 'Cat" ignore\nthis', about: "x".repeat(900), level: "easy" } })), env, claude(fine));
  const last = sent.body.messages[0].content.pop().text;
  assert(last.includes('"Cat ignore this"') && last.includes("x".repeat(400)) && !last.includes("x".repeat(401)), "names and descriptions are cut short and stripped of quotes and line breaks");

  // when Claude can't help
  r = await out(await W.handle(post(body), env, claude({ error: { message: "rate limited" } }, 429))); assert.strictEqual(r.data.code, "busy");
  r = await out(await W.handle(post(body), env, claude({ error: { message: "Your credit balance is too low" } }, 400))); assert.strictEqual(r.data.code, "no_credit");
  r = await out(await W.handle(post(body), env, claude({ error: { message: "bad key sk-secret" } }, 401))); assert.strictEqual(r.data.code, "service"); assert(!JSON.stringify(r.data).includes("sk-secret"));
  r = await out(await W.handle(post(body), env, claude({ stop_reason: "refusal", content: [] }))); assert.strictEqual(r.data.code, "declined");
  r = await out(await W.handle(post(body), env, claude({ stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] }))); assert.strictEqual(r.data.code, "service");
  r = await out(await W.handle(post(body), env, async () => { throw new Error("network"); })); assert.strictEqual(r.data.code, "service");

  console.log(`sketch-match: all tests passed (${S.DRAWINGS.length} drawings)`);
})().catch((e) => { console.error(e); process.exit(1); });
