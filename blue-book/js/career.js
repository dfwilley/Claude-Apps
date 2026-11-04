// Blue Book — career totals, deployments, timeline and search. Pure logic, tested in Node.
(function (root) {
  'use strict';
  const r1 = v => Math.round(v * 10) / 10;
  const n = v => (typeof v === 'number' && isFinite(v) ? v : 0);

  function blank() {
    return { flights: 0, hours: 0, night: 0, day: 0, instActual: 0, instSim: 0, approaches: 0, landings: 0, nightLandings: 0,
      shipLandings: 0, nightShipLandings: 0, traps: 0, nightTraps: 0, cats: 0, first: null, last: null };
  }
  function add(t, f) {
    t.flights++;
    t.hours += n(f.total); t.night += n(f.night); t.day += Math.max(0, n(f.total) - n(f.night));
    t.instActual += n(f.instActual); t.instSim += n(f.instSim); t.approaches += n(f.approaches);
    t.landings += n(f.dayLand) + n(f.nightLand); t.nightLandings += n(f.nightLand);
    t.shipLandings += n(f.dayShip) + n(f.nightShip); t.nightShipLandings += n(f.nightShip);
    t.traps += n(f.dayTraps) + n(f.nightTraps); t.nightTraps += n(f.nightTraps); t.cats += n(f.cats);
    if (f.date) { if (!t.first || f.date < t.first) t.first = f.date; if (!t.last || f.date > t.last) t.last = f.date; }
  }
  function tidy(t) { for (const k of ['hours', 'night', 'day', 'instActual', 'instSim']) t[k] = r1(t[k]); return t; }

  function totals(flights) {
    const all = blank();
    const by = { type: {}, squadron: {}, ship: {}, year: {} };
    for (const f of flights) {
      add(all, f);
      const keys = { type: f.type || '(no type)', squadron: f.squadron || '(no squadron)', year: f.date ? f.date.slice(0, 4) : '(no date)' };
      if (f.ship) keys.ship = f.ship;
      for (const [g, k] of Object.entries(keys)) { (by[g][k] = by[g][k] || blank()); add(by[g][k], f); }
    }
    tidy(all);
    const lists = {};
    for (const g of Object.keys(by)) {
      lists[g] = Object.entries(by[g]).map(([name, t]) => ({ name, ...tidy(t) }))
        .sort(g === 'year' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => (a.first || '9').localeCompare(b.first || '9'));
    }
    return { all, ...lists };
  }

  const atSea = f => n(f.dayShip) + n(f.nightShip) + n(f.dayTraps) + n(f.nightTraps) + n(f.cats) > 0;
  const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;

  // Suggest deployments from runs of ship landings with the same ship.
  // A run keeps going while the gap between at-sea flights is 30 days or less.
  function suggestDeployments(flights, opts) {
    opts = opts || {};
    const maxGap = opts.maxGap || 30;
    const sea = flights.filter(f => f.date && atSea(f)).sort((a, b) => a.date.localeCompare(b.date));
    const byShip = {};
    for (const f of sea) (byShip[f.ship || '(ship not named)'] = byShip[f.ship || '(ship not named)'] || []).push(f);
    const out = [];
    for (const [ship, list] of Object.entries(byShip)) {
      let run = [list[0]];
      const close = () => {
        const start = run[0].date, end = run[run.length - 1].date, span = days(start, end) + 1;
        const sqs = mode(run.map(f => f.squadron).filter(Boolean));
        const kind = span >= 45 || run.length >= 25 ? 'Deployment' : span >= 5 || run.length >= 6 ? 'Det / ship quals' : null;
        if (kind) out.push({ key: `${ship}|${start}`, ship, squadron: sqs || '', start, end, days: span, flights: run.length,
          traps: run.reduce((s, f) => s + n(f.dayTraps) + n(f.nightTraps), 0), shipLandings: run.reduce((s, f) => s + n(f.dayShip) + n(f.nightShip), 0),
          kind, name: `${kind === 'Deployment' ? 'Deployment' : 'Det'} — ${ship} (${monthYear(start)})` });
      };
      for (let i = 1; i < list.length; i++) {
        if (days(list[i - 1].date, list[i].date) <= maxGap) run.push(list[i]); else { close(); run = [list[i]]; }
      }
      close();
    }
    return out.sort((a, b) => a.start.localeCompare(b.start));
  }
  function mode(a) { const c = {}; let best = null; for (const v of a) { c[v] = (c[v] || 0) + 1; if (!best || c[v] > c[best]) best = v; } return best; }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthYear(iso) { return iso ? `${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : ''; }
  function longDate(iso) { return iso ? `${MON[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}, ${iso.slice(0, 4)}` : ''; }

  // Runs of the same squadron / aircraft type, for the timeline lanes. Short gaps don't break a run.
  // Each value (say, AV-8B) gets spans of time; a gap longer than maxGapDays starts a new span. Spans of different values may overlap.
  function segments(flights, key, maxGapDays) {
    const gap = maxGapDays || 120;
    const list = flights.filter(f => f.date && f[key]).sort((a, b) => a.date.localeCompare(b.date));
    const open = {}; const segs = [];
    for (const f of list) {
      const v = f[key]; let s = open[v];
      if (!s || days(s.end, f.date) > gap) { s = open[v] = { value: v, start: f.date, end: f.date, flights: 0, hours: 0 }; segs.push(s); }
      s.end = f.date; s.flights++; s.hours += n(f.total);
    }
    segs.forEach(s => { s.hours = r1(s.hours); });
    return segs.sort((a, b) => a.start.localeCompare(b.start));
  }

  // Milestones: first flight, each new type and squadron, deployments, round-number hours and traps.
  function milestones(flights, deployments) {
    const list = flights.filter(f => f.date).sort((a, b) => a.date.localeCompare(b.date) || (a.row || 0) - (b.row || 0));
    const out = []; const seenType = new Set(), seenSq = new Set();
    let hours = 0, traps = 0, sl = 0; let nextH = 100, nextT = 100, nextS = 100;
    list.forEach((f, i) => {
      if (i === 0) out.push({ date: f.date, kind: 'first', text: `First flight logged${f.type ? ' — ' + f.type : ''}`, flightId: f.id });
      if (f.type && !seenType.has(f.type)) { seenType.add(f.type); if (i) out.push({ date: f.date, kind: 'type', text: `First flight in the ${f.type}`, flightId: f.id }); }
      if (f.squadron && !seenSq.has(f.squadron)) { seenSq.add(f.squadron); out.push({ date: f.date, kind: 'squadron', text: `First flight with ${f.squadron}`, flightId: f.id }); }
      hours += n(f.total); traps += n(f.dayTraps) + n(f.nightTraps); sl += n(f.dayShip) + n(f.nightShip);
      while (hours >= nextH) { out.push({ date: f.date, kind: 'hours', text: `${nextH.toLocaleString('en-US')} hours`, flightId: f.id }); nextH = nextH < 1000 ? nextH + (nextH < 500 ? 100 : 500) : nextH + 500; }
      while (traps >= nextT) { out.push({ date: f.date, kind: 'traps', text: `${nextT} traps`, flightId: f.id }); nextT += 100; }
      while (sl >= nextS) { out.push({ date: f.date, kind: 'ship', text: `${nextS} ship landings`, flightId: f.id }); nextS += 100; }
    });
    for (const d of deployments || []) {
      out.push({ date: d.start, kind: 'deploy', text: `${d.name} begins`, deploymentKey: d.key });
      out.push({ date: d.end, kind: 'deploy-end', text: `${d.name} ends — ${d.flights} flights`, deploymentKey: d.key });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Search across date, type, BuNo, ship, squadron and remarks. Every word must match something.
  function search(flights, query, filters) {
    filters = filters || {};
    const q = (query || '').trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    return flights.filter(f => {
      if (filters.type && f.type !== filters.type) return false;
      if (filters.ship && f.ship !== filters.ship) return false;
      if (filters.squadron && f.squadron !== filters.squadron) return false;
      if (filters.year && (!f.date || f.date.slice(0, 4) !== String(filters.year))) return false;
      if (filters.night && !(n(f.night) > 0)) return false;
      if (filters.flagged && !(f.flags && f.flags.length)) return false;
      if (!terms.length) return true;
      const hay = [f.date || '', longDate(f.date).toLowerCase(), monthYear(f.date).toLowerCase(), (f.type || '').toLowerCase(), (f.type || '').toLowerCase().replace(/-/g, ''),
        f.buno || '', (f.ship || '').toLowerCase(), (f.squadron || '').toLowerCase(), (f.squadron || '').toLowerCase().replace(/-/g, ''), (f.kind || '').toLowerCase(), (f.remarks || '').toLowerCase()].join(' | ');
      return terms.every(t => hay.includes(t) || hay.includes(t.replace(/-/g, '')) || dateMatch(f.date, t));
    }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  function dateMatch(iso, t) { // 3/14/1988, 14mar88, 1988-03
    if (!iso) return false;
    let m;
    if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) { const y = m[3].length === 2 ? (+m[3] > 40 ? '19' : '20') + m[3] : m[3]; return iso === `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
    if ((m = t.match(/^(\d{1,2})([a-z]{3})(\d{2,4})$/))) { const mo = MON.findIndex(x => x.toLowerCase() === m[2]) + 1; const y = m[3].length === 2 ? (+m[3] > 40 ? '19' : '20') + m[3] : m[3]; return mo > 0 && iso === `${y}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    return false;
  }

  const api = { totals, suggestDeployments, segments, milestones, search, atSea, monthYear, longDate, blank };
  root.BBCareer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
