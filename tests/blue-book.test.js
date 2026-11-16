// Tests for Blue Book's reading, totals, deployments, search and file making. Run: node tests/blue-book.test.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const X = require('../blue-book/js/extract.js');
const C = require('../blue-book/js/career.js');
const F = require('../blue-book/js/files.js');
const E = require('../blue-book/js/export.js');
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok -', name); } catch (e) { console.error('FAIL -', name, '\n', e); process.exitCode = 1; } };

// A tidy template: day | type | buno | total | night | dayShip | nightShip | remarks
const tpl = { top: 0.1, bottom: 0.9, columns: [
  { field: 'day', x0: 0.0, x1: 0.08 }, { field: 'type', x0: 0.08, x1: 0.2 }, { field: 'buno', x0: 0.2, x1: 0.32 },
  { field: 'total', x0: 0.32, x1: 0.42 }, { field: 'night', x0: 0.42, x1: 0.5 }, { field: 'dayShip', x0: 0.5, x1: 0.58 },
  { field: 'nightShip', x0: 0.58, x1: 0.66 }, { field: 'remarks', x0: 0.66, x1: 1.0 } ] };
// word helper: column center x, row index
const W = (text, colX, row, conf) => ({ text, conf: conf == null ? 92 : conf, x0: colX - 0.02, x1: colX + 0.02, y0: 0.12 + row * 0.05, y1: 0.12 + row * 0.05 + 0.03 });
const lines = [0.11, 0.16, 0.21, 0.26, 0.31, 0.36, 0.41];

test('reads a page of lines with ruled lines', () => {
  const words = [
    W('3', 0.04, 0), W('AV8B', 0.14, 0), W('163853', 0.26, 0), W('1.5', 0.37, 0), W('Nassau', 0.7, 0), W('DCA', 0.8, 0),
    W('4', 0.04, 1), W('"', 0.14, 1), W('163856', 0.26, 1), W('1 3', 0.37, 1), W('.8', 0.46, 1), W('2', 0.54, 1), W('1', 0.62, 1),
    W('7', 0.04, 2), W('AV-8B', 0.14, 2), W('l63853', 0.26, 2, 40), W('12', 0.37, 2), W('bolter', 0.8, 2),
    W('TOTAL', 0.14, 4), W('4.0', 0.37, 4),
  ];
  const r = X.extractPage(words, tpl, { year: 1988, month: 3, squadron: 'VMA-231', ship: 'USS Nassau (LHA-4)' }, { ruledLines: lines });
  const fl = r.rows.filter(x => x.rowType === 'flight');
  assert.strictEqual(fl.length, 3);
  assert.strictEqual(fl[0].date, '1988-03-03'); assert.strictEqual(fl[0].type, 'AV-8B'); assert.strictEqual(fl[0].buno, '163853'); assert.strictEqual(fl[0].total, 1.5);
  assert.strictEqual(fl[0].remarks, 'Nassau DCA'); assert.strictEqual(fl[0].squadron, 'VMA-231');
  assert.strictEqual(fl[1].type, 'AV-8B', 'ditto copies the type'); assert.ok(!fl[1].flags.some(f => f.field === 'type'), 'a ditto or a line in the type box is normal, not a question');
  assert.strictEqual(fl[1].total, 1.3, 'hours | tenths read as 1.3'); assert.strictEqual(fl[1].night, 0.8);
  assert.strictEqual(fl[1].dayShip, 2); assert.strictEqual(fl[1].nightShip, 1); assert.strictEqual(fl[1].ship, 'USS Nassau (LHA-4)');
  assert.strictEqual(fl[2].buno, '163853', 'l read as 1'); assert.ok(fl[2].flags.some(f => f.field === 'buno' && /hard to read/.test(f.reason)));
  assert.strictEqual(fl[2].total, 1.2); assert.ok(fl[2].flags.some(f => f.field === 'total' && /decimal/.test(f.reason)));
  assert.ok(r.rows.some(x => x.rowType === 'totals'));
  assert.ok(r.notes[0].includes('match'), r.notes[0]);
});

test('flags a totals mismatch and bad values', () => {
  const words = [W('3', 0.04, 0), W('AV-8B', 0.14, 0), W('163853', 0.26, 0), W('1.5', 0.37, 0), W('2.0', 0.46, 0), W('Total', 0.14, 1), W('9.9', 0.37, 1)];
  const r = X.extractPage(words, tpl, { year: 1988, month: 3 }, { ruledLines: lines });
  assert.ok(r.notes[0].includes('9.9'));
  const f = r.rows[0]; assert.ok(f.flags.some(x => x.field === 'night' && /more night/.test(x.reason)));
});

test('works without ruled lines (clusters words)', () => {
  const words = [W('3', 0.04, 0), W('AV-8B', 0.14, 0), W('1.5', 0.37, 0), W('5', 0.04, 2), W('TAV-8B', 0.14, 2), W('1.1', 0.37, 2)];
  const r = X.extractPage(words, tpl, { year: 1990, month: 6 }, {});
  assert.strictEqual(r.rows.length, 2); assert.strictEqual(r.rows[1].type, 'TAV-8B'); assert.strictEqual(r.rows[1].date, '1990-06-05');
});

test('flags missing month/year and days out of order', () => {
  const words = [W('9', 0.04, 0), W('AV-8B', 0.14, 0), W('1.5', 0.37, 0), W('4', 0.04, 1), W('AV-8B', 0.14, 1), W('1.0', 0.37, 1)];
  let r = X.extractPage(words, tpl, {}, { ruledLines: lines });
  assert.ok(r.rows[0].flags.some(f => /month and year/.test(f.reason)));
  r = X.extractPage(words, tpl, { year: 1989, month: 1 }, { ruledLines: lines });
  assert.ok(r.rows[1].flags.some(f => /earlier/.test(f.reason)));
});

