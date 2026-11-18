// Tests the shapes, wire geometry and scoring of Bend It Right. Run: node tests/bend-it-right.test.js
const path = require("path"), fs = require("fs"), assert = require("assert");
const dir = path.join(__dirname, "../bend-it-right");
const G = require(path.join(dir, "core.js"));
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= (tol || 1e-9), `${msg || ""} expected ${b}, got ${a}`);
const wireOf = (sh, bends) => ({ len: sh.wire.len, heading: sh.wire.heading, bends });

// ---------- wire to drawing ----------
{
  const w = { len: 5, heading: 0, bends: [{ s: 3, a: 90 }] };   // 3" right, then a right turn (down the screen), 2" more
  const p = G.wirePoints(w);
  assert.strictEqual(p.length, 3);
  near(p[1].x, 3); near(p[1].y, 0); near(p[2].x, 3, 1e-9); near(p[2].y, 2, 1e-9);
  const left = G.wirePoints({ len: 5, heading: 0, bends: [{ s: 3, a: -90 }] });
  near(left[2].y, -2, 1e-9, "a minus turn goes left (up the screen)");
  assert.deepStrictEqual(G.legLengths(w), [3, 2]);
  assert.deepStrictEqual(G.legHeadings(w), [0, 90]);
  const moved = G.wirePoints(w, { x: 10, y: 20 });
  near(moved[0].x, 10); near(moved[2].y, 22, 1e-9);
  const s = G.sample(p, 6);   // every inch along 5 inches
  near(s[3].x, 3, 1e-9); near(s[4].y, 1, 1e-9); near(s[5].y, 2, 1e-9);
  const n = G.nearest(p, 3.2, 1.5);
  near(n.s, 4.5, 1e-9); near(n.d, 0.2, 1e-9); assert.strictEqual(n.leg, 1);
  assert.strictEqual(G.nearest(p, 3.2, 1.5, (leg) => leg === 1).leg, 0, "legs can be left out");
}

// ---------- inches as fractions ----------
assert.strictEqual(G.fmtIn(3.5), "3 1/2″");
assert.strictEqual(G.fmtIn(0.125), "1/8″");
assert.strictEqual(G.fmtIn(12), "12″");
assert.strictEqual(G.fmtIn(2.9999), "3″");
assert.strictEqual(G.fmtIn(4.625, false), "4 5/8");
assert.strictEqual(G.turnText(90), "90° right");
assert.strictEqual(G.turnText(-45), "45° left");

// ---------- marking, sliding, turning, removing ----------
{
  const w = { len: 10, heading: 0, bends: [] };
  let r = G.addBend(w, 4.06);
  assert.deepStrictEqual(r, { bends: [{ s: 4, a: 0 }], index: 0 }, "marks land on eighths");
  w.bends = r.bends;
  assert.strictEqual(G.addBend(w, 4.05), null, "no second mark on the same spot");
  r = G.addBend(w, 2); w.bends = r.bends;
  assert.strictEqual(r.index, 0, "marks stay in order along the wire");
  assert.deepStrictEqual(w.bends.map((b) => b.s), [2, 4]);
  assert.strictEqual(G.addBend(w, -5).bends[0].s, 0.125, "never on the very end");
  assert.strictEqual(G.addBend(w, 99).bends[2].s, 9.875);
  assert.strictEqual(G.moveBend(w, 0, 9)[0].s, 3.875, "a bend can't slide past the next one");
  assert.strictEqual(G.moveBend(w, 1, 0)[1].s, 2.125);
  assert.strictEqual(G.moveBend(w, 1, 6.3)[1].s, 6.25);
  assert.strictEqual(G.turnBend(w, 0, 400)[0].a, G.MAX_TURN, "a wire can't fold flat on itself");
  assert.strictEqual(G.turnBend(w, 0, -37.4)[0].a, -37);
  assert.deepStrictEqual(G.removeBend(w, 0), [{ s: 4, a: 0 }]);
  assert.deepStrictEqual(w.bends.map((b) => b.s), [2, 4], "changes return new lists");
}

