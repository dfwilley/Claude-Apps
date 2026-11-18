// Tests the puzzles of Fit the Part: every one has exactly one answer, the answers are tidy numbers,
// and the drawing's dimensions agree with them. Run: node tests/fit-the-part.test.js
const path = require("path"), fs = require("fs"), assert = require("assert");
const dir = path.join(__dirname, "../fit-the-part");
const G = require(path.join(dir, "core.js"));
const near = (a, b, msg) => assert(Math.abs(a - b) < 1e-6, `${msg || ""} expected ${b}, got ${a}`);

// ---------- numbers ----------
assert.strictEqual(G.fmt(1.5), "1.5");
assert.strictEqual(G.fmt(0.375), "0.375");
assert.strictEqual(G.fmt(2), "2");
assert.strictEqual(G.fmt(0.1 + 0.2), "0.3");
assert.strictEqual(G.parse("1.5"), 1.5);
assert.strictEqual(G.parse(".5"), 0.5);
assert.strictEqual(G.parse("2."), 2);
assert.strictEqual(G.parse("3/4"), 0.75);
assert.strictEqual(G.parse("1 1/2"), 1.5);
assert(isNaN(G.parse("")) && isNaN(G.parse(".")) && isNaN(G.parse("abc")) && isNaN(G.parse("1/0")));
assert(G.isRight(0.375, 0.375) && G.isRight(0.375, G.parse("3/8")));
assert(!G.isRight(0.375, 0.38) && !G.isRight(2, NaN));
assert.deepStrictEqual([0, 1, 2, 3, 9].map(G.stars), [3, 2, 2, 1, 1]);

// ---------- solving ----------
{
  // the slot is twice the tab, and tab + slot + tab is 4 inches
  const r = G.solve({ W: 4 }, [G.E({ s: 1, t: -2 }), G.E({ t: 2, s: 1, W: -1 })]);
  assert(r.ok); near(r.v.t, 1); near(r.v.s, 2);
  assert(!G.solve({ W: 4 }, [G.E({ s: 1, t: -2 })]).ok, "one clue short: no single answer");
  assert(!G.solve({ W: 4 }, [G.E({ t: 1 }, 1), G.E({ t: 1 }, 2), G.E({ t: 1, W: -1 })]).ok, "clues that disagree");
  assert(G.solve({ W: 4 }, [G.E({ t: 1, W: -0.25 }), G.E({ t: 4, W: -1 })]).ok, "a clue said twice is fine");
}

