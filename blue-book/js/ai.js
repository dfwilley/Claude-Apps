// Blue Book — the optional AI reader (web version).
// The reader built into the browser handles printed text, not handwriting. With this switched on, a picture of each
// page's flight lines is sent to Claude (Anthropic) to be read. It is off until you put in your own key, and it is the
// one part of Blue Book that sends anything off the computer: two pictures per page (the left and right logbook pages).
(function (root) {
  'use strict';
  const X = root.BBExtract || require('./extract.js');
  const MODEL = 'claude-opus-5-5';
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';

  // What the logbook itself prints above each box, so Claude can find it on the page.
  const PRINTED = { day: 'DAY', type: 'MODEL', buno: 'SERIAL NUMBER', kind: 'KIND OF FLIGHT CODE', total: 'TOTAL PILOT TIME', pic: 'FIRST PILOT', sic: 'CO-PILOT', acCmdr: 'A/C COMDR.', specialCrew: 'SPECIAL CREW TIME',
    instActual: 'INSTRUMENT TIME, ACT', instSim: 'INSTRUMENT TIME, SIM', night: 'NIGHT TIME', traps: 'LANDINGS, CARRIER, ARR', carrierTG: 'LANDINGS, CARRIER, T&G', fclp: 'LANDINGS, FCL', landings: 'LANDINGS, SEA/LAND', cats: 'CATAPULT',
    approaches: 'STD INST. APPR. COMPLETED, NO.', apprType: 'STD INST. APPR. COMPLETED, TYPE', simApproaches: 'STD INST. APPR. COMPLETED, S', remarks: 'REMARKS' };
  const heading = f => PRINTED[f] ? `printed heading “${PRINTED[f]}”` : X.FIELD[f].label;

  // The boxes on a line that are read, in logbook order, split at the gutter into the two pages.
  function columnsOf(template) {
    const cols = template.columns.slice().sort((a, b) => a.x0 - b.x0), g = template.gutter || 0.525;
    const use = cols.filter(c => c.field !== 'skip');
    return { left: use.filter(c => (c.x0 + c.x1) / 2 < g), right: use.filter(c => (c.x0 + c.x1) / 2 >= g), all: use };
  }

  // What Claude is asked to send back: one entry per written line, one text value per box, exactly as written.
  function schemaFor(template) {
    const props = { row: { type: 'integer', description: 'The row number printed in red beside the line.' } };
    for (const c of columnsOf(template).all) props[c.field] = { type: 'string', description: heading(c.field) };
    props.unsure = { type: 'array', items: { type: 'string' }, description: 'Names of the boxes on this line you could not read with confidence.' };
    return { type: 'object', additionalProperties: false, required: ['month', 'year', 'rows'], properties: {
      month: { type: 'string', description: 'The month handwritten after MONTH at the top of the left page, or "" if not readable.' },
      year: { type: 'string', description: 'The year handwritten after YEAR at the top of the left page, as written, or "".' },
      rows: { type: 'array', items: { type: 'object', additionalProperties: false, required: Object.keys(props), properties: props } } } };
  }

  function promptFor(template, rowNumbers) {
    const c = columnsOf(template), names = list => list.map(x => `${x.field} (${heading(x.field)})`).join('; ');
    return [
      'These two pictures are the left and right pages of one opening of a US Navy aviator\'s flight logbook. Each ruled line is one flight, written by hand, and a flight runs straight across both pages.',
      `A red number has been added in the margin beside each line (${rowNumbers[0]} to ${rowNumbers[rowNumbers.length - 1]}); the same number marks the same flight on both pages.`,
      `Left page boxes, left to right: ${names(c.left)}.`,
      `Right page boxes, left to right: ${names(c.right)}. The printed column headings on each page show where each box is; a printed column that is not in this list (such as LANDINGS, CARRIER, BOL) is to be ignored.`,
      'Read every line that has handwriting on it and return one entry per line with its red number. Leave out lines with no handwriting, and leave out the printed headings and the totals lines at the bottom (TOTAL THIS PAGE, BROUGHT FORWARD, TOTAL TO DATE).',
      'Copy each box exactly as it is written: do not correct, complete, convert or add anything up. Flight times are hours and tenths such as 1.5. Use "" for an empty box. If a box holds only a drawn horizontal line (meaning "same as the line above"), return "-". If a box holds two entries one above the other, return both separated by a space, top one first.',
      'List in "unsure" the name of any box you had to guess at. Also read the month and year handwritten at the top of the left page.',
    ].join('\n\n');
  }

  // Turn Claude's answer into words placed in their boxes, so the rest of Blue Book treats them like any other reading.
  // bands: [{n, y0, y1, ry0?, ry1?, g?}] — the numbered rows that were drawn on the pictures.
  function wordsFrom(result, template, bands) {
    const out = [], byN = new Map(bands.map(b => [b.n, b])), cols = columnsOf(template).all;
    for (const r of (result && result.rows) || []) {
      const b0 = byN.get(Number(r.row)); if (!b0) continue; const unsure = new Set(r.unsure || []);
      for (const c of cols) {
        const text = String(r[c.field] == null ? '' : r[c.field]).trim(); if (!text) continue;
        const b = X.sideBand(b0, (c.x0 + c.x1) / 2), pad = (b.y1 - b.y0) * 0.2;
        out.push({ text, conf: unsure.has(c.field) ? 45 : 96, x0: c.x0 + 0.001, x1: c.x1 - 0.001, y0: b.y0 + pad, y1: b.y1 - pad, ai: true });
      }
    }
    return out;
  }
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  function dateFrom(result) {
    const m = String((result && result.month) || '').trim().toUpperCase(), y = String((result && result.year) || '').replace(/[^\d]/g, '');
    let month = MONTHS.findIndex(k => m.startsWith(k)) + 1; if (!month && /^\d{1,2}$/.test(m) && +m >= 1 && +m <= 12) month = +m;
    let year = y.length === 4 ? +y : y.length === 2 ? (+y > 40 ? 1900 + +y : 2000 + +y) : null; if (year && (year < 1940 || year > 2100)) year = null;
    return { month: month || null, year };
  }

  // One request per page: the two pictures and the question; the answer comes back as JSON in the agreed shape.
  function requestBody(template, rowNumbers, images) {
    return {
      model: MODEL, max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: schemaFor(template) } },
      fallbacks: 'default', // if the reader declines a page, let the service pass it to its standard fallback
      messages: [{ role: 'user', content: [
        ...images.map(data => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })),
        { type: 'text', text: promptFor(template, rowNumbers) } ] }],
    };
  }
  function explain(status, body) {
    const said = body && body.error && body.error.message ? ' (' + body.error.message + ')' : '';
    if (status === 401) return 'The key was not accepted. Check it under Export, Reading handwriting.';
    if (status === 403) return 'The key is not allowed to do this' + said + '.';
    if (status === 429) return 'The reading service is busy or the account is at its limit. Wait a minute and try again' + said + '.';
    if (status === 400 && /credit|billing/i.test(said)) return 'The Anthropic account has no credit left' + said + '.';
    if (status >= 500) return 'The reading service had a problem. Try again in a minute.';
    return 'The reading service refused the request' + said + '.';
  }
  async function read(key, template, rowNumbers, images, fetchFn) {
    let res;
    try {
      res = await (fetchFn || root.fetch)(ENDPOINT, { method: 'POST', headers: {
        'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2026-10-21',
        'anthropic-beta': 'server-side-fallback-2026-07-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(requestBody(template, rowNumbers, images)) });
    } catch (e) { throw new Error('Could not reach the reading service. Check the internet connection.'); }
    let body = null; try { body = await res.json(); } catch (e) { body = null; }
    if (!res.ok) throw new Error(explain(res.status, body));
    if (!body || body.stop_reason === 'refusal') throw new Error('The reading service declined to read this page.');
    if (body.stop_reason === 'max_tokens') throw new Error('The page was too long to read in one go.');
    const text = (body.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let result; try { result = JSON.parse(text); } catch (e) { throw new Error('The reading service sent back something unreadable. Try again.'); }
    return { result, usage: body.usage || null, model: body.model };
  }

  const api = { MODEL, columnsOf, schemaFor, promptFor, wordsFrom, dateFrom, requestBody, read };
  root.BBAi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