// ---------- every shape ----------
assert(G.SHAPES.length >= 20);
assert.strictEqual(new Set(G.SHAPES.map((s) => s.id)).size, G.SHAPES.length, "shape ids are all different");
assert.strictEqual(new Set(G.SHAPES.map((s) => s.name)).size, G.SHAPES.length, "shape names are all different");
const CLOSED = ["triangle", "square", "bowtie", "house", "diamond", "mountains", "crown", "arrow", "fish", "rocket", "cat", "airplane", "heart", "star", "tree"];
let rng = 12345;
const rnd = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
for (const sh of G.SHAPES) {
  const tag = sh.id, want = sh.wire.bends, legs = G.legLengths(sh.wire);
  assert(G.TIERS.some((t) => t.id === sh.tier), `${tag} tier`);
  assert(want.length >= 1 && want.length <= 10, `${tag} has a sensible number of bends`);
  near(legs.reduce((a, b) => a + b, 0), sh.wire.len, 1e-9, `${tag} legs add up to the wire`);
  for (const l of legs) { assert(l >= 0.5 - 1e-9, `${tag} leg too short to grab: ${l}`); near(l * 8, Math.round(l * 8), 1e-9, `${tag} leg on an eighth`); }
  for (const b of want) {
    assert(Number.isInteger(b.a) && b.a !== 0 && Math.abs(b.a) <= G.MAX_TURN, `${tag} turn ${b.a}`);
    assert(Math.abs(b.a) >= 20, `${tag} has a bend too slight to see: ${b.a}`);
  }
  const pts = G.shapePoints(sh), box = G.bbox(pts);
  assert(box.w <= 5.5 && box.h <= 5.5 && Math.max(box.w, box.h) >= 2, `${tag} size ${box.w} x ${box.h}`);
  if (CLOSED.includes(tag)) assert(Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.16, `${tag} should close up`);

  // the picture's own bends are a perfect score, and can be marked with the game's own moves
  const perfect = G.score(sh, want);
  assert.strictEqual(perfect.score, 100, `${tag} perfect`);
  assert.strictEqual(perfect.stars, 3);
  assert.deepStrictEqual(perfect.notes, []);
  near(perfect.place.rot, 0, 1e-6); near(perfect.place.tx, 0, 1e-6); near(perfect.place.ty, 0, 1e-6);
  let w = wireOf(sh, []);
  for (const b of want) { const r = G.addBend(w, b.s); assert(r, `${tag} can mark ${b.s}`); w = wireOf(sh, G.turnBend(wireOf(sh, r.bends), r.index, b.a)); }
  assert.deepStrictEqual(w.bends, want, `${tag} can be bent exactly`);

  // an unbent wire scores nothing, and a tilted start doesn't matter
  const flat = G.score(sh, []);
  assert.strictEqual(flat.score, 0, `${tag} straight wire`);
  assert.strictEqual(flat.notes.length, 1);
  assert(/none/.test(flat.notes[0]));
  const tilted = { id: sh.id, name: sh.name, tier: sh.tier, start: sh.start, wire: sh.wire };
  const P = G.sample(G.wirePoints({ len: sh.wire.len, heading: sh.wire.heading + 77, bends: want }, { x: 5, y: -3 }), 100);
  near(G.fit(P, G.sample(G.shapePoints(tilted), 100)).gap, 0, 1e-6, `${tag} only the shape counts`);

  // sloppier bends score lower, and careful ones still earn stars
  const off = (ds, da) => want.map((b, i) => ({ s: b.s + (i % 2 ? ds : -ds), a: b.a + (i % 2 ? -da : da) }));
  const a = G.score(sh, off(0.0625, 2)).score, b = G.score(sh, off(0.25, 8)).score, c = G.score(sh, off(0.5, 25)).score;
  assert(a < 100 && a > b && b > c, `${tag} scores should fall as bends get worse: ${a} ${b} ${c}`);
  assert(a >= G.STARS[0], `${tag} small slips still earn a star: ${a}`);
  assert(c < G.STARS[1], `${tag} big slips can't earn two stars: ${c}`);
  for (let k = 0; k < 20; k++) {
    const bends = want.map((q) => ({ s: q.s, a: q.a + Math.round((rnd() - 0.5) * 60) }));
    const r = G.score(sh, bends);
    assert(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100, `${tag} score in range`);
    assert.strictEqual(r.stars, G.stars(r.score));
    assert(r.notes.length <= 3 && !/NaN|undefined|Infinity/.test(r.notes.join(" ")), `${tag} notes: ${r.notes}`);
  }
}
assert.deepStrictEqual([100, 90, 89, 78, 77, 60, 59, 0].map(G.stars), [3, 3, 2, 2, 1, 1, 0, 0]);

