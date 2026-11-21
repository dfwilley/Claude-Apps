// Brick Pile: the screens. The pile, the ideas and the key (if there is one) are kept on this device (localStorage).
// With no key, everything happens on the device: finder.js counts the bricks and builds.js suggests what to make.
// With a key, the picture of the bricks (and later the list of bricks) is sent to Anthropic for a sharper answer.
(function () {
  "use strict";
  const B = window.BrickPile, F = window.BrickFinder, U = window.BrickBuilds, app = document.getElementById("app");
  const PILE = "brick-pile:v1", KEY = "brick-pile:key", SPEND = "brick-pile:spend";
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let pile = Object.assign(B.emptyPile(), load(PILE, null) || {});
  let key = load(KEY, ""), spend = load(SPEND, 0);
  let view = "home", busy = "", problem = "", note = "", editing = 0;
  const keep = () => { if (!save(PILE, pile)) { pile.photos = pile.photos.slice(-2); save(PILE, pile); } };

  // ---------- pictures ----------
  function loadImage(file) {
    return new Promise((ok, bad) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => ok(img); img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("That file could not be opened as a picture.")); };
      img.src = url;
    });
  }
  function canvasOf(img, edge) {
    const s = B.fitSize(img.naturalWidth, img.naturalHeight, edge), c = document.createElement("canvas");
    c.width = s.w; c.height = s.h; c.getContext("2d").drawImage(img, 0, 0, s.w, s.h);
    return c;
  }

  // ---------- counting the bricks in a picture ----------
  async function countBricks(file) {
    problem = ""; note = ""; busy = key ? "Counting your bricks… this can take up to a minute." : "Counting your bricks…"; render();
    try {
      const img = await loadImage(file), thumb = canvasOf(img, B.THUMB_EDGE).toDataURL("image/jpeg", 0.6);
      let found, said = "";
      if (key) {
        const { result, usage } = await B.ask(key, B.inventoryBody(canvasOf(img, B.PHOTO_EDGE).toDataURL("image/jpeg", 0.85).split(",")[1]));
        spend += B.cost(usage); save(SPEND, spend); found = result.items; said = result.note || "";
      } else {
        const c = canvasOf(img, F.EDGE); found = F.findBricks(c.getContext("2d").getImageData(0, 0, c.width, c.height).data, c.width, c.height).items;
        said = "This is a rough count by colour and size. Tap any line to say what the piece really is (a wheel, a roof slope, a 2 x 4 brick).";
      }
      URL.revokeObjectURL(img.src);
      const next = B.addItems(pile, found);
      if (!next.added) problem = (key && said) || "No bricks were found in that picture. Spread them out on a plain surface that is a different colour from the bricks, in good light.";
      else {
        note = `Found ${key ? "" : "about "}${next.added} piece${next.added === 1 ? "" : "s"} in that picture. ${said}`;
        pile = next; delete pile.added; pile.photos = pile.photos.concat(thumb).slice(-12); keep();
      }
    } catch (e) { problem = e.message; }
    busy = ""; render();
  }

  // ---------- ideas ----------
  const showIdeas = () => { const el = document.getElementById("ideas"); if (el) el.scrollIntoView({ behavior: "smooth" }); };
  function builtInIdeas() {
    problem = ""; note = "";
    const ideas = U.suggest(pile.items, pile.who, pile.ideas.filter((i) => i.builtin).map((i) => i.id), 3);
    if (!ideas.length) problem = pile.ideas.some((i) => i.builtin) ? "Those are all the built-in ideas for this pile. Add more bricks to get more." : "The pile is too small for the built-in ideas. Add a few more bricks.";
    else { pile.ideas = ideas.concat(pile.ideas).slice(0, 40); keep(); }
    render(); if (ideas.length) showIdeas();
  }
  async function aiIdeas() {
    problem = ""; note = ""; busy = "Thinking of things to build… this can take up to a minute."; render();
    try {
      const { result, usage } = await B.ask(key, B.ideasBody(pile.items, pile.who, pile.ideas.map((i) => i.name)));
      spend += B.cost(usage); save(SPEND, spend);
      const ideas = B.checkIdeas(pile.items, result);
      if (!ideas.length) problem = "No ideas came back that time. Try again.";
      else { pile.ideas = ideas.concat(pile.ideas).slice(0, 40); keep(); }
      busy = ""; render(); if (ideas.length) showIdeas();
    } catch (e) { problem = e.message; busy = ""; render(); }
  }

  // ---------- drawing a built-in idea, in the builder's own colours ----------
  function picture(d) {
    const pad = 0.5, ink = "#1F2430";
    const one = (s) => {
      const fill = s.color ? B.hex(s.color) : "none", look = `fill="${fill}"${s.color === "clear" ? ' fill-opacity=".55"' : ""} stroke="${ink}" stroke-width=".07" stroke-linejoin="round"${s.color ? "" : ' stroke-dasharray=".25 .2"'}`;
      const x = s.x + pad, y = s.y + pad + 0.3;
      if (s.s === "wheel") return `<circle cx="${x + s.w / 2}" cy="${y + s.h / 2}" r="${s.h / 2}" ${look}/><circle cx="${x + s.w / 2}" cy="${y + s.h / 2}" r="${s.h / 5}" fill="#C9CED6" stroke="${ink}" stroke-width=".05"/>`;
      if (s.s === "slopeL") return `<path d="M${x} ${y + s.h}V${y + s.h * 0.7}L${x + s.w * 0.6} ${y}H${x + s.w}V${y + s.h}Z" ${look}/>`;
      if (s.s === "slopeR") return `<path d="M${x + s.w} ${y + s.h}V${y + s.h * 0.7}L${x + s.w * 0.4} ${y}H${x}V${y + s.h}Z" ${look}/>`;
      let studs = ""; for (let k = 0; k < s.w; k++) studs += `<rect x="${x + k + 0.22}" y="${y - 0.2}" width=".56" height=".2" ${look}/>`;
      return studs + `<rect x="${x}" y="${y}" width="${s.w}" height="${s.h}" rx="${s.s === "round" ? 0.3 : 0.06}" ${look}/>`;
    };
    // lower layers are drawn first so each piece hides the studs it sits on
    const shapes = d.shapes.slice().sort((a, b) => b.y - a.y).map(one).join("");
    return `<svg class="pic" viewBox="0 0 ${d.w + pad * 2} ${d.h + pad * 2 + 0.3}" role="img" aria-label="Picture of the build from the side">${shapes}</svg>`;
  }

  // ---------- drawing the screens ----------
  const swatch = (color) => `<span class="sw${color === "clear" ? " clear" : ""}" style="background:${B.hex(color)}"></span>`;
  const options = (list, now) => list.map((v) => `<option${v === now ? " selected" : ""}>${v}</option>`).join("");
  const photoButtons = (more) => `
    <div class="snap">
      <label class="btn big primary"><input type="file" accept="image/*" capture="environment" data-photo hidden>📷 ${more ? "Take a picture of more bricks" : "Take a picture of your bricks"}</label>
      <label class="btn"><input type="file" accept="image/*" data-photo hidden>Choose a picture</label>
    </div>`;
  const tips = () => `
    <div class="card tips"><h3>For the best count</h3>
      <ul><li>Spread the bricks out flat so none touch or hide under others.</li>
      <li>Use a plain table or a sheet of paper${key ? "" : " that is a different colour from your bricks"}, in good light.</li>
      <li>Hold the phone straight above them.</li><li>About 50 bricks or fewer per picture works best. Take more pictures for more bricks.</li></ul></div>`;

  function row(i) {
    if (editing === i.id) return `
      <form class="edit" data-edit="${i.id}">
        <label>What is it?<input name="name" required maxlength="60" value="${esc(i.name)}" autocomplete="off"></label>
        <div class="pair two"><label>Kind<select name="kind">${options(B.KINDS, i.kind)}</select></label>
        <label>Colour<select name="color">${options(B.COLOR_NAMES, i.color)}</select></label></div>
        <div class="pair two"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-act="edit" data-id="0">Cancel</button></div>
      </form>`;
    return `
      <div class="row">${swatch(i.color)}<button class="what" data-act="edit" data-id="${i.id}" aria-label="Change ${esc(B.label(i))}">${esc(B.label(i))}${i.unsure ? ' <b class="q">?</b>' : ""}</button>
        <button class="step" data-act="less" data-id="${i.id}" aria-label="One fewer ${esc(B.label(i))}">−</button><span class="n">${i.count}</span>
        <button class="step" data-act="more" data-id="${i.id}" aria-label="One more ${esc(B.label(i))}">+</button></div>`;
  }
  function inventory() {
    const groups = B.grouped(pile.items), n = B.total(pile.items);
    return `
      ${pile.photos.length ? `<div class="photos">${pile.photos.map((p) => `<img src="${p}" alt="Picture of bricks">`).join("")}</div>` : ""}
      <h2>Your pile <span class="count">${n} piece${n === 1 ? "" : "s"}</span></h2>
      <p class="blurb">A count from a picture is a good start, not exact. Use − and + to fix a count, or tap a name to change what the piece is. A ? marks a guess.</p>
      ${groups.map((g) => `<h3>${g.title}</h3><div class="card list">${g.items.map(row).join("")}</div>`).join("")}
      <details class="card add"><summary>Add a piece by hand</summary>
        <form data-add>
          <label>What is it?<input name="name" required maxlength="60" placeholder="2 x 4 brick" autocomplete="off"></label>
          <div class="pair"><label>Kind<select name="kind">${options(B.KINDS)}</select></label>
          <label>Colour<select name="color">${options(B.COLOR_NAMES)}</select></label>
          <label>How many<input name="count" type="number" inputmode="numeric" min="1" max="999" value="1" required></label></div>
          <button class="btn" type="submit">Add to the pile</button>
        </form></details>
      ${photoButtons(true)}`;
  }
  function ideaCard(d) {
    const lacking = (d.lacking || []).map((p) => `${p.count} × ${esc(p.name)}`).join(", ");
    return `<div class="card idea"><div class="head"><h3>${esc(d.name)}</h3><span class="lv ${d.level}">${d.level}</span></div>
      <p>${esc(d.about)}</p>
      ${d.draw ? picture(d.draw) : ""}
      <p class="uses">Uses ${d.pieces} piece${d.pieces === 1 ? "" : "s"}:</p>
      <div class="chips">${d.parts.map((p) => `<span class="chip">${swatch(p.color)}${p.count} × ${esc(B.label(p))}</span>`).join("")}</div>
      ${lacking ? `<p class="warn">Almost: your pile is short of ${lacking} (shown dotted). Swap in something close.</p>` : ""}
      ${d.short && d.short.length ? `<p class="warn">You may be short: ${d.short.map((p) => `needs ${p.count} ${esc(B.label(p))}, the pile has ${p.have}`).join("; ")}. Swap in something close.</p>` : ""}
      ${d.draw ? '<p class="uses">Build it layer by layer from the bottom, following the picture:</p>' : ""}
      <ol>${d.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>`;
  }
  function ideas() {
    const more = pile.ideas.length ? "more " : "";
    return `
      <h2 id="ideas">What can I build?</h2>
      <div class="card ask"><label>Ideas for <select data-who>${B.WHO.map((w) => `<option value="${w[0]}"${pile.who === w[0] ? " selected" : ""}>${w[1]}</option>`).join("")}</select></label>
        ${key ? `<button class="btn big primary" data-act="ai-ideas">💡 Show me ${more}ideas from Claude</button><button class="btn" data-act="ideas">Show me ${more}built-in ideas (free)</button>`
          : `<button class="btn big primary" data-act="ideas">💡 Show me ${more}ideas</button>`}</div>
      ${pile.ideas.map(ideaCard).join("")}
      ${pile.ideas.some((i) => !i.builtin) ? '<p class="blurb">Ideas from Claude are made up by an AI from your list, so a step may need a little fixing as you build. That is half the fun.</p>' : ""}`;
  }
  function home() {
    const has = pile.items.length > 0;
    return `
      <div class="top"><img class="logo" src="icon.svg" alt=""><div><h1>Brick Pile Builder</h1><p>Snap your bricks. See what you have. Get ideas to build.</p></div>
        <button class="gear" data-act="settings" aria-label="Settings">⚙︎</button></div>
      ${problem ? `<div class="card bad" role="alert">${esc(problem)}</div>` : ""}
      ${note ? `<div class="card good">${esc(note)}</div>` : ""}
      ${has ? inventory() + ideas() + '<button class="btn quiet" data-act="reset">Start over with an empty pile</button>' : photoButtons(false) + tips()}
      ${key ? "" : `<p class="blurb foot">Everything happens on this device, so the count is rough. For a sharper count and made-to-measure ideas, you can <button class="link" data-act="settings">add an Anthropic key</button> (optional).</p>`}`;
  }
  function settings() {
    return `
      <div class="top"><button class="gear" data-act="home" aria-label="Back">‹</button><div><h1>Settings</h1></div></div>
      ${problem ? `<div class="card bad" role="alert">${esc(problem)}</div>` : ""}
      <div class="card"><h3>Sharper counts with Claude (optional)</h3>
        <p>Brick Pile Builder works without this. On its own it counts bricks by colour and rough size, and suggests builds from a built-in set.</p>
        <p>With an Anthropic key, each picture is looked at by Claude, an AI, which can name the pieces (2 x 4 brick, roof slope, wheel) and write ideas for your exact pile.</p>
        ${key ? `<p><strong>A key is saved</strong> (ends in …${esc(key.slice(-4))}).${spend ? ` Used so far: about $${spend.toFixed(2)} at list prices.` : ""}</p>
          <button class="btn" data-act="forget">Remove the key</button>`
        : `<p>A key is like a password that lets this app use Claude on your Anthropic account. To get one:</p>
          <ol><li>On a computer, go to console.anthropic.com and sign in (or make an account).</li><li>Add a little credit under Billing. Five dollars goes a long way.</li>
          <li>Under API keys, make a key and copy it. It starts with sk-ant-</li><li>Paste it here.</li></ol>
          <form data-key><label>Anthropic API key<input name="key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></label>
          <button class="btn primary" type="submit">Save the key</button></form>`}</div>
      <div class="card"><h3>What it costs</h3><p>Without a key, nothing. With a key, Anthropic charges your account each time Brick Pile Builder asks Claude something: roughly 5 to 12 cents for a picture or a set of ideas. The built-in ideas are always free.</p></div>
      <div class="card"><h3>What leaves this device</h3>
        <p>${key ? "Because a key is saved: when you add a picture, that picture is sent to Anthropic to be looked at, and when you ask Claude for ideas, your list of bricks is sent. Nothing else is sent anywhere, and the app is blocked from contacting any other site. So take pictures of bricks, not people."
          : "Nothing. With no key, your pictures are looked at on this device and never sent anywhere."}</p>
        <p>Your pile, your ideas and your key are kept only on this device.</p></div>`;
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
    else if (act === "edit") editing = id;
    else if (act === "more" && item) { pile = B.setCount(pile, id, item.count + 1); keep(); }
    else if (act === "less" && item) {
      if (item.count === 1 && !confirm(`Take ${B.label(item)} off the list?`)) return;
      pile = B.setCount(pile, id, item.count - 1); keep();
    }
    else if (act === "ideas") return void builtInIdeas();
    else if (act === "ai-ideas") return void aiIdeas();
    else if (act === "reset") { if (!confirm("Empty the pile and clear the ideas? This cannot be undone.")) return; pile = Object.assign(B.emptyPile(), { who: pile.who }); note = ""; problem = ""; editing = 0; keep(); }
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
    } else if (e.target.matches("[data-edit]")) {
      pile = B.editItem(pile, Number(e.target.dataset.edit), { name: f.get("name"), kind: f.get("kind"), color: f.get("color") }); editing = 0; keep();
    }
    render();
  });

  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
