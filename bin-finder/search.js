// Bin Finder search, codes and backup format — the same rules as the native iPhone app (BinFinder/Models.swift).
(function (root) {
  "use strict";
  const normalize = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  // Includes the filler words people say out loud ("where did I put the spare fuses").
  const STOP = new Set(["the", "a", "an", "my", "of", "for", "where", "is", "are", "and", "in", "on", "to", "some", "any", "with",
    "wheres", "find", "i", "im", "need", "looking", "did", "put", "we", "our", "it", "at", "please", "show", "me", "keep", "do", "have"]);

  // Crude plural handling: fuses→fus (matches "fuse"), boxes→box, batteries→battery, glasses→glass, bolts→bolt.
  function stem(w) {
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 4 && w.endsWith("sses")) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("es") && ["s", "x", "z", "ch", "sh"].some((e) => w.slice(0, -2).endsWith(e))) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  function terms(query) {
    const words = normalize(query).replace(/['’]/g, "").split(/[^\p{L}\p{N}.\-]+/u).map((w) => w.replace(/^[.\-]+|[.\-]+$/g, "")).filter(Boolean);
    // Single letters (left over from "where's") would match nearly everything; single digits are kept ("shelf 2").
    const useful = words.filter((w) => !STOP.has(w) && (w.length > 1 || /\d/.test(w)));
    return (useful.length ? useful : words).map(stem);
  }

  const displayName = (b) => (b.name || "").trim() || `Bin ${b.code}`;

  // If some bins match every word, only those are shown; otherwise the best partial matches.
  function search(query, bins) {
    const ts = terms(query);
    if (!ts.length) return [];
    const hits = [];
    for (const bin of bins) {
      let score = 0, matched = 0; const reasons = [];
      const add = (r) => { if (!reasons.includes(r)) reasons.push(r); };
      for (const t of ts) {
        if (normalize(bin.name).includes(t)) { score += 6; matched++; add("Name"); continue; }
        const item = (bin.items || []).find((i) => normalize(i).includes(t));
        if (item) { score += 5; matched++; add(`Item: ${item}`); continue; }
        if (normalize(bin.code).includes(t)) { score += 5; matched++; add(`Label ${bin.code}`); continue; }
        if (normalize(bin.location).includes(t)) { score += 2; matched++; add(`Location: ${bin.location}`); continue; }
        if (normalize(bin.notes).includes(t)) { score += 2; matched++; add("Notes"); continue; }
        const w = (bin.autoWords || []).find((x) => normalize(x).includes(t));
        if (w) { score += 1; matched++; add(`Seen in photo: ${w}`); continue; }
      }
      if (matched > 0) hits.push({ bin, score, matchedTerms: matched, reasons });
    }
    const best = Math.max(0, ...hits.map((h) => h.matchedTerms));
    return hits.filter((h) => h.matchedTerms === best)
      .sort((a, b) => b.score - a.score || displayName(a.bin).localeCompare(displayName(b.bin)));
  }

  // Places inside places: "Hangar › Shelf 2 › Left". Typed as ›, > or /.
  const placeParts = (location) => String(location || "").split(/\s*[›>/\\]\s*/).map((p) => p.trim().replace(/\s+/g, " ")).filter(Boolean);
  const tidyPlace = (location) => placeParts(location).join(" › ");
  const samePart = (a, b) => normalize(a) === normalize(b);
  // Is this bin's location the place itself or somewhere inside it?
  function isUnder(location, place) {
    const l = placeParts(location), p = placeParts(place);
    return p.length > 0 && l.length >= p.length && p.every((x, i) => samePart(x, l[i]));
  }
  // Every place and every place that contains one, e.g. "Hangar" and "Hangar › Shelf 2".
  function allPlaces(bins) {
    const seen = new Map();
    for (const b of bins) { const parts = placeParts(b.location); for (let i = 1; i <= parts.length; i++) { const p = parts.slice(0, i).join(" › "); const k = normalize(p); if (!seen.has(k)) seen.set(k, p); } }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }));
  }
  // The places one level inside `place` ("" = top level), with how many bins are in each.
  function childPlaces(place, bins) {
    const depth = placeParts(place).length; const out = new Map();
    for (const b of bins) {
      const parts = placeParts(b.location);
      if (parts.length <= depth || (depth && !isUnder(b.location, place))) continue;
      const full = parts.slice(0, depth + 1).join(" › "); const k = normalize(full);
      const cur = out.get(k) || { place: full, name: parts[depth], count: 0 }; cur.count++; out.set(k, cur);
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  }
  // The rest of the location below `place`: ("Hangar › Shelf 2 › Left", "Hangar") → "Shelf 2 › Left".
  const placeBelow = (location, place) => placeParts(location).slice(placeParts(place).length).join(" › ");
  // Rename or move a place: every bin inside it follows.
  function renamePlace(location, from, to) {
    if (!isUnder(location, from)) return location;
    return [...placeParts(to), ...placeParts(location).slice(placeParts(from).length)].join(" › ");
  }

  // "Garage" → "G", "RV Rear Bay" → "RR", "Hangar › Shelf 2" → "HS", "" → "B".
  function codePrefix(location) {
    const parts = placeParts(location);
    const words = parts.length >= 2 ? parts.slice(0, 2).map((p) => p.split(/[^\p{L}\p{N}]+/u).filter(Boolean)[0]).filter(Boolean)
      : String(parts[0] || "").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const letters = words.slice(0, 2).map((w) => w[0].toUpperCase());
    return letters.length ? letters.join("") : "B";
  }

  // Trip checklist: each item in a trip bin is one thing to check off; a bin with no items is one thing itself.
  const tripKeys = (b) => (b.items && b.items.length ? b.items.map((i) => `${b.id}|${i}`) : [String(b.id)]);
  function tripProgress(bins, checked) {
    const set = checked instanceof Set ? checked : new Set(checked || []);
    let total = 0, done = 0;
    for (const b of bins) if (b.trip) for (const k of tripKeys(b)) { total++; if (set.has(k)) done++; }
    return { total, done };
  }
  function nextCode(location, bins) {
    const p = codePrefix(location);
    const used = bins.map((b) => String(b.code || "").toUpperCase().split("-"))
      .filter((parts) => parts.length === 2 && parts[0] === p).map((parts) => parseInt(parts[1], 10)).filter(Number.isFinite);
    return `${p}-${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, "0")}`;
  }

  // Words worth keeping from text read in a photo.
  const IGNORE = new Set(["the", "and", "for", "with", "made", "inc", "www", "com", "usa", "net"]);
  function photoWords(text) {
    const out = []; const seen = new Set();
    for (const raw of String(text || "").split(/[^\p{L}\p{N}\-]+/u)) {
      const w = raw.replace(/^-+|-+$/g, "").toLowerCase();
      if (w.length < 3 || IGNORE.has(w) || seen.has(w)) continue;
      const letters = (w.match(/\p{L}/gu) || []).length;
      if (letters < 3 || letters < w.length * 0.6) continue;     // mostly letters
      if (!/[aeiouy]/.test(w)) continue;                          // OCR noise like "lll", "nnm"
      if (/(.)\1\1/.test(w)) continue;                            // three of the same letter in a row
      seen.add(w); out.push(w);
    }
    return out;
  }

  // Dates as the native app writes them (ISO 8601 without fractions of a second), so backups move between both apps.
  const isoNow = (d = new Date()) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

  const api = { normalize, stem, terms, search, codePrefix, nextCode, photoWords, displayName, isoNow,
    placeParts, tidyPlace, isUnder, allPlaces, childPlaces, placeBelow, renamePlace, tripKeys, tripProgress };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BinSearch = api;
})(typeof window !== "undefined" ? window : globalThis);
