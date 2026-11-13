const S = require(process.argv[2] || require("path").join(__dirname, "../bin-finder/search.js")); const assert = require("assert");
const bins = [
  { name: "Electrical spares", location: "Garage", code: "G-01", items: ["Fuses (ATC)", "Zip ties", "Electrical tape"] },
  { name: "Drill and bits", location: "Garage", code: "G-02", items: ["Cordless drill", "Step bits"] },
  { name: "Sewer and water", location: "RV Rear Bay", code: "RR-01", items: ["Sewer hose", "Water pressure regulator"], autoWords: ["camco", "hose"] },
  { name: "Batteries", location: "Hangar", code: "H-03", items: ["AA batteries", "CR2032"], notes: "Check the ELT battery date" },
];
let h = S.search("spare fuses", bins); assert.equal(h[0].bin.code, "G-01"); assert.equal(h.length, 1); assert(h[0].reasons.includes("Item: Fuses (ATC)"));
assert.equal(S.search("BATTERY", bins)[0].bin.code, "H-03");
assert.equal(S.search("bit", bins)[0].bin.code, "G-02");
for (const [a, b] of [["boxes", "box"], ["glasses", "glass"], ["batteries", "battery"], ["ties", "tie"], ["fuses", "fus"]]) assert.equal(S.stem(a), b);
h = S.search("camco", bins); assert.equal(h[0].bin.code, "RR-01"); assert.deepEqual(h[0].reasons, ["Seen in photo: camco"]);
assert.deepEqual(S.search("garage drill", bins).map((x) => x.bin.code), ["G-02"]);
assert.equal(S.search("rr-01", bins)[0].bin.code, "RR-01");
assert.equal(S.search("ELT", bins)[0].bin.code, "H-03");
assert.equal(S.search("snowboard", bins).length, 0); assert.equal(S.search("   ", bins).length, 0);
assert.equal(S.codePrefix("Garage"), "G"); assert.equal(S.codePrefix("RV Rear Bay"), "RR"); assert.equal(S.codePrefix(""), "B");
assert.equal(S.nextCode("Garage", bins), "G-03"); assert.equal(S.nextCode("Shed", bins), "S-01");
assert.deepEqual(S.photoWords("LEVELERS  www.camco.com  lll 1234 Aeroshell 15W-50 nnm"), ["levelers", "camco", "aeroshell"]);
assert.match(S.isoNow(new Date("2026-10-31T10:00:00.123Z")), /^2026-10-31T10:00:00Z$/);
// Singular and plural find each other
const power = [{ name: "Power", location: "Garage", code: "G-09", items: ["AA batteries", "Hose clamps", "Paint brushes"] }];
for (const q of ["battery", "batteries", "aa battery", "clamp", "hose clamps", "brush", "brushes"]) assert.equal(S.search(q, power).length, 1, q);
assert.equal(S.search("butter", power).length, 0);
// Bin or box, and the list of all items
assert.equal(S.kindOf({}), "bin"); assert.equal(S.kindOf({ kind: "box" }), "box"); assert.equal(S.kindOf({ kind: "crate" }), "bin");
assert.equal(S.kindOf({ kind: "none" }), "none"); assert.equal(S.kindWord({ kind: "none" }), ""); assert.equal(S.kindLabel({ kind: "none" }), "None"); assert.equal(S.kindLabel({}), "Bin (plastic)");
assert.equal(S.displayName({ name: "", code: "H-01", kind: "none" }), "H-01"); assert.equal(S.displayName({ name: "Shelf 1", code: "H-01", kind: "none" }), "Shelf 1");
assert.equal(S.displayName({ name: " ", code: "G-07", kind: "box" }), "Box G-07"); assert.equal(S.displayName({ name: "", code: "G-08" }), "Bin G-08");
assert.deepEqual(S.allItems(bins.slice(0, 2)).map((x) => [x.item, x.bin.code]),
  [["Cordless drill", "G-02"], ["Electrical tape", "G-01"], ["Fuses (ATC)", "G-01"], ["Step bits", "G-02"], ["Zip ties", "G-01"]]);
assert.deepEqual(S.allItems([{ name: "B", code: "B-02", items: ["tape", " "] }, { name: "A", code: "B-01", items: ["Tape", "10 mm socket", "9 mm socket"] }]).map((x) => [x.item, x.bin.code]),
  [["9 mm socket", "B-01"], ["10 mm socket", "B-01"], ["Tape", "B-01"], ["tape", "B-02"]]);
