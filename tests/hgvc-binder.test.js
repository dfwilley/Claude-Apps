// Tests for HGVC Binder's points, fees, reminders, import and statement reading. Run: node tests/hgvc-binder.test.js
// Uses made-up sample data only.
const assert = require('assert');
const H = require('../hgvc-binder/js/core.js');
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok -', name); } catch (e) { console.error('FAIL -', name, '\n', e); process.exitCode = 1; } };

const sample = () => ({
  app: 'HGVC Binder', schema: 1, asOf: '2026-11-04',
  properties: [{
    id: 'sunny-shores', name: 'Sunny Shores Resort', short: 'Sunny Shores', account: 'HGVC', currency: 'ClubPoints', annualPoints: 10000,
    contractNumber: '12-345678', memberNumber: '99-000111',
    batches: [
      { id: 'b26', label: 'ClubPoints 2026', year: 2026, kind: 'current', points: 10000, available: 2500, saved: 1000, borrowed: 0, expires: '2026-12-31', saveBy: '2026-11-30', saveNote: 'discount' },
      { id: 'b27', label: 'ClubPoints 2027', year: 2027, kind: 'future', points: 10000, available: 10000, expires: '2027-12-31' },
      { id: 'b25', label: 'ClubPoints 2025', year: 2025, kind: 'current', points: 10000, available: 400, expires: '2025-12-31' }
    ],
    fees: [
      { id: 'f24', year: 2024, label: 'Maintenance fee', amount: 2000, due: '2024-01-01', paid: true },
      { id: 'f25', year: 2025, label: 'Maintenance fee', amount: 2200, due: '2025-01-01', paid: true },
      { id: 'f26', year: 2026, label: 'Maintenance fee', amount: 2310, due: '2026-01-01', paid: true },
      { id: 'f26c', year: 2026, label: 'Credit', amount: -10, due: '2026-01-01', paid: true },
      { id: 'f27', year: 2027, label: 'Maintenance fee', amount: 2400, due: '2027-01-01', paid: false },
      { id: 'p1', year: 2026, label: 'Payment', kind: 'Payment', amount: -2300, paid: true }
    ],
    reservations: [{ id: 'r1', resort: 'Beach Place', checkIn: '2027-03-01', points: 5000 }],
    contacts: [{ label: 'Front desk', phone: '555-0100' }]
  }]
});

test('dates are read in several formats and written out in full', () => {
  assert.strictEqual(H.iso('01/15/2026'), '2026-01-15');
  assert.strictEqual(H.iso('15-Jan-2026'), '2026-01-15');
  assert.strictEqual(H.iso('January 1, 2027'), '2027-01-01');
  assert.strictEqual(H.longDate('2027-01-01'), 'January 1, 2027');
  assert.strictEqual(H.daysBetween('2026-11-04', '2026-12-31'), 57);
});

test('numbers are masked to the last 4 digits', () => {
  assert.strictEqual(H.mask('12-34567'), '•••• 4567');
  assert.strictEqual(H.mask(''), '—');
});

test('importing keeps only the last 4 of contract and member numbers, and drops passwords', () => {
  const d = sample(); d.properties[0].password = 'hunter2'; d.properties[0].notes = 'card 4111 1111 1111 1111 on file';
  const v = H.validateDataFile(JSON.stringify(d));
  assert.ok(v.ok);
  const p = v.data.properties[0];
  assert.strictEqual(p.contractLast4, '5678'); assert.strictEqual(p.memberLast4, '0111');
  assert.ok(!('contractNumber' in p) && !('password' in p));
  assert.ok(!/4111 1111/.test(JSON.stringify(v.data)), 'card number removed');
});

test('rejects files that are not HGVC Binder data', () => {
  assert.strictEqual(H.validateDataFile('not json').ok, false);
  assert.strictEqual(H.validateDataFile({ app: 'Hangar Log', properties: [] }).ok, false);
  assert.strictEqual(H.validateDataFile({ hello: 1 }).ok, false);
});

