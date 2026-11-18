// Wing Rib Riddles: screens and saved progress. Pictures, the daily pick and streak rules live in core.js (window.WRR).
(function () {
  "use strict";
  const W = window.WRR;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");

  // ---------- saved state (stays on this phone) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("wrr." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("wrr." + k, JSON.stringify(v)); } catch { /* storage full or blocked: keep playing */ } },
  };
  let stats = Object.assign({}, W.NEW_STATS, store.get("stats", {}));
  let daily = store.get("daily", null); // { day, pick }: today's answer, once given
  let seen = store.get("seen", {}); // id -> { r, w }: every riddle answered so far
  let tab = "today";
  let extra = null; // the "More riddles" riddle on screen: { id, seed, pick }
  let tally = { right: 0, played: 0 }; // More riddles, this sitting
  let cribPick = null;
  let shownDay = null;

  const today = () => W.dayNumber(new Date());
  const noMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function markSeen(id, correct) {
    const s = seen[id] || { r: 0, w: 0 };
    if (correct) s.r += 1; else s.w += 1;
    seen[id] = s; store.set("seen", seen);
  }

  // ---------- one riddle: picture, four choices, then the answer and the fact ----------
  function riddleHtml(item, seed, pick, closeUp) {
    const done = pick !== null;
    const buttons = W.choicesFor(item, seed).map((c) => {
      const cls = !done ? "" : c === item.name ? " right" : c === pick ? " wrong" : "";
      const mark = !done ? "" : c === item.name ? "✓" : c === pick ? "✗" : "";
      return `<button type="button" class="choice${cls}" data-choice="${esc(c)}"${done ? " disabled" : ""}><span class="mark" aria-hidden="true">${mark}</span>${esc(c)}</button>`;
    }).join("");
    const right = pick === item.name;
    return `<div class="pic">${W.svg(item, closeUp, done ? esc(item.name) : "Mystery close-up")}</div>
      ${done
        ? `<p class="verdict ${right ? "right" : "wrong"}" role="status">${right ? "Right!" : "Not this time."} <span class="soft">It is:</span> ${esc(item.name)}</p>`
        : `<p class="ask">What is this a close-up of?</p><p class="soft small hint">Hint: it is ${W.KINDS[item.kind]}.</p>`}
      <div class="choices">${buttons}</div>
      ${done ? `<div class="card fact"><h3>Did you know?</h3><p>${esc(item.fact)}</p></div>` : ""}`;
  }

  // pull back from the close-up to the whole picture
  function zoomOut(item) {
    const el = $(".pic svg");
    if (!el) return;
    const from = W.viewBox(item, true), to = W.viewBox(item, false);
    if (noMotion()) { el.setAttribute("viewBox", to.join(" ")); return; }
    const t0 = performance.now(), ms = 800;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.setAttribute("viewBox", from.map((v, i) => (v + (to[i] - v) * e).toFixed(2)).join(" "));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- Today ----------
  function untilMidnight() {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const min = Math.max(1, Math.round((next - now) / 60000));
    return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
  }
  function statsHtml(day) {
    const pct = stats.played ? Math.round((stats.right / stats.played) * 100) : 0;
    return `<div class="card stats">
      <div><b>${W.liveStreak(stats, day)}</b><span>day streak</span></div><div><b>${stats.best}</b><span>best streak</span></div>
      <div><b>${stats.played}</b><span>days played</span></div><div><b>${pct}%</b><span>right</span></div></div>`;
  }
  function renderToday(justAnswered) {
    const day = today(), item = W.dailyItem(day);
    const pick = daily && daily.day === day ? daily.pick : null;
    const date = W.dateOfDay(day).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    app.innerHTML = `<div class="card"><div class="head"><h2>Riddle of the day</h2><span class="soft small">${esc(date)}</span></div>
      ${riddleHtml(item, day, pick, pick === null || justAnswered)}</div>
      ${pick === null ? "" : `${statsHtml(day)}
        <p class="soft small" style="text-align:center">A new riddle arrives at midnight, in ${untilMidnight()}.</p>
        <button type="button" class="big primary" data-act="more">More riddles while you wait</button>`}`;
    if (justAnswered) zoomOut(item);
  }

  // ---------- More riddles (for fun; the streak counts only the riddle of the day) ----------
  function newExtra() {
    const day = today(), avoid = [W.dailyItem(day + 1).id];
    if (!(daily && daily.day === day)) avoid.push(W.dailyItem(day).id); // don't give away today's
    if (extra) avoid.push(extra.id);
    extra = { id: W.practiceItem(seen, avoid).id, seed: Math.floor(Math.random() * 1e9), pick: null };
  }
  function renderMore(justAnswered) {
    if (!extra) newExtra();
    const item = W.BY_ID[extra.id];
    app.innerHTML = `<div class="card"><h2>More riddles</h2>
      <p class="soft small">Just for fun: these don't change your streak.${tally.played ? ` This sitting: ${tally.right} of ${tally.played} right.` : ""}</p>
      ${riddleHtml(item, extra.seed, extra.pick, extra.pick === null || justAnswered)}</div>
      ${extra.pick === null ? "" : `<button type="button" class="big primary" data-act="next">Next riddle</button>`}`;
    if (justAnswered) zoomOut(item);
  }

  // ---------- Tool Crib: everything you have come across so far ----------
  function renderCrib() {
    const found = W.ITEMS.filter((it) => seen[it.id]).length;
    const it = cribPick && seen[cribPick] ? W.BY_ID[cribPick] : null;
    const detail = it ? `<div class="card" id="detail"><h2>${esc(it.name)}</h2>
      <div class="pic">${W.svg(it, false, esc(it.name))}</div><div class="fact"><h3>Did you know?</h3><p>${esc(it.fact)}</p></div>
      <p class="soft small">Guessed right ${seen[it.id].r} time${seen[it.id].r === 1 ? "" : "s"}, wrong ${seen[it.id].w}.</p></div>` : "";
    const tiles = W.ITEMS.map((x) => seen[x.id]
      ? `<button type="button" class="tile" data-tile="${x.id}" aria-pressed="${x.id === cribPick}">${W.svg(x, false, esc(x.name))}<span>${esc(x.name)}</span></button>`
      : `<div class="tile locked" aria-label="Not found yet"><div class="q">?</div><span class="soft">Not yet</span></div>`).join("");
    app.innerHTML = `<div class="card"><h2>Tool Crib</h2>
      <p class="soft small">${found} of ${W.ITEMS.length} found. Each riddle you answer, right or wrong, goes on the shelf here. Tap one to see it again.</p></div>
      ${detail}<div class="grid">${tiles}</div>${statsHtml(today())}
      <button type="button" class="big plain" data-act="reset">Start over (erase streak and Tool Crib)</button>
      <p class="soft small" style="text-align:center">Your streak and Tool Crib are kept only on this device.</p>`;
  }

  // ---------- drawing the screen ----------
  function render(justAnswered) {
    const day = today();
    shownDay = day;
    const streak = W.liveStreak(stats, day), pill = $("#streakPill");
    pill.hidden = streak < 1;
    pill.textContent = `🔥 ${streak} day${streak === 1 ? "" : "s"}`;
    document.querySelectorAll(".tabs button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    if (tab === "today") renderToday(justAnswered);
    else if (tab === "more") renderMore(justAnswered);
    else renderCrib();
  }
  function go(t) { tab = t; render(); window.scrollTo(0, 0); }

  app.addEventListener("click", (e) => {
    const choice = e.target.closest("[data-choice]"), act = e.target.closest("[data-act]"), tile = e.target.closest("[data-tile]");
    if (choice && !choice.disabled) {
      const pick = choice.dataset.choice;
      if (tab === "today") {
        const day = today(), item = W.dailyItem(day);
        if (daily && daily.day === day) return;
        const correct = pick === item.name;
        stats = W.recordDay(stats, day, correct); daily = { day, pick };
        store.set("stats", stats); store.set("daily", daily); markSeen(item.id, correct);
      } else if (tab === "more" && extra && extra.pick === null) {
        const correct = pick === W.BY_ID[extra.id].name;
        extra.pick = pick; tally.played += 1; tally.right += correct ? 1 : 0; markSeen(extra.id, correct);
      }
      render(true);
    } else if (act) {
      const a = act.dataset.act;
      if (a === "more") go("more");
      else if (a === "next") { newExtra(); go("more"); }
      else if (a === "reset" && window.confirm("Erase your streak and empty the Tool Crib on this device? This can't be undone.")) {
        stats = Object.assign({}, W.NEW_STATS); daily = null; seen = {}; extra = null; tally = { right: 0, played: 0 }; cribPick = null;
        store.set("stats", stats); store.set("daily", daily); store.set("seen", seen);
        render();
      }
    } else if (tile) {
      cribPick = tile.dataset.tile; render();
      const d = $("#detail"); if (d) d.scrollIntoView({ behavior: noMotion() ? "auto" : "smooth", block: "start" });
    }
  });
  $(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab); });
  // left open overnight: show the new day's riddle when the phone wakes
  document.addEventListener("visibilitychange", () => { if (!document.hidden && today() !== shownDay) render(); });

  render();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
