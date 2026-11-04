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
    { key: 'night',      label: 'Night time',        kind: 'hours' },
    { key: 'instActual', label: 'Instrument (actual)', kind: 'hours' },
    { key: 'instSim',    label: 'Instrument (sim)',  kind: 'hours' },
    { key: 'approaches', label: 'Approaches',        kind: 'count' },
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
  const DEFAULT_COLUMNS = [
    ['day', 0.035], ['type', 0.09], ['buno', 0.08], ['kind', 0.05], ['total', 0.055], ['night', 0.05],
    ['instActual', 0.05], ['instSim', 0.05], ['approaches', 0.045], ['dayLand', 0.045], ['nightLand', 0.045],
    ['dayShip', 0.045], ['nightShip', 0.045], ['dayTraps', 0.045], ['nightTraps', 0.045], ['cats', 0.045], ['remarks', 0.0],
  ];
  function defaultTemplate() {
    let x = 0.02; const cols = [];
    const fixed = DEFAULT_COLUMNS.reduce((s, c) => s + c[1], 0);
    for (const [field, w] of DEFAULT_COLUMNS) {
      const width = w || Math.max(0.05, 0.98 - x - 0.0) ;
      cols.push({ field, x0: round4(x), x1: round4(Math.min(0.98, x + width)) });
      x += width;
    }
    void fixed;
    return { columns: cols, top: 0.16, bottom: 0.92 };
  }

  const KNOWN_TYPES = ['AV-8A', 'AV-8C', 'TAV-8A', 'AV-8B', 'AV-8B+', 'TAV-8B', 'T-34B', 'T-34C', 'T-28B', 'T-28C', 'T-2B', 'T-2C',
    'TA-4F', 'TA-4J', 'A-4M', 'A-4E', 'OA-4M', 'T-45A', 'T-45C', 'T-39', 'UC-12B', 'F/A-18A', 'F/A-18C', 'F-5E', 'T-38'];

  function round4(v) { return Math.round(v * 10000) / 10000; }

  // ---------- Rows ----------

  // Row bands from ruled lines (fractions of page height) — or, if no lines, from where the words sit.
  function rowBands(words, template, ruledLines) {
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
    // Cluster word centers by height on the page.
    const inside = words.filter(w => cy(w) >= top && cy(w) <= bottom).sort((a, b) => cy(a) - cy(b));
    if (!inside.length) return [];
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
  const cy = w => (w.y0 + w.y1) / 2;
  const cx = w => (w.x0 + w.x1) / 2;
  function median(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function mean(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

  // ---------- Reading one cell ----------

  const DITTO = /^(["”“〃'′″]+|do\.?|ditto|-{1,2}|=)$/i;

  function digitsFix(s) { // common handwriting misreads in number columns
    return s.replace(/[Oo]/g, '0').replace(/[lI|!]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').replace(/Z/g, '2').replace(/[gq]/g, '9');
  }

  function parseHours(raw) {
    let s = raw.trim(); if (!s) return { value: null };
    if (DITTO.test(s)) return { value: null, ditto: true };
    s = digitsFix(s).replace(/,/g, '.').replace(/\s+/g, ' ');
    let m;
    if ((m = s.match(/^(\d{1,2}) (\d)$/))) return { value: +(m[1] + '.' + m[2]) }; // hours | tenths sub-columns
    if ((m = s.match(/^(\d{0,2})\.(\d)\d?$/))) return { value: +((m[1] || '0') + '.' + m[2]) };
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
    const bands = rowBands(words, template, opts.ruledLines);
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
    const prev = {};
    let lastDay = 0;
    bands.forEach((band, r) => {
      const cell = cells[r];
      const keys = Object.keys(cell); if (!keys.length) return;
      const textOf = k => (cell[k] || []).sort((a, b) => a.x0 - b.x0).map(w => w.text).join(' ');
      const confOf = k => cell[k] ? Math.min(...cell[k].map(w => w.conf == null ? 100 : w.conf)) : 100;
      const allText = keys.map(textOf).join(' ');
      // Monthly totals / brought-forward lines are checks, not flights.
      if (/TOTAL|FWD|FORWARD|BROUGHT|CARRIED|SUM/i.test(allText)) {
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
        else if (kind === 'count') res = parseCount(raw);
        else if (kind === 'type') res = normalizeType(raw, opts.knownTypes);
        else if (kind === 'buno') res = parseBuno(raw);
        else if (kind === 'code') res = { value: raw.trim().toUpperCase().replace(/^[IL|](?=[A-Z]\d)/, '1').replace(/(\d[A-Z])[IL|]$/, '$11').replace(/^O(?=[A-Z]\d)/, '0') };
        else res = { value: raw.trim() };
        if (res.ditto) { res.value = prev[k] != null ? prev[k] : res.value; flag(f, k, 'ditto mark — copied from the line above'); }
        f[k] = res.value;
        if (res.bad) flag(f, k, `couldn't read "${raw}"`);
        else if (res.unsure) flag(f, k, 'unusual value');
        if (res.note) flag(f, k, res.note);
        if (raw && f.conf[k] < LOW && !res.bad) flag(f, k, 'hard to read — please check');
      }
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
      for (const k of ['type', 'buno', 'kind']) if (f[k]) prev[k] = f[k];
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

  function hasShipWork(f) { return (f.dayShip || 0) + (f.nightShip || 0) + (f.dayTraps || 0) + (f.nightTraps || 0) + (f.cats || 0) > 0; }
  function round1(v) { return Math.round(v * 10) / 10; }

  function flag(f, field, reason) { if (!f.flags.some(x => x.field === field && x.reason === reason)) f.flags.push({ field, reason }); }

  // Checks that look at the whole line. Clears and re-adds its own flags so it can run after edits.
  function sanity(f) {
    f.flags = (f.flags || []).filter(x => !x.check);
    const add = (field, reason) => f.flags.push({ field, reason, check: true });
    if (f.total != null && (f.total <= 0 || f.total > 12)) add('total', 'flight time outside 0.1–12.0');
    if (f.night != null && f.total != null && f.night > f.total + 0.001) add('night', 'more night time than flight time');
    for (const k of ['instActual', 'instSim']) if (f[k] != null && f.total != null && f[k] > f.total + 0.001) add(k, 'more than the flight time');
    for (const k of ['dayLand', 'nightLand', 'dayShip', 'nightShip', 'dayTraps', 'nightTraps', 'cats', 'approaches']) if (f[k] != null && f[k] > 15) add(k, 'unusually high');
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

  const api = { FIELDS, FIELD, NUM_FIELDS, KNOWN_TYPES, defaultTemplate, extractPage, rowBands, parseHours, parseCount, parseBuno, parseDay, parseDate,
    normalizeType, sanity, recheck, findRuledLines, isoDate, hasShipWork };
  root.BBExtract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
