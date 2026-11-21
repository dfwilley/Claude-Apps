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
assert.equal(s.settings.needsApproval, true, "a new family starts with the grown-up check on");
assert.equal(s.version, 2);
s.settings.needsApproval = false; // first, the rules with the grown-up check turned off
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
// The grown-up check is switched on once for saves made before it became the usual setting...
assert.equal(n.settings.needsApproval, true); assert.equal(n.version, 2);
assert.equal(J.normalize({ version: 1, settings: { needsApproval: false } }).settings.needsApproval, true);
// ...and after that a grown-up's choice to turn it off is kept
assert.equal(J.normalize({ version: 2, settings: { needsApproval: false } }).settings.needsApproval, false);
assert.equal(J.normalize(JSON.parse(JSON.stringify(J.normalize({ version: 1 })))).settings.needsApproval, true);
// With the check on, nothing reaches the kid's jar until a grown-up says OK
const q = J.defaultState();
q.kids.push({ id: "k", name: "Kay", avatar: "🦊", color: "#f00", stars: 0 });
assert.equal(J.markDone(q, "k", q.chores[0].id, thu, thu), 0);
assert.equal(J.kidById(q, "k").stars, 0); assert.equal(q.log.length, 0);
assert.equal(J.weekChart(q, "k", thu).total, 0);
assert.equal(J.approve(q, "k", q.chores[0].id, "2026-11-05", thu), 1);
assert.equal(J.kidById(q, "k").stars, 1);
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

