// Tests the route math, query building and stop sorting of Who Was Here. Run: node tests/who-was-here.test.js
const W = require(require("path").join(__dirname, "../who-was-here/core.js"));
const assert = require("assert");
const near = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

const KTUS = [32.1161, -110.941], KPHX = [33.4343, -112.0116], KLAX = [33.9425, -118.4081];

// Distances: Tucson–Phoenix airports ≈ 108 statute miles great-circle
near(W.kmToMi(W.haversine(KTUS, KPHX)), 108, 3, "TUS-PHX miles");
near(W.kmToMi(W.haversine(KPHX, KLAX)), 370, 5, "PHX-LAX miles");

// Great-circle path: ends where it should and is about the same length as the direct distance
const gc = W.greatCirclePath([KTUS, KPHX, KLAX], 20);
assert.deepEqual(gc[0], KTUS); assert.deepEqual(gc[gc.length - 1], KLAX);
near(W.pathLengthKm(gc), W.haversine(KTUS, KPHX) + W.haversine(KPHX, KLAX), 0.5, "path length");

// Samples every ~24 km including both ends
const s = W.samplePath(gc, 24);
assert.deepEqual(s[0], KTUS); assert.deepEqual(s[s.length - 1], KLAX);
for (let i = 1; i < s.length - 1; i++) { const d = W.haversine(s[i - 1], s[i]); assert(d <= 24.6 && d > 15, "sample spacing " + i + " " + d); } // shorter only across the PHX corner

// Distance from a point to the route: Casa Grande is ~5–15 mi west of the straight TUS–PHX line
const casaGrande = [32.8795, -111.7574];
const dCG = W.distanceToPath(casaGrande, W.greatCirclePath([KTUS, KPHX]));
assert(W.kmToMi(dCG.off) > 3 && W.kmToMi(dCG.off) < 20, "Casa Grande off-route " + W.kmToMi(dCG.off));
assert(W.kmToMi(dCG.along) > 60 && W.kmToMi(dCG.along) < 90, "Casa Grande along " + W.kmToMi(dCG.along));
// A point on the route is ~0 off
near(W.distanceToPath(gc[10], gc).off, 0, 0.05, "on route");
// A point straight up the line from the start: along ≈ 0
near(W.distanceToPath(KTUS, gc).along, 0, 0.01, "start along");

// Search plan covers the corridor: every point within the corridor is inside some query circle
const plan = W.searchPlan(gc, 10);
const corridorKm = 10 * W.KM_PER_MI;
for (let i = 0; i < 200; i++) {
  const base = gc[Math.floor(Math.random() * gc.length)];
  const off = (Math.random() * 2 - 1) * corridorKm * 0.99;
  const test = [base[0] + off / 111.2, base[1]]; // north/south offset; route runs mostly east-west after PHX
  if (W.distanceToPath(test, gc).off > corridorKm) continue;
  const inside = plan.points.some((p) => W.haversine(p, test) <= plan.radiusKm);
  assert(inside, "corridor point not covered " + test);
}
assert(plan.points.length < 40, "plan points " + plan.points.length);
// Very long route gets capped
const longPlan = W.searchPlan(W.greatCirclePath([KLAX, [40.6413, -73.7781]]), 5, 100);
assert(longPlan.points.length <= 101 && longPlan.thinned);

// Parsing
assert.deepEqual(W.parsePoint("Point(-110.97 32.22)"), [32.22, -110.97]);
assert.equal(W.parsePoint("nonsense"), null);
assert.deepEqual(W.parseLatLon(" 32.1, -110.9 "), [32.1, -110.9]);
assert.equal(W.parseLatLon("Tucson"), null);
assert.equal(W.parseLatLon("95, 10"), null);
assert.equal(W.year("+1903-12-17T00:00:00Z"), 1903);
assert.equal(W.year("-0044-03-15T00:00:00Z"), -44);
assert.equal(W.year("1903-12-17T00:00:00Z"), 1903); // the form the query service actually returns
assert.equal(W.yearText(-44), "44 BC");

