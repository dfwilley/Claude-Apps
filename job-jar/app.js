// The Job Jar! web app. All data stays in this browser (localStorage).
(function () {
  "use strict";
  const J = window.JJ;
  const KEY = "jobjar.v1";
  const $app = document.getElementById("app");
  const $modal = document.getElementById("modal");
  const $party = document.getElementById("party");

  let S = load();
  let view = { screen: S.setupDone ? "home" : "welcome", kidId: null, kidTab: "today", guTab: "kids", histKid: "" };
  let today = new Date();
  let drawSheet = null; // redraws the open editor sheet
  let draft = null;

  // ---------- storage ----------
  function load() {
    try { return J.normalize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) { return J.defaultState(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked: keep going in memory */ }
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- helpers ----------
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kid = () => J.kidById(S, view.kidId);
  const stars = (n) => "⭐".repeat(Math.max(0, n));
  function fmtWhen(iso) {
    const d = new Date(iso);
    const k = J.dayKey(d), tk = J.dayKey(today), yk = J.dayKey(J.addDays(today, -1));
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (k === tk) return "Today " + time;
    if (k === yk) return "Yesterday " + time;
    return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  }
  function kidStyle(k) { return k ? ` style="--kid:${esc(k.color)}"` : ""; }

  // ---------- sound & voice ----------
  let audio = null;
  function tone(freqs, len) {
    if (!S.settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      freqs.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        const t = audio.currentTime + i * len;
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.8);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len * 2);
      });
    } catch (e) { /* no sound available */ }
  }
  const ding = () => tone([784, 1175], 0.11);
  const fanfare = () => tone([523, 659, 784, 1047, 784, 1047], 0.12);
  function say(text) {
    if (!S.settings.speak || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9; u.pitch = 1.15; u.lang = "en-US";
      speechSynthesis.speak(u);
    } catch (e) { /* no voice available */ }
  }

  // ---------- celebration ----------
  let partyTimer = null;
  function celebrate(pic, title, sub, big) {
    const flyers = [];
    const n = big ? 22 : 10;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4, dist = 160 + Math.random() * (big ? 260 : 140);
      flyers.push(`<span class="fly" style="--x:${Math.round(Math.cos(a) * dist)}px;--y:${Math.round(Math.sin(a) * dist)}px;--r:${Math.round(Math.random() * 360)}deg">${i % 5 === 0 && big ? "🎉" : "⭐"}</span>`);
    }
    $party.innerHTML = flyers.join("") + `<div class="card"><div class="pic">${pic}</div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div>`;
    $party.hidden = false;
    clearTimeout(partyTimer);
    partyTimer = setTimeout(() => { $party.hidden = true; }, big ? 2600 : 1500);
  }
  $party.addEventListener("click", () => { $party.hidden = true; });

  // ---------- sheets ----------
  function openSheet(html) { $modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`; $modal.hidden = false; }
  function closeSheet() { $modal.hidden = true; $modal.innerHTML = ""; drawSheet = null; draft = null; }
  $modal.addEventListener("click", (e) => { if (e.target === $modal) closeSheet(); });

  // PIN pad. mode "check": calls ok() on the right PIN. mode "set": asks twice, then calls ok(pin).
  function pinPad(title, mode, ok, cancel) {
    let entry = "", first = "", msg = "";
    const draw = () => {
      const heading = mode === "set" ? (first ? "Type the same 4 numbers again" : title) : title;
      openSheet(`<div class="pin">
        <div class="sheet-head"><span></span><h2></h2><button class="btn" data-act="pin-cancel">Cancel</button></div>
        <div style="font-size:54px">🔒</div><h2>${esc(heading)}</h2>
        <div class="dots" id="dots">${[0, 1, 2, 3].map((i) => `<i class="${i < entry.length ? "on" : ""}"></i>`).join("")}</div>
        <div class="msg">${esc(msg)}</div>
        <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-act="pin-key" data-k="${d}">${d}</button>`).join("")}
          <button class="blank" tabindex="-1"></button><button data-act="pin-key" data-k="0">0</button><button data-act="pin-key" data-k="back" aria-label="Delete">⌫</button></div>
        ${mode === "check" ? `<button class="link" data-act="pin-forgot">Forgot the PIN?</button>` : ""}
      </div>`);
    };
    pinHandler = (k) => {
      if (k === "cancel") { closeSheet(); pinHandler = null; if (cancel) cancel(); return; }
      if (k === "forgot") { pinHandler = null; forgotPin(ok); return; }
      if (k === "back") { entry = entry.slice(0, -1); draw(); return; }
      if (entry.length >= 4) return;
      entry += k; msg = "";
      draw();
      if (entry.length < 4) return;
      setTimeout(() => {
        if (mode === "check") {
          if (entry === S.settings.pin) { pinHandler = null; closeSheet(); ok(); }
          else { entry = ""; msg = "That's not it. Try again."; draw(); const d = document.getElementById("dots"); if (d) d.classList.add("shake"); }
        } else if (!first) { first = entry; entry = ""; draw(); }
        else if (entry === first) { pinHandler = null; closeSheet(); ok(entry); }
        else { first = ""; entry = ""; msg = "Those didn't match. Start again."; draw(); }
      }, 150);
    };
    draw();
  }
  let pinHandler = null;

  function forgotPin(after) {
    const a = 12 + Math.floor(Math.random() * 7), b = 6 + Math.floor(Math.random() * 4);
    openSheet(`<div class="sheet-head"><h2>Reset the grown-up PIN</h2><button class="btn" data-act="close">Cancel</button></div>
      <p class="note">To make sure you're a grown-up: what is ${a} × ${b}?</p>
      <input class="text" id="forgot" inputmode="numeric" autocomplete="off">
      <div class="actions"><button class="btn primary grow" data-act="forgot-ok" data-ans="${a * b}">Next</button></div>`);
    forgotAfter = after;
    setTimeout(() => { const f = document.getElementById("forgot"); if (f) f.focus(); }, 50);
  }
  let forgotAfter = null;

  /** Runs fn() after a grown-up enters the PIN (or right away if no PIN is set). */
  function grownUp(title, fn) {
    if (J.validPin(S.settings.pin)) pinPad(title, "check", fn);
    else {
      openSheet(`<div class="sheet-head"><h2>${esc(title)}</h2><button class="btn" data-act="close">Cancel</button></div>
        <p class="note">No grown-up PIN is set, so anyone can do this. You can add a PIN in Grown-ups › Settings.</p>
        <div class="actions"><button class="btn primary grow" data-act="nopin-ok">OK, go ahead</button></div>`);
      nopinFn = fn;
    }
  }
  let nopinFn = null;

  // ---------- screens ----------
  function render() {
    today = new Date();
    if (view.screen === "welcome") return renderWelcome();
    if (view.screen === "kid" && kid()) return renderKid();
    if (view.screen === "grownup") return renderGrownup();
    view.screen = "home";
    renderHome();
  }

  function renderWelcome() {
    $app.innerHTML = `<div class="wrap"><div class="welcome">
      <img src="icon.svg" alt="">
      <h1>The Job Jar!</h1>
      <p>A picture chore chart for little helpers. Kids tap a picture when a chore is done and earn a star. Stars fill their jar, and a full jar buys a reward your family picks.</p>
      <p>First, a grown-up picks a 4-number PIN. It keeps kids out of the settings and lets you OK rewards.</p>
      <button class="add" data-act="start">Let's start</button>
      <button class="link" data-act="start-nopin">Skip the PIN for now</button>
    </div></div>`;
  }

  function renderHome() {
    const tiles = S.kids.map((k) => {
      const p = J.progress(S, k.id, today);
      const pct = p.total ? Math.round((p.finished / p.total) * 100) : 0;
      return `<button class="kid-tile" data-act="pick-kid" data-id="${k.id}"${kidStyle(k)} aria-label="${esc(k.name)}, ${J.starWord(k.stars)}">
        <div class="face">${k.avatar}</div><div class="name">${esc(k.name)}</div>
        <div class="stars">⭐ ${k.stars}</div>
        <div class="bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
      </button>`;
    }).join("");
    $app.innerHTML = `<header class="top"><h1><img src="icon.svg" alt="">The Job Jar!</h1>
        <button class="grownup-btn" data-act="grownups">🔒 Grown-ups</button></header>
      <div class="wrap">
        ${S.kids.length ? `<p class="ask">Who's helping today?</p><div class="kids">${tiles}</div>`
          : `<div class="empty"><span class="big">👋</span>No kids yet. A grown-up can add them in <b>Grown-ups</b>.</div>`}
      </div>`;
  }

  function renderKid() {
    const k = kid();
    let body = "";
    if (view.kidTab === "today") {
      const list = J.choresFor(S, k.id, today);
      const p = J.progress(S, k.id, today);
      body = (p.allDone ? `<div class="alldone">🎉 All done today! 🎉</div>` : "") + (list.length ? `<div class="chores">${list.map(({ chore, status }) => `
        <div class="chore ${status}" role="button" tabindex="0" data-act="chore" data-id="${chore.id}" aria-label="${esc(chore.name)}${status === "done" ? ", done" : status === "waiting" ? ", waiting for a grown-up" : ""}">
          <button class="say" data-act="say" data-text="${esc(chore.name)}" aria-label="Say it">🔊</button>
          <div class="pic">${chore.pic}</div><div class="label">${esc(chore.name)}</div><div class="pips">${stars(chore.stars)}</div>
          ${status ? `<div class="mark" aria-hidden="true">${status === "done" ? "✓" : "⏳"}</div>` : ""}
        </div>`).join("")}</div>` : `<div class="empty"><span class="big">🌈</span>No chores today. Enjoy!</div>`);
    } else if (view.kidTab === "prizes") {
      body = `<div class="jar-strip"><img src="icon.svg" alt=""><div><div class="n">⭐ ${k.stars}</div><div class="t">${k.stars === 1 ? "star" : "stars"} in ${esc(k.name)}'s jar</div></div></div>` +
        (S.rewards.length ? `<div class="prizes">${S.rewards.map((r) => {
          const ready = k.stars >= r.cost;
          const showDots = r.cost <= 20;
          return `<div class="prize ${ready ? "ready" : ""}">
            <div class="pic">${r.pic}</div><div class="label">${esc(r.name)}</div>
            ${showDots ? `<div class="need" aria-hidden="true">${Array.from({ length: r.cost }, (_, i) => `<span class="${i < k.stars ? "" : "off"}">⭐</span>`).join("")}</div>`
              : `<div class="meter" aria-hidden="true"><i style="width:${Math.min(100, Math.round((k.stars / r.cost) * 100))}%"></i></div>`}
            <div class="count">${ready ? "You have enough!" : `${Math.min(k.stars, r.cost)} of ${r.cost} ⭐`}</div>
            ${ready ? `<button class="get" data-act="get" data-id="${r.id}">Get it!</button>` : `<button class="say" style="position:static;margin-top:8px" data-act="say" data-text="${esc(r.name)}. ${J.starWord(r.cost - k.stars)} to go." aria-label="Say it">🔊</button>`}
          </div>`;
        }).join("")}</div>` : `<div class="empty"><span class="big">🎁</span>No rewards yet. Ask a grown-up to add some!</div>`);
    } else {
      const wk = J.weekChart(S, k.id, today);
      const tk = J.dayKey(today);
      const icon = { done: "⭐", waiting: "⏳", "": "○", off: "", future: "" };
      body = wk.rows.length ? `<div class="week"><table>
        <thead><tr><th></th>${wk.days.map((d, i) => `<th class="${d === tk ? "today" : ""}" title="${J.DAY_NAMES[i]}">${J.DAY_LETTERS[i]}</th>`).join("")}</tr></thead>
        <tbody>${wk.rows.map((r) => `<tr><td class="pic" title="${esc(r.chore.name)}">${r.chore.pic}<small>${esc(r.chore.name)}</small></td>${r.cells.map((c, i) => `<td class="${c === "off" ? "off" : ""} ${c === "" ? "miss" : ""} ${wk.days[i] === tk ? "today" : ""}">${icon[c]}</td>`).join("")}</tr>`).join("")}</tbody>
        <tfoot><tr><td class="pic"><small>Stars</small></td>${wk.earned.map((n) => `<td>${n || ""}</td>`).join("")}</tr></tfoot>
      </table></div><div class="week-total">This week: ⭐ ${wk.total}</div>` : `<div class="empty"><span class="big">📅</span>No chores yet.</div>`;
    }
    $app.innerHTML = `<div${kidStyle(k)}>
      <header class="top kid-head"><button class="round" data-act="home" aria-label="Home">🏠</button>
        <span class="face">${k.avatar}</span><span class="name">${esc(k.name)}</span>
        <span class="pill" aria-label="${J.starWord(k.stars)}">⭐ ${k.stars}</span></header>
      <div class="wrap">${body}</div>
      <nav class="tabs">
        <button class="tab ${view.kidTab === "today" ? "on" : ""}" data-act="kid-tab" data-tab="today"><b>✅</b>Today</button>
        <button class="tab ${view.kidTab === "prizes" ? "on" : ""}" data-act="kid-tab" data-tab="prizes"><b>🎁</b>Prizes</button>
        <button class="tab ${view.kidTab === "week" ? "on" : ""}" data-act="kid-tab" data-tab="week"><b>📅</b>My week</button>
      </nav></div>`;
  }

  function renderGrownup() {
    const waiting = J.waitingList(S);
    const tabs = [["kids", "👧 Kids"], ["chores", "🧹 Chores"], ["rewards", "🎁 Rewards"], ["history", "📜 History"], ["settings", "⚙️ Settings"]];
    if (S.settings.needsApproval || waiting.length) tabs.unshift(["check", "✅ Check" + (waiting.length ? ` <span class="badge">${waiting.length}</span>` : "")]);
    if (!tabs.some((t) => t[0] === view.guTab)) view.guTab = "kids";
    let body = "";
    const t = view.guTab;
    if (t === "check") {
      body = waiting.length ? `<div class="list">${waiting.map((w) => {
        const k = J.kidById(S, w.kidId);
        return `<div class="row"><span class="pic">${w.chore.pic}</span><div class="main"><b>${esc(w.chore.name)}</b><small>${k.avatar} ${esc(k.name)} · ${w.day === J.dayKey(today) ? "today" : esc(J.parseDay(w.day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }))}</small></div>
          <button class="btn" data-act="reject" data-kid="${w.kidId}" data-chore="${w.chore.id}" data-day="${w.day}" aria-label="Not done">✗</button>
          <button class="btn good" data-act="approve" data-kid="${w.kidId}" data-chore="${w.chore.id}" data-day="${w.day}">✓ ${stars(w.chore.stars)}</button></div>`;
      }).join("")}</div><button class="add" data-act="approve-all">✓ OK all of them</button>` : `<div class="empty"><span class="big">👍</span>Nothing waiting to be checked.</div>`;
      body += `<p class="note">“Grown-up checks chores first” is ${S.settings.needsApproval ? "on" : "off"} (Settings). When it's on, a chore turns yellow ⏳ until you OK it here, then the stars go in the jar.</p>`;
    } else if (t === "kids") {
      body = (S.kids.length ? `<div class="list">${S.kids.map((k) => `<button class="row" data-act="edit-kid" data-id="${k.id}"><span class="pic">${k.avatar}</span>
          <div class="main"><b style="color:${esc(k.color)}">${esc(k.name)}</b><small>${J.choresFor(S, k.id, today).length} chores today</small></div><span class="end">⭐ ${k.stars} ›</span></button>`).join("")}</div>`
        : `<p class="note">Add each child who will use The Job Jar! on this device. Each gets their own picture, chores and star jar.</p>`) +
        `<button class="add" data-act="edit-kid">+ Add a kid</button>`;
    } else if (t === "chores") {
      body = `<div class="list">${S.chores.map((c) => `<button class="row" data-act="edit-chore" data-id="${c.id}"><span class="pic">${c.pic}</span>
          <div class="main"><b>${esc(c.name)}</b><small>${daysText(c.days)} · ${whoText(c.kids)}</small></div><span class="end">${stars(c.stars)} ›</span></button>`).join("")}</div>
        <button class="add" data-act="edit-chore">+ Add a chore</button>
        <p class="note">Pick a picture for each chore so kids who can't read yet know what it is. They can also tap 🔊 to hear it.</p>`;
    } else if (t === "rewards") {
      body = `<div class="list">${S.rewards.map((r) => `<button class="row" data-act="edit-reward" data-id="${r.id}"><span class="pic">${r.pic}</span>
          <div class="main"><b>${esc(r.name)}</b></div><span class="end">⭐ ${r.cost} ›</span></button>`).join("")}</div>
        <button class="add" data-act="edit-reward">+ Add a reward</button>
        <p class="note">When a kid has enough stars, a “Get it!” button appears. A grown-up enters the PIN to OK it, and the stars come out of the jar.</p>`;
    } else if (t === "history") {
      const list = S.log.filter((e) => !view.histKid || e.kid === view.histKid).slice(0, 150);
      body = `<div class="seg" style="margin-bottom:12px"><button class="${!view.histKid ? "on" : ""}" data-act="hist-kid" data-id="">Everyone</button>${S.kids.map((k) => `<button class="${view.histKid === k.id ? "on" : ""}" data-act="hist-kid" data-id="${k.id}">${k.avatar} ${esc(k.name)}</button>`).join("")}</div>` +
        (list.length ? `<div class="list">${list.map((e) => { const k = J.kidById(S, e.kid); return `<div class="row"><span class="pic">${e.pic || "⭐"}</span>
          <div class="main"><b>${esc(e.text)}</b><small>${k ? k.avatar + " " + esc(k.name) + " · " : ""}${esc(fmtWhen(e.t))}</small></div>
          <span class="end ${e.delta > 0 ? "plus" : e.delta < 0 ? "minus" : ""}">${e.delta > 0 ? "+" : ""}${e.delta} ⭐</span></div>`; }).join("")}</div>` : `<div class="empty">Nothing yet.</div>`);
    } else {
      body = `<div class="section">Grown-up PIN</div><div class="list">
          <button class="row" data-act="change-pin"><span class="pic">🔒</span><div class="main"><b>${J.validPin(S.settings.pin) ? "Change the PIN" : "Set a PIN"}</b><small>${J.validPin(S.settings.pin) ? "Needed to open Grown-ups and to OK rewards" : "No PIN: anyone can open Grown-ups"}</small></div><span class="end">›</span></button>
          ${J.validPin(S.settings.pin) ? `<button class="row" data-act="remove-pin"><span class="pic">🔓</span><div class="main"><b>Remove the PIN</b></div></button>` : ""}
        </div>
        <div class="section">How it works</div><div class="list">
          ${toggle("needsApproval", "Grown-up checks chores first", "Stars go in the jar after you OK each chore")}
          ${toggle("sound", "Sounds", "A happy chime when a star is earned")}
          ${toggle("speak", "Read chores out loud", "Says the chore name when a kid taps 🔊 or finishes a chore")}
        </div>
        <div class="section">Backup</div><div class="list">
          <button class="row" data-act="backup"><span class="pic">💾</span><div class="main"><b>Save a backup file</b><small>Kids, chores, rewards and stars</small></div></button>
          <label class="row" style="cursor:pointer"><span class="pic">📂</span><div class="main"><b>Restore from a backup file</b><small>Replaces what's on this device</small></div><input type="file" accept=".json,application/json" id="restore" hidden></label>
        </div>
        <div class="section">Start over</div><div class="list">
          <button class="row" data-act="erase"><span class="pic">🗑️</span><div class="main"><b style="color:var(--red)">Erase everything</b><small>Removes all kids, chores, rewards and stars on this device</small></div></button>
        </div>
        <p class="note">Everything stays on this device. Nothing is sent anywhere. Version 1.0.</p>`;
    }
    $app.innerHTML = `<header class="top"><h1>Grown-ups</h1><button class="btn primary" data-act="home">Done</button></header>
      <div class="wrap gu"><div class="gu-tabs">${tabs.map(([id, label]) => `<button class="${view.guTab === id ? "on" : ""}" data-act="gu-tab" data-tab="${id}">${label}</button>`).join("")}</div>${body}</div>`;
    const r = document.getElementById("restore");
    if (r) r.addEventListener("change", restore);
  }

  function toggle(key, title, sub) {
    return `<label class="toggle-row"><span>${esc(title)}<small>${esc(sub)}</small></span><input type="checkbox" class="switch" data-set="${key}" ${S.settings[key] ? "checked" : ""}></label>`;
  }
  function daysText(days) {
    if (!days || days.length === 7) return "Every day";
    const s = days.slice().sort().join("");
    if (s === "12345") return "School days";
    if (s === "06") return "Weekends";
    return days.slice().sort().map((d) => J.DAY_NAMES[d].slice(0, 3)).join(", ");
  }
  function whoText(ids) {
    if (!ids || !ids.length) return "Everyone";
    return ids.map((id) => { const k = J.kidById(S, id); return k ? k.name : ""; }).filter(Boolean).join(", ") || "Everyone";
  }

  // ---------- editors ----------
  function picGrid(list, current, act) {
    return `<div class="picks">${list.map((p) => { const pic = Array.isArray(p) ? p[0] : p, name = Array.isArray(p) ? p[1] : ""; return `<button class="${pic === current ? "on" : ""}" data-act="${act}" data-pic="${pic}" data-name="${esc(name)}" title="${esc(name)}" aria-label="${esc(name || pic)}">${pic}</button>`; }).join("")}</div>`;
  }

  function editKid(id) {
    const k = id ? J.kidById(S, id) : null;
    const used = S.kids.map((x) => x.avatar);
    draft = k ? Object.assign({}, k) : { id: null, name: "", avatar: J.AVATARS.find((a) => !used.includes(a)) || J.AVATARS[0], color: J.COLORS[S.kids.length % J.COLORS.length], give: 1 };
    draft.give = 1;
    drawSheet = () => {
      openSheet(`<div class="sheet-head"><h2>${k ? "Edit " + esc(k.name) : "Add a kid"}</h2><button class="btn" data-act="close">Cancel</button></div>
        <label class="field" for="nm">Name</label><input class="text" id="nm" value="${esc(draft.name)}" maxlength="20" autocomplete="off" placeholder="First name">
        <span class="field">Picture (so they can find their own chart)</span>${picGrid(J.AVATARS, draft.avatar, "d-avatar")}
        <span class="field">Color</span><div class="colors">${J.COLORS.map((c) => `<button class="${c === draft.color ? "on" : ""}" style="background:${c}" data-act="d-color" data-c="${c}" aria-label="Color ${c}"></button>`).join("")}</div>
        ${k ? `<span class="field">Stars in the jar: ⭐ ${k.stars}</span>
          <div class="stepper"><button data-act="d-give" data-n="-1" aria-label="Less">−</button><output>${draft.give}</output><button data-act="d-give" data-n="1" aria-label="More">+</button></div>
          <input class="text" id="why" placeholder="Why? (optional, e.g. Helped Grandma)" maxlength="40" style="margin-top:10px">
          <div class="actions"><button class="btn good grow" data-act="give" data-sign="1">Give ${J.starWord(draft.give)}</button><button class="btn grow" data-act="give" data-sign="-1">Take away ${draft.give}</button></div>` : ""}
        <div class="actions">${k ? `<button class="btn danger" data-act="del-kid">Remove</button>` : ""}<button class="btn primary grow" data-act="save-kid">Save</button></div>`);
    };
    drawSheet();
  }

  function editChore(id) {
    const c = id ? J.choreById(S, id) : null;
    draft = c ? JSON.parse(JSON.stringify(c)) : { id: null, pic: "🛏️", name: "", stars: 1, days: J.ALL_DAYS.slice(), kids: [] };
    drawSheet = () => {
      openSheet(`<div class="sheet-head"><h2>${c ? "Edit chore" : "Add a chore"}</h2><button class="btn" data-act="close">Cancel</button></div>
        <span class="field">Picture</span>${picGrid(J.CHORE_PICS, draft.pic, "d-pic")}
        <label class="field" for="nm">Name (read out loud when a kid taps 🔊)</label><input class="text" id="nm" value="${esc(draft.name)}" maxlength="30" autocomplete="off" placeholder="Make bed">
        <span class="field">Stars it earns</span><div class="seg">${[1, 2, 3, 4, 5].map((n) => `<button class="${draft.stars === n ? "on" : ""}" data-act="d-stars" data-n="${n}">${stars(n)}</button>`).join("")}</div>
        <span class="field">Which days</span><div class="seg">${J.ALL_DAYS.map((d) => `<button class="${draft.days.includes(d) ? "on" : ""}" data-act="d-day" data-d="${d}" aria-label="${J.DAY_NAMES[d]}">${J.DAY_NAMES[d].slice(0, 3)}</button>`).join("")}
          <button data-act="d-everyday">Every day</button></div>
        <span class="field">Who does it</span><div class="seg"><button class="${!draft.kids.length ? "on" : ""}" data-act="d-kid" data-id="">Everyone</button>${S.kids.map((k) => `<button class="${draft.kids.includes(k.id) ? "on" : ""}" data-act="d-kid" data-id="${k.id}">${k.avatar} ${esc(k.name)}</button>`).join("")}</div>
        <div class="actions">${c ? `<button class="btn danger" data-act="del-chore">Delete</button>` : ""}<button class="btn primary grow" data-act="save-chore">Save</button></div>`);
    };
    drawSheet();
  }

  function editReward(id) {
    const r = id ? J.rewardById(S, id) : null;
    draft = r ? Object.assign({}, r) : { id: null, pic: "🍦", name: "", cost: 10 };
    drawSheet = () => {
      openSheet(`<div class="sheet-head"><h2>${r ? "Edit reward" : "Add a reward"}</h2><button class="btn" data-act="close">Cancel</button></div>
        <span class="field">Picture</span>${picGrid(J.REWARD_PICS, draft.pic, "d-pic")}
        <label class="field" for="nm">Name</label><input class="text" id="nm" value="${esc(draft.name)}" maxlength="30" autocomplete="off" placeholder="Ice cream trip">
        <span class="field">Stars it costs</span>
        <div class="stepper"><button data-act="d-cost" data-n="-5" aria-label="5 less">−5</button><button data-act="d-cost" data-n="-1" aria-label="Less">−</button><output>⭐ ${draft.cost}</output><button data-act="d-cost" data-n="1" aria-label="More">+</button><button data-act="d-cost" data-n="5" aria-label="5 more">+5</button></div>
        <p class="note">Tip: a small treat at 5 to 10 stars keeps young kids excited; save bigger trips for 20 or more.</p>
        <div class="actions">${r ? `<button class="btn danger" data-act="del-reward">Delete</button>` : ""}<button class="btn primary grow" data-act="save-reward">Save</button></div>`);
    };
    drawSheet();
  }

  function keepName() { const n = document.getElementById("nm"); if (n && draft) draft.name = n.value; }

  // ---------- backup ----------
  function backup() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "The Job Jar backup " + J.dayKey(new Date()) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function restore(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      const data = JSON.parse(t);
      if (!data || !Array.isArray(data.kids) || !Array.isArray(data.chores)) throw new Error("not a Job Jar backup");
      if (!confirm("Replace everything on this device with the backup from that file?")) return;
      S = J.normalize(data); S.setupDone = true; save(); render();
      alert("Backup restored.");
    }).catch(() => alert("That file isn't a Job Jar backup."));
  }

  // ---------- actions ----------
  const act = {
    start() { pinPad("Pick a 4-number grown-up PIN", "set", (pin) => { S.settings.pin = pin; finishSetup(); }); },
    "start-nopin"() { finishSetup(); },
    home() { view.screen = "home"; render(); },
    grownups() { grownUp("Grown-ups only", () => { view.screen = "grownup"; if (J.waitingList(S).length) view.guTab = "check"; render(); }); },
    "pick-kid"(d) { view.screen = "kid"; view.kidId = d.id; view.kidTab = "today"; render(); const k = kid(); if (k) say("Hi " + k.name + "!"); },
    "kid-tab"(d) { view.kidTab = d.tab; render(); window.scrollTo(0, 0); },
    say(d) { say(d.text); },
    chore(d) {
      const k = kid(), c = J.choreById(S, d.id);
      if (!k || !c) return;
      const st = J.statusOf(S, k.id, c.id, today);
      if (st) {
        openSheet(`<div style="text-align:center"><div style="font-size:80px">${c.pic}</div><h2 style="font-size:26px;margin:6px 0 18px">${esc(c.name)}</h2>
          <div class="actions"><button class="btn grow" style="font-size:22px;padding:18px" data-act="undo" data-id="${c.id}">↩️ Not done yet</button>
          <button class="btn good grow" style="font-size:22px;padding:18px" data-act="close">${st === "done" ? "✓ It's done!" : "⏳ Keep waiting"}</button></div></div>`);
        say(st === "done" ? c.name + ". Done!" : c.name + ". Waiting for a grown-up.");
        return;
      }
      const got = J.markDone(S, k.id, c.id, today);
      save(); render(); ding();
      const p = J.progress(S, k.id, today);
      if (p.allDone) {
        setTimeout(fanfare, 250);
        celebrate("🏆", "All done today!", got ? "+" + J.starWord(got) : "", true);
        say("Great job " + k.name + "! All your chores are done!");
      } else if (got) {
        celebrate(c.pic, "Great job!", "+" + J.starWord(got));
        say(c.name + ". Great job! " + J.starWord(got) + "!");
      } else {
        celebrate("⏳", "Nice work!", "A grown-up will check it");
        say("Nice work! A grown-up will check it.");
      }
    },
    undo(d) { const k = kid(); J.undo(S, k.id, d.id, today); save(); closeSheet(); render(); },
    get(d) {
      const k = kid(), r = J.rewardById(S, d.id);
      if (!k || !r) return;
      say("Ask a grown-up for " + r.name + "!");
      grownUp("Grown-up: OK " + r.name + " for " + k.name + "?", () => {
        if (J.redeem(S, k.id, r.id)) {
          save(); render(); fanfare();
          celebrate(r.pic, r.name + "!", "−" + J.starWord(r.cost), true);
          say("Hooray! " + r.name + "!");
        }
      });
    },
    "gu-tab"(d) { view.guTab = d.tab; render(); },
    "hist-kid"(d) { view.histKid = d.id; render(); },
    approve(d) { J.approve(S, d.kid, d.chore, d.day); save(); render(); ding(); },
    reject(d) { J.reject(S, d.kid, d.chore, d.day); save(); render(); },
    "approve-all"() { J.waitingList(S).forEach((w) => J.approve(S, w.kidId, w.chore.id, w.day)); save(); render(); fanfare(); },
    "edit-kid"(d) { editKid(d.id); },
    "edit-chore"(d) { editChore(d.id); },
    "edit-reward"(d) { editReward(d.id); },
    "d-avatar"(d) { keepName(); draft.avatar = d.pic; drawSheet(); },
    "d-color"(d) { keepName(); draft.color = d.c; drawSheet(); },
    "d-give"(d) { keepName(); draft.give = Math.max(1, Math.min(50, draft.give + Number(d.n))); drawSheet(); },
    give(d) {
      keepName();
      const why = (document.getElementById("why") || {}).value || "";
      J.adjust(S, draft.id, Number(d.sign) * draft.give, why.trim());
      save(); render(); const id = draft.id, name = draft.name; editKid(id); draft.name = name; drawSheet();
      if (Number(d.sign) > 0) ding();
    },
    "save-kid"() {
      keepName();
      const name = draft.name.trim();
      if (!name) { const n = document.getElementById("nm"); n.focus(); n.placeholder = "Type a name first"; return; }
      if (draft.id) Object.assign(J.kidById(S, draft.id), { name, avatar: draft.avatar, color: draft.color });
      else S.kids.push({ id: J.newId("k"), name, avatar: draft.avatar, color: draft.color, stars: 0 });
      save(); closeSheet(); render();
    },
    "del-kid"() {
      const k = J.kidById(S, draft.id);
      if (!confirm("Remove " + k.name + " and their stars and history? This can't be undone.")) return;
      J.removeKid(S, k.id); save(); closeSheet(); render();
    },
    "d-pic"(d) {
      keepName();
      const oldDefault = (draft.cost ? J.REWARD_PICS : J.CHORE_PICS).some((p) => p[1] === draft.name);
      draft.pic = d.pic;
      if (d.name && (!draft.name.trim() || oldDefault)) draft.name = d.name;
      drawSheet();
    },
    "d-stars"(d) { keepName(); draft.stars = Number(d.n); drawSheet(); },
    "d-day"(d) {
      keepName();
      const n = Number(d.d);
      draft.days = draft.days.includes(n) ? draft.days.filter((x) => x !== n) : draft.days.concat(n).sort();
      drawSheet();
    },
    "d-everyday"() { keepName(); draft.days = J.ALL_DAYS.slice(); drawSheet(); },
    "d-kid"(d) {
      keepName();
      if (!d.id) draft.kids = [];
      else draft.kids = draft.kids.includes(d.id) ? draft.kids.filter((x) => x !== d.id) : draft.kids.concat(d.id);
      if (draft.kids.length === S.kids.length) draft.kids = [];
      drawSheet();
    },
    "save-chore"() {
      keepName();
      const name = draft.name.trim();
      if (!name) { const n = document.getElementById("nm"); n.focus(); n.placeholder = "Type a name first"; return; }
      if (!draft.days.length) { alert("Pick at least one day."); return; }
      const c = { pic: draft.pic, name, stars: draft.stars, days: draft.days.slice().sort(), kids: draft.kids.slice() };
      if (draft.id) Object.assign(J.choreById(S, draft.id), c); else S.chores.push(Object.assign({ id: J.newId("c") }, c));
      save(); closeSheet(); render();
    },
    "del-chore"() { if (!confirm("Delete this chore?")) return; S.chores = S.chores.filter((c) => c.id !== draft.id); save(); closeSheet(); render(); },
    "d-cost"(d) { keepName(); draft.cost = Math.max(1, Math.min(500, draft.cost + Number(d.n))); drawSheet(); },
    "save-reward"() {
      keepName();
      const name = draft.name.trim();
      if (!name) { const n = document.getElementById("nm"); n.focus(); n.placeholder = "Type a name first"; return; }
      const r = { pic: draft.pic, name, cost: draft.cost };
      if (draft.id) Object.assign(J.rewardById(S, draft.id), r); else S.rewards.push(Object.assign({ id: J.newId("r") }, r));
      save(); closeSheet(); render();
    },
    "del-reward"() { if (!confirm("Delete this reward?")) return; S.rewards = S.rewards.filter((r) => r.id !== draft.id); save(); closeSheet(); render(); },
    "change-pin"() { pinPad("Pick a new 4-number PIN", "set", (pin) => { S.settings.pin = pin; save(); render(); }); },
    "remove-pin"() { if (confirm("Remove the PIN? Anyone could then open Grown-ups and OK rewards.")) { S.settings.pin = ""; save(); render(); } },
    backup() { backup(); },
    erase() {
      if (!confirm("Erase all kids, chores, rewards and stars on this device?")) return;
      if (!confirm("Are you sure? This can't be undone. (Save a backup first if you might want it.)")) return;
      S = J.defaultState(); save(); view = { screen: "welcome", kidTab: "today", guTab: "kids", histKid: "" }; render();
    },
    close() { closeSheet(); },
    "pin-key"(d) { if (pinHandler) pinHandler(d.k); },
    "pin-cancel"() { if (pinHandler) pinHandler("cancel"); else closeSheet(); },
    "pin-forgot"() { if (pinHandler) pinHandler("forgot"); },
    "forgot-ok"(d) {
      const v = (document.getElementById("forgot") || {}).value;
      if (String(v).trim() !== d.ans) { alert("That's not right."); return; }
      const after = forgotAfter;
      pinPad("Pick a new 4-number PIN", "set", (pin) => { S.settings.pin = pin; save(); if (after) after(); });
    },
    "nopin-ok"() { const fn = nopinFn; nopinFn = null; closeSheet(); if (fn) fn(); },
  };

  function finishSetup() {
    S.setupDone = true; save();
    view.screen = "grownup"; view.guTab = "kids"; render();
    editKid(null);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || !act[el.dataset.act]) return;
    e.preventDefault();
    act[el.dataset.act](el.dataset, el);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
    if (e.key === "Escape" && !$modal.hidden) { if (pinHandler) pinHandler("cancel"); else closeSheet(); }
    if (pinHandler && /^[0-9]$/.test(e.key)) pinHandler(e.key);
    if (pinHandler && e.key === "Backspace") pinHandler("back");
  });
  document.addEventListener("change", (e) => {
    const k = e.target.dataset && e.target.dataset.set;
    if (!k) return;
    S.settings[k] = e.target.checked; save();
    if (k === "needsApproval") render();
  });

  // A new day starts a fresh chart, even if the app was left open overnight.
  let shownDay = J.dayKey(new Date());
  function checkDay() {
    const k = J.dayKey(new Date());
    if (k !== shownDay) { shownDay = k; J.prune(S, new Date()); save(); if ($modal.hidden) render(); }
  }
  setInterval(checkDay, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });

  J.prune(S, new Date()); save();
  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  // For tests
  window.__jj = { get state() { return S; }, get view() { return view; }, render };
})();
