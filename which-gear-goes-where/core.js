// Which Gear Goes Where: puzzle makers and the rules of how things turn. No screen code here, so it can be tested with Node.
// Every machine is made on the phone, so there is an endless supply and no signal is needed.
(function (root) {
  "use strict";

  // ---------- random numbers (seedable so tests repeat) ----------
  function makeRng(seed) {
    let s = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
    const next = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      ri: (a, b) => a + Math.floor(next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
      },
    };
  }

  // ---------- fractions (speeds are kept exact) ----------
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
  const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  const fracStr = (f) => (f.d === 1 ? String(Math.abs(f.n)) : `${Math.abs(f.n)}/${f.d}`);

  // ---------- sizes, in drawing units ----------
  const TAU = Math.PI * 2;
  const M = 4;            // a gear's radius is teeth × M ÷ 2
  const ADD = 3.4;        // how far a tooth sticks out past that radius
  const CLEAR = 2 * ADD + 7; // gap kept between wheels that don't touch
  const HUB = 9;          // room an axle needs
  const PR = 6;           // a pulley's radius is its size × PR
  const BW = 330, BH = 370; // the machine must fit in this box
  const TEETH = [8, 10, 12, 16, 20, 24, 30];
  const PSIZE = [2, 3, 4, 5, 6];
  const U = 22;           // spacing of the holes along a lever
  const DY = 76;          // height between linked levers

  // ---------- a machine: shafts, the wheels on them, and what links the wheels ----------
  // Angles and turning: positive is clockwise as seen on the screen.
  const newMachine = () => ({ shafts: [], wheels: [], links: [] });
  function addShaft(m, x, y) { const s = { id: m.shafts.length, x, y, wheels: [] }; m.shafts.push(s); return s; }
  function addWheel(m, s, kind, val, layer) {
    const w = { id: m.wheels.length, shaft: s.id, kind, layer };
    if (kind === "gear") { w.teeth = val; w.r = val * M / 2; } else { w.size = val; w.r = val * PR; }
    m.wheels.push(w); s.wheels.push(w.id);
    return w;
  }
  function popWheel(m) { const w = m.wheels.pop(); m.shafts[w.shaft].wheels.pop(); }
  const shaftOf = (m, w) => m.shafts[w.shaft];
  const linkShafts = (m, L) => [m.wheels[L.a].shaft, m.wheels[L.b].shaft];
  function meshPartners(m, sid) {
    const out = [];
    for (const L of m.links) {
      if (L.type !== "mesh") continue;
      const [a, b] = linkShafts(m, L);
      if (a === sid) out.push(b); else if (b === sid) out.push(a);
    }
    return out;
  }
  function distPointSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }

  // Can a wheel of radius r go at (x, y) on this layer without fouling anything?
  function wheelOk(m, x, y, r, layer, ownShaft, partners, meshWheel) {
    for (const w of m.wheels) {
      if (w.shaft === ownShaft) continue;
      if (meshWheel && w.id === meshWheel.id) continue; // touching on purpose
      const s = shaftOf(m, w), d = Math.hypot(s.x - x, s.y - y);
      if (d >= w.r + r + CLEAR) continue;
      if (w.layer === layer) return false;
      // Overlap is fine only between a gear and the other gear stacked on the shaft it meshes with,
      // and only when each axle is clear of the other wheel.
      if (!partners.includes(w.shaft)) return false;
      if (d < Math.max(w.r, r) + HUB) return false;
    }
    for (const L of m.links) {
      if (L.type !== "belt") continue;
      const [a, b] = linkShafts(m, L);
      if (a === ownShaft || b === ownShaft) continue;
      const A = m.shafts[a], B = m.shafts[b];
      if (distPointSeg(x, y, A.x, A.y, B.x, B.y) < r + Math.max(m.wheels[L.a].r, m.wheels[L.b].r) + 6) return false;
    }
    return true;
  }
  function bbox(m, extra) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const eat = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const w of m.wheels) { const s = shaftOf(m, w); eat(s.x, s.y, w.r + ADD); }
    if (extra) eat(extra.x, extra.y, extra.r + ADD);
    return { x0, y0, x1, y1 };
  }
  function inBox(m, x, y, r) { const b = bbox(m, { x, y, r }); return b.x1 - b.x0 <= BW && b.y1 - b.y0 <= BH; }
  function circleIntersect(ax, ay, ar, bx, by, br) {
    const d = Math.hypot(bx - ax, by - ay);
    if (!d || d > ar + br || d < Math.abs(ar - br)) return [];
    const a = (ar * ar - br * br + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ar * ar - a * a));
    const mx = ax + a * (bx - ax) / d, my = ay + a * (by - ay) / d, ux = -(by - ay) / d, uy = (bx - ax) / d;
    return [{ x: mx + h * ux, y: my + h * uy }, { x: mx - h * ux, y: my - h * uy }];
  }

  // ---------- how fast and which way everything turns ----------
  // Returns each shaft's speed as a fraction of the driver's (negative = the other way), or jam = true when two
  // paths to the same shaft disagree, which locks the whole machine.
  function solve(m, driver) {
    const om = m.shafts.map(() => null), via = m.shafts.map(() => null);
    om[driver] = frac(1, 1);
    const q = [driver];
    let jam = false;
    while (q.length) {
      const s = q.shift();
      for (const L of m.links) {
        const wa = m.wheels[L.a], wb = m.wheels[L.b];
        let f, t;
        if (wa.shaft === s) { f = wa; t = wb; } else if (wb.shaft === s) { f = wb; t = wa; } else continue;
        const k = L.type === "mesh" ? frac(-f.teeth, t.teeth) : frac((L.crossed ? -1 : 1) * f.size, t.size);
        const o = frac(om[s].n * k.n, om[s].d * k.d);
        if (om[t.shaft] === null) { om[t.shaft] = o; via[t.shaft] = { link: L, from: f, to: t }; q.push(t.shaft); }
        else if (om[t.shaft].n !== o.n || om[t.shaft].d !== o.d) jam = true;
      }
    }
    return { om, via, jam };
  }
  // The links walked from the driver to a shaft, in order.
  function pathTo(sol, driver, target) {
    const steps = [];
    for (let s = target; s !== driver;) { const v = sol.via[s]; steps.unshift(v); s = v.from.shaft; }
    return steps;
  }

  // ---------- starting angles so the teeth of meshing gears fit between each other ----------
  // resid is how badly the worst mesh fits, as a fraction of a tooth (0 = perfect).
  function phases(m, driver, th0) {
    const th = m.wheels.map(() => null);
    const nb = m.wheels.map(() => []);
    for (const L of m.links) if (L.type === "mesh") { nb[L.a].push(L.b); nb[L.b].push(L.a); }
    let resid = 0;
    const run = (w0, val) => {
      th[w0] = val;
      const q = [w0];
      while (q.length) {
        const a = q.shift(), wa = m.wheels[a], sa = shaftOf(m, wa);
        for (const b of nb[a]) {
          const wb = m.wheels[b], sb = shaftOf(m, wb);
          const phi = Math.atan2(sb.y - sa.y, sb.x - sa.x);
          const pa = (phi - th[a]) * wa.teeth / TAU;
          const want = phi + Math.PI - (0.5 - pa) * TAU / wb.teeth;
          if (th[b] === null) { th[b] = want; q.push(b); }
          else {
            let e = ((want - th[b]) * wb.teeth / TAU) % 1;
            if (e < 0) e += 1;
            resid = Math.max(resid, Math.min(e, 1 - e));
          }
        }
      }
    };
    for (const id of m.shafts[driver].wheels) if (th[id] === null) run(id, th0 || 0);
    for (let id = 0; id < m.wheels.length; id++) if (th[id] === null) run(id, 0);
    return { th, resid };
  }
  // In a locked ring of three the teeth still fit at one particular angle; find it so the picture looks right.
  function bestPhases(m, driver) {
    let best = phases(m, driver, 0);
    if (best.resid < 1e-6) return best;
    const w = m.wheels[m.shafts[driver].wheels[0]];
    const pitch = w.kind === "gear" ? TAU / w.teeth : TAU;
    for (let k = 1; k < 96; k++) {
      const p = phases(m, driver, pitch * k / 96);
      if (p.resid < best.resid) best = p;
    }
    return best;
  }

  // ---------- building a machine ----------
  const teethPool = (n) => TEETH.filter((T) => T <= (n <= 3 ? 30 : n <= 5 ? 24 : 20));

  function baseTri(m, R, pool) {
    const p = pool.filter((T) => T <= 24);
    const T = [R.pick(p), R.pick(p), R.pick(p)], r = T.map((t) => t * M / 2);
    const a = R.next() * TAU;
    const c2 = { x: (r[0] + r[1]) * Math.cos(a), y: (r[0] + r[1]) * Math.sin(a) };
    const pts = circleIntersect(0, 0, r[0] + r[2], c2.x, c2.y, r[1] + r[2]);
    if (!pts.length) return false;
    const c3 = R.pick(pts);
    const w = [[0, 0], [c2.x, c2.y], [c3.x, c3.y]].map(([x, y], i) => addWheel(m, addShaft(m, x, y), "gear", T[i], 0));
    m.links.push({ type: "mesh", a: w[0].id, b: w[1].id }, { type: "mesh", a: w[1].id, b: w[2].id }, { type: "mesh", a: w[2].id, b: w[0].id });
    m.loop = "tri";
    return true;
  }
  // Four gears in a ring. The ring can flex, so slide it until the teeth fit all the way round.
  function baseRing(m, R, pool) {
    const p = pool.filter((T) => T <= 20);
    const T = [R.pick(p), R.pick(p), R.pick(p), R.pick(p)], r = T.map((t) => t * M / 2);
    const a0 = R.next() * TAU;
    const c = [{ x: 0, y: 0 }, { x: (r[0] + r[1]) * Math.cos(a0), y: (r[0] + r[1]) * Math.sin(a0) }];
    const N = 1500, k0 = R.ri(0, N - 1);
    let best = null;
    for (let i = 0; i < N && !(best && best.resid < 0.012); i++) {
      const f = a0 + Math.PI + (((i + k0) % N) / N - 0.5) * 4.6;
      const c3 = { x: c[1].x + (r[1] + r[2]) * Math.cos(f), y: c[1].y + (r[1] + r[2]) * Math.sin(f) };
      if (Math.hypot(c3.x, c3.y) < r[2] + r[0] + CLEAR) continue;
      for (const c4 of circleIntersect(c3.x, c3.y, r[2] + r[3], 0, 0, r[0] + r[3])) {
        if (Math.hypot(c4.x - c[1].x, c4.y - c[1].y) < r[3] + r[1] + CLEAR) continue;
        const t = newMachine();
        const w = [c[0], c[1], c3, c4].map((q, j) => addWheel(t, addShaft(t, q.x, q.y), "gear", T[j], 0));
        for (let j = 0; j < 4; j++) t.links.push({ type: "mesh", a: w[j].id, b: w[(j + 1) % 4].id });
        const b = bbox(t);
        if (b.x1 - b.x0 > BW || b.y1 - b.y0 > BH) continue;
        const resid = phases(t, 0, 0).resid;
        if (!best || resid < best.resid) best = { t, resid };
      }
    }
    if (!best || best.resid > 0.03) return false;
    Object.assign(m, best.t, { loop: "ring" });
    return true;
  }

  function growMesh(m, ps, spec, R, pool, last) {
    const own = ps.wheels.map((id) => m.wheels[id]);
    const gears = own.filter((w) => w.kind === "gear");
    let pw = null, added = false;
    if (own.length === 1 && (!gears.length || R.chance(spec.compound || 0))) {
      // put a second gear on this shaft: a smaller one in front, or a bigger one behind
      const o = own[0];
      for (const T of R.shuffle(pool)) {
        const r = T * M / 2;
        if (o.kind === "pulley" ? r < o.r + 12 : Math.abs(r - o.r) < 12) continue;
        const layer = r < o.r ? o.layer + 1 : o.layer - 1;
        if (!wheelOk(m, ps.x, ps.y, r, layer, ps.id, meshPartners(m, ps.id), null)) continue;
        pw = addWheel(m, ps, "gear", T, layer); added = true;
        break;
      }
    }
    if (!pw) { if (!gears.length) return false; pw = R.pick(gears); }
    let Ts = R.shuffle(pool).slice(0, 4);
    if (last && spec.same && R.chance(spec.same)) Ts = [m.wheels[m.shafts[0].wheels[0]].teeth];
    for (const T of Ts) {
      const r = T * M / 2, a0 = R.next() * TAU, d = pw.r + r;
      for (let k = 0; k < 16; k++) {
        const a = a0 + k * TAU / 16, x = ps.x + d * Math.cos(a), y = ps.y + d * Math.sin(a);
        if (!wheelOk(m, x, y, r, pw.layer, -1, [ps.id], pw) || !inBox(m, x, y, r)) continue;
        const w = addWheel(m, addShaft(m, x, y), "gear", T, pw.layer);
        m.links.push({ type: "mesh", a: pw.id, b: w.id });
        return true;
      }
    }
    if (added) popWheel(m);
    return false;
  }
  function growBelt(m, ps, spec, R) {
    if (ps.wheels.length !== 1) return false;
    const o = m.wheels[ps.wheels[0]];
    const sizes = PSIZE.filter((z) => z * PR <= o.r - 12);
    if (!sizes.length) return false;
    const z1 = R.pick(sizes), r1 = z1 * PR, layer = o.layer + 1;
    if (!wheelOk(m, ps.x, ps.y, r1, layer, ps.id, meshPartners(m, ps.id), null)) return false;
    const z2 = R.pick(PSIZE), r2 = z2 * PR, d = r1 + r2 + R.ri(26, 70), a0 = R.next() * TAU, wide = Math.max(r1, r2) + 6;
    for (let k = 0; k < 16; k++) {
      const a = a0 + k * TAU / 16, x = ps.x + d * Math.cos(a), y = ps.y + d * Math.sin(a);
      if (!wheelOk(m, x, y, r2, layer, -1, [], null) || !inBox(m, x, y, r2)) continue;
      if (m.wheels.some((w) => w.shaft !== ps.id && distPointSeg(shaftOf(m, w).x, shaftOf(m, w).y, ps.x, ps.y, x, y) < w.r + wide)) continue;
      const w1 = addWheel(m, ps, "pulley", z1, layer), w2 = addWheel(m, addShaft(m, x, y), "pulley", z2, layer);
      m.links.push({ type: "belt", a: w1.id, b: w2.id, crossed: R.chance(spec.crossed || 0) });
      return true;
    }
    return false;
  }

  function buildGears(spec, R) {
    const m = newMachine(), pool = teethPool(spec.n);
    if (spec.loop === "tri") { if (!baseTri(m, R, pool)) return null; }
    else if (spec.loop === "ring") { if (!baseRing(m, R, pool)) return null; }
    else addWheel(m, addShaft(m, 0, 0), "gear", R.pick(pool), 0);
    for (let guard = 0; m.shafts.length < spec.n; guard++) {
      if (guard > 40) return null;
      const ps = spec.branch && R.chance(spec.branch) ? R.pick(m.shafts) : m.shafts[m.shafts.length - 1];
      const last = m.shafts.length === spec.n - 1;
      if (R.chance(spec.belt || 0)) growBelt(m, ps, spec, R); else growMesh(m, ps, spec, R, pool, last);
    }
    // the green one drives; the gold one is as far from it as the machine goes
    const deg = m.shafts.map(() => 0);
    for (const L of m.links) for (const s of linkShafts(m, L)) deg[s]++;
    if (spec.branch || spec.loop) {
      const leaves = m.shafts.filter((s) => deg[s.id] === 1);
      m.driver = R.pick(leaves.length ? leaves : m.shafts).id;
    } else m.driver = 0;
    const hop = m.shafts.map(() => -1);
    hop[m.driver] = 0;
    for (const q = [m.driver]; q.length;) {
      const s = q.shift();
      for (const L of m.links) {
        const [a, b] = linkShafts(m, L), t = a === s ? b : b === s ? a : -1;
        if (t >= 0 && hop[t] < 0) { hop[t] = hop[s] + 1; q.push(t); }
      }
    }
    const far = Math.max(...hop);
    if (far < 1 || hop.includes(-1)) return null;
    m.target = R.pick(m.shafts.filter((s) => hop[s.id] === far)).id;
    return m;
  }

  // ---------- words ----------
  const DIRW = { cw: "clockwise", ccw: "counter-clockwise" };
  const LABEL = {
    cw: "Clockwise", ccw: "Counter-clockwise", jam: "Jammed", faster: "Faster", slower: "Slower", same: "Same speed",
    up: "Up", down: "Down", still: "Doesn't move", farther: "Farther", shorter: "Less far", even: "Same distance",
  };
  const noun = (m, sid) => (m.shafts[sid].wheels.every((id) => m.wheels[id].kind === "pulley") ? "pulley" : "gear");
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + "s"}`;
  const stepStr = (v) => (v.link.type === "mesh" ? `${v.from.teeth}→${v.to.teeth} teeth` : `${v.from.size}″→${v.to.size}″ pulleys`);

  function dirHow(steps, same) {
    const k = steps.filter((v) => v.link.type === "mesh").length;
    const c = steps.filter((v) => v.link.type === "belt" && v.link.crossed).length;
    const o = steps.filter((v) => v.link.type === "belt" && !v.link.crossed).length;
    const stacked = steps.some((v, i) => i && steps[i - 1].to.id !== v.from.id);
    const bits = [];
    if (k) bits.push(`${plural(k, "mesh", "meshes")}`);
    if (c) bits.push(`${plural(c, "crossed belt")}`);
    const flips = k + c;
    let s;
    if (!flips) s = `Follow green to gold: only ${o === 1 ? "an open belt, which keeps" : "open belts, which keep"} the same direction.`;
    else {
      s = `Follow green to gold: ${bits.join(" and ")}, and each one flips the direction.`;
      if (o) s += ` ${o === 1 ? "The open belt keeps" : "Open belts keep"} the same direction.`;
    }
    if (stacked) s += " Wheels on the same shaft turn together.";
    s += flips ? ` ${plural(flips, "flip")}: gold turns ${same ? "the same way as" : "opposite to"} green.` : " Gold turns the same way as green.";
    return s;
  }
  function speedHow(steps, ratio) {
    const simple = steps.every((v, i) => v.link.type === "mesh" && (!i || steps[i - 1].to.id === v.from.id));
    let s;
    if (simple && steps.length > 1) s = `The gears in between change direction but not speed, so only first and last count: ${steps[0].from.teeth} teeth driving ${steps[steps.length - 1].to.teeth}.`;
    else if (steps.length === 1) s = `${steps[0].link.type === "mesh" ? `${steps[0].from.teeth} teeth driving ${steps[0].to.teeth}` : `A ${steps[0].from.size}″ pulley driving a ${steps[0].to.size}″ one`}.`;
    else s = `Step by step: ${steps.map(stepStr).join(", then ")}. Multiply the steps.`;
    const turns = ratio.n === ratio.d ? "exactly 1 turn" : `${fracStr(ratio)} ${ratio.n > ratio.d ? "turns" : "of a turn"}`;
    return `${s} Gold makes ${turns} for each turn of green. Small wheels spin faster.`;
  }
  function jamHow(m) {
    return m.loop === "tri"
      ? "Three gears mesh in a ring. Each one would have to turn opposite to both of its neighbors, and that can't happen, so the whole machine is locked."
      : "Two paths lead to the same wheel and disagree about how it should turn, so the whole machine is locked.";
  }

  // ---------- a gear puzzle ----------
  function gearPuzzle(spec, R) {
    const m = buildGears(spec, R);
    if (!m) return null;
    const sol = solve(m, m.driver), jam = sol.jam;
    if (jam && !spec.jamChoice) return null;
    const drive = R.pick([1, -1]);
    const om = sol.om[m.target], ratio = frac(Math.abs(om.n), om.d);
    const turn = jam ? 0 : drive * Math.sign(om.n);
    const steps = pathTo(sol, m.driver, m.target);
    const dn = noun(m, m.driver), tn = noun(m, m.target), dw = DIRW[drive > 0 ? "cw" : "ccw"];
    const ringNote = m.loop === "ring" ? " The ring of four is no trouble: a ring with an even number of gears can turn." : "";
    let text, ids, answer, how;
    if (spec.q === "dir") {
      text = `The green ${dn} turns ${dw}. Which way does the gold ${tn} turn?`;
      ids = ["cw", "ccw"]; answer = turn > 0 ? "cw" : "ccw";
      how = dirHow(steps, om.n > 0) + ringNote;
    } else if (spec.q === "speed") {
      text = `Does the gold ${tn} spin faster or slower than the green ${dn}?`;
      ids = ["faster", "same", "slower"]; answer = ratio.n > ratio.d ? "faster" : ratio.n < ratio.d ? "slower" : "same";
      how = speedHow(steps, ratio) + ringNote;
    } else if (spec.q === "rpm") {
      if (ratio.n === ratio.d) return null;
      const ks = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120].filter((k) => ratio.d * k >= 20 && ratio.d * k <= 600 && ratio.n * k <= 2000);
      if (!ks.length) return null;
      const k = R.pick(ks), rd = ratio.d * k, rt = ratio.n * k, lastStep = steps[steps.length - 1];
      const lastOnly = lastStep.link.type === "mesh" ? rd * lastStep.from.teeth / lastStep.to.teeth : rd * lastStep.from.size / lastStep.to.size;
      const wrong = [];
      for (const v of [rd * ratio.d / ratio.n, lastOnly, rd, rt * 2, rt / 2, rt * 3, rt / 3, rt + k, rt + 2 * k, rt + 3 * k]) {
        if (Number.isInteger(v) && v > 0 && v !== rt && !wrong.includes(v)) wrong.push(v);
      }
      const nums = wrong.slice(0, 3).concat(rt).sort((a, b) => a - b);
      text = `The green ${dn} turns at ${rd} rpm. How fast does the gold ${tn} turn?`;
      ids = nums.map(String); answer = String(rt);
      how = `${speedHow(steps, ratio)} ${rd} × ${fracStr(ratio)} = ${rt} rpm.`;
    } else { // crate on a rope wound round a drum on the gold shaft
      const side = R.pick([1, -1]);
      m.crate = { shaft: m.target, side };
      text = `The green ${dn} turns ${dw}. Which way does the crate go?`;
      ids = ["up", "down"]; answer = turn * side > 0 ? "down" : "up";
      how = `${dirHow(steps, om.n > 0)} So gold turns ${DIRW[turn > 0 ? "cw" : "ccw"]}, and the ${side > 0 ? "right" : "left"} side of the drum, where the rope hangs, moves ${answer}.`;
    }
    if (spec.jamChoice) ids.push(spec.q === "crate" ? "still" : "jam");
    if (jam) { answer = spec.q === "crate" ? "still" : "jam"; how = jamHow(m); }
    return {
      kind: "gears", machine: m, drive, jam, q: spec.q, text, answer, how,
      choices: ids.map((id) => ({ id, label: LABEL[id] || `${id} rpm` })),
      speeds: sol.om.map((o) => (jam ? 0 : drive * o.n / o.d)),
      theta: bestPhases(m, m.driver).th,
    };
  }

  // ---------- a lever puzzle ----------
  // Each lever is a bar with holes 0..len. One hole is the pivot, one is pushed (inn), one pushes the next thing (out).
  function leverPuzzle(spec, R) {
    const levers = [], stack = R.pick([-1, 1]), even = spec.q === "travel" && R.chance(0.15);
    let x = 0, y = 0, total = frac(1, 1);
    for (let i = 0; i < spec.n; i++) {
      let len = R.ri(4, 7), pivot, inn, out;
      if (even) {
        pivot = R.ri(2, 3); len = pivot * 2;
        [inn, out] = R.chance(0.5) ? [0, len] : [len, 0];
      } else if (R.chance(spec.endPivot || 0)) {
        pivot = R.pick([0, len]);
        const far = len - pivot, mid = R.ri(1, len - 1);
        [inn, out] = R.chance(0.5) ? [far, mid] : [mid, far];
      } else {
        pivot = R.ri(1, len - 1);
        [inn, out] = R.chance(0.5) ? [0, len] : [len, 0];
      }
      levers.push({ x0: x - inn * U, y, len, pivot, inn, out });
      const k = frac(out - pivot, inn - pivot);
      total = frac(total.n * k.n, total.d * k.d);
      x += (out - inn) * U; y += stack * DY;
    }
    const xs = levers.flatMap((l) => [l.x0, l.x0 + l.len * U]);
    if (Math.max(...xs) - Math.min(...xs) > BW - 30) return null;
    const push = R.pick([1, -1]); // 1 = the hand pushes down
    const ratio = frac(Math.abs(total.n), total.d);
    const lines = levers.map((l, i) => {
      const mid = (l.inn - l.pivot) * (l.out - l.pivot) < 0;
      return `${spec.n > 1 ? `Lever ${i + 1}: ` : ""}${mid ? "the pivot is between the two points, so they go opposite ways" : "the pivot is at the end, so both points go the same way"}.`;
    });
    let text, ids, answer, how;
    if (spec.q === "updown") {
      text = `The hand pushes ${push > 0 ? "down" : "up"}. Which way does the box go?`;
      ids = ["up", "down"]; answer = push * total.n > 0 ? "down" : "up";
      how = `${lines.join(" ")} The box goes ${answer}.`.replace(/^t/, "T");
    } else {
      text = "Does the box move farther or less far than the hand?";
      ids = ["farther", "even", "shorter"]; answer = ratio.n > ratio.d ? "farther" : ratio.n < ratio.d ? "shorter" : "even";
      const arms = levers.map((l) => `${Math.abs(l.out - l.pivot)}/${Math.abs(l.inn - l.pivot)}`);
      how = `Count holes from each pivot: a point farther from the pivot moves farther. For each lever, holes out to where it pushes over holes out to where it is pushed: ${arms.join(" × ")}${arms.length > 1 || ratio.d === 1 || arms[0] !== fracStr(ratio) ? ` = ${fracStr(ratio)}` : ""}. The box moves ${ratio.n === ratio.d ? "exactly as far as" : `${fracStr(ratio)} as far as`} the hand.`;
    }
    return { kind: "levers", levers, push, total, q: spec.q, text, answer, how, choices: ids.map((id) => ({ id, label: LABEL[id] })) };
  }

  // ---------- levels ----------
  const LEVELS = [
    { name: "First pair", blurb: "Two gears that mesh" },
    { name: "Three in a row", blurb: "Gears in a line" },
    { name: "Seesaws", blurb: "A lever on a pivot" },
    { name: "Big and small", blurb: "Which one spins faster?" },
    { name: "Long trains", blurb: "Four to six gears" },
    { name: "Belts", blurb: "Pulleys with open and crossed belts" },
    { name: "Linked levers", blurb: "One lever pushes the next" },
    { name: "Side branches", blurb: "Some gears are only along for the ride" },
    { name: "Stacked gears", blurb: "Two gears on one shaft" },
    { name: "The winch", blurb: "Does the crate go up or down?" },
    { name: "Will it jam?", blurb: "Some machines lock solid" },
    { name: "Tangled machines", blurb: "Everything at once" },
  ];
  const ROUND = 5;
  function specFor(level, i, R, shrink) {
    const g = (o) => Object.assign({ kind: "gears", n: 2, q: "dir" }, o);
    const lev = (o) => Object.assign({ kind: "levers" }, o);
    let s;
    switch (level) {
      case 1: s = g({ n: 2 }); break;
      case 2: s = g({ n: i < 3 ? 3 : 4 }); break;
      case 3: s = lev({ n: i < 2 ? 1 : 2, endPivot: 0, q: "updown" }); break;
      case 4: s = g({ n: i < 2 ? 2 : 3, q: "speed", same: 0.3 }); break;
      case 5: s = g({ n: R.ri(4, 6), q: i % 2 ? "speed" : "dir", same: 0.3 }); break;
      case 6: s = g({ n: R.ri(3, 4), belt: 0.6, crossed: i < 2 ? 0 : 0.6, q: i === 4 ? "speed" : "dir" }); break;
      case 7: s = lev({ n: R.ri(2, 4), endPivot: 0.45, q: i % 2 ? "travel" : "updown" }); break;
      case 8: s = g({ n: R.ri(5, 7), branch: 0.55, q: i % 2 ? "speed" : "dir" }); break;
      case 9: s = g({ n: R.ri(3, 4), compound: 0.8, q: ["dir", "speed", "rpm", "speed", "rpm"][i % 5] }); break;
      case 10: s = g({ n: R.ri(3, 5), belt: 0.3, crossed: 0.5, compound: 0.3, q: "crate" }); break;
      case 11: s = g({ n: R.ri(4, 6), branch: 0.4, loop: R.pick(["tri", "tri", "tri", "tri", "ring", "ring", "ring", null, null, null]), jamChoice: true }); break;
      default:
        s = [
          () => g({ n: R.ri(6, 8), branch: 0.5, belt: 0.25, crossed: 0.5, compound: 0.3, loop: R.chance(0.35) ? "tri" : null, jamChoice: true }),
          () => g({ n: R.ri(4, 5), compound: 0.8, belt: 0.2, crossed: 0.5, q: "rpm" }),
          () => lev({ n: 4, endPivot: 0.5, q: "travel" }),
          () => g({ n: R.ri(5, 6), branch: 0.3, belt: 0.3, crossed: 0.5, compound: 0.4, loop: R.chance(0.3) ? "tri" : null, q: "crate", jamChoice: true }),
          () => g({ n: R.ri(6, 8), branch: 0.5, belt: 0.2, crossed: 0.5, compound: 0.4, loop: R.pick(["ring", "tri", null]), q: "speed", jamChoice: true }),
        ][i % 5]();
    }
    const least = s.kind === "levers" ? 1 : s.loop === "ring" ? 4 : s.loop === "tri" ? 3 : 2;
    s.n = Math.max(least, s.n - shrink);
    return s;
  }
  // Puzzle number i (0 to 4) of a level. Tries again with a slightly smaller machine if one won't fit.
  function makePuzzle(level, i, R) {
    R = R || makeRng();
    for (let a = 0; a < 800; a++) {
      const spec = specFor(level, i, R, Math.floor(a / 100));
      const p = spec.kind === "levers" ? leverPuzzle(spec, R) : gearPuzzle(spec, R);
      if (p) { p.level = level; return p; }
    }
    const p = gearPuzzle({ kind: "gears", n: 2, q: "dir" }, R);
    p.level = level;
    return p;
  }
  const stars = (right) => (right >= ROUND ? 3 : right === ROUND - 1 ? 2 : right === ROUND - 2 ? 1 : 0);

  const api = {
    makeRng, makePuzzle, LEVELS, ROUND, stars, solve, phases, bestPhases, pathTo, frac, fracStr,
    newMachine, addShaft, addWheel, M, ADD, CLEAR, PR, U, DY, TAU,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WGGW = api;
})(typeof self !== "undefined" ? self : this);