test('field parsers', () => {
  assert.strictEqual(X.parseHours('1,5').value, 1.5); assert.strictEqual(X.parseHours('O.9').value, 0.9); assert.strictEqual(X.parseHours('2').value, 2);
  assert.ok(X.parseHours('abc').bad); assert.strictEqual(X.parseCount('//').value, 2); assert.strictEqual(X.parseCount('l').value, 1);
  assert.strictEqual(X.normalizeType('av8b').value, 'AV-8B'); assert.strictEqual(X.normalizeType('TAV8A').value, 'TAV-8A'); assert.strictEqual(X.normalizeType('TA4J').value, 'TA-4J');
  assert.strictEqual(X.normalizeType('AV-88').value, 'AV-8B'); assert.strictEqual(X.parseDate('16 MAR 88', {}).value, '1988-03-16'); assert.strictEqual(X.parseDate('3/16', { year: 1988 }).value, '1988-03-16');
  assert.strictEqual(X.isoDate(1989, 2, 30), null);
});

test('finds ruled lines in an image', () => {
  const w = 200, h = 100, g = new Uint8Array(w * h).fill(230);
  for (const y of [10, 30, 50, 70]) for (let x = 5; x < 195; x++) g[y * w + x] = 40;
  for (const x of [20, 80]) for (let y = 0; y < h; y++) g[y * w + x] = 40;
  const hs = X.findRuledLines(g, w, h, 'h'); assert.deepStrictEqual(hs.map(v => Math.round(v * h)), [10, 30, 50, 70]);
  const vs = X.findRuledLines(g, w, h, 'v'); assert.deepStrictEqual(vs.map(v => Math.round(v * w)), [20, 80]);
});

// A small career for the totals, deployment and search tests.
function career() {
  const out = []; let id = 0;
  const add = (date, o) => out.push(Object.assign({ id: 'f' + (++id), date, type: 'AV-8B', squadron: 'VMA-231', total: 1.5, night: 0 }, o));
  add('1986-05-02', { type: 'TAV-8A', squadron: 'VMAT-203', total: 1.2 });
  add('1986-05-09', { type: 'AV-8A', squadron: 'VMAT-203', total: 1.4 });
  for (let d = 0; d < 70; d += 2) { // 70-day cruise aboard Nassau
    const dt = new Date(Date.UTC(1988, 2, 1 + d)).toISOString().slice(0, 10);
    add(dt, { ship: 'USS Nassau (LHA-4)', dayShip: 1, nightShip: d % 6 === 0 ? 1 : 0, night: d % 6 === 0 ? 0.7 : 0, remarks: d === 10 ? 'night bolter, waveoff' : '' });
  }
  add('1988-08-10', { ship: 'USS Saipan (LHA-2)', dayShip: 3 }); add('1988-08-11', { ship: 'USS Saipan (LHA-2)', dayShip: 2 });
  add('1989-01-05', { buno: '163853', total: 2.1 });
  add('1990-02-01', { ship: 'USS Lexington (AVT-16)', dayTraps: 1, cats: 1 });
  return out;
}

test('career totals by type, squadron, ship, year', () => {
  const t = C.totals(career());
  assert.strictEqual(t.all.flights, 41);
  assert.strictEqual(t.type.find(g => g.name === 'TAV-8A').hours, 1.2);
  assert.strictEqual(t.squadron.find(g => g.name === 'VMAT-203').flights, 2);
  assert.strictEqual(t.ship.find(g => g.name === 'USS Nassau (LHA-4)').flights, 35);
  assert.strictEqual(t.all.nightShipLandings, 12); assert.strictEqual(t.all.traps, 1); assert.strictEqual(t.all.cats, 1);
  assert.strictEqual(t.year.map(y => y.name).join(','), '1986,1988,1989,1990');
  assert.strictEqual(Math.round((t.all.day + t.all.night) * 10) / 10, t.all.hours);
});

test('suggests deployments from ship landings', () => {
  const d = C.suggestDeployments(career());
  const nas = d.find(x => x.ship === 'USS Nassau (LHA-4)');
  assert.ok(nas && nas.kind === 'Deployment' && nas.start === '1988-03-01' && nas.flights === 35, JSON.stringify(nas));
  assert.ok(!d.find(x => x.ship === 'USS Saipan (LHA-2)'), 'two days aboard is not a deployment');
});

test('timeline segments and milestones', () => {
  const segs = C.segments(career(), 'type', 120);
  assert.ok(segs.find(s => s.value === 'AV-8B' && s.start === '1988-03-01'));
  const ms = C.milestones(career(), []);
  assert.ok(ms.some(m => m.text === 'First flight in the AV-8A')); assert.ok(ms.some(m => m.text === 'First flight with VMA-231'));
});

test('search by date, BuNo, ship and remarks', () => {
  const f = career();
  assert.strictEqual(C.search(f, '163853').length, 1);
  assert.strictEqual(C.search(f, 'bolter').length, 1);
  assert.strictEqual(C.search(f, 'nassau').length, 35);
  assert.strictEqual(C.search(f, '3/11/88').length, 1);
  assert.strictEqual(C.search(f, '11mar88').length, 1);
  assert.strictEqual(C.search(f, 'av8a').length, 2, 'AV-8A and TAV-8A'); assert.strictEqual(C.search(f, 'tav8a').length, 1);
  assert.strictEqual(C.search(f, '', { year: 1986 }).length, 2);
});