// Queries contain the right center (lon lat order), radius and fame filter, and are balanced
const q = W.peopleQuery(KTUS, 20, 30);
assert(q.includes('"Point(-110.94100 32.11610)"^^geo:wktLiteral'));
assert(q.includes('wikibase:radius "20.0"') && q.includes(">= 30"));
const pq = W.placesQuery(KTUS, 20, 8);
for (const t of [q, pq, ...W.airportQueries("ktus")]) {
  assert.equal((t.match(/{/g) || []).length, (t.match(/}/g) || []).length, "braces balanced");
  assert.equal((t.match(/\(/g) || []).length, (t.match(/\)/g) || []).length, "parens balanced");
}
assert(W.airportQueries(" k-tus ")[0].includes('wdt:P239 "KTUS"') && W.airportQueries("E60")[1].includes('wdt:P240 "E60"'));
assert(q.includes('"en,mul,') && pq.includes("P1082"), "shared-language names and no towns");

// Classification of places
const cls = (label, description, types, extra = {}) => W.classifyPlace({ label, description, types, ...extra });
assert.deepEqual(cls("Battle of Picacho Pass", "American Civil War battle in Arizona", ["battle"], { hasDate: true }), ["event"]);
assert(cls("Pima Air & Space Museum", "aerospace museum in Tucson, Arizona", ["aviation museum"]).includes("aviation"));
assert(cls("Pima Air & Space Museum", "aerospace museum in Tucson, Arizona", ["aviation museum"]).includes("landmark"));
assert(cls("Davis–Monthan Air Force Base", "United States Air Force base in Tucson, Arizona", ["military air base"]).includes("aviation"));
assert.deepEqual(cls("Mission San Xavier del Bac", "Spanish Catholic mission near Tucson", ["mission church"], { heritage: true }), ["landmark"]);
assert.deepEqual(cls("Tucson International Airport", "airport in Tucson, Arizona", ["international airport"]), []);
assert.deepEqual(cls("Casa Grande", "city in Pinal County, Arizona, United States", ["city of the United States"]), []);
assert.deepEqual(cls("Santa Cruz River", "river in Arizona", ["river"]), []);
assert.deepEqual(cls("University of Arizona", "public university in Tucson", ["public university"]), []);
assert(cls("Marksburg", "castle in Braubach, Germany", ["castle"], { heritage: true }).includes("landmark"));
assert.deepEqual(cls("Liestal", "town in, and capital of, the Swiss canton of Basel-Country", ["municipality of Switzerland", "cantonal capital of Switzerland"], { heritage: true }), [], "heritage town is not a stop");
assert(cls("2011 Tucson shooting", "Casas Adobes Safeway shooting", ["mass shooting"]).includes("event"));
assert.deepEqual(cls("Silingi", "historical ethnical group of Germania", ["historical ethnic group"]), []);
assert(cls("Augusta Raurica", "archaeological site and former Roman colony town", ["archaeological site", "Roman city"], { heritage: true }).includes("landmark"));
assert(cls("Air France Flight 296", "aviation accident at Habsheim air show", ["aviation accident"]).includes("aviation"));
assert(cls("Lorelei", "rock on the Rhine", ["rock formation"], { heritage: true }).includes("landmark"), "heritage counts");
assert(cls("USS Arizona Memorial", "memorial at Pearl Harbor", ["memorial"]).includes("aviation"));
assert(cls("1943 Rhine crash", "aviation accident", ["aviation accident"], { hasDate: true }).includes("event"));

// People
assert.deepEqual(W.classifyPerson({ description: "American singer" }), ["people"]);
assert.deepEqual(W.classifyPerson({ description: "American aviator" }), ["people", "aviation"]);
assert.deepEqual(W.classifyPerson({ description: "American politician", navy: true }), ["people", "aviation"]);

