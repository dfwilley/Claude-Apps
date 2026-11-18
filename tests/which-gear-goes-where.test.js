// Tests the machine makers and turning rules of Which Gear Goes Where. Run: node tests/which-gear-goes-where.test.js
const G = require(require("path").join(__dirname, "../which-gear-goes-where/core.js"));
const assert = require("assert");

// ---------- hand-built machines: the rules themselves ----------
function train(spec) { // spec: list of teeth meshed in a line
  const m = G.newMachine();
  let x = 0, prev = null;
  for (const T of spec) {
    if (prev) x += prev.r + T * G.M / 2;
    const w = G.addWheel(m, G.addShaft(m, x, 0), "gear", T, 0);
    if (prev) m.links.push({ type: "mesh", a: prev.id, b: w.id });
    prev = w;
  }
  return m;
}
const sp = (m, s) => { const o = G.solve(m, 0).om[s]; return o.n / o.d; };
assert.strictEqual(sp(train([12, 24]), 1), -0.5, "two gears: opposite way, big one slower");
assert.strictEqual(sp(train([12, 30, 24]), 2), 0.5, "idler: same way, only first and last set the speed");
assert.strictEqual(sp(train([20, 8, 16, 10]), 3), -2, "four in a row: opposite way");
assert.strictEqual(G.phases(train([12, 30, 24, 8]), 0, 0.3).resid < 1e-9, true, "teeth fit in a line of gears");
{ // belts
  for (const crossed of [false, true]) {
    const m = G.newMachine();
    const a = G.addWheel(m, G.addShaft(m, 0, 0), "pulley", 2, 0), b = G.addWheel(m, G.addShaft(m, 100, 0), "pulley", 6, 0);
    m.links.push({ type: "belt", a: a.id, b: b.id, crossed });
    assert.strictEqual(sp(m, 1), (crossed ? -1 : 1) / 3, "belt: open keeps direction, crossed flips; big pulley slower");
  }
}
{ // two gears on one shaft: 12 drives 24, a 10 on the 24's shaft drives 30 → 1/2 × 1/3, same way as the first
  const m = G.newMachine();
  const a = G.addWheel(m, G.addShaft(m, 0, 0), "gear", 12, 0), s2 = G.addShaft(m, 72, 0);
  const b = G.addWheel(m, s2, "gear", 24, 0), c = G.addWheel(m, s2, "gear", 10, 1), d = G.addWheel(m, G.addShaft(m, 152, 0), "gear", 30, 1);
  m.links.push({ type: "mesh", a: a.id, b: b.id }, { type: "mesh", a: c.id, b: d.id });
  assert.strictEqual(sp(m, 2), 1 / 6);
}
{ // a ring of three locks; a ring of four turns
  const tri = train([12, 12, 12]); tri.links.push({ type: "mesh", a: 2, b: 0 });
  assert.strictEqual(G.solve(tri, 0).jam, true);
  const ring = train([12, 16, 12, 16]); ring.links.push({ type: "mesh", a: 3, b: 0 });
  assert.strictEqual(G.solve(ring, 0).jam, false);
}
assert.deepStrictEqual([5, 4, 3, 2, 0].map(G.stars), [3, 2, 1, 0, 0]);

