// Knot of the Day — rope drawing engine.
// Each knot is one or two rope "strands" given as control points. The rope is
// smoothed, crossings are found automatically, and each crossing is drawn
// over/under according to the knot's crossing string: for every crossing the
// moving end reaches (in order), 'o' = it goes over, 'u' = it goes under.
const KnotEngine = (() => {
  const W = 13; // rope width in drawing units
  const SAMPLES = 10;

  function sample(pts) {
    const P = [pts[0], ...pts, pts[pts.length - 1]];
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [p0, p1, p2, p3] = [P[i], P[i + 1], P[i + 2], P[i + 3]];
      for (let k = 0; k < SAMPLES; k++) {
        const t = k / SAMPLES, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]), u: i + t });
      }
    }
    const L = pts[pts.length - 1];
    out.push({ x: L[0], y: L[1], u: pts.length - 1 });
    let s = 0;
    out[0].s = 0;
    for (let i = 1; i < out.length; i++) {
      s += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
      out[i].s = s;
    }
    return out;
  }

  function segX(a, b, c, d) {
    const r = { x: b.x - a.x, y: b.y - a.y }, q = { x: d.x - c.x, y: d.y - c.y };
    const den = r.x * q.y - r.y * q.x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / den;
    const v = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    if (t < 0 || t >= 1 || v < 0 || v >= 1) return null;
    return { t, v, x: a.x + t * r.x, y: a.y + t * r.y };
  }

  const lerp = (p, q, t, k) => p[k] + (q[k] - p[k]) * t;
  const inRanges = (ranges, si, u) => (ranges || []).some(([s, a, b]) => s === si && u >= a && u <= b);

  function prepare(knot) {
    const S = knot.strands.map(st => sample(st.pts));
    const cr = [];
    for (let a = 0; a < S.length; a++) for (let b = a; b < S.length; b++) {
      const A = S[a], B = S[b];
      for (let i = 0; i < A.length - 1; i++) {
        for (let j = (a === b ? i + 2 : 0); j < B.length - 1; j++) {
          const hit = segX(A[i], A[i + 1], B[j], B[j + 1]);
          if (!hit) continue;
          const pa = { strand: a, u: lerp(A[i], A[i + 1], hit.t, 'u'), s: lerp(A[i], A[i + 1], hit.t, 's') };
          const pb = { strand: b, u: lerp(B[j], B[j + 1], hit.v, 'u'), s: lerp(B[j], B[j + 1], hit.v, 's') };
          if (a === b && Math.abs(pa.s - pb.s) < 30) continue;
          if (cr.some(c => Math.hypot(c.x - hit.x, c.y - hit.y) < 3)) continue;
          cr.push({ x: hit.x, y: hit.y, pa, pb });
        }
      }
    }
    // Who arrives later at each crossing (the moving end)?
    const later = c => (c.pb.strand > c.pa.strand || (c.pb.strand === c.pa.strand && c.pb.u > c.pa.u)) ? 'pb' : 'pa';
    const visible = c => !inRanges(knot.behind, c.pa.strand, c.pa.u) && !inRanges(knot.behind, c.pb.strand, c.pb.u);
    knot.strands.forEach((st, si) => {
      const mine = cr.filter(c => visible(c) && c[later(c)].strand === si).sort((x, y) => x[later(x)].u - y[later(y)].u);
      mine.forEach((c, k) => {
        const letter = (st.x || '')[k] || 'o';
        const L = c[later(c)], E = c[later(c) === 'pa' ? 'pb' : 'pa'];
        c.over = letter === 'o' ? L : E;
        c.under = letter === 'o' ? E : L;
        c.label = `${si}${letter}${k}`;
      });
    });
    cr.forEach(c => { if (!c.over) { c.over = c.pb; c.under = c.pa; c.label = 'h'; } });
    return { knot, S, cr };
  }

  // Samples with u in [u0, u1], with interpolated end points.
  function slice(samples, u0, u1) {
    const out = [];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      if (p.u >= u0 && p.u <= u1) {
        if (!out.length && i > 0 && samples[i - 1].u < u0) out.push(interp(samples[i - 1], p, u0));
        out.push(p);
      } else if (p.u > u1) {
        if (i > 0 && samples[i - 1].u <= u1 && samples[i - 1].u >= u0 - 1e-9) out.push(interp(samples[i - 1], p, u1));
        else if (!out.length && i > 0 && samples[i - 1].u < u0) { out.push(interp(samples[i - 1], p, u0)); out.push(interp(samples[i - 1], p, u1)); }
        break;
      }
    }
    return out;
  }
  function interp(p, q, u) {
    const t = (u - p.u) / ((q.u - p.u) || 1);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, u, s: p.s + (q.s - p.s) * t };
  }
  function sliceS(samples, s0, s1) {
    const out = [];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      if (p.s >= s0 && p.s <= s1) {
        if (!out.length && i > 0) out.push(interpS(samples[i - 1], p, s0));
        out.push(p);
      } else if (p.s > s1) { if (out.length) out.push(interpS(samples[i - 1], p, s1)); break; }
    }
    return out;
  }
  function interpS(p, q, s) {
    const t = (s - p.s) / ((q.s - p.s) || 1);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, u: p.u + (q.u - p.u) * t, s };
  }

  const d = pts => pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('');

  const COLORS = {
    tan: { body: '#d8b67a', dark: '#5a3d1c', lay: '#8a6431', hi: '#f6e3b8' },
    navy: { body: '#3f6aa8', dark: '#14243f', lay: '#1d355c', hi: '#a9c4ec' },
  };

  function rope(pts, colorName, cap) {
    if (pts.length < 2) return '';
    const c = COLORS[colorName] || COLORS.tan;
    const D = d(pts), off = pts[0].s.toFixed(1);
    return `<g stroke-linecap="${cap}" stroke-linejoin="round" fill="none">` +
      `<path d="${D}" stroke="${c.dark}" stroke-width="${W + 4}"/>` +
      `<path d="${D}" stroke="${c.body}" stroke-width="${W}"/>` +
      `<path d="${D}" stroke="${c.lay}" stroke-width="${W - 2}" stroke-dasharray="2.2 5.3" stroke-dashoffset="${off}" opacity=".35" stroke-linecap="butt"/>` +
      `<path d="${D}" stroke="${c.hi}" stroke-width="2.4" opacity=".55" transform="translate(-1.2,-1.6)"/>` +
      `</g>`;
  }

  // reveal: one entry per strand: a number u (rope laid from its start to u)
  // or [a, b] (only the stretch from a to b is laid). next: same, for the arrow.
  const rng = v => Array.isArray(v) ? v : [0, v];
  function render(prep, reveal, next, opts = {}) {
    const { knot, S, cr } = prep;
    const R = reveal.map(rng), N = next ? next.map(rng) : null;
    const shown = (si, u) => u >= R[si][0] - 1e-6 && u <= R[si][1] + 1e-6 && R[si][1] > R[si][0];
    let out = '';
    out += knot.bg || '';
    S.forEach((s, i) => { if (R[i][1] > R[i][0]) out += rope(slice(s, R[i][0], R[i][1]), knot.strands[i].color, 'round'); });
    if (knot.obj) {
      out += knot.obj;
      S.forEach((s, i) => {
        const [a0, b0] = R[i];
        if (b0 <= a0) return;
        const cuts = (knot.behind || []).filter(r => r[0] === i).map(r => [r[1], r[2]]).sort((a, b) => a[0] - b[0]);
        let u = a0;
        const pieces = [];
        cuts.forEach(([a, b]) => { if (a > u) pieces.push([u, Math.min(a, b0)]); u = Math.max(u, b); });
        pieces.push([u, b0]);
        pieces.forEach(([a, b]) => { if (b > a) out += rope(slice(s, a, b), knot.strands[i].color, 'butt'); });
        if (!inRanges(knot.behind, i, b0)) out += rope(slice(s, Math.max(a0, b0 - 0.15), b0), knot.strands[i].color, 'round');
        if (a0 > 0 && !inRanges(knot.behind, i, a0)) out += rope(slice(s, a0, Math.min(b0, a0 + 0.15)), knot.strands[i].color, 'round');
      });
    }
    cr.forEach(c => {
      if (!shown(c.over.strand, c.over.u) || !shown(c.under.strand, c.under.u)) return;
      if (inRanges(knot.behind, c.over.strand, c.over.u)) return;
      const s = S[c.over.strand], [a0, b0] = R[c.over.strand];
      const vis = slice(s, a0, b0), minS = vis[0].s, maxS = vis[vis.length - 1].s;
      const piece = sliceS(s, Math.max(minS, c.over.s - 15), Math.min(maxS, c.over.s + 15));
      out += rope(piece, knot.strands[c.over.strand].color, 'butt');
      // keep rope ends rounded if they sit inside this overlay
      if (maxS < c.over.s + 15) out += rope(sliceS(s, maxS - 1, maxS), knot.strands[c.over.strand].color, 'round');
      if (minS > c.over.s - 15 && a0 > 0) out += rope(sliceS(s, minS, minS + 1), knot.strands[c.over.strand].color, 'round');
    });
    const arrow = p => p.length < 2 ? '' : `<path d="${d(p)}" fill="none" stroke="#c0392b" stroke-width="3.2" stroke-dasharray="7 6" stroke-linecap="round" marker-end="url(#kd-arrow)" opacity=".9"/>`;
    if (N) S.forEach((s, i) => {
      if (N[i][1] > R[i][1]) out += arrow(slice(s, R[i][1], N[i][1]));
      if (N[i][0] < R[i][0]) out += arrow(slice(s, N[i][0], R[i][0]).reverse());
    });
    if (opts.debug) cr.forEach(c => {
      out += `<circle cx="${c.x}" cy="${c.y}" r="3" fill="red"/><text x="${c.x + 5}" y="${c.y - 5}" font-size="10" fill="red">${c.label}</text>`;
    });
    if (opts.debug) knot.strands.forEach((st, si) => st.pts.forEach((p, k) => {
      out += `<text x="${p[0]}" y="${p[1]}" font-size="8" fill="#090">${k}</text>`;
    }));
    const defs = `<defs><marker id="kd-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#c0392b"/></marker></defs>`;
    return `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" role="img">${defs}${out}</svg>`;
  }

  return { prepare, render };
})();
if (typeof module !== 'undefined') module.exports = KnotEngine;
