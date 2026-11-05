// Tests the chore/star rules of The Job Jar! web app. Run: node tests/job-jar.test.js
const J = require(require("path").join(__dirname, "../job-jar/core.js"));
const assert = require("assert");

const thu = new Date(2026, 10, 5, 9); // Thursday, November 5, 2026
const sat = new Date(2026, 10, 7, 9);
assert.equal(J.dayKey(thu), "2026-11-05");
assert.equal(J.dayKey(J.weekStart(thu)), "2026-11-01"); // Sunday
assert.equal(J.dayKey(J.addDays(thu, 30)), "2026-12-05");
assert.equal(J.dayKey(J.parseDay("2026-03-08")), "2026-03-08"); // daylight saving day

let s = J.defaultState();
assert.equal(s.chores.length, 6); assert.equal(s.rewards.length, 4); assert.equal(s.setupDone, false);
s.kids.push({ id: "a", name: "Ava", avatar: "🦊", color: "#f00", stars: 0 }, { id: "b", name: "Ben", avatar: "🐻", color: "#00f", stars: 0 });
const bed = s.chores[0], dog = s.chores[5];
dog.kids = ["b"]; // only Ben feeds the dog
dog.days = [1, 3, 5]; // Mon, Wed, Fri
dog.stars = 2;

// Who gets which chore, which days
assert.equal(J.choresFor(s, "a", thu).length, 5);
assert.equal(J.choresFor(s, "b", thu).length, 5); // Thursday: no dog
assert.equal(J.choresFor(s, "b", J.addDays(thu, 1)).length, 6); // Friday: dog
assert(!J.isDue(dog, J.addDays(thu, 1), "a"));

// Doing chores gives stars once
assert.equal(J.markDone(s, "a", bed.id, thu, thu), 1);
assert.equal(J.markDone(s, "a", bed.id, thu, thu), 0, "can't earn twice");
assert.equal(J.kidById(s, "a").stars, 1);
assert.equal(J.statusOf(s, "a", bed.id, thu), "done");
assert.equal(J.statusOf(s, "b", bed.id, thu), "", "Ben's chart is separate");
assert.equal(J.statusOf(s, "a", bed.id, J.addDays(thu, 1)), "", "new day, fresh chart");
assert.deepEqual(J.progress(s, "a", thu), { finished: 1, total: 5, allDone: false });
assert.equal(s.log[0].delta, 1); assert.equal(s.log[0].kind, "chore");

// Undo takes the star back, never below zero
assert.equal(J.undo(s, "a", bed.id, thu), 1);
assert.equal(J.kidById(s, "a").stars, 0);
assert.equal(J.undo(s, "a", bed.id, thu), 0);
J.choresFor(s, "a", thu).forEach((x) => J.markDone(s, "a", x.chore.id, thu, thu));
assert.equal(J.kidById(s, "a").stars, 5);
assert(J.progress(s, "a", thu).allDone);
J.kidById(s, "a").stars = 0; // spent elsewhere
assert.equal(J.undo(s, "a", bed.id, thu), 0, "can't go negative");
assert.equal(J.kidById(s, "a").stars, 0);
J.kidById(s, "a").stars = 4;

// Grown-up checks chores first
s.settings.needsApproval = true;
const fri = J.addDays(thu, 1);
assert.equal(J.markDone(s, "b", dog.id, fri, fri), 0);
assert.equal(J.statusOf(s, "b", dog.id, fri), "waiting");
assert.equal(J.kidById(s, "b").stars, 0);
assert(J.progress(s, "b", fri).finished === 1, "waiting counts as finished for the kid");
J.markDone(s, "b", bed.id, fri, fri);
let w = J.waitingList(s);
assert.equal(w.length, 2); assert.equal(w[0].day, "2026-11-06");
assert.equal(J.approve(s, "b", dog.id, "2026-11-06", fri), 2);
assert.equal(J.approve(s, "b", dog.id, "2026-11-06", fri), 0, "only once");
J.reject(s, "b", bed.id, "2026-11-06");
assert.equal(J.statusOf(s, "b", bed.id, fri), "");
assert.equal(J.waitingList(s).length, 0);
assert.equal(J.kidById(s, "b").stars, 2);
assert.equal(J.undo(s, "b", dog.id, fri), 2);
J.markDone(s, "b", dog.id, fri, fri); J.approve(s, "b", dog.id, "2026-11-06", fri);
s.settings.needsApproval = false;

// Rewards
const story = s.rewards[0]; // 5 stars
assert.equal(J.starsNeeded(s, "a", story.id), 1);
assert(!J.canAfford(s, "a", story.id));
assert.equal(J.redeem(s, "a", story.id), false);
J.adjust(s, "a", 3, "Helped Grandma");
assert.equal(J.kidById(s, "a").stars, 7); assert.equal(s.log[0].kind, "bonus");
assert(J.redeem(s, "a", story.id, thu));
assert.equal(J.kidById(s, "a").stars, 2); assert.equal(s.log[0].delta, -5);
assert.equal(J.adjust(s, "a", -10), -2, "taking away stops at zero");
assert.equal(J.kidById(s, "a").stars, 0);
assert.equal(J.adjust(s, "a", 0), 0);