test('zip round trip and Excel file', () => {
  const z = F.zip([{ name: 'a.txt', data: 'hello' }, { name: 'photos/p.jpg', data: new Uint8Array([1, 2, 3]) }]);
  const u = F.unzip(z); assert.strictEqual(new TextDecoder().decode(u['a.txt']), 'hello'); assert.deepStrictEqual([...u['photos/p.jpg']], [1, 2, 3]);
  const x = F.xlsx([{ name: 'Flights', columns: [{ header: 'Date', kind: 'date' }, { header: 'Type' }, { header: 'Hours', kind: 'hours' }, { header: 'Photo', kind: 'link' }],
    rows: [['1988-03-16', 'AV-8B', 1.5, 'photos/p.jpg'], ['1988-03-17', 'R&D <test>', 0.8, '']] }]);
  const out = path.join(require('os').tmpdir(), 'bluebook-test.xlsx'); fs.writeFileSync(out, x);
  assert.strictEqual(F.csv([['a', 'b,c', '=1+1']]), 'a,"b,c","=1+1"\r\n');
  console.log('   wrote', out);
});

test('a flight whose remarks contain "resumed" or "FWD" is still a flight', () => {
  for (const word of ['resumed', 'FWD', 'summer', 'Totally']) {
    const r = X.extractPage([W('5', 0.04, 0), W('AV-8B', 0.14, 0), W('163853', 0.26, 0), W('1.5', 0.37, 0), W(word, 0.8, 0),
      W('6', 0.04, 1), W('AV-8B', 0.14, 1), W('163853', 0.26, 1), W('1.0', 0.37, 1)], tpl, { year: 1988, month: 3 }, { ruledLines: lines });
    assert.strictEqual(r.rows.filter(x => x.rowType === 'flight').length, 2, word);
  }
  // real totals lines are still recognized: label in the left columns, or in the remarks with no date or aircraft
  for (const [text, x] of [['TOTAL', 0.14], ['FWD', 0.14], ['TOTALS', 0.8]]) {
    const r = X.extractPage([W('5', 0.04, 0), W('AV-8B', 0.14, 0), W('163853', 0.26, 0), W('1.5', 0.37, 0), W(text, x, 1), W('1.5', 0.37, 1)], tpl, { year: 1988, month: 3 }, { ruledLines: lines });
    assert.strictEqual(r.rows.filter(x => x.rowType === 'totals').length, 1, text); assert.ok(/match/.test(r.notes[0]), text);
  }
});

test('MyFlightbook import file', () => {
  const db = { pages: [{ status: 'review' }], flights: [
    { date: '1988-03-06', type: 'TA-4J', buno: '158512', kind: '1A1', squadron: 'VT-7', ship: 'USS Lexington (AVT-16)', total: 1.5, pic: 1.5, acCmdr: 1.5, specialCrew: 0.2, night: 0.7, instActual: 0.3,
      traps: 2, carrierTG: 2, fclp: 6, landings: 1, cats: 2, approaches: 2, apprType: 'P', simApproaches: 1, remarks: 'CQ, "OK 3"', flags: [{ field: 'night', reason: 'x' }] },
    { date: '1988-03-05', type: 'AV-8B', buno: '', total: 1.0, landings: 1, approaches: 1, apprType: 'np' },
    { date: '1988-03-04', type: 'AV-8B', buno: '163853', total: 1.0, dayShip: 2, nightShip: 1, dayTraps: 1, nightTraps: 1, nightLand: 1, approaches: 1, apprType: 'GCA' },
    { date: null, type: 'AV-8B', buno: '163853', total: 1.0 }, { date: '1988-03-07', type: 'AV-8B', buno: '163853', total: null } ] };
  const m = E.myFlightbook(db); const rows = m.csv.trim().split('\r\n');
  assert.strictEqual(rows[0], 'Date,Tail Number,Model,Total Flight Time,PIC,SIC,Aircraft Commander Time,Military Special Crew Time,Night,IMC,Simulated Instrument,Approaches,Approaches - Precision (unspecified type),Approaches - Non-precision (unspecified type),' +
    'Landings,FS Day Landings,FS Night Landings,Landings - Touch and Go,Landings - Touch and Go (Night),Landings - Field Carrier Practice (FCLP),Landings - Field Carrier Practice (FCLP) at Night,Landings - Touch and go (Carrier),Landings - Carrier,Landings - Arrestments (Carrier),"Landings - Arrestments (Carrier), Night",Takeoffs - Catapult,Comments');
  assert.strictEqual(rows.length, 4, 'three flights have a date and a time');
  assert.strictEqual(rows[1], '3/4/1988,163853,AV-8B,1,,,,,,,,1,,,6,3,3,,,,,,5,2,1,,Approach type GCA', 'older day/night columns still work');
  assert.strictEqual(rows[2], '3/5/1988,,AV-8B,1,,,,,,,,1,,1,1,1,,,,,,,,,,,');
  assert.strictEqual(rows[3], '3/6/1988,158512,TA-4J,1.5,1.5,,1.5,0.2,0.7,0.3,,3,2,,11,2,1,8,,6,,2,4,2,,2,"CQ, ""OK 3"" | VT-7 | USS Lexington (AVT-16)"', 'some night time: the landing that ended the flight was at night');
  assert.deepStrictEqual([m.included, m.leftOut, m.noTail, m.flagged, m.pagesInReview], [3, 2, 1, 1, 1]);
  const t = C.totals(db.flights).all; assert.deepStrictEqual([t.traps, t.fclp, t.carrierTG, t.landings, t.simApproaches], [4, 6, 2, 3, 1]);
});