// Bins and boxes inside other bins and boxes
{
  const shelf = { id: "A1", name: "Shelf 1", code: "H-01", location: "Hangar", items: [] };
  const kit = { id: "b2", name: "Cowl Louver Kit", kind: "box", code: "H-02", location: "Hangar", items: ["Louvers", "Rivets"], inside: "a1" };
  const bag = { id: "c3", name: "Hardware bag", code: "H-03", items: ["Screws"], inside: "B2" };
  const lost = { id: "d4", name: "Orphan", code: "H-04", items: [], inside: "gone" };
  const self = { id: "e5", name: "Self", code: "H-05", items: [], inside: "e5" };
  const all = [shelf, kit, bag, lost, self];
  assert.equal(S.holderOf(kit, all), shelf); assert.equal(S.holderOf(bag, all), kit);
  assert.equal(S.holderOf(shelf, all), null); assert.equal(S.holderOf(lost, all), null); assert.equal(S.holderOf(self, all), null);
  assert.deepEqual(S.heldBy(shelf, all).map((b) => b.name), ["Cowl Louver Kit"]); assert.deepEqual(S.heldBy(bag, all), []);
  assert.equal(S.canHold(shelf, lost, all), true); assert.equal(S.canHold(bag, lost, all), true);
  assert.equal(S.canHold(shelf, shelf, all), false);   // not inside itself
  assert.equal(S.canHold(kit, shelf, all), false);     // the shelf can't go in a box that's on the shelf
  assert.equal(S.canHold(bag, shelf, all), false);     // ...or in a bag that's in that box
  assert.deepEqual(S.search("rivets", all)[0].reasons, ["Item: Rivets", "In Shelf 1"]);
  assert.deepEqual(S.search("screws", all)[0].reasons, ["Item: Screws", "In Cowl Louver Kit"]);
  assert.deepEqual(S.search("shelf 1", all).map((h) => h.bin.name), ["Shelf 1"]);
}
// Spoken searches
assert.deepEqual(S.terms("Where's my spare fuses?"), ["spare", "fus"]);
assert.equal(S.search("where did I put the drill bits", bins)[0].bin.code, "G-02");
assert.equal(S.search("Where's the sewer hose.", bins)[0].bin.code, "RR-01");
// Places inside places
assert.deepEqual(S.placeParts("Hangar > Shelf 2 /  Left"), ["Hangar", "Shelf 2", "Left"]);
assert.equal(S.tidyPlace(" RV/front bay "), "RV › front bay");
assert(S.isUnder("Hangar › Shelf 2", "hangar")); assert(!S.isUnder("Hangar Annex", "Hangar")); assert(!S.isUnder("Hangar", "Hangar › Shelf 2"));
assert.equal(S.codePrefix("Hangar › Shelf 2"), "HS"); assert.equal(S.codePrefix("RV / Rear bay"), "RR");
const nested = [{ location: "Hangar › Shelf 1" }, { location: "Hangar › Shelf 2 › Left" }, { location: "Hangar › Shelf 2" }, { location: "Garage" }, { location: "" }];
assert.deepEqual(S.allPlaces(nested), ["Garage", "Hangar", "Hangar › Shelf 1", "Hangar › Shelf 2", "Hangar › Shelf 2 › Left"]);
assert.deepEqual(S.childPlaces("", nested).map((c) => [c.name, c.count]), [["Garage", 1], ["Hangar", 3]]);
assert.deepEqual(S.childPlaces("Hangar", nested).map((c) => [c.place, c.count]), [["Hangar › Shelf 1", 1], ["Hangar › Shelf 2", 2]]);
assert.equal(S.placeBelow("Hangar › Shelf 2 › Left", "Hangar"), "Shelf 2 › Left");
// Location pull-downs on the main list
assert.deepEqual(S.placeLevels("", nested).map((l) => [l.parent, l.selected, l.choices.length]), [["", "", 2]]);
assert.deepEqual(S.placeLevels("hangar", nested).map((l) => [l.parent, l.name, l.selected, l.choices.length]), [["", "", "Hangar", 2], ["hangar", "hangar", "", 2]]);
assert.deepEqual(S.placeLevels("Hangar › Shelf 2", nested).map((l) => [l.selected, l.choices.map((c) => c.name).join()]), [["Hangar", "Garage,Hangar"], ["Hangar › Shelf 2", "Shelf 1,Shelf 2"], ["", "Left"]]);
assert.deepEqual(S.placeLevels("Garage", nested).map((l) => l.selected), ["Garage"]);
assert.equal(S.nearestPlace("hangar › shelf 2 › Right", nested), "Hangar › Shelf 2"); assert.equal(S.nearestPlace("Shed › Top", nested), ""); assert.equal(S.nearestPlace("", nested), "");
assert.equal(S.renamePlace("RV Rear Bay › Left", "RV Rear Bay", "RV › Rear bay"), "RV › Rear bay › Left");
assert.equal(S.renamePlace("Garage", "RV Rear Bay", "RV › Rear bay"), "Garage");
assert.deepEqual(S.search("shelf 2", [{ name: "Oil", code: "HS-01", location: "Hangar › Shelf 2", items: [] }])[0].reasons, ["Location: Hangar › Shelf 2"]);
// Trip checklist
const trip = [{ id: "A", trip: true, items: ["Sewer hose", "Gloves"] }, { id: "B", trip: true, items: [] }, { id: "C", trip: false, items: ["Drill"] }];
assert.deepEqual(S.tripKeys(trip[0]), ["A|Sewer hose", "A|Gloves"]); assert.deepEqual(S.tripKeys(trip[1]), ["B"]);
assert.deepEqual(S.tripProgress(trip, ["A|Gloves", "B", "C|Drill"]), { total: 3, done: 2 });
console.log("search tests: all passed (same cases as the native app)");