// Merging raw rows: person with two connected places keeps both; closest one wins; roles combine
const cell = (value) => ({ value });
const rows = [
  { person: cell("http://www.wikidata.org/entity/Q1"), personLabel: cell("Jane Pilot"), personDescription: cell("American aviator"),
    place: cell("http://www.wikidata.org/entity/Q10"), placeLabel: cell("Casa Grande"), coord: cell("Point(-111.7574 32.8795)"),
    role: cell("born"), links: cell("45"), born: cell("+1901-05-01T00:00:00Z"), died: cell("+1980-01-01T00:00:00Z"),
    aviator: cell("true"), navy: cell("false"), article: cell("https://en.wikipedia.org/wiki/Jane_Pilot") },
  { person: cell("http://www.wikidata.org/entity/Q1"), personLabel: cell("Jane Pilot"), personDescription: cell("American aviator"),
    place: cell("http://www.wikidata.org/entity/Q10"), placeLabel: cell("Casa Grande"), coord: cell("Point(-111.7574 32.8795)"),
    role: cell("buried"), links: cell("45"), aviator: cell("true"), navy: cell("false") },
  { person: cell("http://www.wikidata.org/entity/Q1"), personLabel: cell("Jane Pilot"), personDescription: cell("American aviator"),
    place: cell("http://www.wikidata.org/entity/Q11"), placeLabel: cell("Denver"), coord: cell("Point(-104.99 39.74)"),
    role: cell("died"), links: cell("45"), aviator: cell("true"), navy: cell("false") },
  { person: cell("http://www.wikidata.org/entity/Q2"), personLabel: cell("Q2"), personDescription: cell(""),
    place: cell("http://www.wikidata.org/entity/Q10"), placeLabel: cell("Casa Grande"), coord: cell("Point(-111.7574 32.8795)"),
    role: cell("born"), links: cell("45") },
];
const pm = W.mergePeopleRows(rows, new Map());
assert.equal(pm.get("Q1").places.length, 3);
const placeRows = [
  { item: cell("http://www.wikidata.org/entity/Q20"), itemLabel: cell("Battle of Picacho Pass"), itemDescription: cell("American Civil War battle"),
    coord: cell("Point(-111.40 32.64)"), links: cell("12"), typeLabel: cell("battle"), date: cell("+1862-04-15T00:00:00Z") },
  { item: cell("http://www.wikidata.org/entity/Q20"), itemLabel: cell("Battle of Picacho Pass"), itemDescription: cell("American Civil War battle"),
    coord: cell("Point(-111.40 32.64)"), links: cell("12"), typeLabel: cell("conflict") },
  { item: cell("http://www.wikidata.org/entity/Q21"), itemLabel: cell("Far Away Castle"), itemDescription: cell("castle"),
    coord: cell("Point(-100 40)"), links: cell("50"), typeLabel: cell("castle") },
];
const plm = W.mergePlaceRows(placeRows, new Map());
assert.deepEqual(plm.get("Q20").types, ["battle", "conflict"]);
assert.equal(plm.get("Q20").year, 1862);

const route = W.greatCirclePath([KTUS, KPHX]);
let stops = W.buildStops(pm, plm, route, 25, ["people", "event", "landmark", "aviation"]);
assert.deepEqual(stops.map((x) => x.name).sort(), ["Battle of Picacho Pass", "Jane Pilot"], "far castle and unnamed person dropped");
const jane = stops.find((x) => x.name === "Jane Pilot");
assert.equal(jane.placeName, "Casa Grande");
assert.deepEqual(jane.roles, ["born", "buried"]);
assert.equal(W.rolesText(jane.roles, jane.placeName), "Born and buried in Casa Grande");
assert.equal(W.lifeText(jane), "1901–1980");
assert.equal(W.lifeText({ born: 1946 }), "born 1946");
assert.equal(W.lifeText({ died: 1918 }), "?–1918");
// Only aviation wanted: Jane stays (aviator), battle goes
stops = W.buildStops(pm, plm, route, 25, ["aviation"]);
assert.deepEqual(stops.map((x) => x.name), ["Jane Pilot"]);
// Narrow corridor drops Casa Grande (it's several miles off the line)
assert.equal(W.buildStops(pm, plm, route, 2, ["people"]).length, 0);

// Sorting
const fake = [{ name: "a", offKm: 5, alongKm: 50, links: 10 }, { name: "b", offKm: 1, alongKm: 90, links: 5 }, { name: "c", offKm: 3, alongKm: 10, links: 99 }];
assert.deepEqual(W.sortStops(fake, "off").map((x) => x.name), ["b", "c", "a"]);
assert.deepEqual(W.sortStops(fake, "along").map((x) => x.name), ["c", "a", "b"]);
assert.deepEqual(W.sortStops(fake, "fame").map((x) => x.name), ["c", "a", "b"]);
assert.equal(W.miText(0.05), "on the route");
assert.equal(W.miText(W.KM_PER_MI * 3.24), "3.2 mi off route");

const txt = W.shareText({ name: "Tucson to Phoenix" }, W.buildStops(pm, plm, route, 25, ["people"]));
assert(txt.startsWith("Who Was Here: Tucson to Phoenix") && txt.includes("Born and buried in Casa Grande (1901–1980)") && txt.includes("wiki/Jane_Pilot"));

console.log("who-was-here: all tests passed");