test('starting columns follow the Navy logbook order; crew times are read and checked', () => {
  const t = X.defaultTemplate();
  assert.deepStrictEqual(t.columns.map(c => c.field), ['day', 'type', 'buno', 'kind', 'total', 'pic', 'sic', 'acCmdr', 'specialCrew', 'skip', 'instActual', 'instSim', 'night',
    'traps', 'carrierTG', 'skip', 'fclp', 'landings', 'cats', 'approaches', 'apprType', 'simApproaches', 'remarks'], 'the 22 logbook columns, the gap between the two pages, and bolters skipped');
  t.columns.forEach((c, i) => { assert.ok(c.x1 > c.x0 + 0.015, c.field); if (i) assert.ok(Math.abs(c.x0 - t.columns[i - 1].x1) < 1e-3, c.field); });
  assert.ok(t.columns[t.columns.length - 1].x1 <= 1);
  const mid = k => { const c = t.columns.find(c => c.field === k); return (c.x0 + c.x1) / 2; };
  const w = (text, k) => ({ text, conf: 95, x0: mid(k) - 0.01, x1: mid(k) + 0.01, y0: 0.3, y1: 0.32 });
  const r = X.extractPage([w('5', 'day'), w('AV-8B', 'type'), w('163853', 'buno'), w('1A1', 'kind'), w('1.5', 'total'), w('1.5', 'pic'), w('2.0', 'acCmdr'), w('0.3', 'instSim'), w('2', 'traps'), w('4', 'fclp'), w('1', 'cats'), w('P', 'apprType')], t, { year: 1988, month: 3 }, {});
  const f = r.rows[0]; assert.deepStrictEqual([f.total, f.pic, f.acCmdr, f.instSim, f.kind], [1.5, 1.5, 2, 0.3, '1A1']);
  assert.ok(f.flags.some(x => x.field === 'acCmdr' && /more than the flight time/.test(x.reason)));
  assert.strictEqual(C.totals([f]).all.pic, 1.5);
  assert.deepStrictEqual([f.traps, f.fclp, f.cats, f.apprType], [2, 4, 1, 'P']);
});

test('approach types: P, NP, and both in one box', () => {
  const A = (approaches, apprType) => { const c = C.approachCounts({ approaches, apprType }); return [c.total, c.precision, c.non]; };
  assert.deepStrictEqual(A(2, 'P'), [2, 2, 0]); assert.deepStrictEqual(A(1, 'NP'), [1, 0, 1]); assert.deepStrictEqual(A(null, 'P'), [1, 1, 0]);
  assert.deepStrictEqual(A(2, '1 P 1 NP'), [2, 1, 1]); assert.deepStrictEqual(A(null, '2P 1NP'), [3, 2, 1]); assert.deepStrictEqual(A(2, 'P NP'), [2, 1, 1]);
  assert.deepStrictEqual(A(3, ''), [3, 0, 0]); assert.strictEqual(C.approachCounts({ approaches: 1, apprType: 'GCA' }).known, false);
  // read off a page: "1 P" written above "1 NP" in the type box, and "1" above "1" in the number box
  const t = X.defaultTemplate(); const mid = k => { const c = t.columns.find(c => c.field === k); return (c.x0 + c.x1) / 2; };
  const w = (text, k, dx, y) => ({ text, conf: 95, x0: mid(k) + dx - 0.004, x1: mid(k) + dx + 0.004, y0: y, y1: y + 0.012 });
  const r = X.extractPage([w('5', 'day', 0, 0.3), w('AV-8B', 'type', 0, 0.3), w('1.5', 'total', 0, 0.3), w('1', 'approaches', 0, 0.295), w('1', 'approaches', 0, 0.312),
    w('NP', 'apprType', 0.008, 0.312), w('1', 'apprType', -0.008, 0.312), w('P', 'apprType', 0.008, 0.295), w('l', 'apprType', -0.008, 0.295)], t, { year: 1988, month: 3 }, { ruledLines: [0.22, 0.28, 0.34, 0.40, 0.46] });
  const f = r.rows[0]; assert.strictEqual(f.apprType, '1 P 1 NP'); assert.strictEqual(f.approaches, 2);
  const row = E.myFlightbook({ pages: [], flights: [Object.assign({}, f, { date: '1988-03-05' })] }).csv.trim().split('\r\n')[1].split(',');
  assert.deepStrictEqual(row.slice(11, 14), ['2', '1', '1'], 'Approaches, precision, non-precision');
});

test('notices a page lying on its side', () => {
  const up = ['AV-8B', '163853', 'T-34C', '160529', 'FCLP', '1983'].map((text, i) => ({ text, x0: 0.1, x1: 0.18, y0: 0.1 + i * 0.05, y1: 0.12 + i * 0.05 }));
  const side = up.map(w => ({ text: w.text, x0: w.y0, x1: w.y1, y0: w.x0, y1: w.x1 }));
  assert.strictEqual(X.looksSideways(up, 2600, 1800), false); assert.strictEqual(X.looksSideways(side, 1800, 2600), true);
  assert.strictEqual(X.looksSideways([], 100, 100), false);
});

test('cleans up common misreads of handwriting', () => {
  for (const [raw, v] of [['1,6', 1.6], ['1-6', 1.6], ['1 . 6', 1.6], ['l.b', 1.6], ['O.7', 0.7], ['1:8', 1.8], ['0.9.', 0.9], ['I.Z', 1.2]]) assert.strictEqual(X.parseHours(raw).value, v, raw);
  assert.ok(X.parseHours('-').ditto);
  for (const [raw, v] of [['IDI', '1D1'], ['lAl', '1A1'], ['1 A 1', '1A1'], ['2K3', '2K3'], ['181', '1B1'], ['1D|', '1D1']]) assert.strictEqual(X.fixKind(raw), v, raw);
  assert.strictEqual(X.parseBuno('I6O5Z9').value, '160529'); assert.strictEqual(X.parseBuno('16052g').value, '160529');
});