// ---- Special days: a birthday doubles what chores pay, for that kid only
{
  const f = J.defaultState();
  f.settings.needsApproval = false;
  f.kids.push({ id: "a", name: "Ava", avatar: "🦊", color: "#f00", stars: 0 }, { id: "b", name: "Ben", avatar: "🐻", color: "#00f", stars: 0 });
  const c0 = f.chores[0], c1 = f.chores[1];
  c1.stars = 3;
  f.specials.push({ id: "s1", pic: "🎂", name: "Ava's birthday", date: "2020-11-05", yearly: true, times: 2, kids: ["a"] });
  assert.equal(J.timesFor(f, "a", thu), 2); assert.equal(J.timesFor(f, "b", thu), 1);
  assert.equal(J.timesFor(f, "a", fri), 1, "only on the day");
  assert.equal(J.specialFor(f, "a", thu).name, "Ava's birthday");
  assert.equal(J.payFor(f, "a", c1, thu), 6);
  assert.equal(J.markDone(f, "a", c1.id, thu, thu), 6);
  assert.equal(J.markDone(f, "b", c1.id, thu, thu), 3);
  assert.equal(J.kidById(f, "a").stars, 6);
  assert(/×2 Ava's birthday/.test(f.log.find((e) => e.kid === "a").text));
  assert.equal(J.undo(f, "a", c1.id, thu), 6, "undo takes the doubled pay back");
  assert.equal(J.kidById(f, "a").stars, 0);
  // a one-time special day for everyone, tripled; the biggest special wins
  f.specials.push({ id: "s2", pic: "🎉", name: "Snow day", date: "2026-11-05", yearly: false, times: 3, kids: [] });
  assert.equal(J.timesFor(f, "a", thu), 3); assert.equal(J.timesFor(f, "b", thu), 3);
  assert.equal(J.timesFor(f, "b", J.addDays(thu, 365)), 1, "a one-time day doesn't repeat");
  assert.equal(J.timesFor(f, "a", J.addDays(thu, 365)), 2, "the birthday comes back next year");
  // with the grown-up check on, the special day counts by the day the chore was done
  f.settings.needsApproval = true;
  assert.equal(J.markDone(f, "a", c0.id, thu, thu), 0);
  assert.equal(J.approve(f, "a", c0.id, "2026-11-05", sat), 3);
  f.settings.needsApproval = false;
  // loading: bad special days are dropped, the multiplier is kept between 2 and 3
  const ns = J.normalize({ specials: [{ name: "X", date: "soon" }, { name: "Y", date: "2026-12-25", times: 9 }] });
  assert.equal(ns.specials.length, 1); assert.equal(ns.specials[0].times, 3); assert(ns.specials[0].id);
  // removing the only kid a special day was for removes the special day
  J.removeKid(f, "a");
  assert.deepEqual(f.specials.map((x) => x.id), ["s2"]);
}

// ---- A special chore that only shows for a few days
{
  const f = J.defaultState();
  f.settings.needsApproval = false;
  f.kids.push({ id: "a", name: "Ava", avatar: "🦊", color: "#f00", stars: 0 });
  const leaves = { id: "lv", pic: "🍂", name: "Rake leaves", stars: 5, days: J.ALL_DAYS.slice(), kids: [], from: "2026-11-05", until: "2026-11-07" };
  f.chores.push(leaves);
  assert(!J.isDue(leaves, J.addDays(thu, -1), "a")); assert(J.isDue(leaves, thu, "a")); assert(J.isDue(leaves, sat, "a"));
  assert(!J.isDue(leaves, J.addDays(sat, 1), "a"));
  assert.equal(J.choresFor(f, "a", thu).length, 7); assert.equal(J.choresFor(f, "a", J.addDays(sat, 1)).length, 6);
  const row = J.weekChart(f, "a", thu).rows.find((r) => r.chore.id === "lv");
  assert.deepEqual(row.cells, ["off", "off", "off", "off", "", "future", "future"]);
  const nc = J.normalize(JSON.parse(JSON.stringify(f))).chores.find((c) => c.id === "lv");
  assert.equal(nc.from, "2026-11-05"); assert.equal(nc.until, "2026-11-07");
  assert.equal(J.normalize({ chores: [{ name: "X", from: "junk" }] }).chores[0].from, "");
}

// ---- Grandma matches what a kid earns
{
  const f = J.defaultState();
  f.settings.needsApproval = false;
  f.kids.push({ id: "a", name: "Ava", avatar: "🦊", color: "#f00", stars: 0 }, { id: "b", name: "Ben", avatar: "🐻", color: "#00f", stars: 0 });
  const [c0, c1, c2, c3] = f.chores;
  f.matches.push({ id: "m1", pic: "👵", who: "Grandma", percent: 50, kids: ["a"], until: "2026-11-06", cap: 0, earned: {}, given: {} });
  assert.equal(J.matchesFor(f, "a", thu).length, 1); assert.equal(J.matchesFor(f, "b", thu).length, 0);
  assert.equal(J.markDone(f, "a", c0.id, thu, thu), 1, "the chore itself still pays 1");
  assert.equal(J.kidById(f, "a").stars, 1, "half a star isn't given yet");
  J.markDone(f, "a", c1.id, thu, thu);
  assert.equal(J.kidById(f, "a").stars, 3, "2 earned, Grandma adds 1");
  assert.equal(f.log[0].kind, "match"); assert.equal(f.log[0].text, "Grandma's match"); assert.equal(f.log[0].delta, 1);
  assert.equal(f.matches[0].given.a, 1); assert.equal(f.matches[0].earned.a, 2);
  J.markDone(f, "b", c0.id, thu, thu);
  assert.equal(J.kidById(f, "b").stars, 1, "Ben isn't matched");
  assert.equal(J.weekChart(f, "a", thu).earned[4], 3, "the week chart counts the match");
  // taking a chore back takes the match back
  J.undo(f, "a", c1.id, thu);
  assert.equal(J.kidById(f, "a").stars, 1); assert.equal(f.matches[0].given.a || 0, 0);
  J.markDone(f, "a", c1.id, thu, thu);
  assert.equal(J.kidById(f, "a").stars, 3);
  // after the last day of the match, nothing more is added
  J.markDone(f, "a", c0.id, sat, sat); J.markDone(f, "a", c1.id, sat, sat);
  assert.equal(J.kidById(f, "a").stars, 5);
  // a limit, and a 200% match
  f.matches.push({ id: "m2", pic: "👴", who: "Granddad", percent: 200, kids: [], until: "", cap: 3, earned: {}, given: {} });
  J.markDone(f, "b", c1.id, thu, thu);
  assert.equal(J.kidById(f, "b").stars, 1 + 1 + 2, "1 earned, Granddad adds 2");
  J.markDone(f, "b", c2.id, thu, thu);
  assert.equal(J.kidById(f, "b").stars, 4 + 1 + 1, "only 1 more: Granddad's limit is 3");
  J.markDone(f, "b", c3.id, thu, thu);
  assert.equal(J.kidById(f, "b").stars, 7, "the limit is reached");
  // a match and a special day together: the match counts the doubled pay
  f.specials.push({ id: "s", pic: "🎂", name: "Birthday", date: "2026-11-06", yearly: false, times: 2, kids: [] });
  const before = J.kidById(f, "a").stars, m1 = f.matches[0];
  f.matches = [m1];
  J.markDone(f, "a", c0.id, fri, fri);
  assert.equal(J.kidById(f, "a").stars, before + 2 + 1, "2 for the chore, and Grandma's half of 2");
  // with the grown-up check on, the match is only added when the chore is OK'd
  f.settings.needsApproval = true;
  const b2 = J.kidById(f, "a").stars;
  J.markDone(f, "a", c1.id, fri, fri);
  assert.equal(J.kidById(f, "a").stars, b2);
  J.approve(f, "a", c1.id, "2026-11-06", sat);
  assert.equal(J.kidById(f, "a").stars, b2 + 2 + 1);
  // saving and loading keeps the running totals; odd values are tidied
  const nm = J.normalize(JSON.parse(JSON.stringify(f))).matches[0];
  assert.deepEqual(nm.earned, m1.earned); assert.deepEqual(nm.given, m1.given); assert.equal(nm.percent, 50);
  const odd = J.normalize({ matches: [{ percent: "abc", cap: -4, earned: { a: "2", z: -1 } }] }).matches[0];
  assert.equal(odd.percent, 100); assert.equal(odd.cap, 0); assert.deepEqual(odd.earned, { a: 2 }); assert.equal(odd.who, "Grandma");
  J.removeKid(f, "a");
  assert.equal(f.matches.length, 0, "a match made only for a removed kid goes away");
}

// ---- A chore that only needs doing once a day: the first kid gets it, then it leaves the others' lists
{
  const f = J.defaultState();
  f.settings.needsApproval = false;
  f.kids.push({ id: "a", name: "Ava", avatar: "🦊", color: "#f00", stars: 0 }, { id: "b", name: "Ben", avatar: "🐻", color: "#00f", stars: 0 });
  const trash = { id: "tr", pic: "🗑️", name: "Take out trash", stars: 2, days: J.ALL_DAYS.slice(), kids: [], from: "", until: "", once: true };
  f.chores.push(trash);
  assert.equal(J.choresFor(f, "a", thu).length, 7); assert.equal(J.choresFor(f, "b", thu).length, 7);
  assert.equal(J.takenBy(f, trash, thu), "");
  assert.equal(J.markDone(f, "b", "tr", thu, thu), 2);
  assert.equal(J.takenBy(f, trash, thu), "b");
  assert.equal(J.choresFor(f, "a", thu).length, 6, "gone from Ava's list");
  assert.equal(J.choresFor(f, "b", thu).find((x) => x.chore.id === "tr").status, "done", "Ben still sees it, checked off");
  assert.equal(J.markDone(f, "a", "tr", thu, thu), 0, "Ava can't also do it");
  assert.equal(J.kidById(f, "a").stars, 0);
  assert.equal(J.choresFor(f, "a", fri).length, 7, "back the next day");
  assert.equal(J.weekChart(f, "a", thu).rows.find((r) => r.chore.id === "tr").cells[4], "off");
  assert.equal(J.weekChart(f, "b", thu).rows.find((r) => r.chore.id === "tr").cells[4], "done");
  assert.deepEqual(J.progress(f, "a", thu), { finished: 0, total: 6, allDone: false });
  // "Not done yet" gives it back to everyone
  J.undo(f, "b", "tr", thu);
  assert.equal(J.choresFor(f, "a", thu).length, 7);
  // with the grown-up check on, waiting for an OK already takes it; a "no" from the grown-up gives it back
  f.settings.needsApproval = true;
  J.markDone(f, "a", "tr", thu, thu);
  assert.equal(J.choresFor(f, "b", thu).length, 6);
  J.reject(f, "a", "tr", "2026-11-05");
  assert.equal(J.choresFor(f, "b", thu).length, 7);
  // an ordinary chore is not affected, and the setting is kept when saved
  J.markDone(f, "a", f.chores[0].id, thu, thu);
  assert.equal(J.choresFor(f, "b", thu).length, 7);
  const back = J.normalize(JSON.parse(JSON.stringify(f)));
  assert.equal(back.chores.find((c) => c.id === "tr").once, true); assert.equal(back.chores[0].once, false);
}

// ---- Any emoji from the keyboard can be a picture
assert.equal(J.pickEmoji("🦄"), "🦄"); assert.equal(J.pickEmoji("  🚀 "), "🚀");
assert.equal(J.pickEmoji("🐶🐱"), "🐱", "the last one typed wins");
assert.equal(J.pickEmoji("dog 🐕"), "🐕");
assert.equal(J.pickEmoji("abc"), ""); assert.equal(J.pickEmoji("12"), ""); assert.equal(J.pickEmoji(""), "");
assert.equal(J.pickEmoji("👨‍👩‍👧"), "👨‍👩‍👧", "a family emoji stays in one piece");
assert.equal(J.pickEmoji("👍🏽"), "👍🏽", "skin tone stays with its emoji");
[J.CHORE_PICS.map((p) => p[0]), J.REWARD_PICS.map((p) => p[0]), J.AVATARS].forEach((list) => assert.equal(new Set(list).size, list.length, "no picture twice in a list"));
assert(J.CHORE_PICS.length >= 60 && J.AVATARS.length >= 60);

console.log("Job Jar tests passed");
