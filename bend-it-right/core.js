// Bend It Right: the rules. The shapes, how a wire with bends becomes a drawing,
// and how closely a bent wire matches the picture. No screen code here, so Node can test it.
//
// A wire is { len, heading, bends: [{ s, a }] }:
//   len      inches of wire
//   heading  which way it leaves end A, in degrees (0 = to the right, 90 = down the screen)
//   s        where a bend is, in inches along the wire from end A
//   a        how far it turns there, in degrees (+ = to the right as you travel from A, - = to the left)
(function (root) {
  "use strict";
  const DEG = 180 / Math.PI;
  const STEP = 1 / 8;        // marks go on eighths of an inch
  const MAX_TURN = 170;      // a wire can't fold flat back on itself
  const SAMPLES = 240;

  const r8 = (x) => Math.round(x / STEP) * STEP;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------- the shapes ----------
  // Drawn as corner points in inches (x to the right, y down), in the order the wire runs.
  // Slanted legs mostly use 3-4-5 triangles so their lengths land on eighths and closed shapes close.
  // Leg lengths are then rounded to 1/8" and turns to 1 degree, so every shape can be bent exactly.
  const TIERS = [
    { id: 1, name: "Trace it", blurb: "The picture is on the bench under your wire." },
    { id: 2, name: "Shop drawing", blurb: "The picture gives each leg's length. Angles are up to you." },
    { id: 3, name: "By eye", blurb: "Just the picture and the wire's length." },
  ];
  function starPoints() {
    const R = 2.065, r = R * 0.382, pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (-90 + i * 36) / DEG, rad = i % 2 ? r : R;
      pts.push([2 + rad * Math.cos(a), 2.1 + rad * Math.sin(a)]);
    }
    return pts;
  }
  const RAW = [
    [1, "elbow", "Elbow", [[0, 0], [3, 0], [3, 2]]],
    [1, "staple", "Staple", [[0, 2], [0, 0], [3, 0], [3, 2]]],
    [1, "step", "Step", [[0, 0], [2, 0], [2, 2], [4, 2]]],
    [1, "triangle", "Triangle", [[0, 2.6], [3, 2.6], [1.5, 0], [0, 2.6]]],
    [1, "square", "Square", [[0, 0], [2.5, 0], [2.5, 2.5], [0, 2.5], [0, 0]]],
    [1, "bowtie", "Bow tie", [[0, 0], [4, 3], [4, 0], [0, 3], [0, 0]]],

    [2, "bolt", "Lightning bolt", [[2.5, 0], [0.5, 1.5], [2.5, 1.5], [0.5, 3], [2.5, 3], [0.5, 4.5]]],
    [2, "house", "House", [[0, 4], [0, 1.5], [1.5, 0], [3, 1.5], [3, 4], [0, 4]]],
    [2, "diamond", "Diamond", [[1.5, 0], [3, 2], [1.5, 4], [0, 2], [1.5, 0]]],
    [2, "stairs", "Stairs", [[0, 2.25], [1.25, 2.25], [1.25, 1.5], [2.5, 1.5], [2.5, 0.75], [3.75, 0.75], [3.75, 0], [5, 0]]],
    [2, "mountains", "Mountains", [[0, 3], [1.5, 1], [2.25, 2], [3.375, 0.5], [5.25, 3], [0, 3]]],
    [2, "crown", "Crown", [[0, 3], [0, 1], [0.75, 2], [1.5, 1], [2.25, 2], [3, 1], [3, 3], [0, 3]]],
    [2, "arrow", "Arrow", [[0, 1], [2.5, 1], [2.5, 0], [4.5, 1.75], [2.5, 3.5], [2.5, 2.5], [0, 2.5], [0, 1]]],
    [2, "spiral", "Square spiral", [[0, 0], [4, 0], [4, 4], [0, 4], [0, 1], [3, 1], [3, 3], [1, 3], [1, 2], [2, 2]]],

    [3, "fish", "Fish", [[4.5, 0.5], [3.25, 1.5], [1.75, 0.25], [0, 1.5], [1.75, 2.75], [3.25, 1.5], [4.5, 2.5], [4.5, 0.5]]],
    [3, "rocket", "Rocket", [[1.5, 0], [2.25, 1.25], [2.25, 3], [3, 4], [0, 4], [0.75, 3], [0.75, 1.25], [1.5, 0]]],
    [3, "cat", "Cat", [[0, 0], [1, 1], [3, 1], [4, 0], [4, 2.5], [3, 3.5], [1, 3.5], [0, 2.5], [0, 0]]],
    [3, "sailboat", "Sailboat", [[2, 2.6], [3.6, 2.6], [2, 0], [2, 3], [0, 3], [0.7, 3.8], [3.3, 3.8], [4, 3], [2, 3]]],
    [3, "airplane", "Airplane", [[2.5, 0], [5, 2.6], [3, 2.4], [3.7, 4], [2.5, 3.7], [1.3, 4], [2, 2.4], [0, 2.6], [2.5, 0]]],
    [3, "heart", "Heart", [[2.25, 4], [0, 1], [0.75, 0], [1.5, 0], [2.25, 1], [3, 0], [3.75, 0], [4.5, 1], [2.25, 4]]],
    [3, "star", "Star", starPoints()],
    [3, "tree", "Pine tree", [[2, 0], [3, 1.3], [2.5, 1.3], [3.6, 2.8], [2.3, 2.8], [2.3, 3.6], [1.7, 3.6], [1.7, 2.8], [0.4, 2.8], [1.5, 1.3], [1, 1.3], [2, 0]]],
  ];

  function norm180(d) { while (d > 180) d -= 360; while (d <= -180) d += 360; return d; }

  function makeShape(tier, id, name, raw) {
    const head = (i) => Math.atan2(raw[i + 1][1] - raw[i][1], raw[i + 1][0] - raw[i][0]) * DEG;
    const heading = Math.round(head(0));
    const bends = [];
    let s = 0;
    for (let i = 0; i < raw.length - 1; i++) {
      s += Math.max(STEP, r8(Math.hypot(raw[i + 1][0] - raw[i][0], raw[i + 1][1] - raw[i][1])));
      if (i < raw.length - 2) bends.push({ s, a: Math.round(norm180(head(i + 1) - head(i))) });
    }
    const wire = { len: s, heading, bends };
    return { id, name, tier, wire, start: { x: raw[0][0], y: raw[0][1] } };
  }
  const SHAPES = RAW.map((r) => makeShape(r[0], r[1], r[2], r[3]));
  const shapeById = (id) => SHAPES.find((s) => s.id === id) || null;

  // ---------- wire to drawing ----------
  // The corner points of a wire, starting from `start` (default 0,0): end A, each bend, end B.
  function wirePoints(wire, start) {
    let x = start ? start.x : 0, y = start ? start.y : 0, h = wire.heading / DEG, s0 = 0;
    const pts = [{ x, y }];
    for (const b of wire.bends) {
      x += (b.s - s0) * Math.cos(h); y += (b.s - s0) * Math.sin(h);
      pts.push({ x, y });
      h += b.a / DEG; s0 = b.s;
    }
    pts.push({ x: x + (wire.len - s0) * Math.cos(h), y: y + (wire.len - s0) * Math.sin(h) });
    return pts;
  }
  const shapePoints = (shape) => wirePoints(shape.wire, shape.start);

  // The heading (degrees) of each leg: leg 0 runs from A to the first bend.
  function legHeadings(wire) {
    const out = [wire.heading];
    for (const b of wire.bends) out.push(out[out.length - 1] + b.a);
    return out;
  }
  function legLengths(wire) {
    const out = [];
    let s0 = 0;
    for (const b of wire.bends) { out.push(b.s - s0); s0 = b.s; }
    out.push(wire.len - s0);
    return out;
  }

  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  // n points spaced evenly along a path of corner points
  function sample(pts, n) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const total = L[L.length - 1], out = [];
    let k = 1;
    for (let i = 0; i < n; i++) {
      const d = total * i / (n - 1);
      while (k < pts.length - 1 && L[k] < d) k++;
      const seg = L[k] - L[k - 1], t = seg > 0 ? (d - L[k - 1]) / seg : 0;
      out.push({ x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t });
    }
    return out;
  }

  // The nearest spot on a path to (x, y): how far along the wire it is, which leg, and how far away.
  // `skip(leg)` can leave legs out.
  function nearest(pts, x, y, skip) {
    let best = { d: Infinity, s: 0, leg: 0 }, run = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, ay = pts[i].y, dx = pts[i + 1].x - ax, dy = pts[i + 1].y - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0;
      const d = Math.hypot(x - ax - t * dx, y - ay - t * dy), len = Math.sqrt(l2);
      if (d < best.d && !(skip && skip(i))) best = { d, s: run + t * len, leg: i };
      run += len;
    }
    return best;
  }

  // ---------- changing a wire (each returns a new list of bends) ----------
  // Room a bend may slide in: at least 1/8" from the ends and from its neighbours.
  function room(wire, i) {
    const lo = (i > 0 ? wire.bends[i - 1].s : 0) + STEP;
    const hi = (i < wire.bends.length - 1 ? wire.bends[i + 1].s : wire.len) - STEP;
    return { lo, hi };
  }
  // Mark a new bend (still straight) at s. Returns { bends, index } or null if there is no room there.
  function addBend(wire, s) {
    s = clamp(r8(s), STEP, wire.len - STEP);
    if (wire.bends.some((b) => Math.abs(b.s - s) < STEP - 1e-9)) return null;
    const bends = wire.bends.map((b) => ({ s: b.s, a: b.a }));
    let i = 0;
    while (i < bends.length && bends[i].s < s) i++;
    bends.splice(i, 0, { s, a: 0 });
    return { bends, index: i };
  }
  function moveBend(wire, i, s) {
    const { lo, hi } = room(wire, i);
    if (hi < lo) return wire.bends;
    return wire.bends.map((b, k) => (k === i ? { s: clamp(r8(s), lo, hi), a: b.a } : b));
  }
  function turnBend(wire, i, a) {
    return wire.bends.map((b, k) => (k === i ? { s: b.s, a: clamp(Math.round(a), -MAX_TURN, MAX_TURN) } : b));
  }
  function removeBend(wire, i) { return wire.bends.filter((b, k) => k !== i); }

  // ---------- scoring ----------
  // Slide and turn path Q (no stretching, no flipping) to lie as closely as possible on path P.
  // Returns the turn (radians), the move, and what is left over: the typical gap between the two, in inches.
  function fit(P, Q) {
    const n = P.length;
    let px = 0, py = 0, qx = 0, qy = 0;
    for (let i = 0; i < n; i++) { px += P[i].x; py += P[i].y; qx += Q[i].x; qy += Q[i].y; }
    px /= n; py /= n; qx /= n; qy /= n;
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const ux = Q[i].x - qx, uy = Q[i].y - qy, vx = P[i].x - px, vy = P[i].y - py;
      a += ux * vx + uy * vy; b += ux * vy - uy * vx;
    }
    const rot = Math.atan2(b, a), c = Math.cos(rot), s = Math.sin(rot);
    const tx = px - (c * qx - s * qy), ty = py - (s * qx + c * qy);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const x = c * Q[i].x - s * Q[i].y + tx, y = s * Q[i].x + c * Q[i].y + ty;
      sum += (x - P[i].x) ** 2 + (y - P[i].y) ** 2;
    }
    return { rot, tx, ty, gap: Math.sqrt(sum / n) };
  }
  // How spread out a shape is: the typical distance of its wire from its middle.
  function spread(S) {
    let cx = 0, cy = 0, sum = 0;
    for (const p of S) { cx += p.x; cy += p.y; }
    cx /= S.length; cy /= S.length;
    for (const p of S) sum += (p.x - cx) ** 2 + (p.y - cy) ** 2;
    return Math.sqrt(sum / S.length);
  }

  const STARS = [60, 78, 90]; // score needed for 1, 2, 3 stars
  const stars = (score) => STARS.filter((t) => score >= t).length;

  // Score a set of bends against a shape, 0 to 100. Only the shape counts: the wire may sit anywhere, at any tilt.
  // The typical gap between wire and picture is measured against the size of the shape (or, for a shape
  // that is nearly a straight line, against how far a wire with no bends at all would be off, so that
  // an unbent wire never earns much).
  // `place` says how to move the PICTURE so it lies on the player's wire (for showing the comparison).
  function score(shape, bends) {
    const at = (b) => sample(wirePoints({ len: shape.wire.len, heading: shape.wire.heading, bends: b }, shape.start), SAMPLES);
    const P = at(bends), Q = at(shape.wire.bends);
    const f = fit(P, Q), rel = f.gap / Math.min(spread(Q), fit(at([]), Q).gap);
    const pts = Math.round(100 * Math.max(0, 1 - rel) ** 1.5);
    return { score: pts, stars: stars(pts), gap: f.gap, place: { rot: f.rot, tx: f.tx, ty: f.ty }, notes: notes(shape, bends) };
  }

  // ---------- plain-words help after a try ----------
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  // Inches as a shop fraction: 3.5 -> 3 1/2"
  function fmtIn(x, mark) {
    const neg = x < 0; x = Math.abs(x);
    let whole = Math.floor(x + 1e-9), num = Math.round((x - whole) * 16);
    if (num === 16) { whole++; num = 0; }
    const g = gcd(num, 16);
    const str = num ? (whole ? whole + " " : "") + num / g + "/" + 16 / g : String(whole);
    return (neg ? "-" : "") + str + (mark === false ? "" : "″");
  }
  const side = (a) => (a > 0 ? "right" : "left");
  function turnText(a) { return a === 0 ? "straight (not bent yet)" : Math.abs(a) + "° " + side(a); }

  // Up to three things to fix, biggest first. Empty when everything is within 1/16" and 2 degrees.
  function notes(shape, bends) {
    const want = shape.wire.bends, out = [];
    if (bends.length !== want.length) {
      const n = want.length, m = bends.length;
      return [`The picture has ${n} bend${n === 1 ? "" : "s"}; your wire has ${m === 0 ? "none" : m}.`];
    }
    const mine = legLengths({ len: shape.wire.len, bends }), goal = legLengths(shape.wire), found = [];
    for (let i = 0; i < want.length; i++) {
      const dl = mine[i] - goal[i], a = bends[i].a, t = want[i].a;
      if (Math.abs(dl) >= STEP - 1e-9) found.push({ size: Math.abs(dl) * 8, text: `Leg ${i + 1} is ${fmtIn(Math.abs(dl))} too ${dl > 0 ? "long" : "short"}.` });
      if (a !== 0 && t !== 0 && Math.sign(a) !== Math.sign(t)) found.push({ size: 99, text: `Bend ${i + 1} turns the wrong way.` });
      else if (Math.abs(a - t) >= 3) found.push({ size: Math.abs(a - t) / 3, text: `Bend ${i + 1} is ${Math.abs(Math.abs(a) - Math.abs(t))}° ${Math.abs(a) > Math.abs(t) ? "too sharp" : "too open"}.` });
    }
    found.sort((p, q) => q.size - p.size);
    for (const f of found.slice(0, 3)) out.push(f.text);
    return out;
  }

  // ---------- a pattern to make for real ----------
  // The steps to bend a wire, with every length multiplied by `scale`.
  function bendList(wire, scale) {
    scale = scale || 1;
    let s0 = 0;
    const rows = wire.bends.map((b, i) => {
      const row = { n: i + 1, mark: b.s * scale, leg: (b.s - s0) * scale, angle: Math.abs(b.a), dir: b.a === 0 ? "" : side(b.a) };
      s0 = b.s;
      return row;
    });
    return { cut: wire.len * scale, rows, lastLeg: (wire.len - s0) * scale };
  }

  const API = {
    DEG, STEP, MAX_TURN, TIERS, SHAPES, STARS, shapeById, wirePoints, shapePoints, legHeadings, legLengths, bbox, sample, nearest,
    room, addBend, moveBend, turnBend, removeBend, fit, spread, score, stars, notes, fmtIn, turnText, bendList, norm180, r8,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.BIR = API;
})(this);
