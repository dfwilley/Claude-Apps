// Brick Pile: the rules. Keeps the list of bricks, writes the two questions that are sent to Claude (Anthropic's AI)
// with a picture, and checks that every building idea that comes back uses only bricks that are really in the pile.
// Nothing here touches the screen, so tests/brick-pile.test.js can run it with Node.
(function (root) {
  "use strict";
  const MODEL = "claude-opus-5-5";
  const ENDPOINT = "https://api.anthropic.com/v1/messages";
  const PHOTO_EDGE = 1568; // longest side of the picture that is sent, in pixels
  const THUMB_EDGE = 360; // the small copy kept on the device

  // Colour names Claude may use, with the colour each is drawn in.
  const COLORS = [
    ["red", "#C91A09"], ["dark red", "#720E0F"], ["orange", "#F08A1C"], ["yellow", "#F2CD37"], ["tan", "#E4CD9E"],
    ["brown", "#6B3F22"], ["lime", "#A5CA18"], ["green", "#237841"], ["dark green", "#184632"], ["light blue", "#5AC4DA"],
    ["blue", "#0055BF"], ["dark blue", "#0A3463"], ["purple", "#81007B"], ["pink", "#E4ADC8"], ["white", "#F4F4F4"],
    ["light gray", "#A0A5A9"], ["dark gray", "#6C6E68"], ["black", "#1B1B1B"], ["clear", "#D9EEF5"], ["other", "#B8A8D8"]];
  const COLOR_NAMES = COLORS.map((c) => c[0]);
  const hex = (color) => (COLORS.find((c) => c[0] === color) || COLORS[COLORS.length - 1])[1];

  // Kinds of piece, in the order the list is shown.
  const KINDS = ["brick", "plate", "tile", "slope", "round", "wheel", "window or door", "figure", "technic", "special"];
  const KIND_TITLES = { brick: "Bricks", plate: "Plates (thin)", tile: "Tiles (smooth)", slope: "Slopes", round: "Round pieces",
    wheel: "Wheels", "window or door": "Windows and doors", figure: "Figures", technic: "Technic", special: "Special pieces" };
  const WHO = [["little", "a little kid (4 to 7)"], ["kid", "a kid (8 to 12)"], ["grownup", "a teen or grown-up"]];
  const LEVELS = ["easy", "medium", "tricky"];

  // ---------- the pile ----------
  // "2X4  Brick" and "2 x 4 brick" are the same piece.
  function cleanName(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[×✕]/g, "x").replace(/(\d)\s*x\s*(?=\d)/g, "$1 x ")
      .replace(/[^a-z0-9 /.,()'-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  }
  function cleanItem(raw) {
    if (!raw) return null;
    const name = cleanName(raw.name), count = Math.min(999, Math.floor(Number(raw.count)));
    if (!name || !(count >= 1)) return null;
    return { name, kind: KINDS.includes(raw.kind) ? raw.kind : "special", color: COLOR_NAMES.includes(raw.color) ? raw.color : "other",
      count, unsure: !!raw.unsure };
  }
  const emptyPile = () => ({ items: [], nextId: 1, photos: [], ideas: [], who: "kid" });
  const sameAs = (a, b) => a.name === b.name && a.color === b.color;

  // Add what a picture showed to the pile. A piece already listed gets a bigger count, not a second line.
  function addItems(pile, rawItems) {
    const items = pile.items.map((i) => Object.assign({}, i)); let nextId = pile.nextId || 1, added = 0;
    for (const raw of rawItems || []) {
      const it = cleanItem(raw); if (!it) continue;
      const have = items.find((i) => sameAs(i, it));
      if (have) { have.count = Math.min(999, have.count + it.count); have.unsure = have.unsure || it.unsure; }
      else items.push(Object.assign({ id: nextId++ }, it));
      added += it.count;
    }
    return Object.assign({}, pile, { items, nextId, added });
  }
  // Change one line's count; a count of zero takes the line away.
  function setCount(pile, id, count) {
    const n = Math.max(0, Math.min(999, Math.floor(Number(count)) || 0));
    const items = pile.items.map((i) => (i.id === id ? Object.assign({}, i, { count: n, unsure: false }) : i)).filter((i) => i.count > 0);
    return Object.assign({}, pile, { items });
  }
  // Say what a line really is (a new name, kind or colour). If that makes it the same as another line, the two join up.
  function editItem(pile, id, change) {
    const old = pile.items.find((i) => i.id === id), fixed = old && cleanItem(Object.assign({}, old, change, { unsure: false }));
    if (!fixed) return pile;
    const twin = pile.items.find((i) => i.id !== id && sameAs(i, fixed));
    const items = pile.items.filter((i) => i.id !== (twin ? id : -1)).map((i) => (twin && i.id === twin.id ? Object.assign({}, i, { count: Math.min(999, i.count + fixed.count) })
      : i.id === id ? Object.assign({ id }, fixed) : i));
    return Object.assign({}, pile, { items });
  }
  const total = (items) => items.reduce((n, i) => n + i.count, 0);
  function grouped(items) {
    return KINDS.map((kind) => ({ kind, title: KIND_TITLES[kind],
      items: items.filter((i) => i.kind === kind).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }) || a.color.localeCompare(b.color)) }))
      .filter((g) => g.items.length);
  }
  const label = (i) => `${i.color === "other" ? "" : i.color + " "}${i.name}`;

  // ---------- question 1: what is in the picture? ----------
  function inventorySchema() {
    return { type: "object", additionalProperties: false, required: ["items", "note"], properties: {
      items: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "kind", "color", "count", "unsure"], properties: {
        name: { type: "string", description: "Plain name with the stud size first, such as \"2 x 4 brick\", \"1 x 2 plate\", \"2 x 2 roof slope\", \"small wheel with tire\". No colour in the name." },
        kind: { type: "string", enum: KINDS },
        color: { type: "string", enum: COLOR_NAMES },
        count: { type: "integer", description: "How many of exactly this piece in this colour are visible." },
        unsure: { type: "boolean", description: "True if the size or the count is partly a guess." } } } },
      note: { type: "string", description: "One short, friendly sentence for the builder if something got in the way (pieces piled up, blurry, too dark, not bricks). Otherwise \"\"." } } };
  }
  function inventoryPrompt() {
    return [
      "This photo shows a builder's loose LEGO-style building bricks. Make a list of the pieces so the builder knows what they have.",
      "Put pieces that are exactly alike (same shape, same size, same colour) on one line with how many there are. Work across the whole picture so nothing is counted twice or missed.",
      "Name each piece in plain words a child would understand, with its size in studs (the round bumps on top), short side first: \"2 x 4 brick\", \"1 x 6 plate\", \"2 x 2 tile\", \"2 x 3 roof slope\", \"1 x 1 round brick\", \"small wheel with tire\", \"minifigure\". A brick is tall; a plate is thin, a third as tall as a brick; a tile is a plate with a smooth top. Count the studs rather than judging size by eye. Pick the nearest colour from the list.",
      "List only pieces you can actually see. Do not guess at pieces hidden under others, and do not list things that are not building pieces. Pieces already snapped together count as their separate pieces where you can tell them apart. Set \"unsure\" to true when a size or count is partly a guess.",
      "If there are no building bricks in the picture, return an empty list and say so in the note.",
    ].join("\n\n");
  }
  function body(schema, content) {
    return { model: MODEL, max_tokens: 16000,
      output_config: { effort: "medium", format: { type: "json_schema", schema } },
      fallbacks: "default", // if the service declines a request, let it pass the request to its standard fallback
      messages: [{ role: "user", content }] };
  }
  const inventoryBody = (jpegBase64) => body(inventorySchema(), [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
    { type: "text", text: inventoryPrompt() }]);

  // ---------- question 2: what can be built from the list? ----------
  function ideasSchema() {
    return { type: "object", additionalProperties: false, required: ["ideas"], properties: {
      ideas: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "level", "about", "parts", "steps"], properties: {
        name: { type: "string", description: "Short name of the thing to build, such as \"Little tow truck\"." },
        level: { type: "string", enum: LEVELS },
        about: { type: "string", description: "One sentence saying what it is and what makes it fun." },
        parts: { type: "array", items: { type: "object", additionalProperties: false, required: ["line", "count"], properties: {
          line: { type: "integer", description: "The # number of the line in the builder's list." },
          count: { type: "integer", description: "How many of that piece this build uses." } } } },
        steps: { type: "array", items: { type: "string" }, description: "Building steps in order, one short sentence each, naming the pieces by colour and size." } } } } } };
  }
  function ideasPrompt(items, who, avoid) {
    const forWho = (WHO.find((w) => w[0] === who) || WHO[1])[1];
    const lines = items.map((i) => `#${i.id}: ${i.count} x ${label(i)} (${i.kind})`).join("\n");
    return [
      `Here is every LEGO-style piece a builder has, ${total(items)} in all. Each line has a # number, how many there are, and what the piece is:`,
      lines,
      `Suggest 3 quite different things that ${forWho} could really build using only these pieces. Never use more of a line than its count, and never use a piece that is not on the list. A build does not have to use everything. If there are only a few pieces, suggest small things rather than stretching.`,
      "Each build must hold together the way real bricks do: pieces join stud to tube, plates and bricks overlap to lock a layer, and nothing floats. Use the colours sensibly (wheels for a car, clear pieces for windows or lights).",
      "For each build give its name, how hard it is, one sentence about it, the lines and counts it uses, and building steps in order from the bottom up. Each step is one short sentence that names the pieces by colour and size and says where they go.",
      avoid && avoid.length ? `The builder has already been shown these, so suggest different things: ${avoid.join("; ")}.` : "",
    ].filter(Boolean).join("\n\n");
  }
  const ideasBody = (items, who, avoid) => body(ideasSchema(), [{ type: "text", text: ideasPrompt(items, who, avoid) }]);

  // Check an idea against the pile. Lines that do not exist are dropped, a piece named twice is added up, and anything
  // the idea wants more of than the pile holds is listed in "short" so the screen can say so instead of pretending.
  function checkIdea(items, raw) {
    if (!raw) return null;
    const name = String(raw.name || "").trim().slice(0, 80), steps = (raw.steps || []).map((s) => String(s).trim()).filter(Boolean);
    if (!name || !steps.length) return null;
    const want = new Map();
    for (const p of raw.parts || []) {
      const n = Math.floor(Number(p && p.count)), id = Number(p && p.line);
      if (n >= 1 && items.some((i) => i.id === id)) want.set(id, (want.get(id) || 0) + n);
    }
    const parts = [], short = [];
    for (const [id, n] of want) {
      const item = items.find((i) => i.id === id), part = { name: item.name, color: item.color, count: n };
      parts.push(part);
      if (n > item.count) short.push(Object.assign({}, part, { have: item.count }));
    }
    return { name, level: LEVELS.includes(raw.level) ? raw.level : "medium", about: String(raw.about || "").trim(), parts, short, steps,
      pieces: parts.reduce((n, p) => n + p.count, 0) };
  }
  const checkIdeas = (items, result) => ((result && result.ideas) || []).map((i) => checkIdea(items, i)).filter(Boolean);

  // ---------- talking to Claude ----------
  const looksLikeKey = (k) => /^sk-ant-[\w-]{20,}$/.test(String(k || "").trim());
  function explain(status, b) {
    const said = b && b.error && b.error.message ? " (" + b.error.message + ")" : "";
    if (status === 401) return "The key was not accepted. Check it under Settings.";
    if (status === 403) return "The key is not allowed to do this" + said + ".";
    if (status === 413) return "The picture was too big to send. Try another picture.";
    if (status === 429) return "The service is busy or the account is at its limit. Wait a minute and try again" + said + ".";
    if (status === 400 && /credit|billing/i.test(said)) return "The Anthropic account has no credit left" + said + ".";
    if (status >= 500) return "The service had a problem. Try again in a minute.";
    return "The service refused the request" + said + ".";
  }
  // Send one question and return the answer, already turned from JSON text into an object.
  async function ask(key, requestBody, fetchFn) {
    let res;
    try {
      res = await (fetchFn || root.fetch)(ENDPOINT, { method: "POST", headers: {
        "content-type": "application/json", "x-api-key": key, "anthropic-version": "2026-10-21",
        "anthropic-beta": "server-side-fallback-2026-07-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify(requestBody) });
    } catch (e) { throw new Error("Could not reach the service. Check the internet connection."); }
    let b = null; try { b = await res.json(); } catch (e) { b = null; }
    if (!res.ok) throw new Error(explain(res.status, b));
    if (!b || b.stop_reason === "refusal") throw new Error("The service declined this request. Try a different picture.");
    if (b.stop_reason === "max_tokens") throw new Error("There was too much to list in one go. Try a picture with fewer bricks.");
    const text = (b.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    let result; try { result = JSON.parse(text); } catch (e) { throw new Error("The service sent back something unreadable. Try again."); }
    return { result, usage: b.usage || null };
  }
  // Rough cost of one answer in dollars at list prices ($4 per million tokens in, $20 per million out).
  const cost = (usage) => (usage ? ((usage.input_tokens || 0) * 4 + (usage.output_tokens || 0) * 20) / 1e6 : 0);

  // Shrink a picture so its longest side is at most "edge", keeping its shape. Never makes it bigger.
  function fitSize(w, h, edge) {
    const k = Math.min(1, edge / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  const api = { MODEL, ENDPOINT, PHOTO_EDGE, THUMB_EDGE, COLORS, COLOR_NAMES, KINDS, KIND_TITLES, WHO, LEVELS, hex, cleanName, cleanItem, emptyPile,
    addItems, setCount, editItem, total, grouped, label, inventorySchema, inventoryPrompt, inventoryBody, ideasSchema, ideasPrompt, ideasBody,
    checkIdea, checkIdeas, looksLikeKey, explain, ask, cost, fitSize };
  root.BrickPile = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