test('first pilot + co-pilot = total fills a gap and catches a misread', () => {
  const t = { top: 0.1, bottom: 0.9, columns: [{ field: 'day', x0: 0, x1: 0.1 }, { field: 'type', x0: 0.1, x1: 0.3 }, { field: 'total', x0: 0.3, x1: 0.4 }, { field: 'pic', x0: 0.4, x1: 0.5 }, { field: 'sic', x0: 0.5, x1: 0.6 }] };
  const w = (text, x, row) => ({ text, conf: 95, x0: x - 0.02, x1: x + 0.02, y0: 0.12 + row * 0.05, y1: 0.15 + row * 0.05 });
  const r = X.extractPage([w('18', 0.05, 0), w('T-34C', 0.2, 0), w('1.6', 0.35, 0), w('0.7', 0.45, 0), w('0.9', 0.55, 0),   // all three agree
    w('23', 0.05, 1), w('—', 0.2, 1), w('1.0', 0.45, 1), w('0.5', 0.55, 1),                                                  // total not read; line through the type box
    w('25', 0.05, 2), w('1.8', 0.35, 2), w('1.2', 0.45, 2), w('xx', 0.55, 2),                                                // co-pilot unreadable; type box blank
    w('26', 0.05, 3), w('T-34C', 0.2, 3), w('1.8', 0.35, 3), w('1.2', 0.45, 3), w('0.9', 0.55, 3)], t, { year: 1983, month: 2 }, { ruledLines: lines });
  const [a, b, c, d] = r.rows;
  assert.strictEqual(a.flags.length, 0, JSON.stringify(a.flags));
  assert.strictEqual(b.total, 1.5); assert.ok(b.flags.some(x => x.field === 'total' && /worked out/.test(x.reason)));
  assert.strictEqual(b.type, 'T-34C'); assert.ok(!b.flags.some(x => x.field === 'type'), 'a line through the type box copies the type without a question');
  assert.strictEqual(c.sic, 0.6); assert.ok(c.flags.some(x => x.field === 'sic' && /worked out/.test(x.reason)));
  assert.strictEqual(c.type, 'T-34C'); assert.ok(c.typeSame && !c.flags.some(x => x.field === 'type'), 'an empty type box is taken as the line, without a question');
  assert.ok(d.flags.some(x => x.field === 'total' && /is not the total/.test(x.reason)));
});

test('picks between the whole-page reading and the close-up of one box', () => {
  const pick = (f, page, ...c) => X.chooseReading(f, page, c.map(([text, conf]) => ({ text, conf })), ['T-34C']);
  assert.deepStrictEqual(pick('total', '1.6', ['1.6', 40]), { text: '1.6', conf: 95 }, 'both agree: no question');
  assert.strictEqual(pick('total', '', ['1b', 60], ['1.6', 30]).text, '1.6', 'an alternative that looks like a time beats one that does not');
  assert.ok(pick('total', '', ['1b', 60], ['1.6', 30]).conf < 60, 'but it is marked to check');
  assert.strictEqual(pick('total', '1.6', ['lb', 60]), null, 'keep a good page reading when the close-up makes no sense');
  const dis = pick('total', '1.6', ['1.8', 80]); assert.strictEqual(dis.text, '1.8'); assert.ok(dis.conf < 60 && dis.disagreed === '1.6', 'two different sensible readings: ask');
  assert.strictEqual(pick('buno', '16O5', ['160529', 35]).text, '160529'); assert.ok(pick('buno', '16O5', ['160529', 35]).conf >= 60);
  assert.strictEqual(pick('kind', 'IDI', ['1D1', 50]).conf, 95, 'IDI and 1D1 are the same code');
  assert.strictEqual(pick('type', '', ['T-34C', 45]).text, 'T-34C'); assert.strictEqual(pick('type', '', ['—', 30]).text, '—', 'a line is a fine reading for the type box');
  assert.strictEqual(pick('total', '', []), null); assert.strictEqual(pick('total', 'zz', ['??', 20]).conf, 20);
});

test('finds faint, slightly crooked row lines and is not fooled by writing', () => {
  const w = 1200, h = 900, g = new Uint8Array(w * h).fill(255); const slope = Math.tan(1 * Math.PI / 180);
  const ys = []; for (let y = 200; y <= 760; y += 40) ys.push(y);
  for (const y0 of ys) for (let x = 0; x < w; x++) { const y = Math.round(y0 + (x - w / 2) * slope); if ((x * 7 + y0) % 11) { g[y * w + x] = 185; g[(y + 1) * w + x] = 195; } } // grey, grainy, 1 degree off level
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const y0 of ys.slice(0, -1)) for (let k = 0; k < 9; k++) { const x0 = 60 + Math.floor(rnd() * 1000), ww = 30 + Math.floor(rnd() * 50); // writing between the lines
    for (let y = y0 + 12; y < y0 + 32; y++) for (let x = x0; x < x0 + ww; x++) if (rnd() < 0.3) g[(y + Math.round((x - w / 2) * slope)) * w + x] = 40; }
  for (let x = 150; x < 300; x++) { g[(300 + 22) * w + x] = 30; g[(300 + 23) * w + x] = 30; } // a line drawn through one type box
  const found = X.findRowLines(g, w, h).map(v => Math.round(v * h));
  assert.strictEqual(found.length, ys.length, JSON.stringify(found));
  found.forEach((y, i) => assert.ok(Math.abs(y - ys[i]) <= 3, `line ${i}: ${y} vs ${ys[i]}`));
  assert.ok(Math.abs(X.rowPitch(found.map(y => y / h), { top: 0.2, bottom: 0.86 }) * h - 40) < 1);
  assert.strictEqual(X.findRowLines(new Uint8Array(w * h).fill(255), w, h).length, 0);
});