test('points summary: available, used, saved, next to expire', () => {
  const p = H.validateDataFile(sample()).data.properties[0];
  const s = H.pointsSummary(p, '2026-11-04');
  assert.strictEqual(s.availableNow, 2500, 'expired 2025 points and future 2027 points are not counted');
  assert.strictEqual(s.usedThisYear, 6500);
  assert.strictEqual(s.savedThisYear, 1000);
  assert.strictEqual(s.upcoming, 10000);
  assert.strictEqual(s.nextExpiring.points, 2500); assert.strictEqual(s.nextExpiring.days, 57);
});

test('fees by year: totals, change, cost per point, payments left out', () => {
  const p = H.validateDataFile(sample()).data.properties[0];
  const y = H.feeYears(p);
  assert.deepStrictEqual(y.map(r => r.year), [2024, 2025, 2026, 2027]);
  assert.strictEqual(y[2].total, 2300);
  assert.ok(Math.abs(y[1].change - 0.10) < 1e-9);
  assert.strictEqual(y[2].costPerPoint, 0.23);
  assert.strictEqual(y[3].paid, false); assert.strictEqual(y[3].unpaid, 2400);
});

test('deadlines and phone reminders', () => {
  const st = { properties: H.validateDataFile(sample()).data.properties, settings: { remind: { expire: [60, 30, 7], save: [7, 1], fee: [30] } } };
  const d = H.deadlines(st, '2026-11-04');
  assert.deepStrictEqual(d.map(x => x.kind), ['save', 'expire', 'fee']);
  assert.strictEqual(d[0].date, '2026-11-30');
  const n = H.notifications(st, '2026-11-04');
  // expire Dec 31: 60 days before (Nov 1) is past, so 30 and 7; save Nov 30: 7 and 1; fee Jan 1: 30
  assert.deepStrictEqual(n.map(x => x.fire), ['2026-11-23', '2026-11-29', '2026-12-01', '2026-12-02', '2026-12-24']);
  assert.ok(n.every(x => x.id && x.title && x.body));
});

test('calendar file has one event per deadline with alarms', () => {
  const st = { properties: H.validateDataFile(sample()).data.properties };
  const ics = H.buildICS(st, '2026-11-04');
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261231'));
  assert.ok(ics.includes('TRIGGER:-P30DT0H'));
});

test('all-properties roll-up', () => {
  const d = sample(); d.properties.push({ id: 'max', name: 'Max Place', currency: 'HGV Max points', annualPoints: 5000, batches: [{ kind: 'current', points: 5000, available: 100, expires: '2026-12-31' }], fees: [] });
  const st = { properties: H.validateDataFile(d).data.properties };
  const s = H.summary(st, '2026-11-04');
  assert.strictEqual(s.totalAvailable, 2600);
  assert.deepStrictEqual(s.byCurrency, { ClubPoints: 2500, 'HGV Max points': 100 });
  assert.strictEqual(s.dueTotal, 2400);
  assert.strictEqual(s.annualPoints, 15000);
});

test('merging an update replaces owner-site items but keeps hand-entered ones and your edits', () => {
  let st = H.mergeData(H.emptyState(), H.validateDataFile(sample()).data).state;
  const p = st.properties[0];
  p.fees.push({ id: 'mine', year: 2027, label: 'Club dues', amount: 199, paid: false, source: 'manual' });
  p.fees.find(f => f.id === 'f27').paid = true; p.fees.find(f => f.id === 'f27').paidBy = 'me';
  p.reservations[0].source = 'manual'; p.reservations[0].resort = 'Beach Place (my note)';
  p.locked = { short: true }; p.short = 'Shores';
  p.docs.push({ id: 'd1', name: 'Deed' }); p.notes = 'keep me';
  const upd = sample(); upd.asOf = '2026-11-05'; upd.properties[0].batches[0].available = 2000; upd.properties[0].short = 'Sunny';
  st = H.mergeData(st, H.validateDataFile(upd).data).state;
  const q = st.properties[0];
  assert.strictEqual(q.batches.find(b => b.id === 'b26').available, 2000, 'owner-site numbers updated');
  assert.ok(q.fees.some(f => f.id === 'mine'), 'hand-entered fee kept');
  assert.strictEqual(q.fees.find(f => f.id === 'f27').paid, true, 'your paid check mark kept');
  assert.strictEqual(q.reservations.length, 1); assert.strictEqual(q.reservations[0].resort, 'Beach Place (my note)', 'your edit wins, no duplicate');
  assert.strictEqual(q.short, 'Shores', 'locked field kept');
  assert.strictEqual(q.docs.length, 1); assert.strictEqual(q.notes, 'keep me');
  assert.strictEqual(st.meta.hgvAsOf, '2026-11-05');
});

