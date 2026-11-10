// Who Was Here: screens, map and lookups. Route math and sorting live in core.js (window.WWH).
(function () {
  "use strict";
  const W = window.WWH;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");

  const KINDS = {
    people: { label: "Famous people", short: "People", icon: "👤", color: "#7B5BD6" },
    event: { label: "Historic events & battles", short: "Events", icon: "⚔️", color: "#C8433F" },
    landmark: { label: "Landmarks & museums", short: "Landmarks", icon: "🏛️", color: "#B7811B" },
    aviation: { label: "Aviation & Navy", short: "Aviation & Navy", icon: "✈️", color: "#1F72C4" },
  };
  const MODES = {
    drive: { label: "Drive", icon: "🚙", corridor: 10, placeholder: "City, address or place", first: "Start", last: "End", mid: "Stop along the way" },
    fly: { label: "Fly", icon: "✈️", corridor: 25, placeholder: "Airport code: KTUS, E60, TUS", first: "Departure", last: "Destination", mid: "Fuel stop" },
    cruise: { label: "Cruise", icon: "🚢", corridor: 5, placeholder: "Port, e.g. Basel, Switzerland", first: "Port 1", last: "Last port", mid: "Port" },
    here: { label: "Right here", icon: "📍", corridor: 10, placeholder: "Use my location, or type a place", first: "Center", last: "", mid: "" },
  };
  const CORRIDORS = [2, 5, 10, 25];

  // ---------- saved state ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("wwh." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("wwh." + k, JSON.stringify(v)); return true; } catch { toast("Your phone's storage for this app is full. Delete an old trip."); return false; } },
  };
  let draft = store.get("draft", null) || newDraft("drive");
  let trips = store.get("trips", []);
  let current = null; // the open trip (saved or in progress)
  let tab = "plan";
  let view = { sort: "off", only: null, picksOnly: false, shown: 100 };
  let search = null; // running search
  let map = null, mapLayers = null, markerById = new Map();

  function newDraft(mode) {
    return { mode, name: "", points: mode === "here" ? [""] : ["", ""], corridor: MODES[mode].corridor, fame: "known", kinds: Object.keys(KINDS) };
  }
  const saveDraft = () => store.set("draft", draft);

  function toast(msg, ms = 3200) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.hidden = true), ms);
  }

  // ---------- network ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function getJSON(url, opts = {}, tries = 3) {
    let last;
    for (let i = 0; i < tries; i++) {
      try {
        const r = await fetch(url, opts);
        if (r.status === 429 || r.status >= 500) { last = new Error(`Server busy (${r.status})`); await sleep(1500 * (i + 1) + Math.random() * 500); continue; }
        if (!r.ok) throw new Error(`Lookup failed (${r.status})`);
        return await r.json();
      } catch (e) { last = e; if (search && search.cancelled) throw e; await sleep(800 * (i + 1)); }
    }
    throw last;
  }
  const sparql = (q) => getJSON("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { Accept: "application/sparql-results+json" } })
    .then((j) => j.results.bindings);

  let lastNominatim = 0;
  async function geocode(text) {
    const ll = W.parseLatLon(text);
    if (ll) return { coord: ll, name: `${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}` };
    const wait = 1100 - (Date.now() - lastNominatim);
    if (wait > 0) await sleep(wait); // OpenStreetMap asks for no more than one lookup a second
    lastNominatim = Date.now();
    const j = await getJSON("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=" + encodeURIComponent(text));
    if (!j.length) throw new Error(`Couldn't find "${text}". Try adding the state or country.`);
    const name = j[0].display_name.split(",").slice(0, 3).join(",").trim();
    return { coord: [+j[0].lat, +j[0].lon], name };
  }
  async function airport(code) {
    const c = code.trim();
    if (W.parseLatLon(c)) return geocode(c);
    if (/^[A-Za-z0-9-]{3,4}$/.test(c)) {
      const rows = await sparql(W.airportQuery(c));
      if (rows.length) return { coord: W.parsePoint(rows[0].coord.value), name: `${c.toUpperCase()} · ${rows[0].aLabel.value}` };
    }
    return geocode(/airport|field|airpark/i.test(c) ? c : c + " airport");
  }
  async function hereNow() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("This browser can't share your location."));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ coord: [p.coords.latitude, p.coords.longitude], name: "My location" }),
        () => reject(new Error("Location is turned off for this app. Type a place instead.")),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 });
    });
  }
  async function roadRoute(coords) {
    const pts = coords.map((c) => `${c[1].toFixed(5)},${c[0].toFixed(5)}`).join(";");
    const j = await getJSON(`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson`);
    if (!j.routes || !j.routes.length) throw new Error("No road route found between those places.");
    return { path: j.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]), seconds: j.routes[0].duration };
  }

  // ---------- the search ----------
  async function runSearch() {
    if (search) return;
    const d = JSON.parse(JSON.stringify(draft));
    const typed = d.points.map((s) => s.trim());
    if (d.mode !== "here" && typed.filter(Boolean).length < 2) return toast(`Enter at least a ${MODES[d.mode].first.toLowerCase()} and ${MODES[d.mode].last.toLowerCase()}.`);
    if (!d.kinds.length) return toast("Pick at least one kind of stop.");
    search = { cancelled: false, done: 0, total: 0, failed: [], status: "Finding your places…" };
    render();
    try {
      const resolved = [];
      for (const t of typed) {
        if (!t && d.mode !== "here") continue;
        search.status = `Finding ${t || "your location"}…`; renderProgress();
        if (d.mode === "fly") resolved.push(await airport(t));
        else if (!t || /^my location$/i.test(t)) resolved.push(await hereNow());
        else resolved.push(await geocode(t));
        if (search.cancelled) throw new Error("cancelled");
      }
      let path, seconds = null;
      if (d.mode === "drive") {
        search.status = "Working out the road route…"; renderProgress();
        const r = await roadRoute(resolved.map((x) => x.coord));
        path = W.thinPath(r.path, 0.3); seconds = r.seconds;
      } else if (d.mode === "here") path = [resolved[0].coord];
      else path = W.greatCirclePath(resolved.map((x) => x.coord), 15);

      const name = d.name.trim() || (d.mode === "here" ? `Around ${resolved[0].name.split(",")[0]}` : resolved.map((x) => x.name.split(",")[0].replace(/ · .*/, "")).filter((_, i, a) => i === 0 || i === a.length - 1).join(" → "));
      current = {
        id: "t" + Date.now().toString(36), name, mode: d.mode, created: new Date().toISOString(),
        typed, places: resolved, corridor: d.corridor, fame: d.fame, kinds: d.kinds,
        lengthKm: W.pathLengthKm(path), seconds, path, stops: [], picks: [], saved: false, partial: false,
      };
      view = { sort: "off", only: null, picksOnly: false, shown: 100 };
      const plan = W.searchPlan(path, d.corridor);
      const fame = W.FAME[d.fame];
      const wantPeople = d.kinds.includes("people") || d.kinds.includes("aviation");
      const wantPlaces = d.kinds.some((k) => k !== "people");
      const jobs = [];
      plan.points.forEach((p, i) => {
        if (wantPeople) jobs.push({ i, kind: "people", p });
        if (wantPlaces) jobs.push({ i, kind: "places", p });
      });
      search.raw = { people: new Map(), places: new Map() };
      search.plan = plan;
      search.total = jobs.length; search.status = "Looking up who was here…";
      tab = "stops"; render();
      await runJobs(jobs, plan.radiusKm, fame);
      finishSearch();
    } catch (e) {
      const was = search; search = null;
      if (was && was.cancelled) { toast("Search stopped."); render(); return; }
      console.error(e);
      tab = current && current.stops.length ? "stops" : "plan";
      render();
      toast(e.message || "Something went wrong. Check your connection and try again.", 6000);
    }
  }

  async function runJobs(jobs, radiusKm, fame) {
    const queue = jobs.slice();
    let lastPaint = 0;
    const worker = async () => {
      while (queue.length && !search.cancelled) {
        const job = queue.shift();
        try {
          if (job.kind === "people") W.mergePeopleRows(await sparql(W.peopleQuery(job.p, radiusKm, fame.people)), search.raw.people);
          else W.mergePlaceRows(await sparql(W.placesQuery(job.p, radiusKm, fame.places)), search.raw.places);
        } catch (e) {
          if (search.cancelled) return;
          // A busy city can time out at full size: try once more at a smaller circle before giving up.
          try {
            const r = radiusKm * 0.6;
            if (job.kind === "people") W.mergePeopleRows(await sparql(W.peopleQuery(job.p, r, fame.people, 40)), search.raw.people);
            else W.mergePlaceRows(await sparql(W.placesQuery(job.p, r, fame.places, 250)), search.raw.places);
          } catch { search.failed.push(job); }
        }
        search.done++;
        if (Date.now() - lastPaint > 1500) { lastPaint = Date.now(); rebuildStops(); renderStopsLive(); } else renderProgress();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (search.cancelled) throw new Error("cancelled");
  }

  function rebuildStops() {
    if (!current || !search) return;
    current.stops = W.buildStops(search.raw.people, search.raw.places, current.path, current.corridor, current.kinds)
      .map(slimStop);
  }
  // Only what the screens need, to keep saved trips small.
  function slimStop(s) {
    const o = { id: s.id, type: s.type, name: s.name, description: s.description, links: s.links, coord: [+s.coord[0].toFixed(5), +s.coord[1].toFixed(5)],
      kinds: s.kinds, offKm: +s.offKm.toFixed(2), alongKm: +s.alongKm.toFixed(1), article: s.article };
    if (s.type === "person") Object.assign(o, { placeName: s.placeName, roles: s.roles, born: s.born, died: s.died });
    else Object.assign(o, { year: s.year });
    return o;
  }

  function finishSearch() {
    rebuildStops();
    current.partial = search.failed.length > 0;
    current.failedJobs = search.failed.map((j) => ({ kind: j.kind, p: j.p }));
    current.radiusKm = search.plan.radiusKm;
    const n = current.stops.length;
    search = null;
    saveTrip(current, true);
    render();
    toast(n ? `Found ${n} stop${n === 1 ? "" : "s"}. Trip saved in My Trips.` : "Nothing found. Try a wider corridor or “Include local history.”", 5000);
  }

  async function retryFailed() {
    if (!current || !current.failedJobs || !current.failedJobs.length || search) return;
    search = { cancelled: false, done: 0, total: current.failedJobs.length, failed: [], status: "Trying those areas again…",
      raw: { people: new Map(), places: new Map() }, plan: { radiusKm: current.radiusKm } };
    const keep = current.stops;
    render();
    try {
      await runJobs(current.failedJobs.map((j) => ({ ...j })), current.radiusKm, W.FAME[current.fame]);
      const fresh = W.buildStops(search.raw.people, search.raw.places, current.path, current.corridor, current.kinds).map(slimStop);
      const ids = new Set(keep.map((s) => s.id));
      current.stops = keep.concat(fresh.filter((s) => !ids.has(s.id)));
      current.failedJobs = search.failed.map((j) => ({ kind: j.kind, p: j.p }));
      current.partial = current.failedJobs.length > 0;
      const added = current.stops.length - keep.length;
      search = null; saveTrip(current, true); render();
      toast(current.partial ? `Added ${added}. Some areas still didn't answer; try again later.` : `Added ${added} more stop${added === 1 ? "" : "s"}.`);
    } catch { current.stops = keep; search = null; render(); }
  }

  // ---------- trips ----------
  function saveTrip(t, quiet) {
    t.saved = true;
    const copy = { ...t, path: W.thinPath(t.path, Math.max(0.5, t.lengthKm / 1500)) };
    trips = trips.filter((x) => x.id !== t.id);
    trips.unshift(copy);
    if (!store.set("trips", trips) && trips.length > 1) { trips.pop(); store.set("trips", trips); }
    if (!quiet) toast("Saved.");
  }
  function openTrip(id) {
    const t = trips.find((x) => x.id === id);
    if (!t) return;
    current = JSON.parse(JSON.stringify(t));
    view = { sort: "off", only: null, picksOnly: false, shown: 100 };
    tab = "stops"; render();
  }
  function deleteTrip(id) {
    const t = trips.find((x) => x.id === id);
    if (!t || !confirm(`Delete the trip “${t.name}”? This can't be undone.`)) return;
    trips = trips.filter((x) => x.id !== id); store.set("trips", trips);
    if (current && current.id === id) current = null;
    render();
  }
  function togglePick(id) {
    if (!current) return;
    const i = current.picks.indexOf(id);
    if (i >= 0) current.picks.splice(i, 1); else current.picks.push(id);
    if (current.saved) saveTrip(current, true);
  }

  // ---------- rendering ----------
  function render() {
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
    if (tab !== "stops" && map) { map.remove(); map = null; }
    if (tab === "plan") renderPlan();
    else if (tab === "stops") renderStops();
    else renderTrips();
  }

  function renderPlan() {
    const m = MODES[draft.mode];
    const rows = draft.points.map((p, i) => {
      const last = i === draft.points.length - 1;
      const label = draft.mode === "here" ? m.first : i === 0 ? m.first : last ? m.last : (draft.mode === "cruise" ? `Port ${i + 1}` : m.mid);
      const canRemove = draft.mode !== "here" && draft.points.length > 2;
      const showLoc = (draft.mode === "drive" && i === 0) || draft.mode === "here";
      return `<div class="pt">
        <label for="pt${i}">${esc(label)}</label>
        <div class="pt-row">
          <input id="pt${i}" data-pt="${i}" type="text" autocomplete="off" autocapitalize="${draft.mode === "fly" ? "characters" : "words"}" placeholder="${esc(m.placeholder)}" value="${esc(p)}">
          ${showLoc ? `<button type="button" class="icon-btn" data-act="loc" data-i="${i}" title="Use my location" aria-label="Use my location">📍</button>` : ""}
          ${canRemove ? `<button type="button" class="icon-btn" data-act="rm" data-i="${i}" title="Remove" aria-label="Remove ${esc(label)}">✕</button>` : ""}
        </div></div>`;
    }).join("");
    app.innerHTML = `
      <section class="card">
        <div class="modes" role="radiogroup" aria-label="Kind of trip">
          ${Object.entries(MODES).map(([k, v]) => `<button type="button" role="radio" aria-checked="${draft.mode === k}" data-mode="${k}"><span aria-hidden="true">${v.icon}</span>${v.label}</button>`).join("")}
        </div>
        ${draft.mode === "here" ? `<p class="hint">See who was here around where you are now, or around any place you type.</p>` : ""}
        <div class="pts">${rows}</div>
        ${draft.mode !== "here" ? `<button type="button" class="link-btn" data-act="add">+ Add ${draft.mode === "cruise" ? "a port" : draft.mode === "fly" ? "a stop" : "a stop along the way"}</button>` : ""}
        ${draft.mode === "cruise" ? `<p class="hint">Enter ports in order. The ship's path is drawn as straight lines between ports, so on winding rivers a few stops may fall just inside or outside the corridor.</p>` : ""}
        ${draft.mode === "fly" ? `<p class="hint">Uses the direct great-circle line between airports.</p>` : ""}
      </section>
      <section class="card">
        <label class="field">Trip name <span class="opt">(optional)</span>
          <input id="tripName" type="text" value="${esc(draft.name)}" placeholder="e.g. RV trip to Ohio"></label>
        <label class="field">How far off the ${draft.mode === "here" ? "spot" : "route"}
          <select id="corridor">${CORRIDORS.map((c) => `<option value="${c}" ${+draft.corridor === c ? "selected" : ""}>${c} miles</option>`).join("")}</select></label>
        <label class="field">How famous
          <select id="fame">${Object.entries(W.FAME).map(([k, v]) => `<option value="${k}" ${draft.fame === k ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
        <fieldset class="kinds"><legend>Show</legend>
          ${Object.entries(KINDS).map(([k, v]) => `<label class="check"><input type="checkbox" data-kind="${k}" ${draft.kinds.includes(k) ? "checked" : ""}><span aria-hidden="true">${v.icon}</span> ${v.label}</label>`).join("")}
        </fieldset>
      </section>
      <button type="button" class="big" data-act="go" ${search ? "disabled" : ""}>${search ? "Searching…" : "Find who was here"}</button>
      <p class="credits">People and history from <a href="https://www.wikidata.org" target="_blank" rel="noopener">Wikidata</a> and Wikipedia. Maps, places and road routes from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>. Nothing about you is sent anywhere except the places you type.</p>`;
  }

  function progressHTML() {
    if (!search) return "";
    const pct = search.total ? Math.round((100 * search.done) / search.total) : 0;
    return `<div class="progress card" id="progress">
      <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <p>${esc(search.status)} ${search.total ? `${pct}%` : ""}${search.failed.length ? ` · ${search.failed.length} area${search.failed.length === 1 ? "" : "s"} didn't answer` : ""}</p>
      <button type="button" class="link-btn" data-act="stop">Stop searching</button></div>`;
  }
  function renderProgress() {
    const el = $("#progress");
    if (el) el.outerHTML = progressHTML();
    else if (tab === "plan" && search) render();
  }

  function filtered() {
    if (!current) return [];
    let s = current.stops;
    if (view.only) s = s.filter((x) => x.kinds.includes(view.only));
    if (view.picksOnly) s = s.filter((x) => current.picks.includes(x.id));
    return W.sortStops(s, view.sort);
  }

  function stopCard(s) {
    const k = KINDS[s.kinds.includes("aviation") && s.type === "person" ? "aviation" : s.kinds[0]];
    const picked = current.picks.includes(s.id);
    const sub = s.type === "person"
      ? `${esc(W.rolesText(s.roles, s.placeName))}${W.lifeText(s) ? ` · ${W.lifeText(s)}` : ""}`
      : `${esc(s.description || "")}${s.year != null ? ` · ${W.yearText(s.year)}` : ""}`;
    const who = s.type === "person" && s.description ? `<p class="desc">${esc(cap(s.description))}</p>` : "";
    const read = s.article || `https://www.wikidata.org/wiki/${s.id}`;
    const tags = s.kinds.map((x) => `<span class="tag" style="--c:${KINDS[x].color}">${KINDS[x].short}</span>`).join("");
    const dir = `https://maps.apple.com/?daddr=${s.coord[0]},${s.coord[1]}&q=${encodeURIComponent(s.type === "person" ? s.placeName : s.name)}`;
    return `<li class="stop" data-id="${s.id}">
      <div class="dot" style="--c:${k.color}" aria-hidden="true">${k.icon}</div>
      <div class="body">
        <h3>${esc(s.name)}</h3>
        <p class="sub">${sub}</p>${who}
        <p class="meta"><strong>${W.miText(s.offKm)}</strong>${current.mode === "here" ? "" : ` · mile ${Math.round(W.kmToMi(s.alongKm))}`} ${tags}</p>
        <div class="acts">
          <button type="button" class="pick ${picked ? "on" : ""}" data-act="pick" data-id="${s.id}" aria-pressed="${picked}">${picked ? "★ Want to see" : "☆ Want to see"}</button>
          <a href="${esc(read)}" target="_blank" rel="noopener">Read about it</a>
          <button type="button" data-act="show" data-id="${s.id}">On map</button>
          <a href="${esc(dir)}" target="_blank" rel="noopener">Directions</a>
        </div>
      </div></li>`;
  }
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  function summaryText() {
    const c = current;
    const parts = [];
    if (c.mode !== "here") parts.push(`${Math.round(W.kmToMi(c.lengthKm)).toLocaleString()} mi ${c.mode === "drive" ? "drive" : c.mode === "fly" ? "flight" : "cruise"}`);
    if (c.seconds) { const h = Math.floor(c.seconds / 3600), mm = Math.round((c.seconds % 3600) / 60); parts.push(`about ${h ? h + " hr " : ""}${mm} min driving`); }
    parts.push(`within ${c.corridor} mi`);
    parts.push(W.FAME[c.fame].label.toLowerCase());
    return parts.join(" · ");
  }

  function renderStops() {
    if (!current) {
      app.innerHTML = `${progressHTML()}<section class="card empty"><p>No trip open yet.</p><p>Plan a drive, flight or cruise on the <button type="button" class="link-btn" data-goto="plan">Plan</button> tab, or open one from <button type="button" class="link-btn" data-goto="trips">My Trips</button>.</p></section>`;
      return;
    }
    const counts = {};
    for (const k of Object.keys(KINDS)) counts[k] = current.stops.filter((s) => s.kinds.includes(k)).length;
    const list = filtered();
    const shown = list.slice(0, view.shown);
    app.innerHTML = `
      ${progressHTML()}
      <section class="trip-head">
        <h2>${esc(current.name)}</h2>
        <p class="sum">${esc(summaryText())}</p>
      </section>
      <div id="map" class="map" role="region" aria-label="Map of the route and stops"></div>
      ${current.partial && !search ? `<div class="card warn">Some stretches of the route didn't answer (the history service was busy), so a few stops may be missing. <button type="button" class="link-btn" data-act="retry">Try those again</button></div>` : ""}
      <div class="controls">
        <div class="seg" role="radiogroup" aria-label="Sort">
          ${[["off", current.mode === "here" ? "Closest" : "Closest to route"], ["along", "Along the way"], ["fame", "Most famous"]].filter(([k]) => !(current.mode === "here" && k === "along"))
            .map(([k, l]) => `<button type="button" role="radio" aria-checked="${view.sort === k}" data-sort="${k}">${l}</button>`).join("")}
        </div>
        <div class="chips">
          <button type="button" class="chip" aria-pressed="${!view.only}" data-only="">All ${current.stops.length}</button>
          ${current.kinds.map((k) => `<button type="button" class="chip" style="--c:${KINDS[k].color}" aria-pressed="${view.only === k}" data-only="${k}">${KINDS[k].icon} ${KINDS[k].short} ${counts[k]}</button>`).join("")}
          <button type="button" class="chip" aria-pressed="${view.picksOnly}" data-act="picks">★ My picks ${current.picks.length}</button>
        </div>
      </div>
      ${list.length ? `<ol class="stops">${shown.map(stopCard).join("")}</ol>` : `<section class="card empty">${search ? "Stops will appear here as they're found…" : view.picksOnly ? "No picks yet. Tap ☆ Want to see on any stop." : "No stops match. Try a wider corridor or “Include local history.”"}</section>`}
      ${list.length > view.shown ? `<button type="button" class="big ghost" data-act="more">Show ${Math.min(100, list.length - view.shown)} more (of ${list.length})</button>` : ""}
      ${!search && current.stops.length ? `<div class="share-row">
        <button type="button" class="big ghost" data-act="share">${current.picks.length ? "Share my picks" : "Share this list"}</button>
        <button type="button" class="big ghost" data-act="print">Print</button></div>` : ""}`;
    drawMap();
  }
  function renderStopsLive() {
    if (tab !== "stops") return renderProgress();
    const y = window.scrollY;
    renderStops();
    window.scrollTo(0, y);
  }

  function drawMap() {
    const el = $("#map");
    if (!el || !window.L) return;
    if (map) { map.remove(); map = null; }
    map = L.map(el, { zoomControl: true, attributionControl: true, tap: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    markerById = new Map();
    const c = current;
    if (c.path.length > 1) L.polyline(c.path, { color: "#1F6F78", weight: 4, opacity: 0.85, dashArray: c.mode === "drive" ? null : "8 8" }).addTo(mapLayers);
    else L.circle(c.path[0], { radius: c.corridor * W.KM_PER_MI * 1000, color: "#1F6F78", weight: 2, fillOpacity: 0.05 }).addTo(mapLayers);
    c.places.forEach((p, i) => L.circleMarker(p.coord, { radius: 7, color: "#fff", weight: 2, fillColor: "#1F6F78", fillOpacity: 1 })
      .bindTooltip(p.name.split(",")[0], { permanent: c.places.length <= 6 && c.mode !== "here", direction: i === 0 ? "left" : "right", className: "pt-label" }).addTo(mapLayers));
    for (const s of filtered().slice(0, 400)) {
      const k = KINDS[s.kinds.includes("aviation") && s.type === "person" ? "aviation" : s.kinds[0]];
      const picked = c.picks.includes(s.id);
      const m = L.circleMarker(s.coord, { radius: picked ? 8 : 6, color: picked ? "#111" : "#fff", weight: picked ? 2.5 : 1.5, fillColor: k.color, fillOpacity: 0.9 })
        .bindPopup(`<strong>${esc(s.name)}</strong><br>${s.type === "person" ? esc(W.rolesText(s.roles, s.placeName)) : esc(s.description || "")}<br><a href="#" data-jump="${s.id}">Show in list</a>`)
        .addTo(mapLayers);
      markerById.set(s.id, m);
    }
    const b = L.latLngBounds(c.path);
    if (c.mode === "here") map.setView(c.path[0], c.corridor <= 5 ? 11 : c.corridor <= 10 ? 10 : 9);
    else map.fitBounds(b.pad(0.08));
    setTimeout(() => map && map.invalidateSize(), 50);
  }

  function showOnMap(id) {
    const m = markerById.get(id);
    if (!m || !map) return;
    $("#map").scrollIntoView({ behavior: "smooth", block: "start" });
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 11));
    m.openPopup();
  }
  function jumpToCard(id) {
    let card = document.querySelector(`.stop[data-id="${id}"]`);
    if (!card) { view.only = null; view.picksOnly = false; view.shown = 100000; renderStops(); card = document.querySelector(`.stop[data-id="${id}"]`); }
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), 1600);
  }

  function renderTrips() {
    app.innerHTML = `${progressHTML()}
      ${trips.length ? `<ul class="trips">${trips.map((t) => `<li class="card trip">
        <button type="button" class="trip-open" data-open="${t.id}">
          <span class="ti" aria-hidden="true">${MODES[t.mode].icon}</span>
          <span><strong>${esc(t.name)}</strong><br><small>${t.stops.length} stops · ${t.picks.length} picked · ${new Date(t.created).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</small></span>
        </button>
        <div class="trip-acts"><button type="button" class="link-btn" data-rename="${t.id}">Rename</button><button type="button" class="link-btn danger" data-del="${t.id}">Delete</button></div>
      </li>`).join("")}</ul>` : `<section class="card empty"><p>Trips you search are saved here automatically, with your ★ picks.</p></section>`}`;
  }

  async function share() {
    const list = current.picks.length ? W.sortStops(current.stops.filter((s) => current.picks.includes(s.id)), "along") : filtered();
    const text = W.shareText(current, list);
    try {
      if (navigator.share) await navigator.share({ title: `Who Was Here: ${current.name}`, text });
      else { await navigator.clipboard.writeText(text); toast("List copied. Paste it into a message or note."); }
    } catch (e) { if (e && e.name !== "AbortError") toast("Couldn't share. Try Print instead."); }
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a[data-jump]");
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.goto) { tab = t.dataset.goto; render(); return; }
    if (t.dataset.mode) {
      const old = draft.mode, keep = draft.points.filter((p) => p.trim());
      draft = { ...newDraft(t.dataset.mode), kinds: draft.kinds, fame: draft.fame, name: draft.name };
      const placeModes = ["drive", "cruise"]; // both take place names, so keep what was typed
      if (placeModes.includes(old) && placeModes.includes(draft.mode) && keep.length) draft.points = keep.length >= 2 ? keep : [keep[0], ""];
      saveDraft(); render(); return;
    }
    if (t.dataset.sort) { view.sort = t.dataset.sort; view.shown = 100; renderStops(); return; }
    if ("only" in t.dataset) { view.only = t.dataset.only || null; view.shown = 100; renderStops(); return; }
    if (t.dataset.open) { openTrip(t.dataset.open); return; }
    if (t.dataset.del) { deleteTrip(t.dataset.del); return; }
    if (t.dataset.rename) {
      const tr = trips.find((x) => x.id === t.dataset.rename);
      const n = tr && prompt("Trip name", tr.name);
      if (n && n.trim()) { tr.name = n.trim(); store.set("trips", trips); if (current && current.id === tr.id) current.name = tr.name; render(); }
      return;
    }
    if (t.dataset.jump) { e.preventDefault(); map && map.closePopup(); jumpToCard(t.dataset.jump); return; }
    switch (t.dataset.act) {
      case "add": draft.points.splice(draft.points.length - 1, 0, ""); saveDraft(); render(); $(`#pt${draft.points.length - 2}`)?.focus(); break;
      case "rm": draft.points.splice(+t.dataset.i, 1); saveDraft(); render(); break;
      case "loc": draft.points[+t.dataset.i] = "My location"; saveDraft(); render(); break;
      case "go": runSearch(); break;
      case "stop": if (search) { search.cancelled = true; search.status = "Stopping…"; renderProgress(); } break;
      case "pick": {
        togglePick(t.dataset.id);
        const on = current.picks.includes(t.dataset.id);
        t.classList.toggle("on", on); t.setAttribute("aria-pressed", on); t.textContent = on ? "★ Want to see" : "☆ Want to see";
        const chip = document.querySelector('[data-act="picks"]'); if (chip) chip.textContent = `★ My picks ${current.picks.length}`;
        const m = markerById.get(t.dataset.id); if (m) m.setStyle({ radius: on ? 8 : 6, color: on ? "#111" : "#fff", weight: on ? 2.5 : 1.5 });
        if (view.picksOnly && !on) renderStops();
        break;
      }
      case "picks": view.picksOnly = !view.picksOnly; view.shown = 100; renderStops(); break;
      case "show": showOnMap(t.dataset.id); break;
      case "more": view.shown += 100; renderStops(); break;
      case "share": share(); break;
      case "print": window.print(); break;
      case "retry": retryFailed(); break;
    }
  });
  app.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.pt != null) draft.points[+t.dataset.pt] = t.value;
    else if (t.id === "tripName") draft.name = t.value;
    saveDraft();
  });
  app.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "corridor") draft.corridor = +t.value;
    else if (t.id === "fame") draft.fame = t.value;
    else if (t.dataset.kind) {
      const k = t.dataset.kind;
      draft.kinds = t.checked ? [...new Set([...draft.kinds, k])] : draft.kinds.filter((x) => x !== k);
      draft.kinds = Object.keys(KINDS).filter((x) => draft.kinds.includes(x));
    }
    saveDraft();
  });
  app.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input[type=text]")) { e.preventDefault(); runSearch(); } });

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  if (trips.length && !draft.points.some((p) => p.trim())) { current = JSON.parse(JSON.stringify(trips[0])); }
  render();
  window.__wwh = { get current() { return current; }, get draft() { return draft; } }; // for testing
})();
