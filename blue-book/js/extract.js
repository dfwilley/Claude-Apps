// Blue Book — turns words read off a logbook page into flight lines.
// Pure logic (no screen code) so it can be tested in Node.
(function (root) {
  'use strict';

  // Every field a logbook line can have. kind: how the text is read.
  const FIELDS = [
    { key: 'day',        label: 'Day',               kind: 'day' },
    { key: 'date',       label: 'Date',              kind: 'date' },
    { key: 'type',       label: 'Type / model',      kind: 'type' },
    { key: 'buno',       label: 'BuNo',              kind: 'buno' },
    { key: 'kind',       label: 'Kind of flight',    kind: 'code' },
    { key: 'squadron',   label: 'Squadron',          kind: 'text' },
    { key: 'total',      label: 'Flight time',       kind: 'hours' },
    { key: 'pic',        label: 'PIC',               kind: 'hours' },
    { key: 'sic',        label: 'SIC',               kind: 'hours' },
    { key: 'acCmdr',     label: 'Acft Cmdr',         kind: 'hours' },
    { key: 'specialCrew', label: 'Special crew',     kind: 'hours' },
    { key: 'night',      label: 'Night time',        kind: 'hours' },
    { key: 'instActual', label: 'Instrument (actual)', kind: 'hours' },
    { key: 'instSim',    label: 'Instrument (sim)',  kind: 'hours' },
    { key: 'approaches', label: 'Approaches',        kind: 'count' },
    { key: 'apprType',   label: 'Approach type',     kind: 'text' },
    { key: 'simApproaches', label: 'Simulated approaches', kind: 'count' },
    { key: 'traps',      label: 'Carrier arrest',    kind: 'count' },
    { key: 'carrierTG',  label: 'Carrier touch and go', kind: 'count' },
    { key: 'fclp',       label: 'FCLP',              kind: 'count' },
    { key: 'landings',   label: 'Landing',           kind: 'count' },
    { key: 'dayLand',    label: 'Landings day',      kind: 'count' },
    { key: 'nightLand',  label: 'Landings night',    kind: 'count' },
    { key: 'dayShip',    label: 'Ship landings day', kind: 'count' },
    { key: 'nightShip',  label: 'Ship landings night', kind: 'count' },
    { key: 'dayTraps',   label: 'Traps day',         kind: 'count' },
    { key: 'nightTraps', label: 'Traps night',       kind: 'count' },
    { key: 'cats',       label: 'Cat shots',         kind: 'count' },
    { key: 'ship',       label: 'Ship',              kind: 'text' },
    { key: 'remarks',    label: 'Remarks',           kind: 'text' },
    { key: 'skip',       label: '(ignore this column)', kind: 'skip' },
  ];
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const NUM_FIELDS = FIELDS.filter(f => f.kind === 'hours' || f.kind === 'count').map(f => f.key);

  // A starting guess for a Navy logbook spread; you drag the dividers to match your book once.
  // The Navy "Aviators Flight Log Book" spread, measured from a real scanned page (fractions of the open book's width):
  // left page Day … Special Crew Time, the gutter, then Instrument time … Remarks. The Carrier Bolter column is skipped.
  // Each page is nudged onto its own printed lines when it is read (fitTemplate), so this only has to be close.
  const DEFAULT_COLUMNS = [
    ['day', 0.02, 0.066], ['type', 0.066, 0.1442], ['buno', 0.1442, 0.2238], ['kind', 0.2238, 0.263], ['total', 0.263, 0.3114], ['pic', 0.3114, 0.3605],
    ['sic', 0.3605, 0.4093], ['acCmdr', 0.4093, 0.4577], ['specialCrew', 0.4577, 0.5], ['skip', 0.5, 0.55],
    ['instActual', 0.55, 0.6099], ['instSim', 0.6099, 0.6679], ['night', 0.6679, 0.7068], ['traps', 0.7068, 0.7269], ['carrierTG', 0.7269, 0.7468],
    ['skip', 0.7468, 0.7666], ['fclp', 0.7666, 0.785], ['landings', 0.785, 0.8244], ['cats', 0.8244, 0.8443], ['approaches', 0.8443, 0.8643],
    ['apprType', 0.8643, 0.8838], ['simApproaches', 0.8838, 0.903], ['remarks', 0.903, 0.995],
  ];
  function defaultTemplate() { return { columns: DEFAULT_COLUMNS.map(([field, x0, x1]) => ({ field, x0, x1 })), top: 0.148, bottom: 0.845 }; }

  // Follow printed lines across part of a page even when they slope (a photo taken at an angle, a page that doesn't lie flat).
  // Narrow upright strips are examined between x0 and x1 (pixels); a line is followed from strip to strip by expecting it
  // to carry on at the slope it has shown so far. Returns straight fits y = a + b·x with n = strips that saw it,
  // plus `counts` (lines seen per strip) for finding the gutter.
  function trackLines(gray, w, h, opts) {
    opts = opts || {};
    const xa = Math.max(0, Math.round(opts.x0 == null ? w * 0.03 : opts.x0)), xb = Math.min(w, Math.round(opts.x1 == null ? w * 0.97 : opts.x1));
    const S = opts.strips || 24, sw = Math.floor((xb - xa) / S), T = opts.dark || 215, need = opts.cover || 0.6; if (sw < 6) return { fits: [], counts: [] };
    const minGap = Math.max(4, Math.round(h * 0.008)), tol0 = Math.max(5, Math.round(h * 0.012)), tol1 = Math.max(4, Math.round(h * 0.006));
    const tracks = [], counts = [];
    for (let s = 0; s < S; s++) {
      const x0 = xa + s * sw, cx = x0 + sw / 2, frac = new Float32Array(h);
      for (let y = 0; y < h; y++) { let n = 0; const o = y * w + x0; for (let x = 0; x < sw; x++) if (gray[o + x] < T) n++; frac[y] = n / sw; }
      const peaks = [];
      for (let y = 1; y < h - 1; y++) {
        const v = Math.min(1, frac[y - 1] + frac[y] + frac[y + 1]); if (v < need) continue;
        let b = y, top = v, at = y; while (b + 1 < h - 1) { const n2 = Math.min(1, frac[b] + frac[b + 1] + frac[b + 2]); if (n2 < need) break; b++; if (frac[b] > frac[at]) at = b; if (n2 > top) top = n2; }
        y = b; if (peaks.length && at - peaks[peaks.length - 1] < minGap) continue; peaks.push(at);
      }
      counts.push(peaks.length);
      const used = new Set();
      for (const p of peaks) {
        let best = null, bd = 1e9;
        for (const k of tracks) {
          if (used.has(k) || s - k.lastS > 3) continue;
          const pred = k.ys.length >= 2 ? k.lastY + k.slope * (cx - k.lastX) : k.lastY, d = Math.abs(pred - p);
          if (d <= (k.ys.length >= 2 ? tol1 * (s - k.lastS) + 2 : tol0) && d < bd) { bd = d; best = k; }
        }
        if (best) { used.add(best); best.slope = best.ys.length >= 2 ? best.slope * 0.5 + 0.5 * (p - best.lastY) / (cx - best.lastX) : (p - best.lastY) / (cx - best.lastX); best.ys.push(p); best.xs.push(cx); best.lastY = p; best.lastX = cx; best.lastS = s; }
        else { const k = { ys: [p], xs: [cx], lastY: p, lastX: cx, lastS: s, slope: 0 }; tracks.push(k); used.add(k); }
      }
    }
    const fits = tracks.filter(k => k.ys.length >= Math.ceil(S * (opts.share || 0.6))).map(k => {
      const mx = mean(k.xs), my = mean(k.ys); let num = 0, den = 0; k.xs.forEach((x, i) => { num += (x - mx) * (k.ys[i] - my); den += (x - mx) * (x - mx); });
      const b = den ? num / den : 0; return { a: my - b * mx, b, n: k.ys.length };
    }).sort((p, q) => (p.a + p.b * (xa + xb) / 2) - (q.a + q.b * (xa + xb) / 2));
    return { fits, counts, x0: xa, sw };
  }

  // Printed column lines in the flight area: the same finder as for rows, with the page turned on its side.
  function findColLines(gray, w, h, top, bottom) {
    const y0 = Math.max(0, Math.round(h * top)), y1 = Math.min(h, Math.round(h * bottom)), hh = y1 - y0; if (hh < 50) return [];
    const t = new Uint8Array(w * hh);
    for (let y = 0; y < hh; y++) { const o = (y + y0) * w; for (let x = 0; x < w; x++) t[x * hh + y] = gray[o + x]; }
    return rowLineFits(t, hh, w).map(f => (f.a + f.b * hh / 2) / w).sort((a, b) => a - b);
  }

  // Move a column layout onto the lines actually printed on this page. Pages are never scanned in quite the same place or
  // size, so first find the shift and stretch that puts the most column edges on printed lines, then snap each edge to its line.
  // xs / ys: printed column / row lines found on the page. Returns {template, matched} (matched = edges that found a line).
  function fitTemplate(tpl, xs, ys) {
    const out = JSON.parse(JSON.stringify(tpl)); const cols = out.columns.sort((a, b) => a.x0 - b.x0);
    const edges = [...new Set(cols.flatMap(c => [c.x0, c.x1]))].sort((a, b) => a - b);
    // best shift and stretch putting these layout edges on printed lines
    const fit = (es, lines) => {
      let best = { n: 0, s: 1, o: 0 }; const tol = 0.006; if (lines.length < 3 || es.length < 3) return best;
      for (let i = 0; i < es.length; i++) for (let k = i + 2; k < es.length; k++) for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++) {
        const s = (lines[b] - lines[a]) / (es[k] - es[i]); if (s < 0.8 || s > 1.25) continue;
        const o = lines[a] - s * es[i]; if (Math.abs(o + (s - 1) * 0.5) > 0.15) continue;
        let n = 0; for (const e of es) { const v = s * e + o; if (lines.some(x => Math.abs(x - v) < tol)) n++; }
        if (n > best.n) best = { n, s, o };
      }
      return best;
    };
    xs = (xs || []).slice().sort((a, b) => a - b);
    const all = fit(edges, xs); const good = all.n >= Math.min(8, Math.max(4, Math.floor(edges.length * 0.4)));
    let matched = 0;
    if (good) {
      // An open book is two pages, and in a photo each is a slightly different size: fit each page's columns on their own.
      // The gutter is the widest gap in the layout that has no printed line in it.
      let gi = -1, gw = 0; for (let i = 1; i < edges.length; i++) { const lo = all.s * edges[i - 1] + all.o, hi = all.s * edges[i] + all.o; if (edges[i] > 0.3 && edges[i - 1] < 0.7 && edges[i] - edges[i - 1] > gw && !xs.some(x => x > lo + 0.008 && x < hi - 0.008)) { gw = edges[i] - edges[i - 1]; gi = i; } }
      const split = gi > 0 ? (edges[gi - 1] + edges[gi]) / 2 : 2, splitX = all.s * split + all.o;
      const parts = [[edges.filter(e => e < split), xs.filter(x => x < splitX)], [edges.filter(e => e >= split), xs.filter(x => x >= splitX)]];
      const moved = new Map();
      for (const [es, lines] of parts) {
        if (!es.length) continue; let f = fit(es, lines); if (f.n < Math.max(3, Math.floor(es.length * 0.5))) f = all;
        for (const e of es) { const v = f.s * e + f.o; let near = null; for (const x of lines) if (Math.abs(x - v) < 0.008 && (near == null || Math.abs(x - v) < Math.abs(near - v))) near = x; if (near != null) matched++; moved.set(e, Math.max(0, Math.min(1, near == null ? v : near))); }
      }
      for (const c of cols) { c.x0 = moved.get(c.x0); c.x1 = moved.get(c.x1); }
    }
    // Rows: the flight lines are the long run of evenly spaced lines; the headings above them are not evenly spaced.
    // The first line of that run is the top. The layout's own number of rows gives the bottom (a photo may cut the page short).
    ys = (ys || []).slice().sort((a, b) => a - b);
    if (ys.length >= 5) {
      const gaps = ys.slice(1).map((v, i) => v - ys[i]).filter(g => g > 0.012), pitch = median(gaps), nRows = Math.max(1, Math.round((tpl.bottom - tpl.top) / (rowPitch(ys, tpl) || pitch)));
      if (pitch > 0) {
        const on = (y0, k) => ys.some(y => Math.abs(y - (y0 + k * pitch)) < pitch * 0.2);
        let bestN = 0; const scores = ys.map(y0 => { let n = 0; for (let k = 0; k <= nRows; k++) if (on(y0, k)) n++; if (n > bestN) bestN = n; return n; });
        let top = null; ys.forEach((y0, i) => { if (scores[i] >= bestN - 1 && scores[i] >= 4 && (top == null || Math.abs(y0 - tpl.top) < Math.abs(top - tpl.top))) top = y0; });
        if (top != null) {
          out.top = top; let bottom = top;
          for (let k = 1; k <= nRows; k++) { const want = top + k * pitch; let near = null; for (const y of ys) if (Math.abs(y - want) < pitch * 0.3 && (near == null || Math.abs(y - want) < Math.abs(near - want))) near = y; if (near != null) bottom = near; else if (want < 0.995) bottom = want; }
          out.bottom = Math.min(0.999, bottom);
        }
      }
    }
    return { template: out, matched: good ? matched : 0 };
  }

  // The printed column headings are evenly spaced with the flight rows on some photos, so the top can land one row high.
  // If the first row is made of heading words (MODEL, SERIAL NUMBER, FIRST PILOT …), start one row lower.
  const HEADING = /^(DAY|MODEL|SERIAL|NUMBER|KIND|OF|FLIGHT|CODE\*?|TOTAL|PILOT|TIME|FIRST|CO-?|COMDR\.?|A\/C|SPE-?|CIAL|CREW|ACT|SIM|NIGHT|LANDINGS?|CARRIER|ARR|T&G|BOL|FCL|SEA\/?|LAND|CATAPULT|REMARKS|TYPE|NO\.?|INSTRUMENT|AIRCRAFT|STD|INST\.?|APPR\.?|PLETED|COM-?)$/i;
  function skipHeaderRows(words, tpl, ys) {
    const out = JSON.parse(JSON.stringify(tpl)); ys = (ys || []).slice().sort((a, b) => a - b); const pitch = rowPitch(ys, tpl); if (!pitch) return out;
    for (let pass = 0; pass < 3; pass++) {
      const next = ys.find(y => y > out.top + pitch * 0.5); if (next == null) break;
      const n = (words || []).filter(w => cy(w) >= out.top && cy(w) < next && HEADING.test(String(w.text).trim())).length;
      if (n < 3) break;
      const d = next - out.top; out.top = next; let b = Math.min(0.999, out.bottom + d); const near = ys.find(y => Math.abs(y - b) < pitch * 0.3); out.bottom = near != null ? near : b;
    }
    return out;
  }

  // The month and year written at the top of the page ("MONTH February  YEAR 1983"), if they can be read.
  const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  function headerDate(words, top) {
    const head = (words || []).filter(w => (w.y0 + w.y1) / 2 < top); let month = null, year = null, bestD = 9;
    for (const w of head) {
      const t = String(w.text).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const y = t.replace(/[OQD]/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8').match(/^(19[3-9]\d|20[0-4]\d)$/); if (y && year == null) year = +y[1];
      if (t.length < 3 || /^(MONTH|YEAR)$/.test(t) || /\d/.test(t)) continue;
      MONTH_NAMES.forEach((m, i) => {
        const d = t.length <= 4 ? (m.startsWith(t) || (m === 'SEPTEMBER' && t === 'SEPT') ? 0 : 9) : editDistance(t, m);
        const ok = d <= (m.length >= 7 ? 2 : m.length >= 5 ? 1 : 0); if (ok && d < bestD) { bestD = d; month = i + 1; }
      });
    }
    return { month, year };
  }

  const KNOWN_TYPES = ['AV-8A', 'AV-8C', 'TAV-8A', 'AV-8B', 'AV-8B+', 'TAV-8B', 'T-34B', 'T-34C', 'T-28B', 'T-28C', 'T-2B', 'T-2C',
    'TA-4F', 'TA-4J', 'A-4M', 'A-4E', 'OA-4M', 'T-45A', 'T-45C', 'T-39', 'UC-12B', 'F/A-18A', 'F/A-18C', 'F-5E', 'T-38'];

  function round4(v) { return Math.round(v * 10000) / 10000; }

  // ---------- Rows ----------

  // Row bands from ruled lines (fractions of page height) — or, if no lines, from where the words sit.
  function rowBands(words, template, ruledLines, pitch) {
    const top = template.top, bottom = template.bottom;
    let lines = (ruledLines || []).filter(y => y >= top - 0.01 && y <= bottom + 0.01).sort((a, b) => a - b);
    if (lines.length >= 4) {
      const gaps = []; for (let i = 1; i < lines.length; i++) gaps.push(lines[i] - lines[i - 1]);
      const med = median(gaps);
      const bands = [];
      for (let i = 1; i < lines.length; i++) {
        const g = lines[i] - lines[i - 1];
        if (g < med * 0.45) continue; // double line or noise
        if (g > med * 1.7) { // a missed line: split evenly
          const n = Math.round(g / med);
          for (let k = 0; k < n; k++) bands.push({ y0: lines[i - 1] + g * k / n, y1: lines[i - 1] + g * (k + 1) / n });
        } else bands.push({ y0: lines[i - 1], y1: lines[i] });
      }
      if (bands.length >= 3) return bands;
    }
    // Marks a reader makes out of the printed lines themselves (dashes, bars, underscores) say nothing about where the rows are.
    const inside = words.filter(w => cy(w) >= top && cy(w) <= bottom && /[A-Za-z0-9]/.test(w.text)).sort((a, b) => cy(a) - cy(b));
    if (!inside.length) return [];
    // The printed lines weren't found on this page, but the row height is known from an earlier page:
    // lay rows of that height where the writing sits best inside them.
    if (pitch > 0.004 && pitch < 0.2) {
      let best = 0, bestScore = -Infinity;
      for (let i = 0; i < 40; i++) { const o = pitch * i / 40; let sc = 0; for (const w of inside) sc -= Math.cos(2 * Math.PI * (cy(w) - top - o) / pitch); if (sc > bestScore) { bestScore = sc; best = o; } }
      const bands = []; let y = top + best; while (y - pitch > top - pitch * 0.5) y -= pitch;
      for (; y < bottom - pitch * 0.5; y += pitch) bands.push({ y0: Math.max(0, y), y1: Math.min(1, y + pitch) });
      if (bands.length >= 2) return bands;
    }
    // Last resort: cluster word centers by height on the page.
    const hMed = median(inside.map(w => w.y1 - w.y0)) || 0.015;
    const groups = [];
    for (const w of inside) {
      const g = groups[groups.length - 1];
      if (g && cy(w) - g.c < hMed * 0.7) { g.ys.push(cy(w)); g.c = mean(g.ys); g.y0 = Math.min(g.y0, w.y0); g.y1 = Math.max(g.y1, w.y1); }
      else groups.push({ ys: [cy(w)], c: cy(w), y0: w.y0, y1: w.y1 });
    }
    return groups.map((g, i) => ({
      y0: i ? (groups[i - 1].c + g.c) / 2 : Math.max(top, g.y0 - hMed * 0.3),
      y1: i < groups.length - 1 ? (g.c + groups[i + 1].c) / 2 : Math.min(bottom, g.y1 + hMed * 0.3),
    }));
  }
  // Which words of a page reading sit in one box (a row band and a column).
  function cellAt(words, band, col) { return words.filter(w => { const x = (w.x0 + w.x1) / 2, y = (w.y0 + w.y1) / 2; return x >= col.x0 && x < col.x1 && y >= band.y0 && y < band.y1; }); }
  const cy = w => (w.y0 + w.y1) / 2;
  // Words in one box, top line first, then left to right (a box can hold two short lines, like "1 P" over "1 NP").
  function readingOrder(ws) {
    if (ws.length < 2) return ws.slice();
    const h = median(ws.map(w => w.y1 - w.y0)) || 0.01; const lines = [];
    for (const w of ws.slice().sort((a, b) => cy(a) - cy(b))) { const l = lines[lines.length - 1]; if (l && cy(w) - l.c < h * 0.6) { l.ws.push(w); l.c = mean(l.ws.map(cy)); } else lines.push({ c: cy(w), ws: [w] }); }
    return lines.flatMap(l => l.ws.sort((a, b) => a.x0 - b.x0));
  }
  const cx = w => (w.x0 + w.x1) / 2;
  function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

  // ---------- Reading one cell ----------

  // Marks that mean "same as the line above": ditto marks, or a line drawn through the box.
  const DITTO = /^(["”“〃'′″]+|do\.?|ditto|[-—–_~=]+(\s*[-—–_~=]+)*)$/i;

  function digitsFix(s) { // common handwriting misreads in number columns
    return s.replace(/[OoDQ]/g, '0').replace(/[lIi|!\]\[]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').replace(/[Zz]/g, '2').replace(/[gq]/g, '9')
      .replace(/[bG]/g, '6').replace(/T/g, '7').replace(/A/g, '4');
  }
  // Kind-of-flight codes are number, letter, number (1A1). Put each character back in its own alphabet.
  function fixKind(raw) {
    const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9|!]/g, '');
    if (s.length !== 3) return s;
    const toLetter = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 6: 'G', 8: 'B', '|': 'I', '!': 'I' };
    const digit = ch => digitsFix(ch === 'L' ? '1' : ch);
    return digit(s[0]) + (toLetter[s[1]] || s[1]) + digit(s[2]);
  }

  function parseHours(raw) {
    let s = raw.trim(); if (!s) return { value: null };
    if (DITTO.test(s)) return { value: null, ditto: true };
    // a decimal point is easily read as a comma, dash, colon or stray mark; spaces creep in around it
    s = digitsFix(s).replace(/\s*[,.:;'’`·•_\-]+\s*/g, '.').replace(/\s+/g, ' ').replace(/^\.(?=\d\.)/, '').replace(/(\d)\.$/, '$1');
    let m;
    if ((m = s.match(/^(\d{1,2}) (\d)$/))) return { value: +(m[1] + '.' + m[2]) }; // hours | tenths sub-columns
    if ((m = s.match(/^(\d{0,2})\.(\d)$/))) return { value: +((m[1] || '0') + '.' + m[2]) };
    if ((m = s.match(/^(\d{0,2})\.(\d)\d$/))) return { value: +((m[1] || '0') + '.' + m[2]), note: 'extra digit read; took ' + (m[1] || '0') + '.' + m[2] };
    if ((m = s.match(/^(\d{1,3})$/))) {
      const n = +m[1];
      if (n >= 10) return { value: n / 10, note: 'decimal point not seen; read as ' + (n / 10).toFixed(1) };
      return { value: n };
    }
    return { value: null, bad: true };
  }

  function parseCount(raw) {
    let s = raw.trim(); if (!s) return { value: null };
    if (DITTO.test(s)) return { value: null, ditto: true };
    s = digitsFix(s).replace(/\s+/g, '');
    if (/^\d{1,2}$/.test(s)) return { value: +s };
    if (/^[\/\\]+$/.test(s)) return { value: s.length }; // tally marks
    return { value: null, bad: true };
  }

  function normalizeType(raw, extraTypes) {
    let s = raw.trim().toUpperCase().replace(/\s+/g, '');
    if (!s) return { value: '' };
    if (DITTO.test(s)) return { value: '', ditto: true };
    s = s.replace(/^AV8/, 'AV-8').replace(/^TAV8/, 'TAV-8').replace(/^TA4/, 'TA-4').replace(/^A4/, 'A-4').replace(/^T(\d)/, 'T-$1')
      .replace(/^FA18/, 'F/A-18').replace(/^F\/A18/, 'F/A-18').replace(/^AV-8B\+$/, 'AV-8B+');
    s = s.replace(/-8(\d)/, (m, d) => d === '8' ? '-8B' : m); // AV-88 → AV-8B
    const all = [...new Set([...(extraTypes || []), ...KNOWN_TYPES])];
    if (all.includes(s)) return { value: s };
    let best = null, bestD = 9;
    for (const t of all) { const d = editDistance(s, t); if (d < bestD) { bestD = d; best = t; } }
    if (best && bestD <= 1 && s.length >= 4) return { value: best, note: `read "${raw.trim()}", matched ${best}` };
    return { value: s, unsure: !/^[A-Z\/]{1,4}-?\d{1,3}[A-Z+]?$/.test(s) };
  }

  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  function parseBuno(raw) {
    const s0 = raw.trim(); if (!s0) return { value: '' };
    if (DITTO.test(s0)) return { value: '', ditto: true };
    const s = digitsFix(s0).replace(/[^\d]/g, '');
    if (/^\d{5,6}$/.test(s)) return { value: s };
    return { value: s || s0, bad: true };
  }

  function parseDay(raw) {
    const s0 = raw.trim(); if (!s0) return { value: null };
    if (DITTO.test(s0)) return { value: null, ditto: true };
    const s = digitsFix(s0).replace(/[^\d\/\-]/g, '');
    let m;
    if ((m = s.match(/^(\d{1,2})$/)) && +m[1] >= 1 && +m[1] <= 31) return { value: +m[1] };
    if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})/))) return { value: +m[2], month: +m[1] }; // 3/14
    return { value: null, bad: true };
  }

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function parseDate(raw, page) {
    const s = raw.trim().toUpperCase(); if (!s) return { value: null };
    let m;
    if ((m = s.match(/^(\d{1,2})\s*([A-Z]{3})[A-Z]*\s*(\d{2,4})?$/))) {
      const mo = MONTHS.indexOf(m[2]) + 1; if (mo > 0) return { value: isoDate(fullYear(m[3], page), mo, +m[1]) };
    }
    if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/))) return { value: isoDate(fullYear(m[3], page), +m[1], +m[2]) };
    const d = parseDay(raw); if (d.value && page.year && page.month) return { value: isoDate(page.year, d.month || page.month, d.value) };
    return { value: null, bad: true };
  }
  function fullYear(y, page) { if (!y) return page.year; y = +y; return y < 100 ? (y > 40 ? 1900 + y : 2000 + y) : y; }
  function isoDate(y, m, d) {
    if (!y || !m || !d || m > 12 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCMonth() !== m - 1) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // ---------- A whole page ----------

  // words: [{text, conf (0–100), x0, y0, x1, y1}] in fractions of the straightened page.
  // page: {year, month, squadron, ship}. Returns {rows:[...], notes:[...]}
  function extractPage(words, template, page, opts) {
    opts = opts || {};
    const LOW = opts.lowConfidence || 60;
    const cols = template.columns.slice().sort((a, b) => a.x0 - b.x0);
    const bands = rowBands(words, template, opts.ruledLines, opts.rowPitch);
    const rows = []; const notes = [];
    const cells = bands.map(() => ({}));
    for (const w of words) {
      const y = cy(w), x = cx(w);
      const r = bands.findIndex(b => y >= b.y0 && y < b.y1); if (r < 0) continue;
      let c = cols.findIndex(col => x >= col.x0 && x < col.x1);
      if (c < 0) { // a word just outside every column: nearest one within 2% of the page
        let best = -1, bd = 0.02; cols.forEach((col, i) => { const d = Math.min(Math.abs(x - col.x0), Math.abs(x - col.x1)); if (d < bd) { bd = d; best = i; } });
        c = best; if (c < 0) continue;
      }
      const key = cols[c].field; if (key === 'skip') continue;
      (cells[r][key] = cells[r][key] || []).push(w);
    }
    const prev = {}; let carried = false;
    if (opts.carryType) { prev.type = opts.carryType; carried = true; } // a page can open with a line: same aircraft as the last flight on the page before
    let lastDay = 0;
    bands.forEach((band, r) => {
      const cell = cells[r];
      const keys = Object.keys(cell); if (!keys.length) return;
      const textOf = k => readingOrder(cell[k] || []).map(w => w.text).join(' ');
      const confOf = k => cell[k] ? Math.min(...cell[k].map(w => w.conf == null ? 100 : w.conf)) : 100;
      const allText = keys.map(textOf).join(' ');
      if (!/[A-Za-z0-9]/.test(allText)) return; // only dashes and bars: a printed line was read as marks, not a flight
      // Monthly totals / brought-forward lines are checks, not flights.
      // The label has to be a whole word, and a word in the remarks only counts when the line has no date or aircraft
      // (so a flight whose remarks say "resumed" or "FWD" stays a flight).
      const TOTALS = /\b(TOTALS?|FWD|FORWARD|BROUGHT|CARRIED|SUM)\b/i;
      const labelText = keys.filter(k => k !== 'remarks').map(textOf).join(' ');
      const looksLikeFlight = ['day', 'date', 'type', 'buno'].some(k => /[A-Za-z0-9]/.test(textOf(k)) && !TOTALS.test(textOf(k)));
      if (TOTALS.test(labelText) || (TOTALS.test(allText) && !looksLikeFlight)) {
        const t = { rowType: 'totals', band, raw: {} }; keys.forEach(k => { t.raw[k] = textOf(k); });
        const h = parseHours(textOf('total')); t.total = h.value; rows.push(t); return;
      }
      const f = { rowType: 'flight', band, raw: {}, flags: [], conf: {} };
      for (const col of cols) {
        const k = col.field; if (k === 'skip' || k === 'day' || k === 'date') continue;
        const raw = textOf(k); f.raw[k] = raw; f.conf[k] = confOf(k);
        const kind = FIELD[k].kind;
        let res;
        if (kind === 'hours') res = parseHours(raw);
        else if (k === 'approaches' && /^\d\s+\d(\s+\d)*$/.test(digitsFix(raw.trim()))) { // one number per approach type, stacked in the box
          res = { value: digitsFix(raw.trim()).split(/\s+/).reduce((s, v) => s + +v, 0) }; res.note = `added the numbers in this box (${raw.trim()}) to get ${res.value}`; }
        else if (kind === 'count') res = parseCount(raw);
        else if (k === 'apprType') res = { value: raw.trim().toUpperCase().replace(/(^|\s)[LI|](?=\s*N?P(\s|$))/g, '$11').replace(/\s+/g, ' ') };
        else if (kind === 'type') {
          // A line drawn through the box means "same aircraft as above". Readers turn a drawn line into all sorts of marks
          // (dashes, underscores, tildes, an equals sign), so any reading with no letter or digit in it counts as that line.
          res = raw.trim() && !/[A-Za-z0-9]/.test(raw) ? { value: '', ditto: true } : normalizeType(raw, opts.knownTypes);
          // Every aircraft type has both a letter and a number in it (T-34C, AV-8B). A reading with only one or the other
          // is the drawn line misread as a stray "1" or "I", not a type.
          if (!res.ditto && res.value && !(/[A-Z]/.test(res.value) && /\d/.test(res.value)) && ![...(opts.knownTypes || []), ...KNOWN_TYPES].includes(res.value)) res = { value: '', ditto: true };
        }
        else if (kind === 'buno') res = parseBuno(raw);
        else if (kind === 'code') { res = { value: fixKind(raw) }; if (res.value && !/^\d[A-Z]\d$/.test(res.value)) res.unsure = true; }
        else res = { value: raw.trim() };
        // A dash in a time or count box is a leftover scrap of a printed line (nobody dittoes a flight time): treat the box as empty.
        if (res.ditto && (kind === 'hours' || kind === 'count')) res = { value: null };
        if (res.ditto) {
          const had = prev[k] != null; res.value = had ? prev[k] : res.value;
          if (!had) flag(f, k, 'marked “same as the line above”, but there is no line above on this page');
          else if (k !== 'type') flag(f, k, 'ditto mark — copied from the line above'); // a line through the type box is the normal way to write it
          if (k === 'type' && had) { f.typeSame = true; if (carried) flag(f, 'type', 'line in the box: taken from the last flight on the page before'); }
        }
        f[k] = res.value;
        if (res.bad) flag(f, k, `couldn't read "${raw}"`);
        else if (res.unsure) flag(f, k, 'unusual value');
        if (res.note) flag(f, k, res.note);
        if (raw && f.conf[k] < LOW && !res.bad) flag(f, k, 'hard to read — please check');
      }
      pilotTimeRule(f);
      // Nothing readable in the type box is also the line (a long, light line often isn't picked up at all): same aircraft as above.
      if (!f.type && prev.type) { f.type = prev.type; f.typeSame = true; f.flags = f.flags.filter(x => x.field !== 'type'); if (carried) flag(f, 'type', 'line in the box: taken from the last flight on the page before'); }
      else if (!f.type) flag(f, 'type', 'no aircraft type, and none above to copy');
      // Date: from a date column, or day column + page month/year.
      const dateCol = cols.find(c => c.field === 'date'), dayCol = cols.find(c => c.field === 'day');
      if (dateCol) {
        f.raw.date = textOf('date'); f.conf.date = confOf('date');
        const d = parseDate(f.raw.date, page); f.date = d.value; if (!d.value) flag(f, 'date', f.raw.date ? `couldn't read "${f.raw.date}"` : 'no date');
      } else {
        f.raw.day = textOf('day'); f.conf.day = confOf('day');
        const d = parseDay(f.raw.day);
        if (d.ditto) d.value = lastDay || null;
        f.day = d.value;
        f.date = d.value && page.year && page.month ? isoDate(page.year, d.month || page.month, d.value) : null;
        if (!d.value) flag(f, 'day', f.raw.day ? `couldn't read "${f.raw.day}"` : 'no day');
        else if (!page.year || !page.month) flag(f, 'day', 'set the page month and year');
        else if (d.value < lastDay) flag(f, 'day', 'earlier than the line above');
        else if (f.raw.day && f.conf.day < LOW) flag(f, 'day', 'hard to read — please check');
        if (d.value) lastDay = d.value;
      }
      if (!f.squadron) f.squadron = page.squadron || '';
      if (!f.ship && hasShipWork(f)) f.ship = page.ship || '';
      sanity(f);
      // A line with only a stray mark and nothing useful isn't a flight.
      const useful = f.total != null || f.type || f.buno || f.date;
      if (!useful) return;
      // One stray mark in one box (a crease, a smudge, show-through from the other side) isn't a flight either:
      // a real line has writing in at least two of its main boxes.
      const written = ['day', 'date', 'type', 'buno', 'kind', 'total', 'pic', 'sic'].filter(k => cell[k] && (/[A-Za-z0-9]/.test(textOf(k)) || ((k === 'type' || k === 'buno') && DITTO.test(textOf(k).trim())))).length;
      if (written < 2) return;
      for (const k of ['type', 'buno', 'kind']) if (f[k]) prev[k] = f[k];
      if (f.type && !f.typeSame) carried = false; // this page has named its own aircraft now
      rows.push(f);
    });
    // Cross-check against a stamped totals line, if there is one.
    const tot = rows.find(r => r.rowType === 'totals' && r.total != null);
    if (tot) {
      const sum = round1(rows.filter(r => r.rowType === 'flight').reduce((s, r) => s + (r.total || 0), 0));
      if (Math.abs(sum - tot.total) > 0.05) notes.push(`Flight times add up to ${sum.toFixed(1)}, but the totals line on the page says ${tot.total.toFixed(1)}.`);
      else notes.push(`Flight times match the page's totals line (${sum.toFixed(1)}).`);
    }
    return { rows, notes, bands };
  }

  // In a Navy logbook, total pilot time = first pilot (PIC) + co-pilot (SIC). Use that to fill a box that
  // couldn't be read and to catch one that was read wrong. Anything worked out this way is marked for a look.
  function pilotTimeRule(f) {
    const has = k => typeof f[k] === 'number'; const r = v => Math.round(v * 10) / 10;
    if (!has('pic') && !has('sic')) return;
    if (!has('total')) { f.total = r((f.pic || 0) + (f.sic || 0)); f.flags = f.flags.filter(x => x.field !== 'total'); flag(f, 'total', 'worked out as first pilot + co-pilot time'); return; }
    if (has('pic') && has('sic')) { // both read. If the total disagrees but contains the right figure (a printed line read as an extra "1"), take the sum.
      const sum = r(f.pic + f.sic);
      if (Math.abs(sum - f.total) > 0.051 && digitsFix(String(f.raw.total || '')).replace(/[^\d.]/g, '').includes(sum.toFixed(1))) {
        f.total = sum; f.flags = f.flags.filter(x => x.field !== 'total'); flag(f, 'total', 'set to first pilot + co-pilot time');
      }
      return;
    }
    const k = has('pic') ? 'sic' : 'pic', other = has('pic') ? f.pic : f.sic, rest = r(f.total - other);
    if (rest > 0 && rest < f.total && (f.raw[k] || '').trim()) { f[k] = rest; f.flags = f.flags.filter(x => x.field !== k); flag(f, k, 'worked out from the total time'); }
  }

  // ---------- Two readings of one box ----------
  // The page is read twice in the iPhone app: once as a whole, then each filled box on its own, close up, with a few
  // alternative readings. This picks the reading that fits what the column holds.
  function parseField(field, text, knownTypes) {
    const kind = (FIELD[field] || {}).kind; const t = String(text || '').trim();
    if (!t) return { value: null, empty: true };
    if (kind === 'hours') { const p = parseHours(t); return (p.value != null && p.value > 12) ? Object.assign(p, { bad: true }) : p; }
    if (kind === 'count') return parseCount(t);
    if (kind === 'day') return parseDay(t);
    if (kind === 'buno') return parseBuno(t);
    if (kind === 'type') { const p = normalizeType(t, knownTypes); if (!p.ditto && ![...(knownTypes || []), ...KNOWN_TYPES].includes(p.value)) p.unsure = true; return p; }
    if (kind === 'code') { const v = fixKind(t); return { value: v, unsure: !/^\d[A-Z]\d$/.test(v) }; }
    if (field === 'apprType') { const v = t.toUpperCase(); return { value: v, unsure: !/^(\d?\s*N?P\s*)+$/.test(v) }; }
    return { value: t };
  }
  const cleanRead = p => !p.empty && !p.bad && !p.unsure && !p.note && (p.ditto || (p.value != null && p.value !== ''));
  // pageText: what the whole-page reading found in the box. candidates: [{text, conf}] from the close-up, best first.
  // Returns {text, conf} to use in place of the page reading, or null to keep the page reading.
  function chooseReading(field, pageText, candidates, knownTypes) {
    const numeric = ['hours', 'count'].includes((FIELD[field] || {}).kind);
    const cands = (candidates || []).filter(c => c && String(c.text || '').trim() && !(numeric && DITTO.test(String(c.text).trim()))); // a bare dash in a number box is a scrap of printed line
    const page = parseField(field, pageText, knownTypes), pageOk = cleanRead(page);
    const idx = cands.findIndex(c => cleanRead(parseField(field, c.text, knownTypes)));
    if (idx < 0) { // the close-up found nothing that fits the column
      if (pageOk || !cands.length) return null;
      return { text: cands[0].text, conf: Math.min(cands[0].conf == null ? 50 : cands[0].conf, 50) };
    }
    const c = cands[idx], got = parseField(field, c.text, knownTypes);
    if (pageOk && !page.ditto && !got.ditto) {
      if (String(page.value) === String(got.value)) return { text: c.text, conf: 95 };                 // both readings agree
      return { text: c.text, conf: 50, disagreed: String(pageText).trim() };                          // they differ: use the close-up, ask
    }
    return { text: c.text, conf: idx === 0 ? Math.max(c.conf == null ? 65 : c.conf, 65) : 55 };         // an alternative fit: ask
  }

  function hasShipWork(f) { return (f.traps || 0) + (f.carrierTG || 0) + (f.dayShip || 0) + (f.nightShip || 0) + (f.dayTraps || 0) + (f.nightTraps || 0) + (f.cats || 0) > 0; }
  function round1(v) { return Math.round(v * 10) / 10; }

  function flag(f, field, reason) { if (!f.flags.some(x => x.field === field && x.reason === reason)) f.flags.push({ field, reason }); }

  // Checks that look at the whole line. Clears and re-adds its own flags so it can run after edits.
  function sanity(f) {
    f.flags = (f.flags || []).filter(x => !x.check);
    const add = (field, reason) => f.flags.push({ field, reason, check: true });
    if (f.total != null && (f.total <= 0 || f.total > 12)) add('total', 'flight time outside 0.1–12.0');
    if (f.night != null && f.total != null && f.night > f.total + 0.001) add('night', 'more night time than flight time');
    for (const k of ['pic', 'sic', 'acCmdr', 'specialCrew', 'instActual', 'instSim']) if (f[k] != null && f.total != null && f[k] > f.total + 0.001) add(k, 'more than the flight time');
    if (typeof f.pic === 'number' && typeof f.sic === 'number' && typeof f.total === 'number' && Math.abs(f.pic + f.sic - f.total) > 0.051) add('total', `first pilot ${f.pic.toFixed(1)} + co-pilot ${f.sic.toFixed(1)} is not the total ${f.total.toFixed(1)}`);
    for (const k of ['traps', 'carrierTG', 'fclp', 'landings', 'simApproaches', 'dayLand', 'nightLand', 'dayShip', 'nightShip', 'dayTraps', 'nightTraps', 'cats', 'approaches']) if (f[k] != null && f[k] > 15) add(k, 'unusually high');
    if ((f.nightTraps || f.nightShip) && !f.night) add('night', 'night landings aboard ship but no night time');
    if (hasShipWork(f) && !f.ship) add('ship', 'ship landings but no ship name');
    if (f.total == null) add('total', 'no flight time');
    if (f.date && !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) add('date', 'date not in a known form');
    return f;
  }

  // Re-check one line after you edit it on the Review screen (keeps OCR flags only for fields you haven't touched).
  function recheck(f, editedField) {
    if (editedField) f.flags = (f.flags || []).filter(x => x.field !== editedField || x.check);
    return sanity(f);
  }

  // Find the printed row lines on a page, even when they are faint or the page is a little crooked.
  // gray: the page with its lighting evened out (paper near 255). The page is cut into upright strips; in each strip a
  // printed line shows as a thin band that is dark nearly all the way across, which handwriting never is. A line counts
  // when most strips agree on it. Returns heights as fractions of the page, measured at the page's middle.
  function findRowLines(gray, w, h, opts) { return rowLineFits(gray, w, h, opts).map(f => (f.a + f.b * w / 2) / h).sort((a, b) => a - b); }
  // The same lines as straight fits, y = a + b·x in pixels, so each can be followed (and painted out) across a crooked page.
  function rowLineFits(gray, w, h, opts) {
    opts = opts || {};
    const S = opts.strips || 8, T = opts.dark || 215, need = opts.cover || 0.6;
    const xa = Math.round(w * 0.04), sw = Math.floor((w * 0.92) / S), tol = Math.max(3, Math.round(h * 0.007)), minGap = Math.max(4, Math.round(h * 0.008));
    const tracks = [];
    for (let s = 0; s < S; s++) {
      const x0 = xa + s * sw, frac = new Float32Array(h);
      for (let y = 0; y < h; y++) { let n = 0; const o = y * w + x0; for (let x = 0; x < sw; x++) if (gray[o + x] < T) n++; frac[y] = n / sw; }
      // a crooked line crosses a few pixel rows inside one strip, so add up a small window
      const win = new Float32Array(h); for (let y = 2; y < h - 2; y++) win[y] = Math.min(1, frac[y - 2] + frac[y - 1] + frac[y] + frac[y + 1] + frac[y + 2]);
      const peaks = [];
      for (let y = 2; y < h - 2; y++) {
        if (win[y] < need || win[y] < win[y - 1] || win[y] < win[y + 1]) continue;
        let a = y, b = y; while (b + 1 < h && win[b + 1] >= win[y] - 1e-6) b++; // flat top: the line is where the darkest three rows are
        let mid = (a + b) / 2, top3 = -1; for (let k = Math.max(1, a - 2); k <= Math.min(h - 2, b + 2); k++) { const v = frac[k - 1] + frac[k] + frac[k + 1]; if (v > top3) { top3 = v; mid = k; } } y = b;
        if (peaks.length && mid - peaks[peaks.length - 1] < minGap) continue;
        peaks.push(mid);
      }
      for (const p of peaks) {
        let t = null; for (const k of tracks) if (k.lastS < s && s - k.lastS <= 2 && Math.abs(k.lastY - p) <= tol && (!t || Math.abs(k.lastY - p) < Math.abs(t.lastY - p))) t = k;
        const cx = x0 + sw / 2;
        if (t) { t.ys.push(p); t.xs.push(cx); t.lastY = p; t.lastS = s; } else tracks.push({ ys: [p], xs: [cx], lastY: p, lastS: s });
      }
    }
    return tracks.filter(k => k.ys.length >= Math.ceil(S * 0.6)).map(k => {
      const mx = mean(k.xs), my = mean(k.ys); let num = 0, den = 0; k.xs.forEach((x, i) => { num += (x - mx) * (k.ys[i] - my); den += (x - mx) * (x - mx); });
      const b = den ? num / den : 0; return { a: my - b * mx, b };
    });
  }
  // The usual distance between row lines inside the flight area, or 0 if too few were found.
  function rowPitch(lines, template) {
    const ys = (lines || []).filter(y => y >= template.top - 0.01 && y <= template.bottom + 0.01).sort((a, b) => a - b);
    if (ys.length < 4) return 0;
    return median(ys.slice(1).map((v, i) => v - ys[i]));
  }

  // Find long dark horizontal / vertical ruled lines in a grayscale image (Uint8 array, w×h). Returns fractions.
  function findRuledLines(gray, w, h, axis, opts) {
    opts = opts || {};
    const along = axis === 'h' ? w : h, across = axis === 'h' ? h : w;
    const thr = opts.dark || 140, minFrac = opts.minFrac || 0.35;
    const score = new Float32Array(across);
    for (let a = 0; a < across; a++) {
      let run = 0, best = 0, total = 0;
      for (let b = 0; b < along; b++) {
        const v = axis === 'h' ? gray[a * w + b] : gray[b * w + a];
        if (v < thr) { run++; total++; if (run > best) best = run; } else if (run && b + 1 < along && (axis === 'h' ? gray[a * w + b + 1] : gray[(b + 1) * w + a]) < thr) { /* one-pixel gap */ } else run = 0;
      }
      score[a] = Math.max(total / along * 0.6, best / along);
    }
    const out = [];
    for (let a = 1; a < across - 1; a++) {
      if (score[a] >= minFrac && score[a] >= score[a - 1] && score[a] >= score[a + 1]) {
        if (out.length && a - out[out.length - 1].a < across * 0.006) { if (score[a] > out[out.length - 1].s) out[out.length - 1] = { a, s: score[a] }; }
        else out.push({ a, s: score[a] });
      }
    }
    return out.map(o => o.a / across);
  }

  // True when most words are taller than they are wide: the page was photographed lying on its side.
  function looksSideways(words, w, h) {
    const ws = (words || []).filter(x => String(x.text).replace(/[^A-Za-z0-9]/g, '').length >= 3);
    if (ws.length < 5) return false;
    return ws.filter(x => (x.y1 - x.y0) * h > 1.5 * (x.x1 - x.x0) * w).length > ws.length * 0.5;
  }

  const api = { skipHeaderRows, trackLines, findColLines, fitTemplate, headerDate, rowLineFits, findRowLines, rowPitch, readingOrder, fixKind, parseField, chooseReading, cellAt, looksSideways, FIELDS, FIELD, NUM_FIELDS, KNOWN_TYPES, defaultTemplate, extractPage, rowBands, parseHours, parseCount, parseBuno, parseDay, parseDate,
    normalizeType, sanity, recheck, findRuledLines, isoDate, hasShipWork };
  root.BBExtract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