test('with no lines found, rows of a known height are laid around the writing; line marks are ignored', () => {
  const t = { top: 0.1, bottom: 0.9, columns: [{ field: 'day', x0: 0, x1: 0.2 }, { field: 'total', x0: 0.2, x1: 0.4 }] };
  const w = (text, x, y) => ({ text, conf: 90, x0: x - 0.02, x1: x + 0.02, y0: y - 0.01, y1: y + 0.01 });
  const words = []; for (let i = 0; i < 6; i++) { const y = 0.2 + i * 0.05; words.push(w(String(10 + i), 0.1, y - 0.006), w('1.' + i, 0.3, y + 0.006), w('—', 0.1, y + 0.025), w('_', 0.3, y + 0.025)); }
  const r = X.extractPage(words, t, { year: 1983, month: 2 }, { rowPitch: 0.05 });
  const fl = r.rows.filter(x => x.rowType === 'flight');
  assert.strictEqual(fl.length, 6, JSON.stringify(fl.map(f => [f.day, f.total])));
  fl.forEach((f, i) => assert.deepStrictEqual([f.day, f.total], [10 + i, +('1.' + i) || 1]));
});

test('a printed line read as an extra digit does not spoil the total', () => {
  assert.ok(X.parseHours('11.60').note, 'two decimals is not a clean reading');
  const t = { top: 0.1, bottom: 0.9, columns: [{ field: 'day', x0: 0, x1: 0.1 }, { field: 'type', x0: 0.1, x1: 0.3 }, { field: 'total', x0: 0.3, x1: 0.4 }, { field: 'pic', x0: 0.4, x1: 0.5 }, { field: 'sic', x0: 0.5, x1: 0.6 }] };
  const w = (text, x) => ({ text, conf: 95, x0: x - 0.02, x1: x + 0.02, y0: 0.12, y1: 0.15 });
  const f = X.extractPage([w('18', 0.05), w('T-34C', 0.2), w('11.60', 0.35), w('0.7', 0.45), w('0.9', 0.55)], t, { year: 1983, month: 2 }, { ruledLines: lines }).rows[0];
  assert.strictEqual(f.total, 1.6); assert.ok(f.flags.some(x => x.field === 'total' && /set to first pilot/.test(x.reason)));
});

test('lifts the scanned pages out of a PDF', () => {
  const enc = s => Buffer.from(s, 'latin1'); const jpg = n => Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(n, 7), enc('stream inside the picture'), Buffer.from([0xFF, 0xD9])]);
  const a = jpg(500), b = jpg(900), thumb = jpg(50);
  const pdf = Buffer.concat([enc('%PDF-1.7\n1 0 obj\n<</Type /Catalog>>\nendobj\n4 0 obj\n<</Length 9>>\nstream\nq 1 0 0 1\nendstream\nendobj\n'),
    enc(`5 0 obj\n<</Type /XObject /Subtype /Image /Width 2544 /Height 3504 /Length ${a.length} /ColorSpace /DeviceRGB /Filter [ /DCTDecode ] >>\nstream\r\n`), a, enc('\nendstream\nendobj\n'),
    enc(`6 0 obj\n<</Subtype/Image/Width 120/Height 90/Length ${thumb.length}/Filter/DCTDecode>>\nstream\n`), thumb, enc('\nendstream\nendobj\n'),
    enc('7 0 obj\n<</Subtype /Image /Width 2544 /Height 3504 /Length 8 0 R /Filter /DCTDecode>>\nstream\n'), b, enc(`\nendstream\nendobj\n8 0 obj\n${b.length}\nendobj\n`),
    enc('9 0 obj\n<</Subtype /Image /Width 2000 /Height 2000 /Length 4 /Filter /FlateDecode>>\nstream\nabcd\nendstream\nendobj\n%%EOF')]);
  const pages = F.pdfImages(new Uint8Array(pdf));
  assert.strictEqual(pages.length, 2, 'two page pictures; the thumbnail and the non-JPEG picture are left out');
  assert.ok(Buffer.from(pages[0]).equals(a)); assert.ok(Buffer.from(pages[1]).equals(b), 'length given by reference');
  assert.strictEqual(F.pdfImages(new Uint8Array(enc('%PDF-1.4 just text'))).length, 0);
});

test('fits the columns to the lines printed on each page', () => {
  const t = X.defaultTemplate(); const edges = [...new Set(t.columns.flatMap(c => [c.x0, c.x1]))];
  const printed = edges.filter(e => ![0.02, 0.5, 0.55, 0.995].includes(e)); // the book prints no line at the outer edges or the gutter
  const xs = printed.map(x => x * 0.96 + 0.03).concat([0.012]).sort((a, b) => a - b); // scanned 4% smaller, shifted, plus a stray line
  const ys = []; for (let y = 0.16; y < 0.86; y += 0.0355) ys.push(y);
  const f = X.fitTemplate(t, xs, ys);
  assert.ok(f.matched >= 18, 'matched ' + f.matched);
  f.template.columns.forEach((c, i) => { const want = t.columns[i].x0 * 0.96 + 0.03; assert.ok(Math.abs(c.x0 - want) < 0.004, `${c.field} ${c.x0} vs ${want}`); });
  assert.ok(Math.abs(f.template.top - 0.16) < 1e-6, 'top snapped to the nearest row line');
  assert.strictEqual(X.fitTemplate(t, [0.3, 0.7], ys).matched, 0, 'too few lines: columns left where they were');
  assert.deepStrictEqual(X.fitTemplate(t, [0.3, 0.7], []).template.columns, t.columns);
});

