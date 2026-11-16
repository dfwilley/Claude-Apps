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
  // The order of a Navy aviator's logbook spread. The Carrier Bolter column is there but skipped.
  const DEFAULT_COLUMNS = [
    ['day', 0.035], ['type', 0.08], ['buno', 0.07], ['kind', 0.045], ['total', 0.045], ['pic', 0.04], ['sic', 0.04],
    ['acCmdr', 0.04], ['specialCrew', 0.04], ['instActual', 0.04], ['instSim', 0.04], ['night', 0.04],
    ['traps', 0.035], ['carrierTG', 0.035], ['skip', 0.035], ['fclp', 0.035], ['landings', 0.035], ['cats', 0.035],
    ['approaches', 0.035], ['apprType', 0.04], ['simApproaches', 0.035], ['remarks', 0.0],
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
      const textOf = k => readingOrder(cell[k] || []).map(w => w.text).join(' ');
      const confOf = k => cell[k] ? Math.min(...cell[k].map(w => w.conf == null ? 100 : w.conf)) : 100;
      const allText = keys.map(textOf).join(' ');
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
        else if (kind === 'type') res = normalizeType(raw, opts.knownTypes);
        else if (kind === 'buno') res = parseBuno(raw);
        else if (kind === 'code') { res = { value: fixKind(raw) }; if (res.value && !/^\d[A-Z]\d$/.test(res.value)) res.unsure = true; }
        else res = { value: raw.trim() };
        if (res.ditto) {
          const had = prev[k] != null; res.value = had ? prev[k] : res.value;
          if (!had) flag(f, k, 'marked “same as the line above”, but there is no line above on this page');
          else if (k !== 'type') flag(f, k, 'ditto mark — copied from the line above'); // a line through the type box is the normal way to write it
        }
        f[k] = res.value;
        if (res.bad) flag(f, k, `couldn't read "${raw}"`);
        else if (res.unsure) flag(f, k, 'unusual value');
        if (res.note) flag(f, k, res.note);
        if (raw && f.conf[k] < LOW && !res.bad) flag(f, k, 'hard to read — please check');
      }
      pilotTimeRule(f);
      if (!f.type && prev.type && (f.total != null || f.buno)) { f.type = prev.type; flag(f, 'type', 'nothing read here — copied from the line above'); }
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

  // In a Navy logbook, total pilot time = first pilot (PIC) + co-pilot (SIC). Use that to fill a box that
  // couldn't be read and to catch one that was read wrong. Anything worked out this way is marked for a look.
  function pilotTimeRule(f) {
    const has = k => typeof f[k] === 'number'; const r = v => Math.round(v * 10) / 10;
    if (!has('pic') && !has('sic')) return;
    if (!has('total')) { f.total = r((f.pic || 0) + (f.sic || 0)); f.flags = f.flags.filter(x => x.field !== 'total'); flag(f, 'total', 'worked out as first pilot + co-pilot time'); return; }
    if (has('pic') && has('sic')) return; // both read: sanity() says whether they add up
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
    const cands = (candidates || []).filter(c => c && String(c.text || '').trim());
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

  const api = { readingOrder, fixKind, parseField, chooseReading, cellAt, looksSideways, FIELDS, FIELD, NUM_FIELDS, KNOWN_TYPES, defaultTemplate, extractPage, rowBands, parseHours, parseCount, parseBuno, parseDay, parseDate,
    normalizeType, sanity, recheck, findRuledLines, isoDate, hasShipWork };
  root.BBExtract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
