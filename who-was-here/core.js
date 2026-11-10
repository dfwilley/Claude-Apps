// Who Was Here: route math, Wikidata queries and sorting. No screen code here, so it can be tested with Node.
(function (root) {
  "use strict";
  const KM_PER_MI = 1.609344;
  const R_EARTH = 6371.0088; // km

  const rad = (d) => (d * Math.PI) / 180;
  const deg = (r) => (r * 180) / Math.PI;

  // Great-circle distance in km between [lat, lon] pairs.
  function haversine(a, b) {
    const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Point a fraction f of the way along the great circle from a to b.
  function interpolateGC(a, b, f) {
    const d = haversine(a, b) / R_EARTH;
    if (d < 1e-9) return [a[0], a[1]];
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const la1 = rad(a[0]), lo1 = rad(a[1]), la2 = rad(b[0]), lo2 = rad(b[1]);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    return [deg(Math.atan2(z, Math.sqrt(x * x + y * y))), deg(Math.atan2(y, x))];
  }

  // Flight or cruise legs: great-circle line through the points, with a point every ~stepKm.
  function greatCirclePath(points, stepKm = 20) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const n = Math.max(1, Math.ceil(haversine(a, b) / stepKm));
      for (let k = 0; k < n; k++) out.push(interpolateGC(a, b, k / n));
    }
    if (points.length) out.push([points[points.length - 1][0], points[points.length - 1][1]]);
    return out;
  }

  function pathLengthKm(path) {
    let t = 0;
    for (let i = 1; i < path.length; i++) t += haversine(path[i - 1], path[i]);
    return t;
  }

  // Evenly spaced sample points along the path (always includes both ends).
  function samplePath(path, spacingKm) {
    if (!path.length) return [];
    if (path.length === 1) return [path[0].slice()];
    const out = [path[0].slice()];
    let carry = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const seg = haversine(a, b);
      let pos = spacingKm - carry;
      while (pos <= seg) {
        out.push(interpolateGC(a, b, pos / seg));
        pos += spacingKm;
      }
      carry = seg - (pos - spacingKm);
    }
    const last = path[path.length - 1];
    if (haversine(out[out.length - 1], last) > 0.01) out.push(last.slice());
    return out;
  }

  // Shortest distance (km) from point p to the path, and how far along the path (km) that closest spot is.
  function distanceToPath(p, path) {
    if (path.length === 1) return { off: haversine(p, path[0]), along: 0 };
    let best = Infinity, bestAlong = 0, run = 0;
    const kx = (lat) => R_EARTH * rad(1) * Math.cos(rad(lat));
    const ky = R_EARTH * rad(1);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const segLen = haversine(a, b);
      // Flat projection around point p; good to well under 1% at corridor distances.
      const cx = kx(p[0]);
      let dLonA = a[1] - p[1], dLonB = b[1] - p[1];
      if (dLonA > 180) dLonA -= 360; if (dLonA < -180) dLonA += 360;
      if (dLonB > 180) dLonB -= 360; if (dLonB < -180) dLonB += 360;
      const ax = dLonA * cx, ay = (a[0] - p[0]) * ky, bx = dLonB * cx, by = (b[0] - p[0]) * ky;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let t = L2 ? -(ax * dx + ay * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + t * dx, qy = ay + t * dy;
      const d = Math.sqrt(qx * qx + qy * qy);
      if (d < best) { best = d; bestAlong = run + t * segLen; }
      run += segLen;
    }
    return { off: best, along: bestAlong };
  }

  // Leave out extra points closer than minKm to the last kept one (road routes have thousands).
  function thinPath(path, minKm = 0.3) {
    if (path.length < 3) return path.slice();
    const out = [path[0]];
    for (let i = 1; i < path.length - 1; i++) if (haversine(out[out.length - 1], path[i]) >= minKm) out.push(path[i]);
    out.push(path[path.length - 1]);
    return out;
  }

  // How each corridor width is searched. Any spot within r of the route is within r of some route point,
  // and every route point is within half a spacing of a search center, so circles of r + spacing/2 cover
  // the whole corridor, whatever the shape of the road.
  function searchPlan(path, corridorMi, maxPoints = 160) {
    const r = Math.max(1, corridorMi * KM_PER_MI);
    const radius = Math.min(r * 1.75, Math.max(60, r * 1.25));
    let spacing = 2 * (radius - r);
    let pts = samplePath(path, spacing);
    let thinned = false, radiusKm = radius;
    if (pts.length > maxPoints) {
      spacing = pathLengthKm(path) / (maxPoints - 1);
      pts = samplePath(path, spacing);
      radiusKm = Math.min(r + spacing / 2, 80);
      thinned = true;
    }
    return { points: pts, radiusKm, spacingKm: spacing, thinned };
  }

  // Fame levels: minimum number of Wikipedia language editions an item must have.
  const FAME = {
    famous: { people: 60, places: 20, label: "Only the most famous" },
    known: { people: 30, places: 8, label: "Well known" },
    local: { people: 12, places: 3, label: "Include local history" },
  };

  const pointLiteral = (p) => `"Point(${(+p[1]).toFixed(5)} ${(+p[0]).toFixed(5)})"^^geo:wktLiteral`;

  // People born, died, buried or who lived at a place within radiusKm of the point.
  function peopleQuery(p, radiusKm, minLinks, limit = 60) {
    return `SELECT ?person ?personLabel ?personDescription ?place ?placeLabel ?coord ?role ?links ?born ?died ?aviator ?navy ?article WHERE {
SERVICE wikibase:around { ?place wdt:P625 ?coord . bd:serviceParam wikibase:center ${pointLiteral(p)} ; wikibase:radius "${radiusKm.toFixed(1)}" . }
VALUES (?prop ?role) { (wdt:P19 "born") (wdt:P20 "died") (wdt:P119 "buried") (wdt:P551 "lived") }
?person ?prop ?place .
?person wdt:P31 wd:Q5 ; wikibase:sitelinks ?links .
FILTER(?links >= ${minLinks})
OPTIONAL { ?person wdt:P569 ?born . }
OPTIONAL { ?person wdt:P570 ?died . }
BIND(EXISTS { ?person wdt:P106 ?occ . FILTER(?occ IN (wd:Q2095549, wd:Q11631)) } AS ?aviator)
BIND(EXISTS { ?person wdt:P241 ?branch . FILTER(?branch IN (wd:Q11220, wd:Q172771)) } AS ?navy)
OPTIONAL { ?article schema:about ?person ; schema:isPartOf <https://en.wikipedia.org/> . }
SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,nl,es,no,it" . }
} ORDER BY DESC(?links) LIMIT ${limit}`;
  }

  // Things with a map location: landmarks, museums, battles, air bases...
  function placesQuery(p, radiusKm, minLinks, limit = 600) {
    return `SELECT ?item ?itemLabel ?itemDescription ?coord ?links ?typeLabel ?heritage ?date ?start ?article WHERE {
SERVICE wikibase:around { ?item wdt:P625 ?coord . bd:serviceParam wikibase:center ${pointLiteral(p)} ; wikibase:radius "${radiusKm.toFixed(1)}" . }
?item wikibase:sitelinks ?links .
FILTER(?links >= ${minLinks})
FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 . }
FILTER NOT EXISTS { ?item wdt:P1082 ?population . }
OPTIONAL { ?item wdt:P31 ?type . }
OPTIONAL { ?item wdt:P1435 ?heritage . }
OPTIONAL { ?item wdt:P585 ?date . }
OPTIONAL { ?item wdt:P580 ?start . }
OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,nl,es,no,it" . }
} LIMIT ${limit}`;
  }

  // Airports: one quick query per code system, tried in order ICAO (KTUS), FAA (E60), IATA (TUS).
  // (One combined query with UNION was very slow on the query service.)
  function airportQueries(code) {
    const c = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return ["P239", "P240", "P238"].map((prop) => `SELECT ?a ?aLabel ?coord WHERE { ?a wdt:${prop} "${c}" ; wdt:P625 ?coord . SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul" . } } LIMIT 1`);
  }

  // "Point(lon lat)" → [lat, lon]
  function parsePoint(s) {
    const m = /Point\(\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s*\)/.exec(s || "");
    return m ? [parseFloat(m[2]), parseFloat(m[1])] : null;
  }

  // Typed "32.12, -110.94" → [lat, lon]
  function parseLatLon(s) {
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s || "");
    if (!m) return null;
    const lat = +m[1], lon = +m[2];
    return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
  }

  const qid = (uri) => (uri || "").replace(/^.*\/(Q\d+)$/, "$1");
  const year = (iso) => {
    if (!iso) return null;
    const m = /^([+-]?)0*(\d+)-/.exec(iso);
    if (!m) return null;
    return m[1] === "-" ? -parseInt(m[2], 10) : parseInt(m[2], 10);
  };
  const yearText = (y) => (y == null ? "" : y < 0 ? `${-y} BC` : String(y));

  // ---- Sorting things into the four kinds of stops ----
  const AVIATION = /\b(air ?force|air base|airbase|air station|airfield|air field|aerodrome|naval|navy|aviation|aviator|aircraft|aeroplane|airplane|aerospace|air museum|flight museum|space ?(center|centre|museum|flight)|airship|zeppelin|boneyard|warship|battleship|aircraft carrier|submarine|destroyer|cruiser|frigate|shipwreck|naval battle|air crash|plane crash|air disaster|airliner|wright brothers|astronaut|test pilot|pilot|air raid|missile|rocket|seaplane|uss |hms )/i;
  const EVENT = /\b(battle|siege|massacre|skirmish|raid|shootout|gunfight|disaster|earthquake|eruption|flood|explosion|crash|accident|derailment|bombing|attack|treaty|riot|uprising|rebellion|revolt|assassination|incident|shooting|hurricane|tornado|shipwreck|sinking|fire of|great fire|armistice|surrender|ambush|duel|robbery|heist|strike of|first flight)\b/i;
  const LANDMARK = /\b(museum|historic|historical|history|monument|memorial|fort|fortress|presidio|mission|castle|palace|cathedral|basilica|abbey|monastery|convent|minster|ruins?|archaeological|landmark|birthplace|boyhood home|house museum|tomb|mausoleum|cemetery|graveyard|observatory|lighthouse|old town|old city|plantation|pueblo|cliff dwelling|amphitheat(re|er)|roman|castle ruin|citadel|bridge|world heritage|heritage site|national park|national monument|battlefield|estate|manor|chateau|château|schloss|stave church|church|synagogue|mosque|temple|shrine|statue|opera house|theat(re|er)|library|courthouse|capitol|state house|mine|ghost town|trading post|stage ?coach|railroad depot|station museum)\b/i;
  const SETTLEMENT = /\b(city|town|village|municipality|human settlement|commune|county|census-designated|borough|hamlet|unincorporated|neighbou?rhood|quarter|suburb|district|ortsteil|stadtteil|state|province|region|canton|country|island|river|lake|mountain|mountain range|hill|valley|bay|sea|ocean|stream|creek|desert|forest|road|highway|interstate|street|avenue|school|high school|university|college|company|business|enterprise|hotel|restaurant|shopping|store|hospital|stadium|arena|sports venue|golf|park and ride|bus station|railway station|train station|metro station|tram stop|tram system|airport)\b/i;
  // Never a place to stop, whatever their description says.
  const NOT_A_STOP = /\b(ethnic group|organi[sz]ation|tournament|song contest|supermarket|retail chain|tram system|bus system|road|highway|sports league|sports team|club)\b/i;

  // types: array of type labels; heritage: true if it has a protected-heritage status.
  function classifyPlace(it) {
    const desc = `${it.description || ""}`;
    const label = `${it.label || ""}`;
    const types = (it.types || []).join("; ");
    const all = `${label}; ${desc}; ${types}`;
    const kinds = [];
    if (NOT_A_STOP.test(types)) return [];
    const settlementOnly = SETTLEMENT.test(types) && !LANDMARK.test(types) && !EVENT.test(types) && !AVIATION.test(types);
    const plainAirport = /\bairport\b/i.test(`${types}; ${desc}`) && !/\b(historic|former|military|air force|naval|museum|base)\b/i.test(all);
    if (AVIATION.test(all) && !plainAirport) kinds.push("aviation");
    if (EVENT.test(all)) kinds.push("event");
    if ((it.heritage || LANDMARK.test(`${desc}; ${types}`)) && !plainAirport) kinds.push("landmark");
    if (settlementOnly) return []; // towns can carry heritage status too, but they aren't a "stop"
    return [...new Set(kinds)];
  }

  function classifyPerson(p) {
    const k = ["people"];
    if (p.aviator || p.navy || /\b(aviator|aviatrix|pilot|astronaut|cosmonaut|admiral|naval|navy|aircraft designer|aeronautical|aviation|flying ace|sailor|sea captain|commodore)\b/i.test(p.description || "")) k.push("aviation");
    return k;
  }

  const ROLE_WORDS = { born: "Born", died: "Died", buried: "Buried", lived: "Lived" };

  // Turn raw Wikidata rows into stops, merged by item, keyed by id. Existing map is updated in place.
  function mergePeopleRows(rows, map) {
    for (const r of rows) {
      const id = qid(v(r.person));
      if (!id) continue;
      const coord = parsePoint(v(r.coord));
      if (!coord) continue;
      const place = { name: v(r.placeLabel), coord, role: v(r.role), id: qid(v(r.place)) };
      let s = map.get(id);
      if (!s) {
        s = {
          id, type: "person", name: v(r.personLabel), description: v(r.personDescription),
          links: +v(r.links) || 0, born: year(v(r.born)), died: year(v(r.died)),
          aviator: v(r.aviator) === "true", navy: v(r.navy) === "true",
          article: v(r.article) || "", places: [],
        };
        map.set(id, s);
      }
      if (!s.places.some((q) => q.id === place.id && q.role === place.role)) s.places.push(place);
    }
    return map;
  }

  function mergePlaceRows(rows, map) {
    for (const r of rows) {
      const id = qid(v(r.item));
      if (!id) continue;
      const coord = parsePoint(v(r.coord));
      if (!coord) continue;
      let s = map.get(id);
      if (!s) {
        s = { id, type: "place", name: v(r.itemLabel), description: v(r.itemDescription), links: +v(r.links) || 0,
          coord, types: [], heritage: false, year: null, article: v(r.article) || "" };
        map.set(id, s);
      }
      const t = v(r.typeLabel);
      if (t && !/^Q\d+$/.test(t) && !s.types.includes(t)) s.types.push(t);
      if (v(r.heritage)) s.heritage = true;
      const y = year(v(r.date)) ?? year(v(r.start));
      if (y != null && s.year == null) s.year = y;
      if (!s.article && v(r.article)) s.article = v(r.article);
    }
    return map;
  }

  function v(cell) { return cell && cell.value != null ? cell.value : ""; }

  // Label is just the Q-number when an item has no name in any of our languages: not worth showing.
  const hasName = (s) => s.name && !/^Q\d+$/.test(s.name);

  // Final list: measure each stop against the route, keep those inside the corridor and of wanted kinds.
  function buildStops(peopleMap, placeMap, path, corridorMi, wanted) {
    const limitKm = corridorMi * KM_PER_MI;
    const out = [];
    for (const p of peopleMap.values()) {
      if (!hasName(p)) continue;
      let best = null;
      for (const pl of p.places) {
        const d = distanceToPath(pl.coord, path);
        if (!best || d.off < best.d.off) best = { pl, d };
      }
      if (!best || best.d.off > limitKm) continue;
      const kinds = classifyPerson(p);
      if (!kinds.some((k) => wanted.includes(k))) continue;
      // Every role at the closest place, e.g. "Born and buried in Tucson"
      const roles = p.places.filter((q) => q.id === best.pl.id).map((q) => q.role);
      const order = ["born", "lived", "died", "buried"];
      roles.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      out.push({ ...p, kinds, coord: best.pl.coord, placeName: best.pl.name, roles: [...new Set(roles)],
        offKm: best.d.off, alongKm: best.d.along });
    }
    for (const s of placeMap.values()) {
      if (!hasName(s)) continue;
      const kinds = classifyPlace({ label: s.name, description: s.description, types: s.types, heritage: s.heritage, hasDate: s.year != null });
      if (!kinds.length || !kinds.some((k) => wanted.includes(k))) continue;
      const d = distanceToPath(s.coord, path);
      if (d.off > limitKm) continue;
      out.push({ ...s, kinds, offKm: d.off, alongKm: d.along });
    }
    return out;
  }

  function sortStops(stops, how) {
    const a = stops.slice();
    if (how === "along") a.sort((x, y) => x.alongKm - y.alongKm || x.offKm - y.offKm);
    else if (how === "fame") a.sort((x, y) => y.links - x.links || x.offKm - y.offKm);
    else a.sort((x, y) => x.offKm - y.offKm || y.links - x.links);
    return a;
  }

  function rolesText(roles, place) {
    const words = roles.map((r, i) => (i === 0 ? ROLE_WORDS[r] : ROLE_WORDS[r].toLowerCase()));
    const joined = words.length <= 1 ? words.join("") : words.slice(0, -1).join(", ") + " and " + words[words.length - 1];
    return `${joined || "Connected to"} in ${place}`;
  }

  function lifeText(p) {
    if (p.born == null && p.died == null) return "";
    if (p.died == null) return `born ${yearText(p.born)}`;
    return `${p.born != null ? yearText(p.born) : "?"}–${p.died != null ? yearText(p.died) : ""}`;
  }

  const kmToMi = (km) => km / KM_PER_MI;
  function miText(km) {
    const mi = kmToMi(km);
    if (mi < 0.1) return "on the route";
    if (mi < 10) return `${mi.toFixed(1)} mi off route`;
    return `${Math.round(mi)} mi off route`;
  }

  // Plain-text list for sharing or printing.
  function shareText(trip, stops) {
    const lines = [`Who Was Here: ${trip.name}`, ""];
    for (const s of stops) {
      const what = s.type === "person" ? `${rolesText(s.roles, s.placeName)}${lifeText(s) ? ` (${lifeText(s)})` : ""}` : (s.description || "");
      lines.push(`• ${s.name}: ${what}. Mile ${Math.round(kmToMi(s.alongKm))}, ${miText(s.offKm)}.`);
      if (s.article) lines.push(`  ${s.article}`);
    }
    return lines.join("\n");
  }

  const api = {
    KM_PER_MI, FAME, haversine, interpolateGC, greatCirclePath, pathLengthKm, samplePath, distanceToPath, thinPath,
    searchPlan, peopleQuery, placesQuery, airportQueries, parsePoint, parseLatLon, qid, year, yearText,
    classifyPlace, classifyPerson, mergePeopleRows, mergePlaceRows, buildStops, sortStops, rolesText, lifeText,
    kmToMi, miText, shareText,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WWH = api;
})(typeof self !== "undefined" ? self : this);
