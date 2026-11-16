// Blue Book — finds the page in a photo, straightens it, and prepares it for reading. All on the phone.
(function (root) {
  'use strict';

  function loadImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob); const img = new Image();
      img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a photo this app can open (try a JPEG or PNG; in Photos, HEIC photos export as JPEG).")); };
      img.src = url;
    });
  }
  function loadURL(src) {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Photo not found')); img.src = src; });
  }

  function toCanvas(img, maxSide) {
    const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    const s = Math.min(1, (maxSide || 1e9) / Math.max(w0, h0));
    const c = document.createElement('canvas'); c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height); return c;
  }

  function grayOf(canvas) {
    const { width: w, height: h } = canvas; const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    return { gray, w, h };
  }

  function otsu(gray) {
    const hist = new Float64Array(256); for (const v of gray) hist[v]++;
    const total = gray.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break;
      sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const between = wB * wF * (mB - mF) ** 2;
      if (between > best) { best = between; thr = t; }
    }
    return thr;
  }

  // Corners of the page (the largest bright area), as fractions: [tl, tr, br, bl]. Falls back to a small inset.
  function findPageCorners(canvas) {
    const small = document.createElement('canvas'); const s = Math.min(1, 420 / Math.max(canvas.width, canvas.height));
    small.width = Math.round(canvas.width * s); small.height = Math.round(canvas.height * s);
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
    const { gray, w, h } = grayOf(small);
    return cornersFromGray(gray, w, h);
  }
  function cornersFromGray(gray, w, h) {
    const thr = otsu(gray);
    const mask = new Uint8Array(w * h); for (let i = 0; i < mask.length; i++) mask[i] = gray[i] > thr ? 1 : 0;
    // close small dark gaps (ink, ruled lines) so the page is one piece
    const closed = dilate(mask, w, h, 2);
    const label = new Int32Array(w * h); let bestLabel = 0, bestSize = 0, next = 1; const q = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!closed[i] || label[i]) continue;
      let head = 0, tail = 0; q[tail++] = i; label[i] = next; let size = 0;
      while (head < tail) {
        const p = q[head++]; size++; const x = p % w, y = (p / w) | 0;
        if (x > 0 && closed[p - 1] && !label[p - 1]) { label[p - 1] = next; q[tail++] = p - 1; }
        if (x < w - 1 && closed[p + 1] && !label[p + 1]) { label[p + 1] = next; q[tail++] = p + 1; }
        if (y > 0 && closed[p - w] && !label[p - w]) { label[p - w] = next; q[tail++] = p - w; }
        if (y < h - 1 && closed[p + w] && !label[p + w]) { label[p + w] = next; q[tail++] = p + w; }
      }
      if (size > bestSize) { bestSize = size; bestLabel = next; } next++;
    }
    const fallback = [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]];
    if (bestSize < w * h * 0.15 || bestSize > w * h * 0.985) return { corners: fallback, found: false };
    let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, -Infinity];
    for (let i = 0; i < w * h; i++) {
      if (label[i] !== bestLabel) continue; const x = i % w, y = (i / w) | 0;
      if (x + y < tl[2]) tl = [x, y, x + y]; if (x + y > br[2]) br = [x, y, x + y];
      if (x - y > tr[2]) tr = [x, y, x - y]; if (y - x > bl[2]) bl = [x, y, y - x];
    }
    const quad = [tl, tr, br, bl].map(p => [p[0], p[1]]);
    // A flatbed scan is a plain upright rectangle, often with the dark scanner lid below the book and a pale strip down one
    // edge. Far-corner points are fooled by that strip, so also fit an upright rectangle from how full each row and column is,
    // and keep whichever outline matches the paper better.
    const rowN = new Int32Array(h), colN = new Int32Array(w);
    for (let i = 0; i < w * h; i++) if (label[i] === bestLabel) { rowN[(i / w) | 0]++; colN[i % w]++; }
    const span = (arr) => { let m = 0; for (const v of arr) if (v > m) m = v; let a = 0, b = arr.length - 1; while (a < b && arr[a] < m * 0.5) a++; while (b > a && arr[b] < m * 0.5) b--; return [a, b]; };
    const [ry0, ry1] = span(rowN), [rx0, rx1] = span(colN);
    const rect = [[rx0, ry0], [rx1, ry0], [rx1, ry1], [rx0, ry1]];
    const fit = poly => { // overlap of the outline with the paper, as a share of both together
      const inside = (x, y) => { for (let k = 0; k < 4; k++) { const [ax, ay] = poly[k], [bx, by] = poly[(k + 1) % 4]; if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < -0.5) return false; } return true; };
      let both = 0, onlyPoly = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (inside(x, y)) { if (label[y * w + x] === bestLabel) both++; else onlyPoly++; }
      return both / (bestSize / 4 + onlyPoly);
    };
    const best = fit(rect) > fit(quad) + 0.01 ? rect : quad;
    return { corners: best.map(p => [p[0] / (w - 1), p[1] / (h - 1)]), found: true, upright: best === rect };
  }
  function dilate(m, w, h, r) {
    const out = new Uint8Array(m.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0; for (let dy = -r; dy <= r && !v; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < w && m[yy * w + xx]) { v = 1; break; } } }
      out[y * w + x] = v;
    }
    return out;
  }

  // Solve for the 3×3 map that takes the output rectangle to the photo's four corners.
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b); return [...h, 1];
  }
  function solve(A, b) {
    const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }

  // Straighten: corners are fractions [tl,tr,br,bl] of the source canvas.
  function warp(srcCanvas, corners, maxSide) {
    const W = srcCanvas.width, H = srcCanvas.height;
    const P = corners.map(([x, y]) => [x * (W - 1), y * (H - 1)]);
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let ow = Math.max(dist(P[0], P[1]), dist(P[3], P[2])), oh = Math.max(dist(P[0], P[3]), dist(P[1], P[2]));
    const s = Math.min(1, (maxSide || 2600) / Math.max(ow, oh)); ow = Math.round(ow * s); oh = Math.round(oh * s);
    const Hm = homography([[0, 0], [ow - 1, 0], [ow - 1, oh - 1], [0, oh - 1]], P);
    const sd = srcCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const out = document.createElement('canvas'); out.width = ow; out.height = oh;
    const og = out.getContext('2d'); const img = og.createImageData(ow, oh); const od = img.data;
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const z = Hm[6] * x + Hm[7] * y + Hm[8];
        const sx = (Hm[0] * x + Hm[1] * y + Hm[2]) / z, sy = (Hm[3] * x + Hm[4] * y + Hm[5]) / z;
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        const o = (y * ow + x) * 4;
        if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) { od[o] = od[o + 1] = od[o + 2] = 255; od[o + 3] = 255; continue; }
        const i00 = (y0 * W + x0) * 4, i10 = i00 + 4, i01 = i00 + W * 4, i11 = i01 + 4;
        for (let c = 0; c < 3; c++) od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
        od[o + 3] = 255;
      }
    }
    og.putImageData(img, 0, 0); return out;
  }

  function rotate(canvas, quarterTurns) {
    const t = ((quarterTurns % 4) + 4) % 4; if (!t) return canvas;
    const c = document.createElement('canvas'); c.width = t % 2 ? canvas.height : canvas.width; c.height = t % 2 ? canvas.width : canvas.height;
    const g = c.getContext('2d'); g.translate(c.width / 2, c.height / 2); g.rotate(t * Math.PI / 2); g.drawImage(canvas, -canvas.width / 2, -canvas.height / 2); return c;
  }

  // Grayscale with stretched contrast and evened-out lighting, for the text reader.
  function forReading(canvas) {
    const { gray, w, h } = grayOf(canvas);
    // background estimate on a coarse grid, then divide it out (removes shadows and yellowed paper)
    const cell = 32, gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), bg = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      let best = 0; const vals = [];
      for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y += 3) for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x += 3) vals.push(gray[y * w + x]);
      vals.sort((a, b) => a - b); best = vals[Math.floor(vals.length * 0.9)] || 255; bg[gy * gw + gx] = Math.max(40, best);
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const img = g.createImageData(w, h); const d = img.data; const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = Math.min(gh - 1.001, Math.max(0, y / cell - 0.5)), y0 = Math.floor(fy), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.min(gw - 1.001, Math.max(0, x / cell - 0.5)), x0 = Math.floor(fx), tx = fx - x0;
        const b = (bg[y0 * gw + x0] * (1 - tx) + bg[y0 * gw + Math.min(gw - 1, x0 + 1)] * tx) * (1 - ty) + (bg[Math.min(gh - 1, y0 + 1) * gw + x0] * (1 - tx) + bg[Math.min(gh - 1, y0 + 1) * gw + Math.min(gw - 1, x0 + 1)] * tx) * ty;
        let v = gray[y * w + x] / b * 255; v = v > 235 ? 255 : v < 60 ? 0 : (v - 60) * 255 / 175; v = Math.max(0, Math.min(255, v));
        out[y * w + x] = v; const o = (y * w + x) * 4; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255;
      }
    }
    const withRules = out.slice(); // kept for spotting a line drawn through a box, which the next step would paint out
    removeRules(out, w, h, d);
    g.putImageData(img, 0, 0);
    return { canvas: c, gray: out, grayWithRules: withRules, w, h };
  }

  // Paint out the printed ruled lines (long straight dark runs) so the reader sees only the writing.
  function removeRules(gray, w, h, rgba) {
    // Printed lines are often grey, not black, and broken by paper grain: count anything clearly darker than paper, and bridge 2-pixel gaps.
    const dark = 190, minH = Math.round(w * 0.04), minV = Math.round(h * 0.04);
    const kill = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let run = 0, gap = 0;
      for (let x = 0; x <= w; x++) {
        if (x < w && gray[y * w + x] < dark) { run += gap + 1; gap = 0; }
        else if (x < w && run && gap < 2) gap++;
        else { if (run >= minH) for (let k = x - gap - run; k < x - gap; k++) kill[y * w + k] = 1; run = 0; gap = 0; }
      }
    }
    for (let x = 0; x < w; x++) {
      let run = 0, gap = 0;
      for (let y = 0; y <= h; y++) {
        if (y < h && gray[y * w + x] < dark) { run += gap + 1; gap = 0; }
        else if (y < h && run && gap < 2) gap++;
        else { if (run >= minV) for (let k = y - gap - run; k < y - gap; k++) kill[k * w + x] = 1; run = 0; gap = 0; }
      }
    }
    // widen by one pixel to catch anti-aliased edges
    for (let i = 0; i < w * h; i++) {
      if (!kill[i] && !((i % w > 0 && kill[i - 1] === 1) || (i % w < w - 1 && kill[i + 1] === 1) || (i >= w && kill[i - w] === 1) || (i < w * (h - 1) && kill[i + w] === 1))) continue;
      gray[i] = 255; if (rgba) { const o = i * 4; rgba[o] = rgba[o + 1] = rgba[o + 2] = 255; }
    }
  }

  // Paint out printed row lines that have been located (fits: y = a + b·x), between heights y0..y1 (fractions) only.
  // Where the line is thicker than usual, a pen stroke is lying on it or crossing it (the foot of a 2, a 7's tail):
  // that part is left alone so the writing isn't cut.
  function eraseLines(prepared, fits, y0, y1) {
    const { gray, w, h, canvas } = prepared; if (!fits || !fits.length) return;
    const g = canvas.getContext('2d'), img = g.getImageData(0, 0, w, h), d = img.data, DARK = 175, REACH = 16;
    const lo = new Int16Array(w), hi = new Int16Array(w);
    for (const f of fits) {
      const xa = Math.max(0, Math.round(f.x0 == null ? 0 : f.x0)), xb = Math.min(w, Math.round(f.x1 == null ? w : f.x1)); // a fit may cover one page only
      const mid = (f.a + f.b * (xa + xb) / 2) / h; if (mid < (y0 == null ? 0 : y0) || mid > (y1 == null ? 1 : y1)) continue;
      const lens = [];
      for (let x = xa; x < xb; x++) {
        lo[x] = hi[x] = -1; const yc = Math.round(f.a + f.b * x); if (yc < REACH + 4 || yc >= h - REACH - 4) continue;
        let y = -1; for (let k = 0; k <= 3 && y < 0; k++) { if (gray[(yc - k) * w + x] < DARK) y = yc - k; else if (gray[(yc + k) * w + x] < DARK) y = yc + k; }
        if (y < 0) continue;
        let a = y, b = y; while (y - a < REACH && gray[(a - 1) * w + x] < DARK) a--; while (b - y < REACH && gray[(b + 1) * w + x] < DARK) b++;
        lo[x] = a; hi[x] = b; lens.push(b - a + 1);
      }
      if (lens.length < (xb - xa) * 0.2) continue;
      lens.sort((p, q) => p - q); const usual = lens[lens.length >> 1];
      for (let x = xa; x < xb; x++) {
        if (lo[x] < 0 || hi[x] - lo[x] + 1 > usual + 1) continue;
        // writing that rests on the line (the foot of a 2, a 5 or a Z lies right along it): leave the line under it
        let rests = false; for (let dx = -3; dx <= 3 && !rests; dx++) { const xx = x + dx; if (xx >= 0 && xx < w && lo[xx] >= 3 && (gray[(lo[xx] - 2) * w + xx] < DARK || gray[(lo[xx] - 3) * w + xx] < DARK)) rests = true; }
        if (rests) continue;
        for (let y = lo[x] - 1; y <= hi[x] + 1; y++) { const i = y * w + x; gray[i] = 255; const o = i * 4; d[o] = d[o + 1] = d[o + 2] = 255; }
      }
    }
    g.putImageData(img, 0, 0);
  }

  // Flatten a photographed open book. In a photo each of the two pages leans its own way, so the printed lines slope and
  // fan out. This follows the printed row and column lines on each page, and stretches each page so its lines run level
  // and upright and the rows of the two pages meet across the gutter. A flat scan comes back unchanged.
  function flattenSpread(canvas) {
    const X = root.BBExtract, w = canvas.width, h = canvas.height; const pr = forReading(canvas), gray = pr.grayWithRules;
    const whole = X.trackLines(gray, w, h, { strips: 48, share: 0.3 });
    // the gutter: a run of strips near the middle where no row line is printed
    const med = whole.counts.slice().sort((a, b) => a - b)[whole.counts.length >> 1] || 0; let g = null;
    if (med >= 4) { let bestLen = 0, run = 0; for (let s = 16; s < 32; s++) { if (whole.counts[s] < med * 0.3) { run++; if (run > bestLen) { bestLen = run; g = whole.x0 + (s - (run - 1) / 2 + 0.5) * whole.sw; } } else run = 0; } }
    if (g == null) return { canvas, done: false, why: 'no gutter found' };
    const margin = whole.sw * 1.2;
    const halves = [{ x0: w * 0.02, x1: g - margin }, { x0: g + margin, x1: w * 0.985 }].map(r => Object.assign(r, { rows: X.trackLines(gray, w, h, { x0: r.x0, x1: r.x1, strips: 22, share: 0.55 }).fits }));
    // On one page the slope of the lines changes steadily down the page (they fan out). A line that doesn't follow that
    // pattern is a heading or a stray mark, not a row line: drop it.
    for (const r of halves) {
      for (let pass = 0; pass < 2 && r.rows.length >= 4; pass++) {
        const ys = r.rows.map(f => f.a + f.b * (r.x0 + r.x1) / 2), bs = r.rows.map(f => f.b); const my = ys.reduce((s, v) => s + v, 0) / ys.length, mb = bs.slice().sort((a, b) => a - b)[bs.length >> 1];
        let num = 0, den = 0; ys.forEach((y, i) => { if (Math.abs(bs[i] - mb) < 0.05) { num += (y - my) * (bs[i] - mb); den += (y - my) * (y - my); } }); const q = den ? num / den : 0;
        r.rows = r.rows.filter((f, i) => Math.abs(f.b - (mb + q * (ys[i] - my))) < (pass ? 0.008 : 0.02));
      }
    }
    if (halves[0].rows.length < 6 || halves[1].rows.length < 6) return { canvas, done: false, why: 'too few row lines' };
    const lean = rows => { const v = rows.map(f => Math.abs(f.b)).sort((a, b) => a - b); return v[v.length >> 1]; };
    const worst = Math.max(lean(halves[0].rows), lean(halves[1].rows));
    // pair up the rows of the two pages where they meet at the gutter
    const at = (f, x) => f.a + f.b * x; const pitchOf = rows => { const d = rows.slice(1).map((f, i) => at(f, g) - at(rows[i], g)).sort((a, b) => a - b); return d[d.length >> 1]; };
    const pitch = Math.min(pitchOf(halves[0].rows), pitchOf(halves[1].rows)); const pairs = [];
    for (const L of halves[0].rows) { let best = null; for (const R of halves[1].rows) if (Math.abs(at(L, g) - at(R, g)) < pitch * 0.4 && (!best || Math.abs(at(L, g) - at(R, g)) < Math.abs(at(L, g) - at(best, g)))) best = R; if (best) pairs.push([L, best]); }
    if (pairs.length < 5) return { canvas, done: false, why: 'rows of the two pages did not pair up' };
    const top = pairs[0], bot = pairs[pairs.length - 1]; const yTop = (at(top[0], g) + at(top[1], g)) / 2, yBot = (at(bot[0], g) + at(bot[1], g)) / 2;
    if (worst < 0.006) return { canvas, done: false, why: 'already flat' };
    // column lines on each page, between the top and bottom paired rows (the page turned on its side for the same follower)
    const out = document.createElement('canvas'); out.width = w; out.height = h; const og = out.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, w, h);
    const sd = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data; const img = og.getImageData(0, 0, w, h), od = img.data;
    for (let k = 0; k < 2; k++) {
      const r = halves[k], rowT = k ? top[1] : top[0], rowB = k ? bot[1] : bot[0];
      const xa = Math.round(r.x0), xb = Math.round(r.x1), ww = xb - xa, mid = (xa + xb) / 2;
      const ya = Math.max(0, Math.round(Math.min(at(rowT, xa), at(rowT, xb)))), yb = Math.min(h, Math.round(Math.max(at(rowB, xa), at(rowB, xb)))), hh = yb - ya; if (hh < 80 || ww < 80) return { canvas, done: false, why: 'page too small' };
      const t = new Uint8Array(ww * hh); for (let y = 0; y < hh; y++) { const o = (y + ya) * w + xa; for (let x = 0; x < ww; x++) t[x * hh + y] = gray[o + x]; }
      const cols = X.trackLines(t, hh, ww, { x0: hh * 0.08, x1: hh * 0.92, strips: 14, share: 0.6 }).fits.map(f => ({ a: xa + f.a - f.b * ya, b: f.b })); // x = a + b·y on the full page
      if (cols.length < 3) return { canvas, done: false, why: 'too few column lines' };
      const colL = cols[0], colR = cols[cols.length - 1]; const cross = (row, col) => { const x = (col.a + col.b * row.a) / (1 - col.b * row.b); return [x, row.a + row.b * x]; };
      const quad = [cross(rowT, colL), cross(rowT, colR), cross(rowB, colR), cross(rowB, colL)];
      const yMid = (yTop + yBot) / 2, xL = colL.a + colL.b * yMid, xR = colR.a + colR.b * yMid;
      const H = homography([[xL, yTop], [xR, yTop], [xR, yBot], [xL, yBot]], quad); // where each flattened point comes from in the photo
      const ox0 = k ? Math.round(g) : 0, ox1 = k ? w : Math.round(g);
      for (let y = 0; y < h; y++) for (let x = ox0; x < ox1; x++) {
        const z = H[6] * x + H[7] * y + H[8], sx = (H[0] * x + H[1] * y + H[2]) / z, sy = (H[3] * x + H[4] * y + H[5]) / z;
        const x0 = Math.floor(sx), y0 = Math.floor(sy), o = (y * w + x) * 4; od[o + 3] = 255;
        if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) { od[o] = od[o + 1] = od[o + 2] = 255; continue; }
        const fx = sx - x0, fy = sy - y0, i00 = (y0 * w + x0) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
        for (let c = 0; c < 3; c++) od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
      }
      void mid;
    }
    og.putImageData(img, 0, 0);
    // Check the work: the lines must really be more level now, or the photo is kept as it was.
    const after = forReading(out).grayWithRules; let left = 0;
    for (const r of halves) { const rows = X.trackLines(after, w, h, { x0: r.x0, x1: r.x1, strips: 22, share: 0.55 }).fits; if (rows.length < 5) return { canvas, done: false, why: 'check failed' }; left = Math.max(left, lean(rows)); }
    if (left > worst * 0.5 || left > 0.006) return { canvas, done: false, why: 'did not improve', left, worst };
    return { canvas: out, done: true, gutter: g / w, pairs: pairs.length, worst, left };
  }

  function toBlob(canvas, type, q) { return new Promise(r => canvas.toBlob(r, type || 'image/jpeg', q || 0.86)); }

  // A strip of the page (one logbook line), for showing next to the line's fields.
  function strip(img, band, pad) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height; pad = pad == null ? 0.004 : pad;
    const y0 = Math.max(0, (band.y0 - pad) * H), y1 = Math.min(H, (band.y1 + pad) * H);
    const c = document.createElement('canvas'); const s = Math.min(1, 1400 / W);
    c.width = Math.round(W * s); c.height = Math.max(8, Math.round((y1 - y0) * s));
    c.getContext('2d').drawImage(img, 0, y0, W, y1 - y0, 0, 0, c.width, c.height); return c;
  }

  const api = { flattenSpread, eraseLines, loadImage, loadURL, toCanvas, grayOf, otsu, findPageCorners, cornersFromGray, homography, warp, rotate, forReading, toBlob, strip };
  root.BBImage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