test('keeps and shows the last download time', () => {
  const d = sample(); d.downloaded = '2026-11-04T13:30:00-07:00'; d.generated = '2026-11-04T20:30:16Z';
  const st = H.mergeData(H.emptyState(), H.validateDataFile(d).data).state;
  assert.strictEqual(st.meta.downloaded, '2026-11-04T13:30:00-07:00');
  assert.ok(/^November 4, 2026 at \d{1,2}:30 (AM|PM)$/.test(H.stampText(st.meta.downloaded)));
  assert.strictEqual(H.stampText('2027-01-01'), 'January 1, 2027');
  assert.strictEqual(H.stampText(''), '');
});

test('reads a typical HGV statement', () => {
  const text = `HAWAII SAMPLE MEMBERS ASSOCIATION
STATEMENT
Contract No. 12-345678
Statement as of: 10/21/2026
Date Due Description Charge Credit
01/01/2027 2027 Operating Fee $3,100.25
01/01/2027 2027 Reserve Fee $900.00
01/01/2027 2027 Real Estate Tax $250.10
01/01/2027 2027 Club Dues $239.00
01/01/2027 ARDA-ROC Voluntary Contribution $5.00
Credit $26.95
DATE DUE: 01/01/2027
TOTAL AMOUNT DUE $4,467.40`;
  const st = H.parseStatement(text);
  assert.strictEqual(st.due, '2027-01-01'); assert.strictEqual(st.total, 4467.40); assert.strictEqual(st.contractLast4, '5678'); assert.strictEqual(st.year, 2027);
  assert.strictEqual(st.lines.length, 6);
  assert.strictEqual(st.lines.find(l => /credit/i.test(l.label)).amount, -26.95);
  const sum = st.lines.reduce((s, l) => s + l.amount, 0);
  assert.ok(Math.abs(sum - 4467.40) < 0.001, 'lines add up to the total');
  const rows = H.statementToFees(st);
  assert.ok(rows.every(r => r.year === 2027 && r.due === '2027-01-01' && r.source === 'manual'));
  assert.strictEqual(rows.find(r => /dues/i.test(r.label)).kind, 'Club dues');
});

test('statement with only a total still gives a fee line', () => {
  const rows = H.statementToFees(H.parseStatement('Payment due by January 1, 2027\nAmount due: $4,956.22'));
  assert.strictEqual(rows.length, 1); assert.strictEqual(rows[0].amount, 4956.22); assert.strictEqual(rows[0].year, 2027);
});

test('fee lines you replaced with a statement stay replaced after the next update', () => {
  let st = H.mergeData(H.emptyState(), H.validateDataFile(sample()).data).state;
  const p = st.properties[0]; p.suppress = ['f27']; p.fees = p.fees.filter(f => f.id !== 'f27');
  st = H.mergeData(st, H.validateDataFile(sample()).data).state;
  assert.ok(!st.properties[0].fees.some(f => f.id === 'f27'));
});

test('Hilton Honors balance and tier come through; the Honors number never does', () => {
  const d = sample(); d.honors = { balance: '740,291', tier: 'Diamond', asOf: '11/04/2026', honorsNumber: '123456789' };
  const v = H.validateDataFile(d);
  assert.deepStrictEqual(v.data.honors, { balance: 740291, tier: 'Diamond', asOf: '2026-11-04' });
  let st = H.mergeData(H.emptyState(), v.data).state;
  assert.strictEqual(H.summary(st, '2026-11-04').honors.balance, 740291);
  const upd = sample(); upd.honors = { balance: 750000, tier: 'Diamond', asOf: '2026-12-02' };
  st = H.mergeData(st, H.validateDataFile(upd).data).state;
  assert.strictEqual(st.honors.balance, 750000);
  const noH = sample(); st = H.mergeData(st, H.validateDataFile(noH).data).state;
  assert.strictEqual(st.honors.balance, 750000, 'a file without Honors keeps the last balance');
  assert.ok(!JSON.stringify(st).includes('123456789'));
});

console.log(`\n${passed} passed`);
