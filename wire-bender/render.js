// Builds the full-size (1:1) template drawings as SVG text, sized in real inches.
(function (root) {
  'use strict';
  const G = root.WireGeom || (typeof require !== 'undefined' ? require('./geom.js') : null);
  const r4 = v => Math.round(v * 10000) / 10000;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const PAGE = { w: 8.5, h: 11, margin: 0.5, overlap: 0.5 };
  PAGE.cw = PAGE.w - 2 * PAGE.margin; // 7.5 printable width per sheet
  PAGE.ch = PAGE.h - 2 * PAGE.margin; // 10 printable height per sheet
  const LABEL_MARGIN = 0.9;           // room around the wire for numbers and labels

  // The drawing itself (wire, centerline, bend marks, end labels) for a region of the design.
  function drawing(res) {
    const d = Math.max(res.wireDia, 0.02);
    const half = d / 2;
    const parts = [];
    parts.push('<path d="' + G.pathD(res) + '" fill="none" stroke="#e7b48c" stroke-width="' + r4(d) + '" stroke-linecap="round" stroke-linejoin="round"/>');
    parts.push('<path d="' + G.pathD(res) + '" fill="none" stroke="#1d232b" stroke-width="0.012" stroke-linejoin="round"/>');
    for (const b of res.bends) {
      // tangent points (where the bend starts and ends): short thin ticks
      for (const [p, u] of [[b.A, perp(b.A, b.corner)], [b.B, perp(b.B, b.corner)]]) {
        const e = half + 0.08;
        parts.push(line(p.x - u.x * e, p.y - u.y * e, p.x + u.x * e, p.y + u.y * e, '#6b7380', 0.008));
      }
      const o = b.outward;
      const e1 = half + 0.04, e2 = half + 0.2;
      // center-of-bend mark: heavy red tick on the outside of the bend, thin across the wire
      parts.push(line(b.mid.x - o.x * e1, b.mid.y - o.y * e1, b.mid.x + o.x * e2, b.mid.y + o.y * e2, '#b0322a', 0.022));
      const lp = { x: b.mid.x + o.x * (half + 0.4), y: b.mid.y + o.y * (half + 0.4) };
      parts.push('<circle cx="' + r4(lp.x) + '" cy="' + r4(lp.y) + '" r="0.15" fill="#fff" stroke="#b0322a" stroke-width="0.016"/>');
      parts.push(text(lp.x, lp.y + 0.065, String(b.number), 0.19, '#b0322a', 'bold'));
      const ap = { x: b.mid.x + o.x * (half + 0.68), y: b.mid.y + o.y * (half + 0.68) };
      parts.push(text(ap.x, ap.y + 0.04, Math.round(b.angle) + '° ' + (b.dir === 'R' ? 'R' : 'L'), 0.12, '#1d232b', 'normal'));
    }
    // ends
    const A = res.endA, B = res.endB;
    parts.push('<circle cx="' + r4(A.x) + '" cy="' + r4(A.y) + '" r="' + r4(half + 0.03) + '" fill="#1d232b"/>');
    const la = { x: A.x - res.dirA.x * (half + 0.32), y: A.y - res.dirA.y * (half + 0.32) };
    parts.push(text(la.x, la.y + 0.08, 'A', 0.24, '#1c2f4f', 'bold'));
    const lb = { x: B.x + res.dirB.x * (half + 0.32), y: B.y + res.dirB.y * (half + 0.32) };
    parts.push(text(lb.x, lb.y + 0.08, 'B', 0.24, '#1c2f4f', 'bold'));
    if (res.tail > 0) {
      // show the extra (to be trimmed) beyond each end as a dashed line
      const ta = { x: A.x - res.dirA.x * res.tail, y: A.y - res.dirA.y * res.tail };
      const tb = { x: B.x + res.dirB.x * res.tail, y: B.y + res.dirB.y * res.tail };
      parts.push('<path d="M' + r4(A.x) + ' ' + r4(A.y) + 'L' + r4(ta.x) + ' ' + r4(ta.y) + 'M' + r4(B.x) + ' ' + r4(B.y) + 'L' + r4(tb.x) + ' ' + r4(tb.y) + '" stroke="#6b7380" stroke-width="0.012" stroke-dasharray="0.06 0.05" fill="none"/>');
    }
    return parts.join('');
  }
  function perp(p, corner) { const v = { x: corner.x - p.x, y: corner.y - p.y }; const l = Math.hypot(v.x, v.y) || 1; return { x: -v.y / l, y: v.x / l }; }
  function line(x1, y1, x2, y2, c, w) { return '<line x1="' + r4(x1) + '" y1="' + r4(y1) + '" x2="' + r4(x2) + '" y2="' + r4(y2) + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>'; }
  function text(x, y, s, size, fill, weight) { return '<text x="' + r4(x) + '" y="' + r4(y) + '" font-size="' + size + '" fill="' + fill + '" font-weight="' + weight + '" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">' + esc(s) + '</text>'; }

  function grid(x, y, w, h) {
    let g = '';
    for (let gx = Math.ceil(x); gx <= x + w; gx++) g += line(gx, y, gx, y + h, '#d5d9de', 0.006);
    for (let gy = Math.ceil(y); gy <= y + h; gy++) g += line(x, gy, x + w, gy, '#d5d9de', 0.006);
    return g;
  }

  // Region of the design covered by the template, centered across the sheets.
  function layout(res) {
    const bb = res.bbox, ext = Math.max(res.tail, 0) + LABEL_MARGIN;
    const W = bb.w + 2 * ext, H = bb.h + 2 * ext;
    const stepX = PAGE.cw - PAGE.overlap, stepY = PAGE.ch - PAGE.overlap;
    const cols = W <= PAGE.cw ? 1 : Math.ceil((W - PAGE.overlap) / stepX);
    const rows = H <= PAGE.ch ? 1 : Math.ceil((H - PAGE.overlap) / stepY);
    const totW = cols * stepX + PAGE.overlap, totH = rows * stepY + PAGE.overlap;
    const x0 = bb.minX - ext - (totW - W) / 2, y0 = bb.minY - ext - (totH - H) / 2;
    const tiles = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      tiles.push({ row: r, col: c, x: x0 + c * stepX, y: y0 + r * stepY, w: PAGE.cw, h: PAGE.ch });
    }
    return { cols, rows, tiles, stepX, stepY, x0, y0, W, H };
  }

  // One printed sheet's SVG (7.5 x 10 in).
  function tileSVG(res, lay, t) {
    const body = drawing(res);
    let guides = '';
    const dash = ' stroke-dasharray="0.15 0.1"';
    const gl = (x1, y1, x2, y2) => '<line x1="' + r4(x1) + '" y1="' + r4(y1) + '" x2="' + r4(x2) + '" y2="' + r4(y2) + '" stroke="#2a4470" stroke-width="0.012"' + dash + '/>';
    if (t.col < lay.cols - 1) guides += gl(t.x + lay.stepX, t.y, t.x + lay.stepX, t.y + t.h);
    if (t.col > 0) guides += gl(t.x + PAGE.overlap, t.y, t.x + PAGE.overlap, t.y + t.h);
    if (t.row < lay.rows - 1) guides += gl(t.x, t.y + lay.stepY, t.x + t.w, t.y + lay.stepY);
    if (t.row > 0) guides += gl(t.x, t.y + PAGE.overlap, t.x + t.w, t.y + PAGE.overlap);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + t.w + 'in" height="' + t.h + 'in" viewBox="' + r4(t.x) + ' ' + r4(t.y) + ' ' + t.w + ' ' + t.h + '">' +
      '<rect x="' + r4(t.x) + '" y="' + r4(t.y) + '" width="' + t.w + '" height="' + t.h + '" fill="#fff"/>' +
      grid(t.x, t.y, t.w, t.h) + guides + body +
      '<rect x="' + r4(t.x) + '" y="' + r4(t.y) + '" width="' + t.w + '" height="' + t.h + '" fill="none" stroke="#9aa3ad" stroke-width="0.01"/></svg>';
  }

  // Single full-size SVG of the whole template (for a large-format printer, or to import).
  function fullSVG(res, title) {
    const ext = Math.max(res.tail, 0) + LABEL_MARGIN;
    const x = res.bbox.minX - ext, y = res.bbox.minY - ext - 0.4;
    const w = res.bbox.w + 2 * ext, h = res.bbox.h + 2 * ext + 0.4;
    const W = Math.max(w, 3);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="' + r4(W) + 'in" height="' + r4(h) + 'in" viewBox="' + r4(x) + ' ' + r4(y) + ' ' + r4(W) + ' ' + r4(h) + '">' +
      '<rect x="' + r4(x) + '" y="' + r4(y) + '" width="' + r4(W) + '" height="' + r4(h) + '" fill="#fff"/>' + grid(x, y, W, h) + drawing(res) +
      '<text x="' + r4(x + 0.15) + '" y="' + r4(y + 0.28) + '" font-size="0.16" font-family="Helvetica, Arial, sans-serif" fill="#1d232b">' + esc(title) + ' — full size, 1-inch grid. Cut length ' + G.fmtIn(res.cutLength) + '</text></svg>';
  }

  const R = { PAGE, layout, tileSVG, fullSVG, drawing };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.WireRender = R;
})(this);