// ---------- what to fix ----------
{
  const sh = G.shapeById("house"), want = sh.wire.bends;   // legs 2 1/2, 2 1/8, 2 1/8, 2 1/2, 3; turns 45, 90, 45, 90 right
  assert.deepStrictEqual(want.map((b) => b.a), [45, 90, 45, 90]);
  const tweak = (i, ds, da) => want.map((b, k) => (k === i ? { s: b.s + ds, a: b.a + da } : b));
  assert.deepStrictEqual(G.notes(sh, tweak(1, 0, 10)), ["Bend 2 is 10° too sharp."]);
  assert.deepStrictEqual(G.notes(sh, tweak(1, 0, -12)), ["Bend 2 is 12° too open."]);
  assert.deepStrictEqual(G.notes(sh, tweak(0, 0, -90)), ["Bend 1 turns the wrong way."]);
  assert.deepStrictEqual(G.notes(sh, tweak(0, 0.25, 0)), ["Leg 1 is 1/4″ too long.", "Leg 2 is 1/4″ too short."]);
  assert.deepStrictEqual(G.notes(sh, tweak(2, 0, 2)), [], "2 degrees is close enough to say nothing");
  assert.deepStrictEqual(G.notes(sh, want.slice(0, 3)), ["The picture has 4 bends; your wire has 3."]);
  assert.deepStrictEqual(G.notes(G.shapeById("elbow"), []), ["The picture has 1 bend; your wire has none."]);
}

// ---------- a pattern to make for real ----------
{
  const sh = G.shapeById("house"), one = G.bendList(sh.wire), two = G.bendList(sh.wire, 2);
  assert.strictEqual(one.cut, 12.25);
  assert.deepStrictEqual(one.rows[1], { n: 2, mark: 4.625, leg: 2.125, angle: 90, dir: "right" });
  assert.strictEqual(one.lastLeg, 3);
  assert.strictEqual(two.cut, 24.5);
  assert.deepStrictEqual(two.rows[1], { n: 2, mark: 9.25, leg: 4.25, angle: 90, dir: "right" }, "twice the size: twice the lengths, same angles");
  const l = G.bendList({ len: 4, heading: 0, bends: [{ s: 1, a: -30 }, { s: 2, a: 0 }] });
  assert.strictEqual(l.rows[0].dir, "left"); assert.strictEqual(l.rows[1].dir, "");
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
  assert.deepStrictEqual(listed, onDisk.sort(), "sw.js SHELL must list every file in bend-it-right/");
  const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
  for (const f of ["core.js", "app.js", "style.css", "manifest.webmanifest"]) assert(html.includes(f), `index.html uses ${f}`);
  JSON.parse(fs.readFileSync(path.join(dir, "manifest.webmanifest"), "utf8"));
}

console.log(`bend-it-right: ${G.SHAPES.length} shapes checked, all tests passed`);
