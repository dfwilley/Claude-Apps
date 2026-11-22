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

// Removing a kid removes their bags
G.removeKid(s, ava.id);
assert.equal(s.kids.length, 1); assert.equal(s.bags.length, 1);
assert(!s.checks[soccer.id]);

console.log("gear-bag-check: all tests passed");