// ---------- every level makes clean, correct puzzles ----------
const wheelsOf = (m, s) => m.shafts[s].wheels.map((id) => m.wheels[id]);
let made = 0;
const seen = {};
for (let level = 1; level <= G.LEVELS.length; level++) {
  seen[level] = {};
  for (let seed = 0; seed < 300; seed++) {
    const i = seed % G.ROUND, p = G.makePuzzle(level, i, G.makeRng(seed * 7919 + level * 131));
    const tag = `L${level} seed ${seed}`;
    made++;
    assert(p.text && p.how && p.answer, `${tag} missing parts`);
    assert(!/NaN|undefined|Infinity|null/.test([p.text, p.how, ...p.choices.map((c) => c.label)].join(" ")), `${tag} bad text: ${p.text} ${p.how}`);
    const ids = p.choices.map((c) => c.id);
    assert(ids.includes(p.answer), `${tag} answer not offered`);
    assert.strictEqual(new Set(ids).size, ids.length, `${tag} repeated choice`);
    assert(ids.length >= 2 && ids.length <= 4);
    seen[level][p.answer.match(/^\d+$/) ? "rpm" : p.answer] = (seen[level][p.answer.match(/^\d+$/) ? "rpm" : p.answer] || 0) + 1;

    if (p.kind === "levers") {
      // work it out a second way: follow the push through each lever
      let d = p.push;
      for (const l of p.levers) d = d * (l.out - l.pivot) / (l.inn - l.pivot);
      if (p.q === "updown") assert.strictEqual(p.answer, d > 0 ? "down" : "up", tag);
      else assert.strictEqual(p.answer, Math.abs(d) > 1 + 1e-9 ? "farther" : Math.abs(d) < 1 - 1e-9 ? "shorter" : "even", tag);
      for (const l of p.levers) assert(new Set([l.pivot, l.inn, l.out]).size === 3 && [l.pivot, l.inn, l.out].every((h) => h >= 0 && h <= l.len), tag);
      p.levers.forEach((l, k) => { if (k) { const q = p.levers[k - 1]; assert(Math.abs(q.x0 + q.out * G.U - (l.x0 + l.inn * G.U)) < 1e-9, `${tag} rod not upright`); } });
      continue;
    }

    const m = p.machine;
    assert(m.driver !== m.target, tag);
    // geometry: meshing gears touch exactly, nothing else on the same layer is close, at most two wheels a shaft
    for (const s of m.shafts) assert(s.wheels.length >= 1 && s.wheels.length <= 2, tag);
    const meshed = new Set(m.links.filter((L) => L.type === "mesh").map((L) => `${Math.min(L.a, L.b)}-${Math.max(L.a, L.b)}`));
    for (const a of m.wheels) for (const b of m.wheels) {
      if (a.id >= b.id || a.shaft === b.shaft) continue;
      const d = Math.hypot(m.shafts[a.shaft].x - m.shafts[b.shaft].x, m.shafts[a.shaft].y - m.shafts[b.shaft].y);
      if (meshed.has(`${a.id}-${b.id}`)) {
        assert(a.layer === b.layer && a.kind === "gear" && b.kind === "gear" && Math.abs(d - a.r - b.r) < 1e-6, `${tag} bad mesh`);
      } else if (a.layer === b.layer) assert(d >= a.r + b.r + G.CLEAR - 1e-6, `${tag} wheels ${a.id},${b.id} too close`);
      else if (d < a.r + b.r) assert(d >= Math.max(a.r, b.r) + 8, `${tag} axle through a wheel`);
    }
    for (const L of m.links) if (L.type === "belt") assert(m.wheels[L.a].kind === "pulley" && m.wheels[L.b].kind === "pulley" && m.wheels[L.a].layer === m.wheels[L.b].layer, tag);
    const xs = m.wheels.map((w) => m.shafts[w.shaft].x), ys = m.wheels.map((w) => m.shafts[w.shaft].y);
    assert(Math.max(...xs) - Math.min(...xs) <= 330 && Math.max(...ys) - Math.min(...ys) <= 370, `${tag} too big`);

    // the answer, worked a second way: walk outward from the green shaft, wheel by wheel, with plain numbers
    const w = m.shafts.map(() => null);
    w[m.driver] = p.drive;
    let jam = false;
    for (let pass = 0; pass < m.shafts.length + 1; pass++) {
      for (const L of m.links) for (const [f, t] of [[m.wheels[L.a], m.wheels[L.b]], [m.wheels[L.b], m.wheels[L.a]]]) {
        if (w[f.shaft] === null) continue;
        const v = L.type === "mesh" ? -w[f.shaft] * f.teeth / t.teeth : (L.crossed ? -1 : 1) * w[f.shaft] * f.size / t.size;
        if (w[t.shaft] === null) w[t.shaft] = v; else if (Math.abs(w[t.shaft] - v) > 1e-9) jam = true;
      }
    }
    assert(!w.includes(null), `${tag} a wheel is not connected`);
    assert.strictEqual(p.jam, jam, tag);
    if (m.loop === "tri") assert(jam, `${tag} ring of three should lock`);
    if (!m.loop) assert(!jam, tag);
    const v = w[m.target];
    let want;
    if (jam) want = p.q === "crate" ? "still" : "jam";
    else if (p.q === "dir") want = v > 0 ? "cw" : "ccw";
    else if (p.q === "speed") want = Math.abs(v) > 1 + 1e-9 ? "faster" : Math.abs(v) < 1 - 1e-9 ? "slower" : "same";
    else if (p.q === "crate") want = v * m.crate.side > 0 ? "down" : "up";
    else { const rd = Number(p.text.match(/at (\d+) rpm/)[1]); want = String(Math.round(rd * Math.abs(v))); assert(Math.abs(rd * Math.abs(v) - Number(want)) < 1e-6, tag); }
    assert.strictEqual(p.answer, want, `${tag}: ${p.text}`);
    if (!jam) m.shafts.forEach((s) => assert(Math.abs(p.speeds[s.id] - w[s.id]) < 1e-9, tag));
    // the picture: teeth of meshing gears sit between each other
    assert(G.phases(m, m.driver, 0).resid < (jam ? 1 : 0.031), `${tag} teeth clash`);
    if (jam) { const th = p.theta; assert(th.every((a) => Number.isFinite(a)), tag); }
    assert(wheelsOf(m, m.target).length && wheelsOf(m, m.driver).length);
  }
}
// every answer a level offers really comes up, so no button is always wrong
const need = { 1: ["cw", "ccw"], 3: ["up", "down"], 4: ["faster", "slower", "same"], 6: ["cw", "ccw", "faster", "slower"], 7: ["up", "down", "farther", "shorter", "even"],
  9: ["cw", "ccw", "faster", "slower", "rpm"], 10: ["up", "down"], 11: ["cw", "ccw", "jam"], 12: ["cw", "ccw", "jam", "rpm", "farther", "shorter", "up", "down", "still", "faster", "slower"] };
for (const [level, list] of Object.entries(need)) for (const a of list) assert((seen[level][a] || 0) >= 4, `level ${level} never answers ${a}: ${JSON.stringify(seen[level])}`);
const jams = seen[11].jam / 300;
assert(jams > 0.2 && jams < 0.6, `level 11 jam share ${jams}`);

// same seed, same puzzle
assert.deepStrictEqual(G.makePuzzle(8, 2, G.makeRng(42)), G.makePuzzle(8, 2, G.makeRng(42)));

console.log(`which-gear-goes-where: all tests passed (${made} puzzles checked)`);
