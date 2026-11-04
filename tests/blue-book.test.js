// Tests for Blue Book's reading, totals, deployments, search and file making. Run: node tests/blue-book.test.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const X = require('../blue-book/js/extract.js');
const C = require('../blue-book/js/career.js');
const F = require('../blue-book/js/files.js');
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
  assert.strictEqual(fl[1].type, 'AV-8B', 'ditto copies the type'); assert.ok(fl[1].flags.some(f => f.field === 'type' && /ditto/.test(f.reason)));
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

console.log(`${passed} tests passed`);