test('finds the first flight row and does not take the printed headings for one', () => {
  const t = X.defaultTemplate(); const ys = [0.05, 0.07, 0.093]; for (let k = 0; k <= 15; k++) ys.push(0.14 + k * 0.047); // headings, then evenly spaced rows; the page is cut short
  const f = X.fitTemplate(t, [], ys).template; assert.ok(Math.abs(f.top - 0.14) < 1e-9, 'top ' + f.top); assert.ok(f.bottom >= 0.14 + 15 * 0.047 - 1e-6 && f.bottom <= 0.999, 'runs on for the full page of rows even where the photo cuts off');
  const w = (text, x, y) => ({ text, conf: 95, x0: x, x1: x + 0.03, y0: y, y1: y + 0.012 });
  const head = ['MODEL', 'SERIAL', 'NUMBER', 'FIRST', 'PILOT', 'REMARKS'].map((s, i) => w(s, 0.1 + i * 0.1, 0.155));
  const a = X.skipHeaderRows(head.concat([w('18', 0.03, 0.2), w('T-34C', 0.1, 0.2)]), f, ys); assert.ok(Math.abs(a.top - 0.187) < 1e-9, 'moved down one row: ' + a.top);
  const b = X.skipHeaderRows([w('18', 0.03, 0.155), w('T-34C', 0.1, 0.155), w('NIGHT', 0.9, 0.155)], f, ys); assert.ok(Math.abs(b.top - 0.14) < 1e-9, 'a flight row is left alone');
});

test('follows sloping lines on each page of a photographed book', () => {
  const w = 1200, h = 800, g = new Uint8Array(w * h).fill(255);
  for (let k = 0; k < 12; k++) for (let x = 40; x < 560; x++) { const y = Math.round(150 + k * 45 + (x - 40) * (0.10 - k * 0.006)); g[y * w + x] = 60; g[(y + 1) * w + x] = 60; } // left page: lines fan out
  const t = X.trackLines(g, w, h, { x0: 40, x1: 560, strips: 22, share: 0.55 });
  assert.strictEqual(t.fits.length, 12); t.fits.forEach((f, k) => { assert.ok(Math.abs(f.b - (0.10 - k * 0.006)) < 0.004, `slope ${k}: ${f.b}`); assert.ok(Math.abs(f.a + f.b * 40 - (150 + k * 45)) < 3); });
  const all = X.trackLines(g, w, h, { strips: 48, share: 0.3 }); assert.ok(all.counts.slice(26, 44).every(c => c === 0) && all.counts[10] >= 10, 'the empty right side shows no lines');
});

test('reads the month and year written at the top of the page', () => {
  const w = (text, y) => ({ text, x0: 0.1, x1: 0.2, y0: y, y1: y + 0.01 });
  assert.deepStrictEqual(X.headerDate([w('MONTH', 0.04), w('FEBRVARY', 0.04), w('YEAR', 0.04), w('I983', 0.04), w('MARCH', 0.5)], 0.14), { month: 2, year: 1983 });
  assert.deepStrictEqual(X.headerDate([w('Sept', 0.04), w('1991', 0.05)], 0.14), { month: 9, year: 1991 });
  assert.deepStrictEqual(X.headerDate([w('AIRCRAFT', 0.1), w('PILOT', 0.1), w('TIME', 0.1), w('MODEL', 0.12)], 0.14), { month: null, year: null }, 'printed headings are not months');
});

test('a line in the type box means the same aircraft as above, however the reader spells the line', () => {
  const t = { top: 0.1, bottom: 0.9, columns: [{ field: 'day', x0: 0, x1: 0.1 }, { field: 'type', x0: 0.1, x1: 0.3 }, { field: 'total', x0: 0.3, x1: 0.4 }] };
  const w = (text, x, row) => ({ text, conf: 95, x0: x - 0.02, x1: x + 0.02, y0: 0.12 + row * 0.05, y1: 0.15 + row * 0.05 });
  const marks = ['—', '-', '___', '~', '=', '一', '. .', '–—'];
  const words = [w('1', 0.05, 0), w('T-34C', 0.2, 0), w('1.0', 0.35, 0)]; marks.forEach((m, i) => words.push(w(String(2 + i), 0.05, 1 + i), w(m, 0.2, 1 + i), w('1.0', 0.35, 1 + i)));
  words.push(w('20', 0.05, 9), w('T-2C', 0.2, 9), w('1.0', 0.35, 9), w('21', 0.05, 10), w('—', 0.2, 10), w('1.0', 0.35, 10));
  const ys = []; for (let k = 0; k <= 12; k++) ys.push(0.11 + k * 0.05);
  const rows = X.extractPage(words, t, { year: 1983, month: 2 }, { ruledLines: ys, knownTypes: ['T-34C', 'T-2C'] }).rows;
  assert.strictEqual(rows.length, 11);
  rows.slice(1, 9).forEach((f, i) => { assert.strictEqual(f.type, 'T-34C', 'mark ' + marks[i]); assert.ok(f.typeSame && !f.flags.some(x => x.field === 'type'), 'no question for ' + marks[i]); });
  assert.ok(!rows[0].typeSame); assert.strictEqual(rows[9].type, 'T-2C'); assert.strictEqual(rows[10].type, 'T-2C', 'follows the nearest type written above');
  // a page that opens with a line takes the type from the page before, and says so
  const r2 = X.extractPage([w('3', 0.05, 0), w('—', 0.2, 0), w('1.0', 0.35, 0), w('4', 0.05, 1), w('—', 0.2, 1), w('1.0', 0.35, 1)], t, { year: 1983, month: 3 }, { ruledLines: ys, carryType: 'T-34C' }).rows;
  assert.deepStrictEqual(r2.map(f => f.type), ['T-34C', 'T-34C']); assert.ok(r2[0].flags.some(x => /page before/.test(x.reason)));
  for (const junk of ['1', 'I', 'l', 'TT', '11']) { const rj = X.extractPage([w('1', 0.05, 0), w('T-34C', 0.2, 0), w('1.0', 0.35, 0), w('2', 0.05, 1), w(junk, 0.2, 1), w('1.0', 0.35, 1)], t, { year: 1983, month: 2 }, { ruledLines: ys }).rows; assert.strictEqual(rj[1].type, 'T-34C', 'a stray ' + junk + ' is the line misread'); }
  const r3 = X.extractPage([w('3', 0.05, 0), w('—', 0.2, 0), w('1.0', 0.35, 0)], t, { year: 1983, month: 3 }, { ruledLines: ys }).rows;
  assert.strictEqual(r3[0].type, ''); assert.ok(r3[0].flags.some(x => x.field === 'type'), 'nothing to copy from: asks');
});

