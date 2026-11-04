// Wire Bender geometry: turns a drawn centerline (points in inches) into
// real bends with a radius, a cut length, a bend list, and drawable paths.
// Screen coordinates: x to the right, y DOWN (so a positive cross product = a right turn).
(function (root) {
  'use strict';
  const EPS = 1e-9;
  const DEG = 180 / Math.PI;
  const MIN_BEND_DEG = 0.25;   // smaller than this counts as straight
  const MAX_BEND_DEG = 179;    // a true 180 hairpin has no tangent points

  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const len = v => Math.hypot(v.x, v.y);
  const unit = v => { const l = len(v); return l < EPS ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l }; };

  function cleanPoints(pts) {
    const out = [];
    for (const p of pts || []) {
      if (!isFinite(p.x) || !isFinite(p.y)) continue;
      if (!out.length || len(sub(p, out[out.length - 1])) > 1e-6) out.push({ x: p.x, y: p.y });
    }
    return out;
  }

  // Main analysis. opts: { wireDia, insideRadius, tail }
  function analyze(pointsIn, opts) {
    const pts = cleanPoints(pointsIn);
    const d = Math.max(0, +opts.wireDia || 0);
    const ri = Math.max(0, +opts.insideRadius || 0);
    const tail = Math.max(0, +opts.tail || 0);
    const R = ri + d / 2; // centerline bend radius
    const n = pts.length;
    const res = { points: pts, wireDia: d, insideRadius: ri, R, tail, segments: [], bends: [], pieces: [], warnings: [], cutLength: 0, ok: n >= 2 };
    if (n < 2) return res;

    const seg = [];
    for (let i = 0; i < n - 1; i++) {
      const v = sub(pts[i + 1], pts[i]);
      seg.push({ L: len(v), u: unit(v) });
    }

    const T = new Array(n).fill(0);
    const bendAt = new Array(n).fill(null);
    for (let k = 1; k < n - 1; k++) {
      const u1 = seg[k - 1].u, u2 = seg[k].u;
      const cross = u1.x * u2.y - u1.y * u2.x;
      const dot = u1.x * u2.x + u1.y * u2.y;
      const theta = Math.atan2(cross, dot);
      let a = Math.abs(theta);
      if (a * DEG < MIN_BEND_DEG) continue;
      if (a * DEG > MAX_BEND_DEG) {
        res.warnings.push({ kind: 'hairpin', vertex: k, text: 'A corner folds almost straight back on itself. Real wire needs a loop there; the most this app can work out is ' + MAX_BEND_DEG + '°.' });
        a = MAX_BEND_DEG / DEG;
      }
      const P = pts[k];
      const t = R * Math.tan(a / 2);
      T[k] = t;
      const right = theta > 0;
      const nrm = right ? { x: -u1.y, y: u1.x } : { x: u1.y, y: -u1.x };
      const A = sub(P, mul(u1, t));
      const B = add(P, mul(u2, t));
      const C = add(A, mul(nrm, R));
      const out = unit(sub(P, C));
      const mid = R > EPS ? add(C, mul(out, R)) : { x: P.x, y: P.y };
      bendAt[k] = {
        vertex: k, angle: a * DEG, dir: right ? 'R' : 'L', signed: (right ? 1 : -1) * a * DEG,
        tangent: t, arc: R * a, corner: P, A, B, C, mid, outward: R > EPS ? out : unit(sub(u1, u2))
      };
    }

    let pos = tail;
    let from = pts[0];
    for (let j = 0; j < n - 1; j++) {
      const straight = seg[j].L - T[j] - T[j + 1];
      const s = { index: j, length: seg[j].L, straight, start: pos, heading: Math.atan2(seg[j].u.y, seg[j].u.x) * DEG };
      if (straight < -1e-6) {
        res.warnings.push({ kind: 'short', segment: j, text: 'Leg ' + (j + 1) + ' is too short for the bend radius at its ends (needs about ' + (T[j] + T[j + 1]).toFixed(3) + ' in). Make it longer or use a tighter radius.' });
        res.ok = false;
      }
      pos += Math.max(0, straight);
      s.end = pos;
      res.segments.push(s);
      const b = bendAt[j + 1];
      const to = b ? b.A : pts[j + 1];
      res.pieces.push({ type: 'line', a: from, b: to });
      if (b) {
        b.number = res.bends.length + 1;
        b.start = pos; b.center = pos + b.arc / 2; b.end = pos + b.arc;
        b.straightBefore = Math.max(0, straight);
        pos = b.end;
        res.bends.push(b);
        res.pieces.push({ type: 'arc', a: b.A, b: b.B, C: b.C, R, sweep: b.dir === 'R' ? 1 : 0 });
        from = b.B;
      }
    }
    for (let i = 0; i < res.bends.length; i++) {
      const b = res.bends[i];
      const segAfter = res.segments[b.vertex];
      b.straightAfter = Math.max(0, segAfter.straight);
    }
    res.cutLength = pos + tail;
    res.endA = pts[0]; res.endB = pts[n - 1];
    res.dirA = seg[0].u; res.dirB = seg[n - 2].u;

    // bounding box of the centerline path
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); };
    for (const pc of res.pieces) {
      grow(pc.a); grow(pc.b);
      if (pc.type === 'arc') { for (let s = 1; s < 8; s++) grow(arcPoint(pc, s / 8)); }
    }
    res.bbox = { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
    return res;
  }

  function arcPoint(pc, f) {
    const a0 = Math.atan2(pc.a.y - pc.C.y, pc.a.x - pc.C.x);
    let a1 = Math.atan2(pc.b.y - pc.C.y, pc.b.x - pc.C.x);
    // sweep 1 = clockwise on screen = increasing angle in y-down coordinates
    let da = a1 - a0;
    if (pc.sweep === 1) { while (da < 0) da += 2 * Math.PI; } else { while (da > 0) da -= 2 * Math.PI; }
    const a = a0 + da * f;
    return { x: pc.C.x + pc.R * Math.cos(a), y: pc.C.y + pc.R * Math.sin(a) };
  }

  const r4 = v => Math.round(v * 10000) / 10000;
  function pathD(res) {
    if (!res.pieces.length) return '';
    let d = 'M' + r4(res.pieces[0].a.x) + ' ' + r4(res.pieces[0].a.y);
    for (const pc of res.pieces) {
      if (pc.type === 'line') d += ' L' + r4(pc.b.x) + ' ' + r4(pc.b.y);
      else if (pc.R > EPS) d += ' A' + r4(pc.R) + ' ' + r4(pc.R) + ' 0 0 ' + pc.sweep + ' ' + r4(pc.b.x) + ' ' + r4(pc.b.y);
      else d += ' L' + r4(pc.b.x) + ' ' + r4(pc.b.y);
    }
    return d;
  }

  // DXF (R12, inches) of the wire centerline: LINE and ARC entities, y flipped to point up.
  function toDXF(res) {
    const out = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '1', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
    const f = v => (Math.round(v * 1e6) / 1e6).toString();
    const ang = (p, C) => { let a = Math.atan2(-(p.y) - (-C.y), p.x - C.x) * DEG; if (a < 0) a += 360; return a; };
    for (const pc of res.pieces) {
      if (pc.type === 'line' || pc.R < EPS) {
        if (len(sub(pc.a, pc.b)) < 1e-6) continue;
        out.push('0', 'LINE', '8', 'WIRE', '10', f(pc.a.x), '20', f(-pc.a.y), '30', '0', '11', f(pc.b.x), '21', f(-pc.b.y), '31', '0');
      } else {
        // Screen clockwise (sweep 1) is clockwise in y-up too, so the CCW DXF arc runs B -> A.
        const sa = pc.sweep === 1 ? ang(pc.b, pc.C) : ang(pc.a, pc.C);
        const ea = pc.sweep === 1 ? ang(pc.a, pc.C) : ang(pc.b, pc.C);
        out.push('0', 'ARC', '8', 'WIRE', '10', f(pc.C.x), '20', f(-pc.C.y), '30', '0', '40', f(pc.R), '50', f(sa), '51', f(ea));
      }
    }
    out.push('0', 'ENDSEC', '0', 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  // ---- inches as shop fractions ----
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function fmtIn(x, denom, withMark) {
    denom = denom || 16;
    if (!isFinite(x)) return '—';
    const neg = x < 0; x = Math.abs(x);
    let whole = Math.floor(x + 1e-9);
    let num = Math.round((x - whole) * denom);
    if (num === denom) { whole += 1; num = 0; }
    let s = '';
    if (num) { const g = gcd(num, denom); s = (whole ? whole + ' ' : '') + (num / g) + '/' + (denom / g); }
    else s = String(whole);
    return (neg ? '−' : '') + s + (withMark === false ? '' : '"');
  }
  function fmtDec(x, places) { return isFinite(x) ? x.toFixed(places == null ? 3 : places) : '—'; }

  // Accepts 3.5, 3 1/2, 3-1/2, 7/8, 3.5", 89mm, 8.9 cm. Returns inches or NaN.
  function parseLen(str) {
    if (str == null) return NaN;
    let s = String(str).trim().toLowerCase().replace(/[”″"]|in(ch(es)?)?\b/g, '').trim();
    let scale = 1;
    const mm = s.match(/^(.*?)(mm|cm)$/);
    if (mm) { s = mm[1].trim(); scale = mm[2] === 'mm' ? 1 / 25.4 : 1 / 2.54; }
    let m;
    if ((m = s.match(/^(\d+(?:\.\d+)?)$/)) || (m = s.match(/^(\.\d+)$/))) return parseFloat(m[1]) * scale;
    if ((m = s.match(/^(\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)$/))) return (+m[1] + (+m[2]) / (+m[3])) * scale;
    if ((m = s.match(/^(\d+)\s*\/\s*(\d+)$/))) return ((+m[1]) / (+m[2])) * scale;
    return NaN;
  }

  // Rebuild points from typed legs: legs[i] = { length, turn } (turn in degrees, + right, - left, ignored for leg 0)
  function pointsFromLegs(start, heading0Deg, legs) {
    const pts = [{ x: start.x, y: start.y }];
    let h = heading0Deg / DEG;
    legs.forEach((leg, i) => {
      if (i > 0) h += (leg.turn || 0) / DEG;
      const p = pts[pts.length - 1];
      pts.push({ x: p.x + leg.length * Math.cos(h), y: p.y + leg.length * Math.sin(h) });
    });
    return pts;
  }

  function legsFromPoints(pts) {
    const legs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const v = sub(pts[i + 1], pts[i]);
      let turn = 0;
      if (i > 0) {
        const u1 = unit(sub(pts[i], pts[i - 1])), u2 = unit(v);
        turn = Math.atan2(u1.x * u2.y - u1.y * u2.x, u1.x * u2.x + u1.y * u2.y) * DEG;
      }
      legs.push({ length: len(v), turn });
    }
    return legs;
  }

  const G = { analyze, pathD, toDXF, fmtIn, fmtDec, parseLen, pointsFromLegs, legsFromPoints, arcPoint, cleanPoints };
  if (typeof module !== 'undefined' && module.exports) module.exports = G; else root.WireGeom = G;
})(this);
