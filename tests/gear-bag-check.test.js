// Tests the packing rules of Gear Bag Check. Run: node tests/gear-bag-check.test.js
const G = require(require("path").join(__dirname, "../gear-bag-check/core.js"));
const assert = require("assert");

const sat = new Date(2026, 10, 21, 8); // Saturday, November 21, 2026
const sun = new Date(2026, 10, 22, 8);

// Starter bags
assert.deepEqual(G.TEMPLATE_KEYS, ["soccer", "baseball", "softball", "basketball"]);
G.TEMPLATE_KEYS.forEach((k) => G.TEMPLATES[k].items.forEach((x) => {
  assert(G.CAT_KEYS.includes(x[2]), k + " " + x[1] + " has a real category");
  assert(x[3] >= 1 && x[3] <= 9);
}));

let s = G.defaultState();
const ava = G.addKid(s, "  Ava  ", "🦊");
const ben = G.addKid(s, "Ben");
assert.equal(ava.name, "Ava");
assert.notEqual(ava.color, ben.color);
const soccer = G.addBag(s, ava.id, "soccer");
const hoops = G.addBag(s, ben.id, "basketball");
const custom = G.addBag(s, ava.id, { name: "Swim", emoji: "🏊" });
assert.equal(soccer.items.length, G.TEMPLATES.soccer.items.length);
assert.equal(custom.items.length, 0);
assert.equal(G.bagsFor(s, ava.id).length, 2);
assert.notEqual(soccer.items[0].id, soccer.items[1].id);

// Each kid's bag is their own copy
const avaBottle = soccer.items.find((i) => i.name === "Water bottle");
assert.equal(avaBottle.count, 2);
const benBottle = hoops.items.find((i) => i.name === "Water bottle");
assert.notEqual(avaBottle.id, benBottle.id);

// Days: no days picked means never "today"
assert(!G.isToday(soccer, sat));
soccer.days = [2, 4, 6]; // Tue, Thu, Sat
assert(G.isToday(soccer, sat));
assert(!G.isToday(soccer, sun));
assert.deepEqual(G.bagsToday(s, ava.id, sat).map((b) => b.id), [soccer.id]);

// Door check
let sm = G.summary(s, soccer.id, sat);
assert.equal(sm.packed, 0); assert.equal(sm.total, 9); assert(!sm.allPacked);
assert.equal(G.togglePacked(s, soccer.id, soccer.items[0].id, sat), true);
assert(G.isPacked(s, soccer.id, soccer.items[0].id, sat));
assert.equal(G.togglePacked(s, soccer.id, soccer.items[0].id, sat), false, "tap again takes it out");
soccer.items.forEach((i) => G.togglePacked(s, soccer.id, i.id, sat));
sm = G.summary(s, soccer.id, sat);
assert(sm.allPacked); assert.equal(sm.missing.length, 0);
assert(!G.isPacked(s, soccer.id, soccer.items[0].id, sun), "a new day starts with an empty bag");
assert.equal(G.summary(s, soccer.id, sun).packed, 0);
assert(G.summary(s, soccer.id, sat).packed === 0, "and yesterday's marks are gone");
assert.equal(G.summary(s, custom.id, sat).allPacked, false, "an empty bag is never all packed");
assert.equal(G.togglePacked(s, soccer.id, "nope", sat), false);

// Worn out, too small, lost
const cleats = soccer.items.find((i) => i.name === "Cleats");
const guards = soccer.items.find((i) => i.name === "Shin guards");
const ball = soccer.items.find((i) => i.name === "Soccer ball");
G.togglePacked(s, soccer.id, cleats.id, sat);
G.togglePacked(s, soccer.id, ball.id, sat);
assert(G.setStatus(s, soccer.id, cleats.id, "small", "toes hurt", sat));
assert.equal(cleats.note, "toes hurt"); assert.equal(cleats.statusDay, "2026-11-21");
sm = G.summary(s, soccer.id, sat);
assert.deepEqual(sm.flagged.map((i) => i.name), ["Cleats"], "too-small cleats still went in the bag but are flagged");
G.setStatus(s, soccer.id, ball.id, "lost", "", sat);
assert(!G.isPacked(s, soccer.id, ball.id, sat), "a lost item comes out of the bag");
G.setStatus(s, soccer.id, guards.id, "worn", "strap broke", sat);
assert(!G.setStatus(s, soccer.id, guards.id, "eaten", "", sat), "unknown status refused");

const att = G.attention(s);
assert.deepEqual(att.map((a) => a.item.status), ["lost", "worn", "small"], "lost first");
assert.equal(att[0].kid.name, "Ava");
assert.equal(att[0].bag.name, "Soccer");

// Finding a lost item: pack it and it's no longer lost
assert.equal(G.togglePacked(s, soccer.id, ball.id, sat), true);
assert.equal(ball.status, "ok");
assert.equal(G.attention(s).length, 2);
G.setStatus(s, soccer.id, cleats.id, "ok", "ignored", sat);
assert.equal(cleats.note, ""); assert.equal(cleats.statusDay, "");
assert.equal(G.attention(s).length, 1);

