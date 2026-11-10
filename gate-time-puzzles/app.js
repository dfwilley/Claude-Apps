// Gate Time Puzzles: screens, timer and saved progress. Puzzle recipes and grading live in core.js (window.GTP).
(function () {
  "use strict";
  const P = window.GTP;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const app = $("#app");
  const CAT_KEYS = Object.keys(P.CATS);
  const R = P.makeRng();

  // ---------- saved state (stays on this phone) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("gtp." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("gtp." + k, JSON.stringify(v)); } catch { /* storage full or blocked: keep playing */ } },
  };
  let ratings = Object.assign({ math: 1, nav: 1, mech: 1 }, store.get("ratings", {}));
  let history = store.get("history", []);
  let settings = Object.assign({ limit: 60, sound: false }, store.get("settings", {}));
  let recentKeys = store.get("recent", []);
  let streak = store.get("streak", { now: 0, best: 0 });
  let boardAt = store.get("boardAt", null); // boarding time, ms
  let boardPick = boardAt ? store.get("boardPick", 0) : 0;
  let tab = "play";
  let play = null; // the puzzle on screen
  let picked = null; // greenie board cell being looked at
  let lastIds = [];

  function save() {
    store.set("ratings", ratings); store.set("history", history.slice(-2000)); store.set("settings", settings);
    store.set("recent", recentKeys.slice(-60)); store.set("streak", streak);
  }

  function toast(msg, ms = 2600) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), ms);
  }

  // ---------- little sounds (off unless turned on) ----------
  let actx = null;
  function beep(notes) {
    if (!settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      let t = actx.currentTime;
      for (const [f, d] of notes) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d); t += d * 0.8;
      }
    } catch { /* no audio: fine */ }
  }

  // ---------- helpers ----------
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const dayLabel = (key) => {
    if (key === dayKey(Date.now())) return "Today";
    if (key === dayKey(Date.now() - 864e5)) return "Yesterday";
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };
  const gradeChip = (g, extra = "") => {
    const G = P.GRADES[g];
    return `<span class="gc ${G.cls}${G.underline ? " u" : ""} ${extra}" title="${esc(G.name)}">${G.label}</span>`;
  };
  const levelLine = (cat) => { const L = P.levelOf(ratings[cat]); return `Level ${L} · ${P.rankOf(L)}`; };
  const levelPct = (cat) => Math.round((ratings[cat] - P.levelOf(ratings[cat])) * 100);

  // ---------- tabs ----------
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    if (play && !play.answered && b.dataset.tab !== "play") pause();
    tab = b.dataset.tab; picked = null; render(); window.scrollTo(0, 0);
  }));

  function render() {
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === tab ? "page" : "false"));
    if (tab === "play") { if (play) renderPuzzle(); else renderHome(); }
    else if (tab === "board") renderBoard();
    else renderMore();
  }

  // ---------- home ----------
  function renderHome() {
    const today = history.filter((h) => dayKey(h.t) === dayKey(Date.now()));
    const boardNote = boardAt
      ? `<p class="soft">Boarding at <b>${new Date(boardAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</b>. The countdown shows at the top.</p>`
      : `<p class="soft">Set a countdown and keep an eye on it while you play.</p>`;
    app.innerHTML = `
      <section class="card hero">
        <h2>Got a minute?</h2>
        <p>One puzzle at a time, ${settings.limit} seconds each. Tap your answer. They get harder as you get better.</p>
        <button class="big primary" data-play="mixed" type="button">▶&nbsp; Mixed puzzles</button>
      </section>
      <div class="cats">
        ${CAT_KEYS.map((c) => `
          <button class="card cat" data-play="${c}" type="button">
            <span class="cat-icon" aria-hidden="true">${P.CATS[c].icon}</span>
            <span class="cat-body">
              <span class="cat-name">${P.CATS[c].label}</span>
              <span class="cat-lvl">${levelLine(c)}</span>
              <span class="bar" aria-hidden="true"><i style="width:${levelPct(c)}%"></i></span>
              <span class="cat-blurb">${esc(P.CATS[c].blurb)}</span>
            </span>
          </button>`).join("")}
      </div>
      <section class="card">
        <h2>Boarding in…</h2>
        <div class="chips" role="group" aria-label="Boarding countdown">
          ${[0, 10, 20, 30, 45, 60, 90].map((m) => `<button type="button" class="chip-btn" data-board="${m}" aria-pressed="${m === boardPick ? "true" : "false"}">${m ? m + " min" : "Off"}</button>`).join("")}
        </div>
        ${boardNote}
      </section>
      <section class="card today">
        <h2>Today</h2>
        ${today.length ? `
          <p><b>${today.length}</b> puzzle${today.length === 1 ? "" : "s"} · board average <b>${P.gpa(today.map((h) => h.g)).toFixed(2)}</b> · ${streak.now} right in a row (best ${streak.best})</p>
          <div class="row-cells">${today.slice(-30).map((h) => gradeChip(h.g)).join("")}</div>`
          : `<p class="soft">No puzzles yet today. Your results land on the Greenie Board, graded like carrier landings.</p>`}
      </section>`;
  }

  app.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.play) { startPlay(b.dataset.play); return; }
    if (b.dataset.board !== undefined) { setBoarding(+b.dataset.board); return; }
    if (b.dataset.opt !== undefined) { answer(+b.dataset.opt); return; }
    const act = b.dataset.act;
    if (act === "next") nextPuzzle();
    else if (act === "skip") answer(null, "skip");
    else if (act === "quit") { stopTimer(); play = null; render(); }
    else if (act === "resume") resume();
    else if (act === "cell") { picked = +b.dataset.i; renderBoard(); $("#picked")?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    else if (act === "limit") { settings.limit = +b.dataset.v; save(); renderMore(); }
    else if (act === "sound") { settings.sound = !settings.sound; save(); renderMore(); if (settings.sound) beep([[660, 0.12], [880, 0.15]]); }
    else if (act === "reset-levels") { if (confirm("Start all three categories over at Level 1? Your Greenie Board stays.")) { ratings = { math: 1, nav: 1, mech: 1 }; save(); toast("Levels reset."); renderMore(); } }
    else if (act === "clear-board") { if (confirm("Clear every result from the Greenie Board? Levels stay.")) { history = []; streak = { now: 0, best: 0 }; save(); toast("Greenie Board cleared."); renderMore(); } }
  });

  // ---------- boarding countdown ----------
  function setBoarding(m) {
    boardAt = m ? Date.now() + m * 60000 : null; boardPick = m; store.set("boardAt", boardAt); store.set("boardPick", m);
    updatePill(); if (tab === "play" && !play) renderHome();
  }
  function updatePill() {
    const pill = $("#boardPill");
    document.body.classList.toggle("boarding", !!boardAt);
    if (!boardAt) { pill.hidden = true; return; }
    const left = Math.round((boardAt - Date.now()) / 1000);
    if (left <= 0) {
      boardAt = null; boardPick = 0; store.set("boardAt", null); pill.hidden = true; document.body.classList.remove("boarding");
      beep([[880, 0.2], [660, 0.2], [880, 0.3]]);
      toast("✈️ Time to board! Your progress is saved.", 6000);
      if (tab === "play" && !play) renderHome();
      return;
    }
    pill.hidden = false;
    pill.classList.toggle("soon", left <= 300);
    pill.textContent = `✈️ Boarding ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  }
  setInterval(updatePill, 1000); updatePill();

  // ---------- playing ----------
  function startPlay(mode) { play = { mode }; nextPuzzle(); }

  function nextPuzzle() {
    const mode = play.mode;
    const cat = mode === "mixed" ? R.pick(CAT_KEYS) : mode;
    const puzzle = P.makePuzzle(cat, ratings[cat], R, { avoidIds: lastIds, avoidTexts: recentKeys });
    lastIds = [...lastIds, puzzle.id].slice(-2);
    recentKeys.push(puzzle.key); recentKeys = recentKeys.slice(-60);
    play = { mode, puzzle, used: 0, since: Date.now(), answered: false, paused: false };
    startTimer(); render(); window.scrollTo(0, 0);
  }

  const elapsed = () => (play ? play.used + (play.paused || play.answered ? 0 : (Date.now() - play.since) / 1000) : 0);
  let timerH = null;
  function startTimer() { stopTimer(); timerH = setInterval(tick, 200); tick(); }
  function stopTimer() { clearInterval(timerH); timerH = null; }
  function tick() {
    if (!play || play.answered || play.paused) return;
    const left = Math.max(0, settings.limit - elapsed());
    const bar = $("#tbar"), txt = $("#ttxt");
    if (bar) { bar.style.width = (left / settings.limit) * 100 + "%"; bar.classList.toggle("low", left <= 10); }
    if (txt) txt.textContent = Math.ceil(left) + " s";
    if (left <= 0) answer(null, "timeout");
  }
  function pause() { if (!play || play.answered || play.paused) return; play.used = elapsed(); play.paused = true; stopTimer(); }
  function resume() { if (!play || !play.paused) return; play.paused = false; play.since = Date.now(); startTimer(); render(); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(); if (tab === "play" && play && play.paused) render(); } });

  function answer(idx, how) {
    if (!play || play.answered || play.paused) return;
    const seconds = elapsed();
    play.used = seconds; play.answered = true; stopTimer();
    const pz = play.puzzle, correct = idx === pz.correct;
    const g = P.grade({ correct, seconds, timedOut: how === "timeout", skipped: how === "skip", limit: settings.limit });
    const before = P.levelOf(ratings[pz.cat]);
    ratings[pz.cat] = P.updateRating(ratings[pz.cat], g);
    const after = P.levelOf(ratings[pz.cat]);
    if (correct) { streak.now++; streak.best = Math.max(streak.best, streak.now); } else if (how !== "skip") streak.now = 0;
    history.push({ t: Date.now(), c: pz.cat, g, s: Math.round(seconds), q: (pz.text + (pz.big ? " " + pz.big : "") + (pz.mono ? " (" + pz.mono.join("; ").replace(/\s+/g, " ") + ")" : "")).slice(0, 300), a: pz.answer, y: idx === null ? null : pz.options[idx] });
    save();
    play.choice = idx; play.grade = g;
    play.levelMsg = after > before ? `⬆️ Level up! ${P.CATS[pz.cat].label} is now Level ${after} · ${P.rankOf(after)}.`
      : after < before ? `${P.CATS[pz.cat].label} eased back to Level ${after}. You'll climb back fast.` : "";
    if (correct) beep([[660, 0.1], [990, 0.16]]); else beep([[220, 0.25]]);
    renderPuzzle();
    $(".result")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  document.addEventListener("keydown", (e) => {
    if (tab !== "play" || !play || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (!play.answered && "1234abcd".includes(k) && k.length === 1) answer("1234".includes(k) ? +k - 1 : "abcd".indexOf(k));
    else if (play.answered && (k === "enter" || k === " " || k === "n")) { e.preventDefault(); nextPuzzle(); }
  });

  function renderPuzzle() {
    const pz = play.puzzle, C = P.CATS[pz.cat], done = play.answered;
    const left = Math.max(0, settings.limit - elapsed());
    const G = done ? P.GRADES[play.grade] : null;
    app.innerHTML = `
      <div class="pz-top">
        <button class="ghost" data-act="quit" type="button">✕ Done</button>
        <span class="tag">${C.icon} ${C.label} · Level ${pz.level}</span>
      </div>
      <div class="timer" aria-hidden="${done}">
        <div class="track"><i id="tbar" style="width:${done ? 0 : (left / settings.limit) * 100}%"></i></div>
        <span id="ttxt">${done ? Math.round(play.used) + " s used" : Math.ceil(left) + " s"}</span>
      </div>
      ${play.paused ? `
        <section class="card paused">
          <p>Paused — the clock stopped when you left. ${Math.ceil(left)} seconds left.</p>
          <button class="big primary" data-act="resume" type="button">Resume</button>
        </section>` : `
      <section class="card q">
        <p class="qtext">${esc(pz.text)}</p>
        ${pz.big ? `<div class="bigq">${esc(pz.big)}</div>` : ""}
        ${pz.mono ? `<pre class="mono">${esc(pz.mono.join("\n"))}</pre>` : ""}
      </section>
      <div class="opts">
        ${pz.options.map((o, i) => {
          let cls = "";
          if (done) cls = i === pz.correct ? "right" : i === play.choice ? "wrong" : "dim";
          return `<button type="button" class="opt ${cls}" data-opt="${i}" ${done ? "disabled" : ""} aria-label="Answer ${"ABCD"[i]}: ${esc(o)}${done && i === pz.correct ? " (correct)" : ""}"><span class="letter">${"ABCD"[i]}</span><span class="otext">${esc(o)}</span></button>`;
        }).join("")}
      </div>
      ${done ? `
        <section class="card result">
          <div class="result-head">${gradeChip(play.grade, "lg")}<div><b>${esc(G.name)}</b><br><span class="soft">${Math.round(play.used)} seconds${play.grade === "NG" ? ` · answer: ${esc(pz.answer)}` : ""}</span></div></div>
          ${play.levelMsg ? `<p class="lvlmsg">${esc(play.levelMsg)}</p>` : ""}
          <p class="how"><b>How to work it:</b> ${esc(pz.how)}</p>
        </section>
        <button class="big primary" data-act="next" type="button">Next puzzle ▶</button>`
        : `<button class="link" data-act="skip" type="button">Wave off (skip this one)</button>`}`}`;
  }

  // ---------- greenie board ----------
  function renderBoard() {
    if (!history.length) {
      app.innerHTML = `<section class="card"><h2>Greenie Board</h2><p class="soft">Nothing here yet. Every puzzle you answer gets an LSO-style grade and lands on this board.</p></section>${legend()}`;
      return;
    }
    const days = [];
    history.forEach((h, i) => { const k = dayKey(h.t); if (!days.length || days[days.length - 1].k !== k) days.push({ k, items: [] }); days[days.length - 1].items.push({ h, i }); });
    const shown = days.slice(-14).reverse();
    const recent = history.slice(-50).map((h) => h.g);
    const p = picked !== null ? history[picked] : null;
    app.innerHTML = `
      <section class="card">
        <h2>Greenie Board</h2>
        <div class="stats">
          <div><b>${P.gpa(recent).toFixed(2)}</b><span>average, last ${recent.length}</span></div>
          <div><b>${history.length}</b><span>puzzles</span></div>
          <div><b>${streak.best}</b><span>best streak</span></div>
        </div>
        <div class="board" role="list">
          ${shown.map((d) => `
            <div class="brow" role="listitem">
              <div class="bday">${esc(dayLabel(d.k))}<span>${P.gpa(d.items.map((x) => x.h.g)).toFixed(1)}</span></div>
              <div class="row-cells">${d.items.map(({ h, i }) => `<button type="button" class="cellbtn${picked === i ? " sel" : ""}" data-act="cell" data-i="${i}" aria-label="${esc(P.GRADES[h.g].name)}, ${esc(P.CATS[h.c]?.label || "")}">${gradeChip(h.g)}</button>`).join("")}</div>
            </div>`).join("")}
        </div>
        <p class="soft small">Tap a square to see that puzzle.</p>
      </section>
      ${p ? `
        <section class="card" id="picked">
          <div class="result-head">${gradeChip(p.g, "lg")}<div><b>${esc(P.GRADES[p.g].name)}</b><br><span class="soft">${esc(P.CATS[p.c]?.label || "")} · ${p.s} s · ${new Date(p.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div></div>
          <p>${esc(p.q)}</p>
          <p>Answer: <b>${esc(p.a)}</b>${p.y && p.y !== p.a ? ` · you picked ${esc(p.y)}` : ""}</p>
        </section>` : ""}
      <section class="card">
        <h2>By category</h2>
        <table class="tbl">
          <thead><tr><th>Category</th><th>Level</th><th>Done</th><th>Right</th><th>Avg time</th></tr></thead>
          <tbody>${CAT_KEYS.map((c) => {
            const hs = history.filter((h) => h.c === c), ans = hs.filter((h) => h.g !== "WO" && h.g !== "B"), right = hs.filter((h) => ["OKU", "OK", "F"].includes(h.g));
            const avg = right.length ? Math.round(right.reduce((s, h) => s + h.s, 0) / right.length) + " s" : "–";
            return `<tr><td>${P.CATS[c].icon} ${P.CATS[c].label}</td><td>${P.levelOf(ratings[c])}<span class="soft small"> ${P.rankOf(P.levelOf(ratings[c]))}</span></td><td>${hs.length}</td><td>${ans.length ? Math.round((right.length / hs.length) * 100) + "%" : "–"}</td><td>${avg}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </section>
      ${legend()}`;
  }
  function legend() {
    const k = settings.limit / 60;
    const rows = [
      ["OKU", `Right in ${Math.round(15 * k)} s or less`], ["OK", `Right in ${Math.round(35 * k)} s or less`], ["F", "Right, but slower"],
      ["B", "Clock ran out"], ["NG", "Wrong answer"], ["WO", "Skipped"],
    ];
    return `<section class="card"><h2>Grades</h2><ul class="legend">${rows.map(([g, t]) => `<li>${gradeChip(g)}<span><b>${esc(P.GRADES[g].name)}</b> — ${t} (${P.GRADES[g].pts} pt${P.GRADES[g].pts === 1 ? "" : "s"})</span></li>`).join("")}</ul>
      <p class="soft small">Right answers move you up a level; misses ease you back, so the puzzles stay just hard enough.</p></section>`;
  }

  // ---------- settings ----------
  function renderMore() {
    app.innerHTML = `
      <section class="card">
        <h2>Time per puzzle</h2>
        <div class="chips">${[45, 60, 90].map((v) => `<button type="button" class="chip-btn" data-act="limit" data-v="${v}" aria-pressed="${settings.limit === v}">${v} seconds</button>`).join("")}</div>
        <p class="soft small">The grade cutoffs stretch or shrink to match.</p>
      </section>
      <section class="card">
        <h2>Sounds</h2>
        <button type="button" class="chip-btn" data-act="sound" aria-pressed="${settings.sound}">${settings.sound ? "🔊 On" : "🔈 Off"}</button>
        <p class="soft small">A short chime for right and wrong answers, and when it's time to board. Off by default for quiet gate areas.</p>
      </section>
      <section class="card">
        <h2>Your levels</h2>
        <ul class="plain">${CAT_KEYS.map((c) => `<li>${P.CATS[c].icon} ${P.CATS[c].label}: ${levelLine(c)}</li>`).join("")}</ul>
        <div class="chips">
          <button type="button" class="chip-btn warn" data-act="reset-levels">Start levels over</button>
          <button type="button" class="chip-btn warn" data-act="clear-board">Clear Greenie Board</button>
        </div>
      </section>
      <section class="card">
        <h2>About</h2>
        <p>Every puzzle is made right on your phone, so there's an endless supply and it works in airplane mode once it's been opened. Your levels and board are saved on this phone only.</p>
        <p>To keep it on your Home Screen: in Safari, tap <b>Share</b> › <b>Add to Home Screen</b>.</p>
        <p class="soft small">Some answers use standard pilot rules of thumb: the crosswind clock rule, 3° descent ≈ groundspeed × 5, standard-rate bank ≈ airspeed ÷ 10 + 7, and 6 lb per gallon of avgas. Tucson times use Arizona's year-round UTC−7.</p>
      </section>`;
  }

  // ---------- start ----------
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