// ---------- every puzzle, with every set of numbers ----------
assert.strictEqual(new Set(G.PUZZLES.map((p) => p.id)).size, G.PUZZLES.length, "puzzle ids are all different");
G.LEVELS.forEach((lv, i) => assert(G.PUZZLES.filter((p) => p.level === i).length >= 5, `${lv.name} has puzzles`));
let checked = 0;
for (const p of G.PUZZLES) {
  assert(p.ask.length >= 1 && p.ask.length <= 3, `${p.id}: 1 to 3 missing numbers`);
  assert(p.sets.length >= 3, `${p.id}: at least three sets of numbers`);
  assert(p.clues.length >= 2 && p.clues.every((c) => c.sw && c.sw.length > 20), `${p.id}: clues, each with its SolidWorks note`);
  const answers = new Set();
  p.sets.forEach((set, si) => {
    const tag = `${p.id} set ${si + 1}:`, r = G.solve(set, G.eqsOf(p));
    assert(r.ok, `${tag} ${r.why}`);
    const v = G.values(p, si);
    assert.deepStrictEqual(v, r.v);
    // every value is either given or asked for, never both
    for (const q of p.ask) assert(!(q.n in set), `${tag} ${q.n} is asked for but also given`);
    assert.deepStrictEqual(Object.keys(v).sort(), Object.keys(set).concat(p.ask.map((q) => q.n)).sort(), `${tag} every value is given or asked`);
    // drop any one clue's sums and the answer is no longer pinned down: no clue is filler
    const allNames = G.E(Object.fromEntries(Object.keys(v).map((n) => [n, 0])));   // keeps every value in play
    for (const c of p.clues) if (c.eqs.length) assert(!G.solve(set, G.eqsOf(p).filter((e) => !c.eqs.includes(e)).concat(allNames)).ok, `${tag} clue "${G.clueText(c, v)}" is needed`);
    for (const q of p.ask) {
      const a = v[q.n];
      assert(a > 0, `${tag} ${q.n} is positive`);
      near(a * 1000, Math.round(a * 1000), `${tag} ${q.n} has at most 3 decimal places:`);
      assert(G.isRight(a, G.parse(G.fmt(a))), `${tag} typing the shown answer is accepted`);
    }
    answers.add(p.ask.map((q) => v[q.n]).join());

    // the drawing
    const m = p.draw(v), circle = m.outline.circle;
    const xs = circle ? [0, circle] : m.outline.map((pt) => pt[0]), ys = circle ? [0, circle] : m.outline.map((pt) => pt[1]);
    const W = Math.max(...xs), H = Math.max(...ys);
    near(Math.min(...xs), 0, `${tag} part starts at x 0`); near(Math.min(...ys), 0, `${tag} part starts at y 0`);
    assert(W / H < 6 && H / W < 2, `${tag} fits a phone screen`);
    if (!circle) {
      for (let i = 0; i < m.outline.length; i++) {
        const a = m.outline[i], b = m.outline[(i + 1) % m.outline.length];
        assert(Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.1, `${tag} no edge shrinks to nothing`);
      }
    }
    for (const h of m.holes || []) assert(h.d > 0.05 && h.x - h.d / 2 > 0 && h.x + h.d / 2 < W && h.y - h.d / 2 > 0 && h.y + h.d / 2 < H, `${tag} hole inside the part`);
    for (const c of m.cuts || []) assert(c.w > 0.05 && c.h > 0.05 && c.x - c.w / 2 > 0 && c.x + c.w / 2 < W && c.y - c.h / 2 > 0 && c.y + c.h / 2 < H, `${tag} cutout inside the part`);
    const dimmed = new Set();
    for (const d of m.dims) {
      assert(d.n in v, `${tag} dimension ${d.n} is a known value`);
      dimmed.add(d.n);
      if (d.t === "d") { near(d.d, v[d.n], `${tag} leader ${d.n}`); assert((m.holes || []).some((h) => h.x === d.x && h.y === d.y && h.d === d.d), `${tag} leader ${d.n} points at a hole`); }
      else {
        assert(["h", "v"].includes(d.t) && (d.t === "h" ? ["t", "b"] : ["l", "r"]).includes(d.side) && d.row >= 1, `${tag} dimension ${d.n} is placed`);
        near(d.b - d.a, v[d.n], `${tag} drawn size of ${d.n}:`);
        assert(d.a >= -1e-9 && d.b <= (d.t === "h" ? W : H) + 1e-9, `${tag} dimension ${d.n} is on the part`);
      }
    }
    for (const q of p.ask) assert(dimmed.has(q.n), `${tag} ${q.n} has its letter on the drawing`);
    // a given must be on the drawing or stated in a clue
    const clueWords = p.clues.map((c) => G.clueText(c, v)).join(" ");
    for (const g of Object.keys(set)) assert(dimmed.has(g) || clueWords.includes(G.fmt(set[g])), `${tag} given ${g} is shown somewhere`);

    // the words
    const how = p.how(v, G.fmt), idea = p.idea(v, G.fmt);
    assert(how.length >= 2 && how.length <= 4, `${tag} working has 2 to 4 lines`);
    for (const q of p.ask) assert(how.join(" ").includes(G.fmt(v[q.n])), `${tag} the working reaches ${q.n}`);
    assert(idea.name && idea.what && idea.steps.length >= 3, `${tag} has a part idea`);
    const words = how.concat(idea.steps, [idea.name, idea.what], p.clues.map((c) => G.clueText(c, v))).join(" ");
    assert(!/undefined|NaN|\[object|\d\.\d{4}/.test(words), `${tag} wording is clean: ${words.match(/.{0,30}(undefined|NaN|\[object|\d\.\d{4}).{0,10}/)}`);
    checked++;
  });
  assert.strictEqual(answers.size, p.sets.length, `${p.id}: each set of numbers gives different answers`);
  assert.deepStrictEqual(p.ask.map((q) => G.letter(p, q.n)), ["A", "B", "C"].slice(0, p.ask.length));
  assert.strictEqual(G.letter(p, Object.keys(p.sets[0])[0]), "");
}

// ---------- what comes next ----------
{
  const ids = G.PUZZLES.map((p) => p.id);
  assert.strictEqual(G.nextId({}, ""), ids[0]);
  assert.strictEqual(G.nextId({ [ids[0]]: { stars: 3 } }, ids[0]), ids[1]);
  assert.strictEqual(G.nextId({ [ids[1]]: { stars: 3 } }, ids[0]), ids[2], "skips solved ones");
  assert.strictEqual(G.nextId({}, ids[ids.length - 1]), ids[0], "goes round to the start");
  const all = {}; ids.forEach((id) => { all[id] = { stars: 1 }; });
  assert.strictEqual(G.nextId(all, ids[3]), ids[4], "all solved: just the next one");
  assert.strictEqual(G.byId("nope"), null);
}

// ---------- the offline copy lists every file the app needs ----------
{
  const sw = fs.readFileSync(path.join(dir, "sw.js"), "utf8");
  const listed = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]).filter((f) => f !== "./").sort();
  const onDisk = [];
  (function walk(d, pre) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name), pre + f.name + "/");
      else if (f.name !== "sw.js") onDisk.push(pre + f.name);
    }
  })(dir, "");
  assert.deepStrictEqual(listed, onDisk.sort(), "sw.js SHELL must list every file in fit-the-part/");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  for (const f of ["core.js", "app.js", "style.css", "manifest.webmanifest"]) assert(html.includes(f), `index.html uses ${f}`);
  JSON.parse(fs.readFileSync(path.join(dir, "manifest.webmanifest"), "utf8"));
}

console.log(`fit-the-part: ${G.PUZZLES.length} puzzles, ${checked} sets of numbers checked, all tests passed`);