// Finishing records what was missing
G.startOver(s, soccer.id, sat);
assert.equal(G.summary(s, soccer.id, sat).packed, 0);
G.togglePacked(s, soccer.id, cleats.id, sat);
const e = G.finishCheck(s, soccer.id, sat);
assert.equal(e.packed, 1); assert.equal(e.total, 9); assert.equal(e.missing.length, 8);
assert.equal(s.log[0], e);

// Editing items
const goggles = G.addItem(custom, { emoji: "🥽", name: "Goggles", cat: "nonsense", count: 40 });
assert.equal(goggles.cat, "gear"); assert.equal(goggles.count, 9);
G.addItem(custom, { name: "Towel", count: 0 });
assert.equal(custom.items[1].count, 1);
assert(G.moveItem(custom, custom.items[1].id, -1));
assert.equal(custom.items[0].name, "Towel");
assert(!G.moveItem(custom, custom.items[0].id, -1), "can't move past the top");
G.togglePacked(s, custom.id, goggles.id, sat);
G.removeItem(s, custom.id, goggles.id);
assert.equal(custom.items.length, 1);
assert.equal(G.currentCheck(s, custom.id, sat).packed.length, 0, "removed item leaves the check too");

// Backup and restore
const copy = G.normalize(JSON.parse(JSON.stringify(s)));
assert.equal(copy.kids.length, 2); assert.equal(copy.bags.length, 3);
assert.equal(copy.bags[0].items.find((i) => i.name === "Shin guards").status, "worn");
assert.deepEqual(copy.checks[soccer.id].packed, [cleats.id]);
assert.equal(copy.log.length, 1);
assert.throws(() => G.normalize({ hello: 1 }), /isn't a Gear Bag Check backup/);
assert.throws(() => G.normalize(null));
const messy = G.normalize({ kids: [{ id: "x", name: "", color: "red" }], bags: [{ id: "b", kidId: "ghost", items: [] },
  { id: "c", kidId: "x", days: [1, 9, "2"], items: [{ id: "i", status: "melted", count: -3 }] }], checks: { gone: { day: "x", packed: [] } } });
assert.equal(messy.kids[0].name, "Player"); assert.equal(messy.kids[0].color, G.COLORS[0]);
assert.equal(messy.bags.length, 1, "bag for a missing kid dropped");
assert.deepEqual(messy.bags[0].days, [1]);
assert.equal(messy.bags[0].items[0].status, "ok"); assert.equal(messy.bags[0].items[0].count, 1);
assert.deepEqual(Object.keys(messy.checks), []);

// Copying a bag to a brother or sister: same list, their own good gear
const dup = G.copyBag(s, soccer.id, ben.id);
assert.equal(dup.kidId, ben.id); assert.equal(dup.items.length, soccer.items.length);
assert.deepEqual(dup.days, soccer.days); assert.notEqual(dup.days, soccer.days);
assert(dup.items.every((i) => i.status === "ok"));
assert.notEqual(dup.items[0].id, soccer.items[0].id);
assert.equal(G.copyBag(s, soccer.id, "ghost"), null);
G.removeBag(s, dup.id);

// Hair kit and styles
assert(G.CAT_KEYS.includes("hair"));
assert.equal(ava.theme, "field");
const hairBag = G.addBag(s, ben.id, "basketball"); // already has hair ties
assert.equal(G.addKit(hairBag, G.HAIR_KIT), 2, "hair ties not added twice");
assert.deepEqual(hairBag.items.filter((i) => i.cat === "hair").map((i) => i.name), ["Hair ties", "Hair gel", "Slick-back brush"]);
assert.equal(G.addKit(hairBag, G.HAIR_KIT), 0, "second tap adds nothing");
const oldBag = G.addBag(s, ben.id, { name: "Old" }); G.addItem(oldBag, { name: "Hair tie", cat: "uniform" });
assert.equal(G.addKit(oldBag, G.HAIR_KIT), 2, "an old 'Hair tie' counts as hair ties");
G.removeBag(s, hairBag.id); G.removeBag(s, oldBag.id);
ava.theme = "berry";
assert.equal(G.normalize(JSON.parse(JSON.stringify(s))).kids[0].theme, "berry");
assert.equal(G.normalize({ kids: [{ id: "x", theme: "neon" }], bags: [] }).kids[0].theme, "field");
assert.equal(G.normalize({ kids: [{ id: "x" }], bags: [{ id: "b", kidId: "x", items: [{ id: "i", cat: "hair" }] }] }).bags[0].items[0].cat, "hair");

// Schedule
assert.deepEqual(s.events, []);
const ev = G.addEvent(s, ava.id, { date: "2026-11-24", time: "17:30", title: "", bagId: soccer.id, note: "Field 3" });
assert.equal(ev.length, 1); assert.equal(ev[0].title, "Soccer", "title defaults to the bag's name");
assert.equal(G.time12("17:30"), "5:30 PM"); assert.equal(G.time12("00:05"), "12:05 AM"); assert.equal(G.time12("12:00"), "12:00 PM"); assert.equal(G.time12("25:00"), "");
const games = G.addEvent(s, ava.id, { date: "2026-11-28", time: "09:00", title: "Game", bagId: soccer.id }, 4);
assert.deepEqual(games.map((e) => e.date), ["2026-11-28", "2026-12-05", "2026-12-12", "2026-12-19"]);
assert.equal(G.addEvent(s, ava.id, { date: "2026-02-30", title: "x" }).length, 0, "not a real date");
assert.equal(G.addEvent(s, ava.id, { date: "2026-11-24", title: "" }).length, 0, "needs a title or a bag");
assert.equal(G.addEvent(s, ava.id, { date: "2026-12-01", title: "Long", bagId: hoops.id })[0].bagId, "", "can't use another player's bag");
const big = G.addEvent(s, ava.id, { date: "2026-11-24", title: "Big", }, 99);
assert.equal(big.length, G.MAX_REPEAT);
assert.equal(G.removeEvent(s, big[1].id, true), G.MAX_REPEAT - 1, "removing from week 2 on keeps week 1");
const tue = new Date(2026, 10, 24, 7);
G.addEvent(s, ava.id, { date: "2026-11-24", title: "Team photo", time: "07:45" });
assert.deepEqual(G.eventsOn(s, ava.id, "2026-11-24").map((e) => e.title), ["Team photo", "Soccer", "Big"], "sorted by time, no-time last");
soccer.days = [];
assert.deepEqual(G.bagsToday(s, ava.id, tue).map((b) => b.id), [soccer.id], "a scheduled practice makes the bag Today");
assert.deepEqual(G.bagsToday(s, ava.id, new Date(2026, 10, 25, 7)), []);
assert.deepEqual(G.upcoming(s, ava.id, new Date(2026, 11, 6), 2).map((e) => e.date), ["2026-12-12", "2026-12-19"]);
assert(G.updateEvent(s, games[1].id, { date: "2026-12-06", time: "10:00", title: "Tournament", bagId: soccer.id, note: "" }));
assert.equal(games[1].date, "2026-12-06");
assert(!G.updateEvent(s, games[1].id, { date: "nope", title: "x" }));
assert.equal(G.removeEvent(s, games[2].id, true), 2, "this and later repeats");
assert.equal(s.events.filter((e) => e.group === games[0].group).length, 2);
assert.equal(G.removeEvent(s, games[0].id), 1);
const grid = G.monthGrid(2026, 10); // November 2026 starts on a Sunday
assert.equal(grid[0], "2026-11-01"); assert.equal(grid.length, 30);
assert.equal(G.monthGrid(2026, 11)[2], "2026-12-01", "December 2026 starts on a Tuesday");
assert.equal(G.addDays("2026-03-07", 1), "2026-03-08");
const back = G.normalize(JSON.parse(JSON.stringify(s)));
assert.equal(back.events.length, s.events.length);
assert.equal(G.normalize({ kids: [], bags: [], events: [{ id: "e", kidId: "ghost", date: "2026-11-24", title: "x" }] }).events.length, 0);

// Wording and custom colors
assert.equal(ava.plain, false);
ava.plain = true; ava.theme = "custom"; ava.custom = { bg: "#121212", accent: "#E3B341", accent2: "#E8E3D6" };
const kept = G.normalize(JSON.parse(JSON.stringify(s))).kids[0];
assert.equal(kept.plain, true); assert.equal(kept.theme, "custom"); assert.equal(kept.custom.accent, "#E3B341");
assert.equal(G.normalize({ kids: [{ id: "x", custom: { bg: "red" } }], bags: [] }).kids[0].custom.bg, G.PALETTES[0][1]);
G.PALETTES.forEach(([name, bg, a, a2]) => {
  const t = G.customTokens({ bg, accent: a, accent2: a2 });
  assert(G.contrast(t["--ink"], t["--bg"]) >= 7, name + ": text readable on the background");
  assert(G.contrast(t["--ink"], t["--card"]) >= 7, name + ": text readable on cards");
  assert(G.contrast(t["--on-field"], a) >= 2.5, name + ": button text readable");
});
assert.equal(G.customTokens({ bg: "#FFFFFF", accent: "#FFEB3B", accent2: "#000000" })["--on-field"], "#141218", "dark text on a yellow button");
assert.equal(G.customTokens({ bg: "#000000", accent: "#1A237E", accent2: "#FFFFFF" }).dark, true);

// Removing a kid removes their bags
G.removeKid(s, ava.id);
assert.equal(s.kids.length, 1); assert.equal(s.bags.length, 1);
assert(!s.checks[soccer.id]);

console.log("gear-bag-check: all tests passed");