test('each page of the open book has its own row heights, joined row for row', () => {
  const t = Object.assign(X.defaultTemplate(), { top: 0.2, bottom: 0.2 + 5 * 0.05, rows: 5, pitch: 0.05 });
  const left = [0.1, 0.13, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45], right = [0.11, 0.222, 0.272, 0.322, 0.372, 0.422, 0.472]; // right page sits lower by nearly half a row
  const bands = X.rowBands([], t, { left, right, gutter: 0.525 });
  assert.strictEqual(bands.length, 5); assert.ok(Math.abs(bands[0].y0 - 0.2) < 1e-9 && Math.abs(bands[0].ry0 - 0.222) < 1e-9 && Math.abs(bands[4].ry1 - 0.472) < 1e-9, JSON.stringify(bands[0]));
  const day = t.columns.find(c => c.field === 'day'), rem = t.columns.find(c => c.field === 'remarks'), tot = t.columns.find(c => c.field === 'total'), typ = t.columns.find(c => c.field === 'type');
  const w = (text, col, y) => ({ text, conf: 95, x0: (col.x0 + col.x1) / 2 - 0.005, x1: (col.x0 + col.x1) / 2 + 0.005, y0: y - 0.008, y1: y + 0.008 });
  // remarks for the first flight are written at a height that, on the left page, would already be the second row
  const r = X.extractPage([w('18', day, 0.225), w('T-34C', typ, 0.225), w('1.6', tot, 0.225), w('FAM1', rem, 0.262), w('23', day, 0.275), w('T-34C', typ, 0.275), w('1.5', tot, 0.275), w('FAM2', rem, 0.312)], t, { year: 1983, month: 2 }, { ruledLines: { left, right, gutter: 0.525 } });
  assert.deepStrictEqual(r.rows.map(f => [f.day, f.remarks]), [[18, 'FAM1'], [23, 'FAM2']]);
  // heavy writing in a row is not a printed line; nor is a wrong extra line allowed to split a row
  assert.strictEqual(X.rowBands([], t, [0.2, 0.25, 0.276, 0.3, 0.35, 0.4, 0.45]).length, 5);
  const g = new Uint8Array(1000 * 600).fill(255); for (let k = 0; k < 8; k++) for (let x = 40; x < 960; x++) { g[(100 + k * 50) * 1000 + x] = 60; g[(101 + k * 50) * 1000 + x] = 60; }
  for (let k = 0; k < 7; k++) for (let y = 112 + k * 50; y < 142 + k * 50; y++) for (let x = 60; x < 940; x++) if ((x * 31 + y * 17) % 20 < 9) g[y * 1000 + x] = 30; // rows packed with heavy writing: nearly half of every pixel row is ink
  const got = X.findRowLines(g, 1000, 600).map(v => Math.round(v * 600)); assert.strictEqual(got.length, 8, JSON.stringify(got)); got.forEach((y, k) => assert.ok(Math.abs(y - (100 + k * 50)) <= 1, `line ${k} at ${y}`));
});

test('landing rules: one full stop per flight, the rest touch and goes; night time makes the last landing a night one', () => {
  const L = f => { const c = C.landingCounts(f); return [c.total, c.fullStops, c.touchAndGo, c.nightFS, c.nightTG, c.nightTraps, c.nightFCLP]; };
  assert.deepStrictEqual(L({ total: 1.5, landings: 1 }), [1, 1, 0, 0, 0, 0, 0], 'one day landing');
  assert.deepStrictEqual(L({ total: 1.5, landings: 7 }), [7, 1, 6, 0, 0, 0, 0], 'seven landings: six touch and goes and the full stop');
  assert.deepStrictEqual(L({ total: 1.5, night: 0.4, landings: 7 }), [7, 1, 6, 1, 0, 0, 0], 'some night time: the full stop was at night, the touch and goes are not assumed to be');
  assert.deepStrictEqual(L({ total: 1.5, night: 1.5, landings: 4, fclp: 6 }), [10, 1, 9, 1, 9, 0, 6], 'all night: every landing was');
  assert.deepStrictEqual(L({ total: 2.0, night: 0.5, traps: 3, cats: 3 }), [3, 3, 0, 1, 0, 1, 0], 'ended aboard ship at night: the last trap was a night trap');
  assert.deepStrictEqual(L({ total: 2.0, night: 2.0, traps: 3, carrierTG: 2 }), [5, 3, 2, 3, 2, 3, 0]);
  assert.deepStrictEqual(L({ total: 1.0, night: 0.3 }), [0, 0, 0, 0, 0, 0, 0], 'night time but no landing logged: nothing invented');
  const t = C.totals([{ date: '1984-01-02', total: 1.5, night: 0.4, landings: 7 }, { date: '1984-01-03', total: 2, night: 2, traps: 3 }]).all; assert.deepStrictEqual([t.nightLandings, t.nightTraps, t.traps], [1, 3, 3]);
});

console.log(`${passed} tests passed`);
