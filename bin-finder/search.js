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

  // Does the text contain the search word? Also compares against the text with each word made singular,
  // so "battery" and "batteries" find each other.
  const singular = (s) => normalize(s).split(/[^\p{L}\p{N}.\-]+/u).map(stem).join(" ");
  const has = (text, t) => normalize(text).includes(t) || singular(text).includes(t);

  // A container is a bin (plastic) or a box (cardboard). They work the same; the word just matches what's on the shelf.
  // "none" is for something that is neither, like a shelf, a drawer or an RV compartment.
  const kindOf = (b) => (b && (b.kind === "box" || b.kind === "none") ? b.kind : "bin");
  const kindWord = (b) => ({ box: "Box", none: "" })[kindOf(b)] ?? "Bin";          // shown in lists; blank for "none"
  const kindNoun = (b) => ({ box: "box", none: "entry" })[kindOf(b)] ?? "bin";     // "Delete this box"
  const kindLabel = (b) => ({ box: "Box (cardboard)", none: "None" })[kindOf(b)] ?? "Bin (plastic)";
  const displayName = (b) => (b.name || "").trim() || [kindWord(b), b.code].filter(Boolean).join(" ");
  // A bin or box can sit inside another one (a box on a shelf, a small bin in a big one). `inside` holds the holder's id.
  const sameID = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();
  // The bin or box this one sits inside, or null.
  const holderOf = (bin, bins) => (bin && bin.inside && !sameID(bin.inside, bin.id) && bins.find((x) => sameID(x.id, bin.inside))) || null;
  // The bins and boxes sitting directly inside this one, by name.
  const heldBy = (bin, bins) => bins.filter((x) => holderOf(x, bins) === bin)
    .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base", numeric: true }));
  // Could `bin` go inside `holder`? Not inside itself, and not inside something that is already inside it.
  function canHold(holder, bin, bins) {
    if (!holder || !bin || sameID(holder.id, bin.id)) return false;
    let p = holder;
    for (let n = 0; n < 100 && (p = holderOf(p, bins)); n++) if (sameID(p.id, bin.id)) return false;
    return true;
  }
  // Every item in every bin and box, A to Z, each with the container it's in.
  function allItems(bins) {
    const out = [];
    for (const bin of bins) for (const item of bin.items || []) if (String(item).trim()) out.push({ item: String(item).trim(), bin });
    const opt = { sensitivity: "base", numeric: true };
    return out.sort((a, b) => a.item.localeCompare(b.item, undefined, opt) || displayName(a.bin).localeCompare(displayName(b.bin), undefined, opt));
  }

  // If some bins match every word, only those are shown; otherwise the best partial matches.
  function search(query, bins) {
    const ts = terms(query);
    if (!ts.length) return [];
    const hits = [];
    for (const bin of bins) {
      let score = 0, matched = 0; const reasons = [];
      const add = (r) => { if (!reasons.includes(r)) reasons.push(r); };
      for (const t of ts) {
        if (has(bin.name, t)) { score += 6; matched++; add("Name"); continue; }
        const item = (bin.items || []).find((i) => has(i, t));
        if (item) { score += 5; matched++; add(`Item: ${item}`); continue; }
        if (normalize(bin.code).includes(t)) { score += 5; matched++; add(`Label ${bin.code}`); continue; }
        if (has(bin.location, t)) { score += 2; matched++; add(`Location: ${bin.location}`); continue; }
        if (has(bin.notes, t)) { score += 2; matched++; add("Notes"); continue; }
        const w = (bin.autoWords || []).find((x) => has(x, t));
        if (w) { score += 1; matched++; add(`Seen in photo: ${w}`); continue; }
      }
      const holder = holderOf(bin, bins);
      if (matched > 0 && holder) add(`In ${displayName(holder)}`);
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
  // The deepest part of `place` that still has a bin in or under it ("" if none), spelled the way the bins spell it.
  function nearestPlace(place, bins) {
    const parts = placeParts(place);
    for (let n = parts.length; n > 0; n--) {
      const b = bins.find((x) => isUnder(x.location, parts.slice(0, n).join(" › ")));
      if (b) return placeParts(b.location).slice(0, n).join(" › ");
    }
    return "";
  }
  // The pull-downs on the main list for the chosen place: one per level that has places to choose from.
  // ("Hangar") → [{ parent: "", choices: Garage/Hangar, selected: "Hangar" }, { parent: "Hangar", choices: its shelves, selected: "" }].
  function placeLevels(place, bins) {
    const parts = placeParts(place), out = [];
    for (let i = 0; i <= parts.length; i++) {
      const parent = parts.slice(0, i).join(" › "), choices = childPlaces(parent, bins);
      if (!choices.length) break;
      const want = normalize(parts.slice(0, i + 1).join(" › "));
      const hit = i < parts.length ? choices.find((c) => normalize(c.place) === want) : null;
      out.push({ parent, name: i ? parts[i - 1] : "", choices, selected: hit ? hit.place : "" });
    }
    return out;
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
  // Label codes count each type on its own within each location: "G-BIN-1", "G-BIN-2", "G-BOX-1", and "G-1" for kind none.
  const codeStem = (location, kind) => [codePrefix(location), { bin: "BIN", box: "BOX", none: "" }[kindOf({ kind })]].filter(Boolean).join("-");
  // Is this still the code the app would give it (so it may follow a change of type or location), not one typed by hand?
  const isAutoCode = (b) => { const stem = codeStem(b.location, b.kind) + "-", c = String(b.code || "").toUpperCase(); return c.startsWith(stem) && /^\d+$/.test(c.slice(stem.length)); };
  function nextCode(location, bins, kind) {
    const stem = codeStem(location, kind) + "-";
    const used = bins.map((b) => String(b.code || "").toUpperCase()).filter((c) => c.startsWith(stem) && /^\d+$/.test(c.slice(stem.length))).map((c) => parseInt(c.slice(stem.length), 10));
    return stem + ((used.length ? Math.max(...used) : 0) + 1);
  }
  // Renumber everything, oldest first: returns [[bin, new code], …].
  function renumber(bins) {
    const order = [...bins].sort((a, b) => String(a.created || "").localeCompare(String(b.created || "")) || String(a.code || "").localeCompare(String(b.code || ""), undefined, { numeric: true }));
    const n = {};
    return order.map((b) => { const stem = codeStem(b.location, b.kind); n[stem] = (n[stem] || 0) + 1; return [b, `${stem}-${n[stem]}`]; });
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

  const api = { normalize, stem, terms, search, codePrefix, codeStem, isAutoCode, nextCode, renumber, photoWords, displayName, isoNow,
    kindOf, kindWord, kindNoun, kindLabel, allItems, holderOf, heldBy, canHold, placeParts, tidyPlace, isUnder, allPlaces, childPlaces, nearestPlace, placeLevels, placeBelow, renamePlace, tripKeys, tripProgress };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BinSearch = api;
})(typeof window !== "undefined" ? window : globalThis);
