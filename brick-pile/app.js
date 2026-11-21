// Brick Pile: the screens. The pile, the ideas and the key are kept on this device (localStorage).
// The only thing that leaves the device is a picture of the bricks (and later the list of bricks), sent to Anthropic.
(function () {
  "use strict";
  const B = window.BrickPile, app = document.getElementById("app");
  const PILE = "brick-pile:v1", KEY = "brick-pile:key", SPEND = "brick-pile:spend";
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let pile = Object.assign(B.emptyPile(), load(PILE, null) || {});
  let key = load(KEY, ""), spend = load(SPEND, 0);
  let view = "home", busy = "", problem = "", note = "";
  const keep = () => { if (!save(PILE, pile)) { pile.photos = pile.photos.slice(-2); save(PILE, pile); } };

  // ---------- pictures ----------
  function loadImage(file) {
    return new Promise((ok, bad) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => ok(img); img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("That file could not be opened as a picture.")); };
      img.src = url;
    });
  }
  function shrink(img, edge, quality) {
    const s = B.fitSize(img.naturalWidth, img.naturalHeight, edge), c = document.createElement("canvas");
    c.width = s.w; c.height = s.h; c.getContext("2d").drawImage(img, 0, 0, s.w, s.h);
    return c.toDataURL("image/jpeg", quality);
  }

  // ---------- the two jobs ----------
  async function countBricks(file) {
    if (!key) { view = "settings"; problem = "Brick Pile needs a key before it can look at pictures."; return render(); }
    problem = ""; note = ""; busy = "Counting your bricks… this can take up to a minute."; render();
    try {
      const img = await loadImage(file), big = shrink(img, B.PHOTO_EDGE, 0.85), thumb = shrink(img, B.THUMB_EDGE, 0.6);
      URL.revokeObjectURL(img.src);
      const { result, usage } = await B.ask(key, B.inventoryBody(big.split(",")[1]));
      spend += B.cost(usage); save(SPEND, spend);
      const next = B.addItems(pile, result.items);
      if (!next.added) problem = result.note || "No bricks were found in that picture. Try again with the bricks spread out in good light.";
      else {
        note = `Found ${next.added} piece${next.added === 1 ? "" : "s"} in that picture. ${result.note || ""}`;
        pile = next; delete pile.added; pile.photos = pile.photos.concat(thumb).slice(-12); keep();
      }
    } catch (e) { problem = e.message; }
    busy = ""; render();
  }
  async function getIdeas() {
    problem = ""; note = ""; busy = "Thinking of things to build… this can take up to a minute."; render();
    try {
      const { result, usage } = await B.ask(key, B.ideasBody(pile.items, pile.who, pile.ideas.map((i) => i.name)));
      spend += B.cost(usage); save(SPEND, spend);
      const ideas = B.checkIdeas(pile.items, result);
      if (!ideas.length) problem = "No ideas came back that time. Try again.";
      else { pile.ideas = ideas.concat(pile.ideas).slice(0, 30); keep(); }
      busy = ""; render();
      if (ideas.length) { const el = document.getElementById("ideas"); if (el) el.scrollIntoView({ behavior: "smooth" }); }
    } catch (e) { problem = e.message; busy = ""; render(); }
  }

  // ---------- drawing the screens ----------
  const swatch = (color) => `<span class="sw${color === "clear" ? " clear" : ""}" style="background:${B.hex(color)}"></span>`;
  const photoButtons = (more) => `
    <div class="snap">
      <label class="btn big primary"><input type="file" accept="image/*" capture="environment" data-photo hidden>📷 ${more ? "Take a picture of more bricks" : "Take a picture of your bricks"}</label>
      <label class="btn"><input type="file" accept="image/*" data-photo hidden>Choose a picture</label>
    </div>`;
  const tips = `
    <div class="card tips"><h3>For the best count</h3>
      <ul><li>Spread the bricks out flat so none hide under others.</li><li>Use a plain table or a sheet of paper, in good light.</li>
      <li>Hold the phone straight above them.</li><li>About 50 bricks or fewer per picture works best. Take more pictures for more bricks.</li></ul></div>`;

  function inventory() {
    const groups = B.grouped(pile.items), n = B.total(pile.items);
    return `
      ${pile.photos.length ? `<div class="photos">${pile.photos.map((p) => `<img src="${p}" alt="Picture of bricks">`).join("")}</div>` : ""}
      <h2>Your pile <span class="count">${n} piece${n === 1 ? "" : "s"}</span></h2>
      <p class="blurb">A count from a picture is a good start, not exact. Use − and + to fix any line. A ? marks a guess.</p>
      ${groups.map((g) => `<h3>${g.title}</h3><div class="card list">${g.items.map((i) => `
        <div class="row">${swatch(i.color)}<span class="what">${esc(B.label(i))}${i.unsure ? ' <b class="q" title="This one was partly a guess">?</b>' : ""}</span>
          <button class="step" data-act="less" data-id="${i.id}" aria-label="One fewer ${esc(B.label(i))}">−</button><span class="n">${i.count}</span>
          <button class="step" data-act="more" data-id="${i.id}" aria-label="One more ${esc(B.label(i))}">+</button></div>`).join("")}</div>`).join("")}
      <details class="card add"><summary>Add a piece by hand</summary>
        <form data-add>
          <label>What is it?<input name="name" required maxlength="60" placeholder="2 x 4 brick" autocomplete="off"></label>
          <div class="pair"><label>Kind<select name="kind">${B.KINDS.map((k) => `<option>${k}</option>`).join("")}</select></label>
          <label>Colour<select name="color">${B.COLOR_NAMES.map((c) => `<option>${c}</option>`).join("")}</select></label>
          <label>How many<input name="count" type="number" inputmode="numeric" min="1" max="999" value="1" required></label></div>
          <button class="btn" type="submit">Add to the pile</button>
        </form></details>
      ${photoButtons(true)}`;
  }
  function ideas() {
    return `
      <h2 id="ideas">What can I build?</h2>
      <div class="card ask"><label>Ideas for <select data-who>${B.WHO.map((w) => `<option value="${w[0]}"${pile.who === w[0] ? " selected" : ""}>${w[1]}</option>`).join("")}</select></label>
        <button class="btn big primary" data-act="ideas">💡 ${pile.ideas.length ? "Show me more ideas" : "Show me ideas"}</button></div>
      ${pile.ideas.map((d) => `<div class="card idea"><div class="head"><h3>${esc(d.name)}</h3><span class="lv ${d.level}">${d.level}</span></div>
        <p>${esc(d.about)}</p>
        <p class="uses">Uses ${d.pieces} piece${d.pieces === 1 ? "" : "s"}:</p>
        <div class="chips">${d.parts.map((p) => `<span class="chip">${swatch(p.color)}${p.count} × ${esc(B.label(p))}</span>`).join("")}</div>
        ${d.short.length ? `<p class="warn">You may be short: ${d.short.map((p) => `needs ${p.count} ${esc(B.label(p))}, the pile has ${p.have}`).join("; ")}. Swap in something close.</p>` : ""}
        <ol>${d.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>`).join("")}
      ${pile.ideas.length ? '<p class="blurb">The ideas are made up by an AI from your list, so a step may need a little fixing as you build. That is half the fun.</p>' : ""}`;
  }
  function home() {
    const has = pile.items.length > 0;
    return `
      <div class="top"><img class="logo" src="icon.svg" alt=""><div><h1>Brick Pile</h1><p>Snap your bricks. See what you have. Get ideas to build.</p></div>
        <button class="gear" data-act="settings" aria-label="Settings">⚙︎</button></div>
      ${problem ? `<div class="card bad" role="alert">${esc(problem)}</div>` : ""}
      ${note ? `<div class="card good">${esc(note)}</div>` : ""}
      ${!key ? `<div class="card setup"><h3>One-time setup</h3><p>Brick Pile uses Claude, an AI made by Anthropic, to look at your picture. It needs your own Anthropic key, which you type in once.</p>
        <button class="btn primary" data-act="settings">Set it up</button></div>` : ""}
      ${has ? inventory() + ideas() + '<button class="btn quiet" data-act="reset">Start over with an empty pile</button>' : photoButtons(false) + tips}`;
  }
  function settings() {
    return `
      <div class="top"><button class="gear" data-act="home" aria-label="Back">‹</button><div><h1>Settings</h1></div></div>
      ${problem ? `<div class="card bad" role="alert">${esc(problem)}</div>` : ""}
      <div class="card"><h3>Your Anthropic key</h3>
        ${key ? `<p><strong>A key is saved</strong> (ends in …${esc(key.slice(-4))}).${spend ? ` Used so far: about $${spend.toFixed(2)} at list prices.` : ""}</p>
          <button class="btn" data-act="forget">Remove the key</button>`
        : `<p>A key is like a password that lets this app use Claude on your Anthropic account. To get one:</p>
          <ol><li>On a computer, go to console.anthropic.com and sign in (or make an account).</li><li>Add a little credit under Billing. Five dollars goes a long way.</li>
          <li>Under API keys, make a key and copy it. It starts with sk-ant-</li><li>Paste it here.</li></ol>
          <form data-key><label>Anthropic API key<input name="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>
          <button class="btn primary" type="submit">Save the key</button></form>`}</div>
      <div class="card"><h3>What it costs</h3><p>Anthropic charges your account each time Brick Pile asks Claude something: roughly 5 to 15 cents for a picture or a set of ideas. Brick Pile itself is free.</p></div>
      <div class="card"><h3>What leaves this device</h3><p>When you add a picture, that picture is sent to Anthropic to be looked at. When you ask for ideas, your list of bricks is sent. Nothing else is sent anywhere, and the app is blocked from contacting any other site.</p>
        <p>Your pile, your ideas and your key are kept only on this device. So take pictures of bricks, not people.</p></div>`;
  }
  function render() {
    app.innerHTML = (view === "settings" ? settings() : home()) +
      (busy ? `<div class="busy" role="status"><div class="box"><div class="bricks"><i></i><i></i><i></i></div><p>${esc(busy)}</p></div></div>` : "");
  }

  // ---------- taps ----------
  app.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]"); if (!t || busy) return;
    const act = t.dataset.act, id = Number(t.dataset.id), item = pile.items.find((i) => i.id === id);
    if (act === "settings") { view = "settings"; problem = ""; }
    else if (act === "home") { view = "home"; problem = ""; }
    else if (act === "more" && item) { pile = B.setCount(pile, id, item.count + 1); keep(); }
    else if (act === "less" && item) {
      if (item.count === 1 && !confirm(`Take ${B.label(item)} off the list?`)) return;
      pile = B.setCount(pile, id, item.count - 1); keep();
    }
    else if (act === "ideas") { if (!key) { view = "settings"; problem = "Brick Pile needs a key before it can suggest ideas."; } else return void getIdeas(); }
    else if (act === "reset") { if (!confirm("Empty the pile and clear the ideas? This cannot be undone.")) return; pile = Object.assign(B.emptyPile(), { who: pile.who }); note = ""; problem = ""; keep(); }
    else if (act === "forget") { if (!confirm("Remove the key from this device?")) return; key = ""; try { localStorage.removeItem(KEY); } catch (err) { /* nothing to remove */ } }
    render();
  });
  app.addEventListener("change", (e) => {
    if (e.target.matches("[data-photo]")) { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f && !busy) countBricks(f); }
    else if (e.target.matches("[data-who]")) { pile.who = e.target.value; keep(); }
  });
  app.addEventListener("submit", (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    if (e.target.matches("[data-key]")) {
      const k = String(f.get("key") || "").trim();
      if (!B.looksLikeKey(k)) { problem = "That does not look like an Anthropic key. It starts with sk-ant-"; return render(); }
      key = k; save(KEY, key); problem = ""; view = "home";
    } else if (e.target.matches("[data-add]")) {
      const next = B.addItems(pile, [{ name: f.get("name"), kind: f.get("kind"), color: f.get("color"), count: f.get("count") }]);
      if (!next.added) return; pile = next; delete pile.added; keep();
    }
    render();
  });

  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