// Week chart
const wk = J.weekChart(s, "b", fri);
assert.equal(wk.days[0], "2026-11-01"); assert.equal(wk.days.length, 7);
const dogRow = wk.rows.find((r) => r.chore.id === dog.id);
assert.deepEqual(dogRow.cells, ["off", "", "off", "", "off", "done", "off"]);
const bedRow = wk.rows.find((r) => r.chore.id === bed.id);
assert.equal(bedRow.cells[6], "future");
assert.equal(wk.earned[5], 2, "dog approved Friday (undo + redo nets 2)");
assert.equal(J.weekChart(s, "a", thu).rows.length, 5, "Ava's chart has no dog row");
assert.equal(J.weekChart(s, "a", thu).earned[4], 5); // +1, -1, +5, then an undo with no stars left to take back
assert.equal(J.weekChart(s, "a", sat).total, J.weekChart(s, "a", thu).total);

// Pruning old days and removed kids
s.done["2026-01-01"] = { a: { x: "done" } };
J.prune(s, thu);
assert(!s.done["2026-01-01"]);
J.removeKid(s, "b");
assert.equal(s.kids.length, 1);
assert(!s.done["2026-11-06"].b);
assert.deepEqual(dog.kids, []);
assert(s.log.every((e) => e.kid !== "b"));

// Loading older or hand-edited saves
const n = J.normalize({ kids: [{ name: "Cy", stars: "3.4" }], chores: [{ name: "X", stars: 9, days: [] }], settings: { pin: "1234" } });
assert.equal(n.kids[0].stars, 3); assert(n.kids[0].id); assert(n.kids[0].avatar);
assert.equal(n.chores[0].stars, 9); assert.deepEqual(n.chores[0].days, J.ALL_DAYS);
assert.equal(n.rewards.length, 4); assert.equal(n.settings.pin, "1234"); assert.equal(n.settings.sound, true);
assert.equal(J.normalize(null).chores.length, 6);
assert.equal(J.normalize(JSON.parse(JSON.stringify(s))).kids[0].name, "Ava");

// Small helpers
assert.equal(J.starWord(1), "1 star"); assert.equal(J.starWord(3), "3 stars");
assert(J.validPin("0420")); assert(!J.validPin("123")); assert(!J.validPin("12a4"));
assert.notEqual(J.newId("k"), J.newId("k"));

// Money mode
const m = J.defaultState();
assert.equal(m.settings.money, false); assert.equal(m.settings.coin, "nickel");
assert.equal(J.amountText(m, 3), "3 stars");
m.settings.money = true;
assert.equal(J.amountText(m, 5), "25¢"); assert.equal(J.amountShort(m, 5), "25¢");
assert.equal(J.amountSpeech(m, 5), "25 cents"); assert.equal(J.coinCount(m, 5), "5 nickels"); assert.equal(J.coinCount(m, 1), "1 nickel");
m.settings.coin = "quarter";
assert.equal(J.amountText(m, 6), "$1.50"); assert.equal(J.amountSpeech(m, 6), "1 dollar and 50 cents");
m.settings.coin = "penny"; assert.equal(J.coinCount(m, 2), "2 pennies"); assert.equal(J.amountText(m, 1), "1¢");
m.settings.coin = "dollar"; assert.equal(J.amountText(m, 2), "$2.00"); assert.equal(J.amountSpeech(m, 2), "2 dollars");
assert.equal(J.money(0), "0¢"); assert.equal(J.money(-35), "−35¢"); assert.equal(J.money(1005), "$10.05");
assert.equal(J.moneyWords(0), "0 cents"); assert.equal(J.moneyWords(101), "1 dollar and 1 cent");
assert.equal(J.normalize({ settings: { money: 1, coin: "doubloon" } }).settings.coin, "nickel");
assert.equal(J.normalize({ settings: { money: 1 } }).settings.money, true);
assert.equal(J.normalize({ chores: [{ name: "Big job", stars: 15 }] }).chores[0].stars, 15, "money jobs can pay up to 20 coins");
assert.equal(J.normalize({ chores: [{ name: "Huge", stars: 99 }] }).chores[0].stars, 20);
// Coin sizes are in real proportion: a dime is the smallest, the half dollar the biggest
assert(J.COINS.dime.d < J.COINS.penny.d && J.COINS.penny.d < J.COINS.nickel.d && J.COINS.quarter.d < J.COINS.half.d);

// Photo avatars
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
assert(J.validPhoto(png));
assert(!J.validPhoto("javascript:alert(1)")); assert(!J.validPhoto("data:text/html;base64,PGI+")); assert(!J.validPhoto('data:image/png;base64,AA"onerror="x'));
assert.equal(J.normalize({ kids: [{ name: "Pat", photo: png }] }).kids[0].photo, png);
assert.equal(J.normalize({ kids: [{ name: "Pat", photo: "http://example.com/x.png" }] }).kids[0].photo, "");

console.log("Job Jar tests passed");
