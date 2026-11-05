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
assert.equal(S.renamePlace("RV Rear Bay › Left", "RV Rear Bay", "RV › Rear bay"), "RV › Rear bay › Left");
assert.equal(S.renamePlace("Garage", "RV Rear Bay", "RV › Rear bay"), "Garage");
assert.deepEqual(S.search("shelf 2", [{ name: "Oil", code: "HS-01", location: "Hangar › Shelf 2", items: [] }])[0].reasons, ["Location: Hangar › Shelf 2"]);
// Trip checklist
const trip = [{ id: "A", trip: true, items: ["Sewer hose", "Gloves"] }, { id: "B", trip: true, items: [] }, { id: "C", trip: false, items: ["Drill"] }];
assert.deepEqual(S.tripKeys(trip[0]), ["A|Sewer hose", "A|Gloves"]); assert.deepEqual(S.tripKeys(trip[1]), ["B"]);
assert.deepEqual(S.tripProgress(trip, ["A|Gloves", "B", "C|Drill"]), { total: 3, done: 2 });
console.log("search tests: all passed (same cases as the native app)");
