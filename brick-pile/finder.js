// Brick Pile: finding bricks in a picture on the device itself, with no AI and no internet.
// It cannot tell a 2 x 4 brick from a 2 x 3 plate. What it can do: work out the colour of the table from the edges of the
// picture, find every patch that is a different colour, and call each patch a small, medium or large piece of that colour.
// The builder then fixes the list by hand. Nothing here touches the screen, so tests/brick-pile.test.js can run it.
(function (root) {
  "use strict";
  const NAMES = ["red", "orange", "yellow", "tan", "brown", "lime", "green", "light blue", "blue", "purple", "pink", "white", "light gray", "dark gray", "black"];
  const EDGE = 320; // the picture is shrunk to this many pixels on its longest side before it is looked at

  // Name the colour of one pixel. Hue (which colour) is used rather than brightness, so a brick's shaded side
  // is still called the same colour as its top.
  function colourOf(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, v = mx / 255, s = mx ? d / mx : 0;
    if (d < 28 || s < 0.16) return v > 0.8 ? "white" : v > 0.52 ? "light gray" : v > 0.26 ? "dark gray" : "black";
    if (v < 0.16) return "black";
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    if (h < 14 || h >= 345) return s < 0.45 && v > 0.7 ? "pink" : "red";
    if (h < 42) return v < 0.55 ? "brown" : s < 0.45 ? "tan" : "orange";
    if (h < 68) return s < 0.42 ? "tan" : "yellow";
    if (h < 95) return "lime";
    if (h < 165) return "green";
    if (h < 200) return "light blue";
    if (h < 255) return v > 0.8 && s < 0.5 ? "light blue" : "blue";
    if (h < 295) return "purple";
    return v < 0.5 ? "purple" : "pink";
  }
  const median = (a) => { const s = Array.from(a).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  // rgba: the picture's pixels, four numbers each (red, green, blue, see-through), w across and h down.
  function findBricks(rgba, w, h) {
    const n = w * h, rim = Math.max(2, Math.round(Math.min(w, h) * 0.04));
    // 1. The table's colour is the middle colour of the picture's rim.
    const br = [], bg = [], bb = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x >= rim && x < w - rim && y >= rim && y < h - rim) { x = w - rim - 1; continue; }
      const i = (y * w + x) * 4; br.push(rgba[i]); bg.push(rgba[i + 1]); bb.push(rgba[i + 2]);
    }
    const R = median(br), G = median(bg), Bl = median(bb), Y0 = 0.299 * R + 0.587 * G + 0.114 * Bl, cr0 = R - Y0, cb0 = Bl - Y0;
    // 2. A pixel belongs to a piece if its colour is unlike the table's, or it is a lot darker or lighter.
    //    A soft shadow is only a little darker and the same colour as the table, so it is left out.
    let cls = new Uint8Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const dc = Math.hypot(r - Y - cr0, b - Y - cb0), dl = Y - Y0;
      if (dc > 30 || dl < -75 || dl > 60) cls[p] = NAMES.indexOf(colourOf(r, g, b)) + 1;
    }
    // 3. Tidy up speckles: each pixel takes the commonest answer among itself and its eight neighbours.
    const tidy = new Uint8Array(n), votes = new Uint8Array(NAMES.length + 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      votes.fill(0); let best = 0, bestN = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const c = cls[yy * w + xx], k = ++votes[c]; if (k > bestN) { bestN = k; best = c; }
      }
      tidy[y * w + x] = best;
    }
    cls = tidy;
    // 4. Gather touching pixels of one colour into patches, and measure each patch's length and width.
    const seen = new Uint8Array(n), stack = new Int32Array(n), blobs = [], least = Math.max(12, n * 0.0006);
    for (let start = 0; start < n; start++) {
      if (!cls[start] || seen[start]) continue;
      const c = cls[start]; let top = 0, m = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      stack[top++] = start; seen[start] = 1;
      while (top) {
        const p = stack[--top], x = p % w, y = (p - x) / w;
        m++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
        if (x > 0 && !seen[p - 1] && cls[p - 1] === c) { seen[p - 1] = 1; stack[top++] = p - 1; }
        if (x < w - 1 && !seen[p + 1] && cls[p + 1] === c) { seen[p + 1] = 1; stack[top++] = p + 1; }
        if (y > 0 && !seen[p - w] && cls[p - w] === c) { seen[p - w] = 1; stack[top++] = p - w; }
        if (y < h - 1 && !seen[p + w] && cls[p + w] === c) { seen[p + w] = 1; stack[top++] = p + w; }
      }
      if (m < least || m > n * 0.3) continue; // a speck, or something far too big to be a brick
      const mx = sx / m, my = sy / m, a = sxx / m - mx * mx, b = sxy / m - mx * my, d = syy / m - my * my;
      const mid = (a + d) / 2, off = Math.sqrt(Math.max(0, ((a - d) / 2) ** 2 + b * b));
      blobs.push({ color: NAMES[c - 1], area: m, long: Math.sqrt(12 * Math.max(mid + off, 1 / 12)), short: Math.sqrt(12 * Math.max(mid - off, 1 / 12)), x: mx, y: my });
    }
    // 5. Sizes are judged against each other: the usual width of a piece here stands for a 2-stud brick.
    const unit = median(blobs.map((b) => b.short)) || 1, kept = blobs.filter((b) => b.short >= unit * 0.3); // thin slivers are shadows and edges
    const counts = new Map();
    for (const b of kept) {
      const rel = b.area / (unit * unit); b.size = rel < 0.7 ? "small" : rel < 1.75 ? "medium" : "large";
      b.count = rel > 6 ? Math.min(12, Math.round(rel / 2)) : 1; // a very big patch is probably several bricks of one colour touching
      const k = b.size + "|" + b.color; counts.set(k, (counts.get(k) || 0) + b.count);
    }
    const items = Array.from(counts, ([k, count]) => { const [size, color] = k.split("|"); return { name: size + " brick", kind: "brick", color, count, unsure: true }; });
    return { items, blobs: kept, table: colourOf(R, G, Bl) };
  }

  const api = { EDGE, NAMES, colourOf, findBricks };
  root.BrickFinder = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
