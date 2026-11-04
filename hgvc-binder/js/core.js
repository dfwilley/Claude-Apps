// HGVC Binder — the math and rules. No screens here, so it can be tested on its own (node tests/hgvc-binder.test.js).
(function (root) {
  'use strict';

  const SCHEMA = 1;
  const DAY = 86400000;

  // ---------- dates ----------
  // All dates are plain calendar dates stored as "YYYY-MM-DD" (no time zone surprises).
  function parseDate(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const m = String(s).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const u = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // 01/15/2026
    if (u) return new Date(u[3].length === 2 ? 2000 + +u[3] : +u[3], +u[1] - 1, +u[2]);
    const d = String(s).trim().match(/^(\d{1,2})[- ]([A-Za-z]{3})[A-Za-z]*[- ,]+(\d{4})$/); // 15-Jan-2026
    if (d) {
      const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(d[2].toLowerCase());
      if (mi >= 0) return new Date(+d[3], mi, +d[1]);
    }
    const w = String(s).trim().match(/^([A-Za-z]{3})[A-Za-z]*\.? (\d{1,2}),? (\d{4})$/); // January 1, 2027
    if (w) {
      const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(w[1].toLowerCase());
      if (mi >= 0) return new Date(+w[3], mi, +w[2]);
    }
    return null;
  }
  function iso(d) {
    d = parseDate(d); if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(d, n) { d = parseDate(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / DAY); }
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  // Dates are always written out in full (e.g. "January 1, 2027") so they can't be misread.
  function longDate(d) { d = parseDate(d); return d ? MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() : ''; }
  function shortDate(d) { d = parseDate(d); return d ? MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear() : ''; }

  // ---------- money and numbers ----------
  function money(n) {
    if (n == null || isNaN(n)) return '—';
    const neg = n < 0; const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg ? '−$' : '$') + s;
  }
  function pts(n) { return n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'); }
  function num(v) {
    if (typeof v === 'number') return v;
    if (v == null) return 0;
    const s = String(v).replace(/[$,\s]/g, '');
    const neg = /^\(.*\)$/.test(s) || /^[−-]/.test(s);
    const n = parseFloat(s.replace(/[()−-]/g, ''));
    return isNaN(n) ? 0 : (neg ? -n : n);
  }

  // ---------- privacy ----------
  // Account numbers are only ever shown as the last 4 digits.
  function last4(s) { const d = String(s || '').replace(/\D/g, ''); return d.slice(-4); }
  function mask(s) { const l = last4(s); return l ? '•••• ' + l : '—'; }
  const FORBIDDEN_KEYS = /pass(word|code)?|pwd|token|secret|cvv|card.?number|ssn|honors.?number/i;
  // Removes anything that looks like a password or full card/account number from imported data.
  function scrub(obj) {
    if (Array.isArray(obj)) return obj.map(scrub);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        if (FORBIDDEN_KEYS.test(k)) continue;
        let v = obj[k];
        if (/(contract|member|ref|reservation|confirmation).*(mask|last4|number|no)$/i.test(k) && typeof v === 'string') v = last4(v);
        out[k] = scrub(v);
      }
      return out;
    }
    if (typeof obj === 'string') return obj.replace(/\b(?:\d[ -]?){13,19}\b/g, m => '•••• ' + last4(m)); // card-like numbers
    return obj;
  }

  // ---------- points ----------
  function batchUsed(b) {
    const used = num(b.points) - num(b.available) - num(b.saved) - num(b.borrowed);
    return Math.max(0, used);
  }
  function isCurrent(b, today) { const e = parseDate(b.expires); return !e || e >= parseDate(today); }

  function pointsSummary(p, today) {
    const y = parseDate(today).getFullYear();
    const batches = (p.batches || []).filter(b => isCurrent(b, today));
    const thisYear = (p.batches || []).filter(b => +b.year === y);
    const availableNow = batches.filter(b => b.kind !== 'future').reduce((s, b) => s + num(b.available), 0);
    const future = batches.filter(b => b.kind === 'future');
    const next = batches.filter(b => num(b.available) > 0 && b.kind !== 'future' && b.expires)
      .sort((a, b) => parseDate(a.expires) - parseDate(b.expires))[0] || null;
    return {
      availableNow,
      usedThisYear: thisYear.reduce((s, b) => s + batchUsed(b), 0),
      savedThisYear: thisYear.reduce((s, b) => s + num(b.saved), 0),
      borrowedThisYear: thisYear.reduce((s, b) => s + num(b.borrowed), 0),
      upcoming: future.reduce((s, b) => s + num(b.available), 0),
      nextExpiring: next ? { batch: next, points: num(next.available), date: next.expires, days: daysBetween(today, next.expires) } : null
    };
  }

  // ---------- fees ----------
  function feeYears(p) {
    const by = {};
    for (const f of p.fees || []) {
      if (f.kind === 'Payment') continue;
      const y = +f.year; if (!y) continue;
      by[y] = by[y] || { year: y, total: 0, unpaid: 0, items: [], due: null, paid: true };
      by[y].total += num(f.amount);
      by[y].items.push(f);
      if (!f.paid) { by[y].unpaid += num(f.amount); by[y].paid = false; }
      if (f.due && num(f.amount) > 0 && (!by[y].due || parseDate(f.due) < parseDate(by[y].due))) by[y].due = f.due;
    }
    const years = Object.values(by).sort((a, b) => a.year - b.year);
    years.forEach((r, i) => {
      r.total = Math.round(r.total * 100) / 100; r.unpaid = Math.round(r.unpaid * 100) / 100;
      r.change = i ? (r.total - years[i - 1].total) / years[i - 1].total : null;
      r.costPerPoint = num(p.annualPoints) ? r.total / num(p.annualPoints) : null;
    });
    return years;
  }
  function feesDue(p) { return (p.fees || []).filter(f => !f.paid && f.kind !== 'Payment' && num(f.amount) > 0); }

  // ---------- reminders ----------
  const DEFAULT_SETTINGS = { remind: { expire: [60, 30, 7], save: [21, 7, 1], fee: [30, 14, 3] }, hour: 9 };

  // Everything worth a heads-up: points about to expire, the last day to save them, and fees coming due.
  function deadlines(state, today) {
    const out = [];
    for (const p of state.properties || []) {
      for (const b of p.batches || []) {
        if (num(b.available) <= 0 || !b.expires || b.kind === 'future') continue;
        out.push({ kind: 'expire', propertyId: p.id, date: iso(b.expires), title: pts(b.available) + ' ' + (p.currency || 'points') + ' expire', sub: (p.short || p.name) + ' · ' + (b.label || b.year) });
        if (b.saveBy && b.kind !== 'saved' && b.kind !== 'bonus') {
          out.push({ kind: 'save', propertyId: p.id, date: iso(b.saveBy), title: 'Save ' + pts(b.available) + ' ' + (p.currency || 'points'), sub: (p.short || p.name) + (b.saveNote ? ' · ' + b.saveNote : '') });
        }
      }
      for (const f of feesDue(p)) {
        if (!f.due) continue;
        out.push({ kind: 'fee', propertyId: p.id, date: iso(f.due), title: money(num(f.amount)) + ' ' + (f.label || 'fee') + ' due', sub: (p.short || p.name) + ' · ' + f.year + (f.note ? ' · ' + f.note : '') });
      }
    }
    const t = parseDate(today);
    return out.filter(d => parseDate(d.date) >= t).map(d => Object.assign(d, { days: daysBetween(t, d.date) }))
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  }

  // The phone notifications to schedule: each deadline, N days before.
  function notifications(state, today) {
    const s = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
    const remind = Object.assign({}, DEFAULT_SETTINGS.remind, s.remind || {});
    const t = parseDate(today); const out = [];
    for (const d of deadlines(state, today)) {
      for (const lead of remind[d.kind] || []) {
        const fire = addDays(d.date, -lead);
        if (fire < t) continue;
        const when = lead === 0 ? 'today' : lead === 1 ? 'tomorrow' : 'in ' + lead + ' days';
        out.push({ id: [d.kind, d.propertyId, d.date, lead].join('|'), fire: iso(fire), hour: s.hour || 9,
          title: d.title + ' ' + when, body: d.sub + ' — ' + longDate(d.date) });
      }
    }
    return out.sort((a, b) => a.fire < b.fire ? -1 : 1).slice(0, 60); // iPhone allows 64 pending
  }

  // A calendar file (.ics) with all-day events — used by the web version, which can't send notifications on its own.
  function buildICS(state, today) {
    const s = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
    const esc = t => String(t).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HGVC Binder//EN', 'CALSCALE:GREGORIAN'];
    for (const d of deadlines(state, today)) {
      const ymd = d.date.replace(/-/g, ''); const next = iso(addDays(d.date, 1)).replace(/-/g, '');
      const leads = (s.remind && s.remind[d.kind]) || DEFAULT_SETTINGS.remind[d.kind];
      lines.push('BEGIN:VEVENT', 'UID:' + esc([d.kind, d.propertyId, d.date].join('-')) + '@hgvc-binder', 'DTSTAMP:' + iso(today).replace(/-/g, '') + 'T000000Z',
        'DTSTART;VALUE=DATE:' + ymd, 'DTEND;VALUE=DATE:' + next, 'SUMMARY:' + esc(d.title), 'DESCRIPTION:' + esc(d.sub + ' (from HGVC Binder)'));
      for (const lead of leads) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(d.title), 'TRIGGER:-P' + lead + 'DT0H', 'END:VALARM');
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // ---------- roll-up ----------
  function summary(state, today) {
    const props = state.properties || [];
    const byCurrency = {};
    let dueTotal = 0; const due = [];
    for (const p of props) {
      const ps = pointsSummary(p, today);
      const c = p.currency || 'Points';
      byCurrency[c] = (byCurrency[c] || 0) + ps.availableNow;
      for (const f of feesDue(p)) { dueTotal += num(f.amount); due.push({ property: p, fee: f }); }
    }
    const expiring = [];
    for (const p of props) for (const b of p.batches || []) {
      if (num(b.available) > 0 && b.kind !== 'future' && b.expires && isCurrent(b, today)) expiring.push({ property: p, batch: b, days: daysBetween(today, b.expires) });
    }
    expiring.sort((a, b) => a.days - b.days);
    const totalAvailable = Object.values(byCurrency).reduce((s, n) => s + n, 0);
    const annualPoints = props.reduce((s, p) => s + num(p.annualPoints), 0);
    return { byCurrency, totalAvailable, annualPoints, dueTotal: Math.round(dueTotal * 100) / 100, due, expiring, deadlines: deadlines(state, today) };
  }

  // ---------- data file import ----------
  function slug(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'property'; }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  function emptyState() { return { schema: SCHEMA, properties: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), meta: {} }; }

  function normalizeProperty(p) {
    p = Object.assign({ batches: [], ledger: [], reservations: [], fees: [], docs: [], contacts: [], notes: '' }, p);
    p.id = p.id || slug(p.name);
    for (const k of ['batches', 'ledger', 'reservations', 'fees', 'contacts']) p[k] = (p[k] || []).map(x => Object.assign({ id: x.id || uid() }, x));
    if (p.contractNumber) { p.contractLast4 = last4(p.contractNumber); delete p.contractNumber; }
    if (p.memberNumber) { p.memberLast4 = last4(p.memberNumber); delete p.memberNumber; }
    return p;
  }

  // Checks a data file before it's used. Returns {ok, data, problems}.
  function validateDataFile(raw) {
    let d = raw;
    if (typeof raw === 'string') { try { d = JSON.parse(raw); } catch (e) { return { ok: false, problems: ['This isn\'t a readable data file.'] }; } }
    if (!d || typeof d !== 'object' || !Array.isArray(d.properties)) return { ok: false, problems: ['This file has no properties in it.'] };
    if (d.app && d.app !== 'HGVC Binder') return { ok: false, problems: ['This file belongs to a different app (' + d.app + ').'] };
    d = scrub(d);
    d.properties = d.properties.map(normalizeProperty);
    return { ok: true, data: d, problems: [] };
  }

  // Brings in what the owner site says, without losing anything typed by hand.
  // Items from the owner site carry source:"hgv" and are replaced each time; hand-entered items (source:"manual") are kept.
  function mergeData(state, incoming) {
    const s = JSON.parse(JSON.stringify(state || emptyState()));
    const lists = ['batches', 'ledger', 'reservations', 'fees'];
    const changes = [];
    for (const inc of incoming.properties || []) {
      let p = s.properties.find(x => x.id === inc.id);
      if (!p) { p = normalizeProperty(Object.assign({}, inc)); s.properties.push(p); changes.push('Added ' + p.name); continue; }
      const locked = p.locked || {};
      for (const k of Object.keys(inc)) {
        if (lists.includes(k) || k === 'docs' || k === 'contacts' || k === 'notes' || k === 'locked') continue;
        if (locked[k]) continue; // you edited this by hand, so the owner site doesn't overwrite it
        p[k] = inc[k];
      }
      for (const k of lists) {
        const keep = (p[k] || []).filter(x => x.source === 'manual');
        // An owner-site item you edited by hand becomes yours (same id), so the update leaves it alone.
        const fresh = (inc[k] || []).map(x => Object.assign({ source: 'hgv' }, x)).filter(x => !keep.some(m => m.id === x.id) && !(p.suppress || []).includes(x.id));
        // Paid check marks you set by hand survive an update until the owner site agrees.
        if (k === 'fees') for (const f of fresh) { const old = (p.fees || []).find(o => o.id === f.id); if (old && old.paid && !f.paid && old.paidBy === 'me') { f.paid = true; f.paidBy = 'me'; } }
        p[k] = fresh.concat(keep);
      }
      for (const c of inc.contacts || []) if (!(p.contacts || []).some(x => x.label === c.label)) p.contacts.push(Object.assign({ id: uid() }, c));
      changes.push('Updated ' + p.name);
    }
    s.meta = Object.assign({}, s.meta, { hgvAsOf: incoming.asOf || incoming.generated || null, importedAt: new Date().toISOString(), source: incoming.source || 'data file' });
    if (incoming.notes) s.meta.syncNotes = incoming.notes;
    return { state: s, changes };
  }

  // ---------- PDF statement reading ----------
  // HGV statements differ by association, so this finds the common pieces and leaves the rest for you to check.
  function parseStatement(text) {
    const t = String(text || '').replace(/ /g, ' ');
    const out = { year: null, due: null, total: null, lines: [], contractLast4: null, association: null };
    const due = t.match(/(?:date\s*due|due\s*date|payment\s*due|due\s*by|due\s*on)[:\s]*([A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{4})/i);
    if (due) out.due = iso(parseDate(due[1]));
    const tot = t.match(/total\s*(?:amount\s*)?due[:\s]*\$?\s*([\d,]+\.\d{2})/i) || t.match(/amount\s*due[:\s]*\$?\s*([\d,]+\.\d{2})/i) || t.match(/balance\s*due[:\s]*\$?\s*([\d,]+\.\d{2})/i);
    if (tot) out.total = num(tot[1]);
    const con = t.match(/contract\s*(?:no\.?|number|#)[:\s]*([\d-]{5,})/i);
    if (con) out.contractLast4 = last4(con[1]);
    const assoc = t.match(/([A-Z][A-Za-z'’ .&-]{3,60}(?:Association|Members Association|Owners Association))/);
    if (assoc) out.association = assoc[1].trim();
    const years = (t.match(/\b20\d{2}\b/g) || []).map(Number);
    const yr = t.match(/(20\d{2})\s+(?:annual\s+)?(?:maintenance|assessment|club dues|operating)/i);
    out.year = yr ? +yr[1] : (out.due ? parseDate(out.due).getFullYear() : (years.length ? Math.max.apply(null, years) : null));
    const want = /(maintenance|assessment|operating|reserve|real estate|property tax|excise|club dues|club fee|dues|arda|credit|tax)/i;
    for (const line of t.split(/\n/)) {
      const m = line.match(/^\s*(.*?[A-Za-z].*?)\s+(\(?-?\$?\s?[\d,]+\.\d{2}\)?)\s*$/);
      if (!m || !want.test(m[1]) || /total|balance|amount due/i.test(m[1])) continue;
      const label = m[1].replace(/\s{2,}/g, ' ').replace(/^\d{1,2}[\/-]\S+\s+/, '').trim().slice(0, 80);
      out.lines.push({ label, amount: num(m[2]) * (/credit/i.test(label) && num(m[2]) > 0 ? -1 : 1) });
    }
    return out;
  }

  // Turns a read statement into fee rows ready to add to a property.
  function statementToFees(st) {
    const year = st.year || new Date().getFullYear();
    const rows = st.lines.length ? st.lines.map(l => ({ label: l.label, amount: l.amount })) : (st.total != null ? [{ label: 'Maintenance fee & taxes', amount: st.total }] : []);
    return rows.map(r => ({ id: uid(), year, label: r.label, kind: /dues/i.test(r.label) ? 'Club dues' : /credit/i.test(r.label) ? 'Credit' : 'Maintenance fee', amount: r.amount, due: st.due, paid: false, source: 'manual', from: 'statement' }));
  }

  const api = { SCHEMA, DEFAULT_SETTINGS, parseDate, iso, addDays, daysBetween, longDate, shortDate, money, pts, num, last4, mask, scrub,
    batchUsed, pointsSummary, feeYears, feesDue, deadlines, notifications, buildICS, summary, slug, uid, emptyState, normalizeProperty,
    validateDataFile, mergeData, parseStatement, statementToFees, MONTHS };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.HB = api;
})(typeof self !== 'undefined' ? self : this);
