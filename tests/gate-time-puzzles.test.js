// Tests the puzzle makers, grading and levels of Gate Time Puzzles. Run: node tests/gate-time-puzzles.test.js
const P = require(require("path").join(__dirname, "../gate-time-puzzles/core.js"));
const assert = require("assert");

// ---------- helpers ----------
assert.strictEqual(P.hdg(47 + 180), "227");
assert.strictEqual(P.hdg(0), "360");
assert.strictEqual(P.hdg(-10), "350");
assert.strictEqual(P.rwy(9 + 18), "27");
assert.strictEqual(P.rwy(27 + 18), "09");
assert.strictEqual(P.rwy(18 + 18), "36");
assert.strictEqual(P.rwyNum(0), 36);
assert.strictEqual(P.fracStr(22, 16), "1 3/8");
assert.strictEqual(P.fracStr(6, 16), "3/8");
assert.strictEqual(P.fracStr(32, 16), "2");
assert.strictEqual(P.hhmm(14 * 60 + 35 + 420), "2135");
assert.strictEqual(P.hhmm(20 * 60 + 420), "0300"); // wraps past midnight
assert.strictEqual(P.dur(48), "48 min");
assert.strictEqual(P.dur(140), "2 h 20 min");
assert.strictEqual(P.dur(120), "2 h");
assert.strictEqual(P.secs(90), "1 min 30 s");
assert.strictEqual(P.dec(5 / 16), "0.3125");

// ---------- every recipe at every level makes a clean 4-choice puzzle ----------
let made = 0;
for (const rec of P.RECIPES) {
  for (let L = rec.min; L <= 10; L++) {
    for (let seed = 0; seed < 250; seed++) {
      const R = P.makeRng(seed * 7919 + L * 31 + rec.id.length);
      const p = rec.gen(L, R);
      if (!p) continue; // recipe gave up; makePuzzle retries
      assert(p.text && p.how && p.answer !== undefined, `${rec.id} L${L} missing parts`);
      const all = [p.text, p.big || "", (p.mono || []).join(" "), p.how, String(p.answer), ...p.pool.map(String)].join(" ");
      assert(!/NaN|undefined|Infinity/.test(all), `${rec.id} L${L} seed ${seed} bad text: ${all}`);
      made++;
    }
  }
}
for (const cat of Object.keys(P.CATS)) {
  for (let L = 1; L <= 10; L++) {
    const R = P.makeRng(1000 + L);
    for (let i = 0; i < 400; i++) {
      const p = P.makePuzzle(cat, L + 0.5, R);
      assert.strictEqual(p.options.length, 4, "4 options");
      assert.strictEqual(new Set(p.options).size, 4, `options must differ: ${p.id} ${p.options}`);
      assert.strictEqual(p.options[p.correct], p.answer, "correct index points at the answer");
      assert(p.level === L);
      assert(P.RECIPES.find((g) => g.id === p.id).min <= L, "no recipe above the level");
    }
  }
}

// ---------- spot-check answers by re-doing the arithmetic from the question ----------
const R = P.makeRng(42);
const gen = (id, L) => P.RECIPES.find((g) => g.id === id).gen(L, R);
for (let i = 0; i < 300; i++) {
  const L = 1 + (i % 10);
  // mental math: evaluate the expression
  const a = gen("arith", L);
  const expr = a.big.replace(/,/g, "").replace("×", "*").replace("÷", "/").replace("−", "-");
  assert.strictEqual(P.num(eval(expr)), a.answer, "arith " + a.big);
  // reciprocal
  const r = gen("recip", L), h = +r.text.match(/of (\d{3})/)[1];
  assert.strictEqual(r.answer, P.hdg(h + 180) + "°");
  // Tucson local to Zulu (UTC-7)
  if (L >= 2 && L <= 4) {
    const z = gen("zulu", L), t = z.text.match(/It's (\d\d)(\d\d)/);
    assert.strictEqual(z.answer, P.hhmm(+t[1] * 60 + +t[2] + 420) + "Z");
  }
  // shortest turn really is shortest
  const tr = gen("turn", L), [, h1, h2] = tr.text.match(/heading (\d{3})°.*heading (\d{3})°/);
  const d = (((+h2 - +h1) % 360) + 360) % 360;
  assert.strictEqual(tr.answer, d < 180 ? `Right ${d}°` : `Left ${360 - d}°`);
  // CG
  if (L >= 3) {
    const c = gen("cg", L);
    const items = c.mono.map((s) => s.match(/(\d+) lb at (\d+) in/).slice(1).map(Number));
    const cg = items.reduce((s, [w, x]) => s + w * x, 0) / items.reduce((s, [w]) => s + w, 0);
    assert.strictEqual(c.answer, `${P.num(cg, 1)} in`);
  }
  // crosswind
  if (L >= 3) {
    const x = gen("xwind", L), [, rw, wd, sp] = x.text.match(/Runway (\d\d), wind (\d{3})° at (\d+)/).map(Number);
    const ang = (Math.abs(((wd - rw * 10 + 540) % 360) - 180) * Math.PI) / 180;
    const want = /headwind/.test(x.text) ? Math.round(sp * Math.cos(ang)) : Math.round(sp * Math.sin(ang));
    assert.strictEqual(x.answer, `${want} kt`, x.text);
  }
}
// the classic examples
assert.strictEqual(P.grade({ correct: true, seconds: 10 }), "OKU");
assert.strictEqual(P.grade({ correct: true, seconds: 30 }), "OK");
assert.strictEqual(P.grade({ correct: true, seconds: 50 }), "F");
assert.strictEqual(P.grade({ correct: false, seconds: 5 }), "NG");
assert.strictEqual(P.grade({ timedOut: true }), "B");
assert.strictEqual(P.grade({ skipped: true }), "WO");
assert.strictEqual(P.grade({ correct: true, seconds: 20, limit: 90 }), "OKU"); // relaxed timer scales the cutoffs

// ---------- levels move the right way and stay in range ----------
let r = 1;
for (let i = 0; i < 100; i++) r = P.updateRating(r, "OKU");
assert(r < 11 && P.levelOf(r) === 10);
for (let i = 0; i < 100; i++) r = P.updateRating(r, "NG");
assert.strictEqual(r, 1);
assert(P.updateRating(3, "OK") > 3 && P.updateRating(3, "B") < 3);
assert.strictEqual(P.rankOf(1), "Student Pilot");
assert.strictEqual(P.rankOf(10), "Top Gun");
assert.strictEqual(P.gpa(["OKU", "OK", "F", "NG"]), 3.5);

// avoids repeating the same question when asked
const seenKeys = [];
const R2 = P.makeRng(7);
for (let i = 0; i < 20; i++) { const p = P.makePuzzle("nav", 5, R2, { avoidTexts: seenKeys }); assert(!seenKeys.includes(p.key)); seenKeys.push(p.key); }

console.log(`Gate Time Puzzles: all tests passed (${made} recipe runs).`);
