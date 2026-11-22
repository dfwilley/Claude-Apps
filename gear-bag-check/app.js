// Gear Bag Check — the screens. The packing rules live in core.js.
(function () {
  "use strict";
  const G = window.GB;
  const STORE = "gearbag-v1";
  const app = document.getElementById("app");
  const modal = document.getElementById("modal");

  // ---------- Saving ----------
  let state = load();
  let saveWarned = false;
  function load() {
    try { const raw = localStorage.getItem(STORE); if (raw) return G.normalize(JSON.parse(raw)); } catch (e) { /* start fresh */ }
    return G.defaultState();
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); }
    catch (e) { if (!saveWarned) { saveWarned = true; toast("This phone isn't letting the app save. Changes may be lost when it closes."); } }
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }

  // ---------- Little helpers ----------
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const now = () => new Date();
  let view = { name: "home" };
  function go(v) { view = v; render(); window.scrollTo(0, 0); }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function say(text) {
    if (!state.settings.speak || !("speechSynthesis" in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; speechSynthesis.speak(u); } catch (e) { /* no voice */ }
  }
  let audio = null;
  function tone(notes) {
    if (!state.settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audio.currentTime;
      notes.forEach((f, i) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = "sine"; o.frequency.value = f;
        const t = t0 + i * 0.12;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.32);
      });
    } catch (e) { /* no sound */ }
  }
  const DING = [880], UNDO = [440], FANFARE = [523, 659, 784, 1047];

  function fmtDate(t) {
    return new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  }
  function fmtDayKey(k) {
    if (!k) return "";
    const p = k.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  function daysText(bag) {
    if (!bag.days.length) return "";
    if (bag.days.length === 7) return "Every day";
    return bag.days.slice().sort().map((d) => G.DAY_NAMES[d].slice(0, 3)).join(", ");
  }
  function avatar(kid, size) {
    return '<span class="avatar ' + (size || "") + '" style="--kid:' + esc(kid.color) + '">' + esc(kid.avatar) + "</span>";
  }
  function topBar(title, back, extra) {
    return '<header class="top">' + (back ? '<button class="round" data-a="back" aria-label="Back">‹</button>' : "") +
      "<h1>" + title + "</h1>" + (extra || "") + "</header>";
  }
  function back() {
    const v = view;
    if (v.name === "check" || v.name === "done") go({ name: "kid", kidId: (G.bagById(state, v.bagId) || {}).kidId });
    else if (v.name === "editBag") go({ name: "editKid", kidId: (G.bagById(state, v.bagId) || {}).kidId });
    else if (v.name === "editKid") go({ name: "grown" });
    else go({ name: "home" });
  }

  // ---------- Screens ----------
  function render() {
    const v = view;
    if ((v.kidId && !G.kidById(state, v.kidId)) || (v.bagId && !G.bagById(state, v.bagId))) view = { name: "home" };
    const fn = { home: homeView, kid: kidView, check: checkView, done: doneView, grown: grownView, editKid: editKidView, editBag: editBagView }[view.name];
    app.innerHTML = fn();
    document.body.dataset.view = view.name;
    const bag = view.bagId && G.bagById(state, view.bagId);
    const kid = G.kidById(state, view.kidId || (bag && bag.kidId));
    document.documentElement.dataset.theme = kid ? kid.theme : "field";
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#EEF4F0";
  }

  function grownButton() {
    const n = G.attention(state).length;
    return '<button class="hold" data-hold="grown" aria-label="Grown-ups: press and hold">' +
      '<span class="hold-fill"></span><span class="hold-text">🔧 Grown-ups' + (n ? ' <b class="badge">' + n + "</b>" : "") +
      '</span><small>press and hold</small></button>';
  }

  function homeView() {
    let h = topBar('<img src="icon.svg" alt=""> Gear Bag Check');
    h += '<div class="wrap">';
    if (!state.kids.length) {
      h += '<section class="card welcome"><div class="big-emoji">🎒</div><h2>Preflight your gear bag</h2>' +
        "<p>Like a pilot's checklist: before you head out the door, tap each thing as it goes in the bag. " +
        "You'll see right away what's still missing, and grown-ups see what's worn out or lost.</p>" +
        '<button class="btn primary" data-a="firstKid">Add the first player</button></section>';
    } else {
      h += '<p class="lead">Who\'s packing?</p><div class="kids">';
      const d = now();
      state.kids.forEach((k) => {
        const today = G.bagsToday(state, k.id, d);
        h += '<button class="kid-card" style="--kid:' + esc(k.color) + '" data-a="kid" data-id="' + k.id + '">' + avatar(k, "xl") +
          '<span class="kid-name">' + esc(k.name) + "</span>" +
          (today.length ? '<span class="today">Today: ' + today.map((b) => esc(b.emoji + " " + b.name)).join(", ") + "</span>" : "") + "</button>";
      });
      h += "</div>";
    }
    h += '<div class="foot">' + grownButton() + "</div></div>";
    return h;
  }

  function kidView() {
    const kid = G.kidById(state, view.kidId), d = now();
    const bags = G.bagsFor(state, kid.id).slice().sort((a, b) => Number(G.isToday(b, d)) - Number(G.isToday(a, d)));
    let h = topBar(avatar(kid) + " " + esc(kid.name) + "'s bags", true, '<button class="round" data-a="style" aria-label="Change my style">🎨</button>');
    h += '<div class="wrap">';
    if (!bags.length) h += '<section class="card welcome"><div class="big-emoji">🎒</div><p>No bags yet. Ask a grown-up to add one.</p></section>';
    h += '<div class="bags">';
    bags.forEach((b) => {
      const sm = G.summary(state, b.id, d);
      const flags = b.items.filter((i) => i.status !== "ok").length;
      h += '<button class="bag-card" data-a="check" data-id="' + b.id + '">' +
        '<span class="bag-emoji">' + esc(b.emoji) + "</span>" +
        '<span class="bag-text"><span class="bag-name">' + esc(b.name) + (G.isToday(b, d) ? ' <span class="chip today-chip">Today</span>' : "") + "</span>" +
        '<span class="bag-sub">' + (sm.packed ? sm.packed + " of " + sm.total + " in the bag" : sm.total + " things to pack") +
        (flags ? ' · <span class="warn">' + flags + " need a grown-up</span>" : "") + "</span></span>" +
        (sm.allPacked ? '<span class="ok-mark">✓</span>' : '<span class="go">›</span>') + "</button>";
    });
    h += "</div></div>";
    return h;
  }

  function tile(bag, item, packed) {
    const st = G.STATUS[item.status];
    const cls = "tile" + (packed ? " packed" : "") + (item.status === "lost" ? " lost" : "") + (item.status !== "ok" && item.status !== "lost" ? " flagged" : "");
    return '<div class="' + cls + '">' +
      '<button class="tile-main" data-a="pack" data-id="' + item.id + '" aria-pressed="' + packed + '" aria-label="' +
      esc(item.name + (item.count > 1 ? ", " + item.count : "") + (packed ? ", in the bag" : ", not packed") + (st.short ? ", " + st.short : "")) + '">' +
      '<span class="tile-emoji">' + esc(item.emoji) + "</span>" +
      '<span class="tile-name">' + esc(item.name) + "</span>" +
      (item.count > 1 ? '<span class="count">×' + item.count + "</span>" : "") +
      (st.short ? '<span class="status s-' + item.status + '">' + st.icon + " " + st.short + "</span>" : "") +
      '<span class="check" aria-hidden="true">✓</span></button>' +
      '<button class="tile-more" data-a="report" data-id="' + item.id + '" aria-label="Something wrong with ' + esc(item.name) + '">!</button></div>';
  }

  function checkView() {
    const bag = G.bagById(state, view.bagId), kid = G.kidById(state, bag.kidId), d = now();
    const sm = G.summary(state, bag.id, d), c = G.currentCheck(state, bag.id, d);
    const pct = sm.total ? Math.round((sm.packed / sm.total) * 100) : 0;
    let h = topBar(esc(bag.emoji + " " + bag.name) + ' <small class="sub">' + esc(kid.name) + "</small>", true);
    h += '<div class="wrap">';
    h += '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + sm.total + '" aria-valuenow="' + sm.packed + '">' +
      '<div class="bar"><span style="width:' + pct + '%"></span></div>' +
      '<div class="ptext"><b>' + sm.packed + " of " + sm.total + "</b> in the bag</div></div>";
    if (!bag.items.length) h += '<section class="card"><p>This bag has nothing on its list yet. Ask a grown-up to add things.</p></section>';
    G.CATS.forEach(([key, label]) => {
      const items = bag.items.filter((i) => i.cat === key);
      if (!items.length) return;
      h += '<h2 class="sect">' + label + '</h2><div class="tiles">' + items.map((i) => tile(bag, i, c.packed.includes(i.id))).join("") + "</div>";
    });
    h += '<p class="hint">Tap a picture when it goes in the bag. Tap <b>!</b> if you can\'t find it, or it\'s worn out or too small.</p>';
    h += "</div>";
    h += '<div class="dock"><button class="btn ghost" data-a="startOver">Start over</button>' +
      '<button class="btn primary big" data-a="ready"' + (bag.items.length ? "" : " disabled") + ">Ready to go</button></div>";
    return h;
  }

  function doneView() {
    const bag = G.bagById(state, view.bagId), kid = G.kidById(state, bag.kidId), sm = G.summary(state, bag.id, now());
    let h = topBar(esc(bag.emoji + " " + bag.name), true);
    h += '<div class="wrap">';
    if (sm.allPacked) {
      h += '<section class="card done good"><div class="big-emoji fly">✈️</div><h2>Cleared for takeoff!</h2>' +
        "<p>Everything's in " + esc(kid.name) + "'s " + esc(bag.name.toLowerCase()) + " bag. Have a great time!</p>";
      if (sm.flagged.length) {
        h += '<div class="note"><b>Tell a grown-up:</b><ul>' + sm.flagged.map((i) => "<li>" + esc(i.emoji + " " + i.name) + " — " +
          esc(G.STATUS[i.status].label.toLowerCase()) + "</li>").join("") + "</ul></div>";
      }
      h += '<button class="btn primary big" data-a="home">Done</button></section>';
    } else {
      h += '<section class="card done hold-short"><div class="big-emoji">✋</div><h2>Hold short!</h2><p>Still not in the bag:</p>' +
        '<div class="missing">' + sm.missing.map((i) => '<button class="miss" data-a="packFromDone" data-id="' + i.id + '"><span>' + esc(i.emoji) +
        "</span>" + esc(i.name) + (i.count > 1 ? " ×" + i.count : "") + (i.status === "lost" ? ' <span class="status s-lost">🔍 Lost</span>' : "") +
        "</button>").join("") + "</div>" +
        '<p class="hint">Found one? Tap it to put it in the bag.</p>' +
        '<div class="row"><button class="btn primary big" data-a="check" data-id="' + bag.id + '">Go find them</button>' +
        '<button class="btn ghost" data-a="leave">Leave without them</button></div></section>';
    }
    h += "</div>";
    return h;
  }

  function grownView() {
    const att = G.attention(state);
    let h = topBar("🔧 Grown-ups", true);
    h += '<div class="wrap">';
    h += '<section class="card"><h2>Needs attention' + (att.length ? ' <b class="badge">' + att.length + "</b>" : "") + "</h2>";
    if (!att.length) h += '<p class="soft">Nothing lost, worn out or outgrown. 👍</p>';
    else {
      h += '<ul class="att">' + att.map((a) => '<li class="att-row">' + avatar(a.kid) +
        '<div class="att-text"><b>' + esc(a.item.emoji + " " + a.item.name) + "</b> " +
        '<span class="status s-' + a.item.status + '">' + G.STATUS[a.item.status].icon + " " + esc(G.STATUS[a.item.status].label) + "</span>" +
        '<div class="soft">' + esc(a.kid.name + " · " + a.bag.name) + (a.item.statusDay ? " · since " + esc(fmtDayKey(a.item.statusDay)) : "") + "</div>" +
        (a.item.note ? '<div class="quote">“' + esc(a.item.note) + "”</div>" : "") + "</div>" +
        '<button class="btn small" data-a="fixed" data-bag="' + a.bag.id + '" data-id="' + a.item.id + '">' +
        (a.item.status === "lost" ? "Found it" : "Replaced") + "</button></li>").join("") + "</ul>";
    }
    h += "</section>";

    h += '<section class="card"><h2>Players</h2><div class="list">';
    state.kids.forEach((k) => {
      const n = G.bagsFor(state, k.id).length;
      h += '<button class="list-row" data-a="editKid" data-id="' + k.id + '">' + avatar(k) + '<span class="grow"><b>' + esc(k.name) +
        '</b><span class="soft"> · ' + n + (n === 1 ? " bag" : " bags") + '</span></span><span class="go">›</span></button>';
    });
    h += '</div><button class="btn" data-a="addKid">+ Add a player</button></section>';

    const recent = state.log.slice(0, 12);
    h += '<section class="card"><h2>Recent door checks</h2>';
    if (!recent.length) h += '<p class="soft">None yet.</p>';
    else h += '<ul class="log">' + recent.map((e) => {
      const k = G.kidById(state, e.kidId);
      return "<li><b>" + esc((k ? k.name : "Someone") + " · " + e.bagName) + "</b> " +
        (e.missing.length ? '<span class="warn">left without ' + esc(e.missing.join(", ")) + "</span>" : '<span class="good-text">all packed ✓</span>') +
        '<div class="soft">' + esc(fmtDate(e.t)) + "</div></li>";
    }).join("") + "</ul>";
    h += "</section>";

    h += '<section class="card"><h2>Settings</h2>' +
      '<label class="switch"><input type="checkbox" data-set="speak"' + (state.settings.speak ? " checked" : "") + "> Say each item out loud when it's packed</label>" +
      '<label class="switch"><input type="checkbox" data-set="sound"' + (state.settings.sound ? " checked" : "") + "> Sounds</label></section>";

    h += '<section class="card"><h2>Backup</h2><p class="soft">Everything is kept on this phone only. Save a backup file now and then ' +
      "(for example to iCloud Drive or Dropbox), so a new phone can pick up where this one left off.</p>" +
      '<div class="row"><button class="btn" data-a="backup">Save a backup file</button>' +
      '<button class="btn" data-a="restore">Restore from a backup</button></div>' +
      '<input type="file" id="restoreFile" accept=".json,application/json" hidden></section>';
    h += '<p class="soft center">Gear Bag Check · made with Claude</p></div>';
    return h;
  }

  function pickGrid(list, current, act) {
    return '<div class="picks">' + list.map((e) => '<button class="pick' + (e === current ? " on" : "") + '" data-a="' + act + '" data-v="' + esc(e) +
      '" aria-label="' + esc(e) + '" aria-pressed="' + (e === current) + '">' + esc(e) + "</button>").join("") + "</div>";
  }

  function styleChoices(kid) {
    return '<div class="styles">' + G.THEMES.map(([k, name, desc]) => '<button class="style-opt' + (kid.theme === k ? " on" : "") + '" data-a="setTheme" data-v="' + k +
      '" aria-pressed="' + (kid.theme === k) + '"><span class="style-swatch sw-' + k + '"><i></i><i></i><i></i></span><b>' + name + '</b><span class="soft">' + desc + "</span></button>").join("") + "</div>";
  }

  function editKidView() {
    const kid = G.kidById(state, view.kidId);
    let h = topBar("Player", true);
    h += '<div class="wrap"><section class="card"><label class="field">Name<input id="kidName" maxlength="20" value="' + esc(kid.name) + '" autocomplete="off"></label>' +
      '<div class="field">Picture' + pickGrid(G.AVATARS, kid.avatar, "kidAvatar") + "</div>" +
      '<div class="field">Color<div class="swatches">' + G.COLORS.map((c) => '<button class="swatch' + (c === kid.color ? " on" : "") +
      '" style="background:' + c + '" data-a="kidColor" data-v="' + c + '" aria-label="Color ' + c + '"></button>').join("") + "</div></div>" +
      '<div class="field">Style' + styleChoices(kid) + "</div></section>";
    h += '<section class="card"><h2>' + esc(kid.name) + "'s bags</h2><div class=\"list\">";
    G.bagsFor(state, kid.id).forEach((b) => {
      h += '<button class="list-row" data-a="editBag" data-id="' + b.id + '"><span class="list-emoji">' + esc(b.emoji) + '</span><span class="grow"><b>' + esc(b.name) +
        '</b><span class="soft"> · ' + b.items.length + " items" + (daysText(b) ? " · " + esc(daysText(b)) : "") + '</span></span><span class="go">›</span></button>';
    });
    h += '</div><h3 class="sect">Add a bag</h3><div class="row wrap-row">' +
      G.TEMPLATE_KEYS.map((k) => '<button class="btn" data-a="addBag" data-v="' + k + '">' + G.TEMPLATES[k].emoji + " " + G.TEMPLATES[k].name + "</button>").join("") +
      '<button class="btn" data-a="addBag" data-v="">🎒 Blank bag</button></div></section>';
    h += '<button class="btn danger" data-a="removeKid">Remove ' + esc(kid.name) + "</button></div>";
    return h;
  }

  function editBagView() {
    const bag = G.bagById(state, view.bagId), kid = G.kidById(state, bag.kidId);
    let h = topBar(esc(kid.name) + "'s bag", true);
    h += '<div class="wrap"><section class="card"><label class="field">Name<input id="bagName" maxlength="24" value="' + esc(bag.name) + '" autocomplete="off"></label>' +
      '<div class="field">Picture' + pickGrid(G.BAG_PICS, bag.emoji, "bagEmoji") + "</div>" +
      '<div class="field">Practice and game days <span class="soft">(shows "Today" on those days)</span><div class="days">' +
      G.DAY_LETTERS.map((l, i) => '<button class="day' + (bag.days.includes(i) ? " on" : "") + '" data-a="day" data-v="' + i + '" aria-label="' + G.DAY_NAMES[i] +
      '" aria-pressed="' + bag.days.includes(i) + '">' + l + "</button>").join("") + "</div></div></section>";
    h += '<section class="card"><h2>What goes in the bag</h2><ul class="items">';
    bag.items.forEach((i, n) => {
      const st = G.STATUS[i.status];
      h += '<li class="item-row"><button class="grow item-edit" data-a="editItem" data-id="' + i.id + '"><span class="list-emoji">' + esc(i.emoji) + "</span><span><b>" +
        esc(i.name) + "</b>" + (i.count > 1 ? " ×" + i.count : "") + '<span class="soft"> · ' + esc(G.CATS.find((c) => c[0] === i.cat)[1]) + "</span>" +
        (st.short ? ' <span class="status s-' + i.status + '">' + st.icon + " " + st.short + "</span>" : "") + "</span></button>" +
        '<button class="mini" data-a="up" data-id="' + i.id + '" aria-label="Move up"' + (n === 0 ? " disabled" : "") + ">▲</button>" +
        '<button class="mini" data-a="down" data-id="' + i.id + '" aria-label="Move down"' + (n === bag.items.length - 1 ? " disabled" : "") + ">▼</button></li>";
    });
    h += '</ul><div class="row"><button class="btn" data-a="addItem">+ Add something</button>' +
      '<button class="btn" data-a="hairKit">🎀 Add hair kit</button></div></section>';
    const others = state.kids.filter((k) => k.id !== kid.id);
    if (others.length) h += '<section class="card"><h2>Copy this bag</h2><p class="soft">Gives another player the same list, with their own gear.</p><div class="row wrap-row">' +
      others.map((k) => '<button class="btn" data-a="copyBag" data-v="' + k.id + '">' + esc(k.avatar + " " + k.name) + "</button>").join("") + "</div></section>";
    h += '<button class="btn danger" data-a="removeBag">Remove this bag</button></div>';
    return h;
  }

  // ---------- Pop-ups ----------
  let modalCtx = null;
  function openModal(html, ctx) {
    modalCtx = ctx || {};
    modal.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + "</div>";
    modal.hidden = false;
    const f = modal.querySelector("[autofocus]"); if (f) setTimeout(() => f.focus(), 50);
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ""; modalCtx = null; }

  function reportModal(bag, item) {
    const opts = ["lost", "worn", "small"].map((s) => '<button class="opt' + (item.status === s ? " on" : "") + '" data-m="status" data-v="' + s + '">' +
      '<span class="opt-icon">' + G.STATUS[s].icon + "</span>" + G.STATUS[s].label + "</button>").join("");
    openModal('<div class="sheet-head"><span class="big-emoji sm">' + esc(item.emoji) + "</span><h2>" + esc(item.name) + "</h2></div>" +
      "<p>What's wrong?</p>" + opts +
      '<label class="field">Anything to add? <span class="soft">(optional)</span><input id="reportNote" maxlength="80" value="' + esc(item.note) + '" placeholder="like: the strap broke"></label>' +
      (item.status !== "ok" ? '<button class="opt good" data-m="status" data-v="ok"><span class="opt-icon">✓</span>It\'s fine now</button>' : "") +
      '<button class="btn ghost full" data-m="close">Never mind</button>', { kind: "report", bagId: bag.id, itemId: item.id });
  }

  function itemModal(bag, item) {
    const it = item || { emoji: "⭐", name: "", count: 1, cat: "gear", status: "ok", note: "" };
    modalCtx = { kind: "item", bagId: bag.id, itemId: item ? item.id : null, emoji: it.emoji, count: it.count, cat: it.cat, status: it.status };
    openModal('<h2>' + (item ? "Edit item" : "Add something") + "</h2>" +
      '<label class="field">Name<input id="itemName" maxlength="30" value="' + esc(it.name) + '" placeholder="like: Shin guards" autocomplete="off"' + (item ? "" : " autofocus") + "></label>" +
      '<div class="field">Picture<div id="itemPicks">' + pickGrid(G.ITEM_PICS, it.emoji, "itemEmoji") + "</div></div>" +
      '<div class="field">How many<div class="stepper"><button class="mini" data-m="count" data-v="-1" aria-label="Fewer">−</button><b id="itemCount">' + it.count +
      '</b><button class="mini" data-m="count" data-v="1" aria-label="More">+</button></div></div>' +
      '<div class="field">Goes under<div class="seg" id="itemCat">' + G.CATS.map(([k, l]) => '<button class="' + (k === it.cat ? "on" : "") + '" data-m="cat" data-v="' + k + '">' + l + "</button>").join("") + "</div></div>" +
      '<label class="field">Condition<select id="itemStatus">' + Object.keys(G.STATUS).map((k) => '<option value="' + k + '"' + (k === it.status ? " selected" : "") + ">" + G.STATUS[k].label + "</option>").join("") + "</select></label>" +
      '<div class="row"><button class="btn primary" data-m="saveItem">Save</button>' + (item ? '<button class="btn danger" data-m="deleteItem">Delete</button>' : "") +
      '<button class="btn ghost" data-m="close">Cancel</button></div>', modalCtx);
  }

  function confirmModal(text, yesLabel, onYes) {
    openModal("<h2>Are you sure?</h2><p>" + esc(text) + '</p><div class="row"><button class="btn danger" data-m="yes">' + esc(yesLabel) +
      '</button><button class="btn ghost" data-m="close">Cancel</button></div>', { kind: "confirm", onYes });
  }

  // ---------- Taps ----------
  app.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-a]"); if (!b || b.disabled) return;
    const a = b.dataset.a, id = b.dataset.id, v = b.dataset.v, d = now();
    switch (a) {
      case "back": back(); break;
      case "home": go({ name: "home" }); break;
      case "kid": go({ name: "kid", kidId: id }); break;
      case "check": go({ name: "check", bagId: id }); break;
      case "pack": {
        const item = G.bagById(state, view.bagId).items.find((i) => i.id === id);
        const wasLost = item.status === "lost";
        const inBag = G.togglePacked(state, view.bagId, id, d); save();
        if (inBag) { tone(DING); say(item.name); if (wasLost) toast("Found it! " + item.name + ": back in the bag."); } else tone(UNDO);
        const sm = G.summary(state, view.bagId, d);
        render();
        if (inBag && sm.allPacked) { tone(FANFARE); }
        break;
      }
      case "packFromDone": {
        const item = G.bagById(state, view.bagId).items.find((i) => i.id === id);
        G.togglePacked(state, view.bagId, id, d); save(); tone(DING); say(item.name); render(); break;
      }
      case "report": { const bag = G.bagById(state, view.bagId); reportModal(bag, bag.items.find((i) => i.id === id)); break; }
      case "startOver": G.startOver(state, view.bagId, d); save(); render(); break;
      case "ready": {
        const sm = G.summary(state, view.bagId, d);
        if (sm.allPacked) { G.finishCheck(state, view.bagId, d); save(); tone(FANFARE); say("Cleared for takeoff!"); }
        else say("Hold short. Still missing " + sm.missing.length + (sm.missing.length === 1 ? " thing." : " things."));
        go({ name: "done", bagId: view.bagId }); break;
      }
      case "leave": G.finishCheck(state, view.bagId, d); save(); go({ name: "home" }); break;
      case "firstKid": case "addKid": { const k = G.addKid(state, ""); k.name = "Player " + state.kids.length; save(); go({ name: "editKid", kidId: k.id, isNew: true }); break; }
      case "fixed": G.setStatus(state, b.dataset.bag, id, "ok", "", d); save(); render(); break;
      case "editKid": go({ name: "editKid", kidId: id }); break;
      case "kidAvatar": G.kidById(state, view.kidId).avatar = v; save(); render(); break;
      case "style": openModal("<h2>Pick your style</h2>" + styleChoices(G.kidById(state, view.kidId)) +
        '<button class="btn ghost full" data-m="close">Done</button>', { kind: "style", kidId: view.kidId }); break;
      case "setTheme": G.kidById(state, view.kidId).theme = v; save(); render(); break;
      case "hairKit": { const n = G.addKit(G.bagById(state, view.bagId), G.HAIR_KIT); save(); render();
        toast(n ? "Added the hair kit." : "This bag already has the hair kit."); break; }
      case "kidColor": G.kidById(state, view.kidId).color = v; save(); render(); break;
      case "addBag": { const bag = G.addBag(state, view.kidId, v || { name: "My bag", emoji: "🎒" }); save(); go({ name: "editBag", bagId: bag.id }); break; }
      case "removeKid": { const kid = G.kidById(state, view.kidId);
        confirmModal("Remove " + kid.name + " and all of " + kid.name + "'s bags?", "Remove", () => { G.removeKid(state, kid.id); save(); go({ name: "grown" }); }); break; }
      case "editBag": go({ name: "editBag", bagId: id }); break;
      case "bagEmoji": G.bagById(state, view.bagId).emoji = v; save(); render(); break;
      case "day": { const bag = G.bagById(state, view.bagId), n = Number(v);
        bag.days = bag.days.includes(n) ? bag.days.filter((x) => x !== n) : bag.days.concat(n).sort(); save(); render(); break; }
      case "editItem": { const bag = G.bagById(state, view.bagId); itemModal(bag, bag.items.find((i) => i.id === id)); break; }
      case "addItem": itemModal(G.bagById(state, view.bagId), null); break;
      case "up": case "down": G.moveItem(G.bagById(state, view.bagId), id, a === "up" ? -1 : 1); save(); render(); break;
      case "copyBag": { const kid = G.kidById(state, v); G.copyBag(state, view.bagId, v); save(); toast("Copied to " + kid.name + "."); break; }
      case "removeBag": { const bag = G.bagById(state, view.bagId);
        confirmModal("Remove the " + bag.name + " bag?", "Remove", () => { const kidId = bag.kidId; G.removeBag(state, bag.id); save(); go({ name: "editKid", kidId }); }); break; }
      case "backup": backup(); break;
      case "restore": document.getElementById("restoreFile").click(); break;
    }
  });

  app.addEventListener("input", (ev) => {
    const t = ev.target;
    if (t.id === "kidName") { if (t.value.trim()) { G.kidById(state, view.kidId).name = t.value.trim().slice(0, 20); save(); } }
    if (t.id === "bagName") { if (t.value.trim()) { G.bagById(state, view.bagId).name = t.value.trim().slice(0, 24); save(); } }
  });
  app.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.set) { state.settings[t.dataset.set] = t.checked; save(); }
    if (t.id === "restoreFile" && t.files[0]) restore(t.files[0]);
    if (t.id === "kidName" || t.id === "bagName") render();
  });

  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) { closeModal(); return; }
    const b = ev.target.closest("[data-m],[data-a]"); if (!b || !modalCtx) return;
    const m = b.dataset.m || b.dataset.a, v = b.dataset.v, c = modalCtx, d = now();
    if (m === "close") { closeModal(); return; }
    if (c.kind === "style" && m === "setTheme") {
      G.kidById(state, c.kidId).theme = v; save(); render();
      modal.querySelectorAll(".style-opt").forEach((o) => { o.classList.toggle("on", o.dataset.v === v); o.setAttribute("aria-pressed", o.dataset.v === v); });
      return;
    }
    if (c.kind === "confirm" && m === "yes") { const f = c.onYes; closeModal(); f(); return; }
    if (c.kind === "report" && m === "status") {
      const note = (document.getElementById("reportNote") || {}).value || "";
      const item = G.bagById(state, c.bagId).items.find((i) => i.id === c.itemId);
      G.setStatus(state, c.bagId, c.itemId, v, note, d); save(); closeModal(); render();
      toast(v === "ok" ? item.name + ": all good." : "Thanks! Grown-ups will see: " + item.name + ", " + G.STATUS[v].label.toLowerCase() + ".");
      return;
    }
    if (c.kind === "item") {
      if (m === "itemEmoji") { c.emoji = v; modal.querySelectorAll(".pick").forEach((p) => { p.classList.toggle("on", p.dataset.v === v); p.setAttribute("aria-pressed", p.dataset.v === v); }); }
      else if (m === "count") { c.count = Math.max(1, Math.min(9, c.count + Number(v))); document.getElementById("itemCount").textContent = c.count; }
      else if (m === "cat") { c.cat = v; modal.querySelectorAll("#itemCat button").forEach((p) => p.classList.toggle("on", p.dataset.v === v)); }
      else if (m === "saveItem") {
        const name = document.getElementById("itemName").value.trim();
        if (!name) { toast("Give it a name first."); return; }
        const status = document.getElementById("itemStatus").value, bag = G.bagById(state, c.bagId);
        let item = c.itemId && bag.items.find((i) => i.id === c.itemId);
        if (!item) item = G.addItem(bag, { emoji: c.emoji, name, count: c.count, cat: c.cat });
        else { item.emoji = c.emoji; item.name = name.slice(0, 30); item.count = c.count; item.cat = c.cat; }
        if (status !== item.status) G.setStatus(state, bag.id, item.id, status, item.note, d);
        save(); closeModal(); render();
      } else if (m === "deleteItem") { G.removeItem(state, c.bagId, c.itemId); save(); closeModal(); render(); }
    }
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !modal.hidden) closeModal(); });

  // ---------- Grown-up button: press and hold so little fingers don't wander in ----------
  let holdTimer = null, holdEl = null;
  function holdStart(ev) {
    const b = ev.target.closest("[data-hold]"); if (!b) return;
    if (!state.kids.length) { go({ name: "grown" }); return; }
    holdEl = b; b.classList.add("holding");
    holdTimer = setTimeout(() => { holdEnd(); tone(DING); go({ name: "grown" }); }, 1200);
  }
  function holdEnd() { clearTimeout(holdTimer); holdTimer = null; if (holdEl) holdEl.classList.remove("holding"); holdEl = null; }
  app.addEventListener("pointerdown", holdStart);
  ["pointerup", "pointercancel", "pointerleave"].forEach((e) => app.addEventListener(e, holdEnd));
  app.addEventListener("contextmenu", (ev) => { if (ev.target.closest("[data-hold]")) ev.preventDefault(); });
  app.addEventListener("keydown", (ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.closest("[data-hold]")) { ev.preventDefault(); go({ name: "grown" }); } });

  // ---------- Backup ----------
  function backup() {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
    const name = "Gear Bag Check backup " + G.dayKey(now()) + ".json";
    const file = typeof File === "function" ? new File([blob], name, { type: "application/json" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function restore(file) {
    const r = new FileReader();
    r.onload = () => {
      let next;
      try { next = G.normalize(JSON.parse(r.result)); } catch (e) { toast(e.message && /backup/.test(e.message) ? e.message : "That file couldn't be read."); return; }
      confirmModal("Replace everything on this phone with the backup (" + next.kids.length + " players, " + next.bags.length + " bags)?", "Restore",
        () => { state = next; save(); toast("Backup restored."); go({ name: "grown" }); });
    };
    r.readAsText(file);
  }

  // A new day while the app sits open: redraw so yesterday's check marks clear.
  let lastDay = G.dayKey(now());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && G.dayKey(now()) !== lastDay) { lastDay = G.dayKey(now()); render(); }
  });

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  render();
})();
