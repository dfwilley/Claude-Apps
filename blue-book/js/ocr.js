// Blue Book — reads the words on a page, on the phone.
// iPhone app: Apple's built-in text reader (handles handwriting). Web version: Tesseract, bundled with the app (no outside service).
(function (root) {
  'use strict';
  let worker = null;

  async function webWorker(onProgress) {
    if (worker) return worker;
    const base = new URL('vendor/', location.href).href;
    worker = await root.Tesseract.createWorker('eng', 1, {
      workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false, cacheMethod: 'none',
      logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress); },
    });
    await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' });
    return worker;
  }

  // Returns [{text, conf, x0, y0, x1, y1}] with positions as fractions of the page.
  async function readWeb(canvas, onProgress) {
    const w = await webWorker(onProgress);
    const { data } = await w.recognize(canvas, {}, { blocks: true, text: false, hocr: false, tsv: false });
    const W = canvas.width, H = canvas.height, out = [];
    for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const wd of l.words || []) {
      const t = (wd.text || '').trim(); if (!t) continue;
      out.push({ text: t, conf: Math.round(wd.confidence), x0: wd.bbox.x0 / W, y0: wd.bbox.y0 / H, x1: wd.bbox.x1 / W, y1: wd.bbox.y1 / H });
    }
    return out;
  }

  async function read(photoId, canvas, onProgress) {
    if (root.BBStore.isNative) {
      // Read the cleaned-up page (printed lines painted out, lighting evened) so lines aren't read as 1s and dashes.
      let words;
      try { words = await root.BBStore.ocrImage(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]); } catch (e) { words = await root.BBStore.ocr(photoId); } // an older app: read the stored photo
      return (words || []).map(w => ({ text: w.text, conf: Math.round(w.conf), x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 }));
    }
    return readWeb(canvas, onProgress);
  }

  // Second look (web version): number cells that have ink in them but where nothing was read —
  // single digits beside printed lines are easy to miss. Each is read on its own as a number.
  async function secondLook(prepared, words, template, bands, onProgress) {
    if (root.BBStore.isNative) return [];
    const X = root.BBExtract; const numeric = new Set(['day', ...X.NUM_FIELDS]);
    const { gray, w: W, h: H, canvas } = prepared; const todo = [];
    for (const b of bands) for (const c of template.columns) {
      if (!numeric.has(c.field)) continue;
      const has = words.some(wd => { const x = (wd.x0 + wd.x1) / 2, y = (wd.y0 + wd.y1) / 2; return x >= c.x0 && x < c.x1 && y >= b.y0 && y < b.y1; });
      if (has) continue;
      const ix0 = Math.round((c.x0 + (c.x1 - c.x0) * 0.1) * W), ix1 = Math.round((c.x1 - (c.x1 - c.x0) * 0.1) * W);
      const iy0 = Math.round((b.y0 + (b.y1 - b.y0) * 0.12) * H), iy1 = Math.round((b.y1 - (b.y1 - b.y0) * 0.12) * H);
      let ink = 0, n = 0; for (let y = iy0; y < iy1; y += 1) for (let x = ix0; x < ix1; x += 1) { n++; if (gray[y * W + x] < 120) ink++; }
      if (n && ink / n > 0.006) todo.push({ c, b, ix0, ix1, iy0, iy1 });
    }
    if (!todo.length) return [];
    const wk = await webWorker();
    await wk.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789.' });
    const found = [];
    try {
      for (let i = 0; i < todo.length; i++) {
        const t = todo[i]; const cw = t.ix1 - t.ix0, ch = t.iy1 - t.iy0; const pad = 16, s = Math.max(1, 64 / ch);
        const cc = document.createElement('canvas'); cc.width = Math.round(cw * s) + pad * 2; cc.height = Math.round(ch * s) + pad * 2;
        const g = cc.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cc.width, cc.height); g.drawImage(canvas, t.ix0, t.iy0, cw, ch, pad, pad, cw * s, ch * s);
        const { data } = await wk.recognize(cc);
        const text = (data.text || '').trim().replace(/\s+/g, ' ');
        if (text && /\d/.test(text)) found.push({ text, conf: Math.min(55, Math.round(data.confidence)), x0: t.ix0 / W, x1: t.ix1 / W, y0: t.iy0 / H, y1: t.iy1 / H, second: true });
        if (onProgress) onProgress((i + 1) / todo.length);
      }
    } finally {
      await wk.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' });
    }
    return found;
  }

  // Ink in the middle of a box, on the cleaned-up page: how much, and how wide and tall the marks are.
  // withRules: look at the page before printed lines were painted out, staying well inside the box to miss its printed edges.
  function inkIn(prepared, band, col, withRules) {
    const { w: W, h: H } = prepared; const gray = withRules && prepared.grayWithRules ? prepared.grayWithRules : prepared.gray; const my = withRules ? 0.24 : 0.12;
    const ix0 = Math.round((col.x0 + (col.x1 - col.x0) * 0.1) * W), ix1 = Math.round((col.x1 - (col.x1 - col.x0) * 0.1) * W);
    const iy0 = Math.round((band.y0 + (band.y1 - band.y0) * my) * H), iy1 = Math.round((band.y1 - (band.y1 - band.y0) * my) * H); const DARK = withRules ? 170 : 120; // pencil lines are pale
    let ink = 0, n = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (let y = iy0; y < iy1; y++) for (let x = ix0; x < ix1; x++) { n++; if (gray[y * W + x] < DARK) { ink++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
    return { frac: n ? ink / n : 0, wide: maxX < 0 ? 0 : (maxX - minX + 1) / Math.max(1, ix1 - ix0), tall: maxY < 0 ? 0 : (maxY - minY + 1) / Math.max(1, iy1 - iy0) };
  }

  // A line drawn through the type box means "same aircraft as the line above". A reader sees no words there,
  // so where a type box holds a long flat mark and nothing was read, note it as that mark.
  function markLines(prepared, words, template, bands) {
    const X = root.BBExtract; const out = words.slice();
    for (const b of bands) for (const c of template.columns) {
      if (c.field !== 'type' || X.cellAt(out, b, c).length) continue;
      const k = inkIn(prepared, b, c, true);
      if (k.frac > 0.004 && k.wide >= 0.45 && k.tall <= 0.45) out.push({ text: '—', conf: 90, x0: c.x0 + 0.001, x1: c.x1 - 0.001, y0: b.y0 + 0.001, y1: b.y1 - 0.001, line: true });
    }
    return out;
  }

  // Close-up pass (iPhone app): every box with writing in it is cut out of the cleaned-up page, enlarged, and read
  // on its own. Apple's reader gives a few alternative readings for each; the one that fits the column is used.
  const CLOSE_UP_SKIP = new Set(['skip', 'remarks', 'squadron', 'ship']);
  function cropBox(prepared, band, col) {
    const { canvas, w: W, h: H } = prepared; const cw = col.x1 - col.x0, bh = band.y1 - band.y0;
    void cw; const x0 = Math.max(0, Math.round(col.x0 * W) + 4), x1 = Math.min(W, Math.round(col.x1 * W) - 4); // just inside the printed column lines, so they aren't read as 1s
    const y0 = Math.max(0, Math.round((band.y0 - bh * 0.05) * H)), y1 = Math.min(H, Math.round((band.y1 + bh * 0.05) * H));
    const sw = Math.max(1, x1 - x0), sh = Math.max(1, y1 - y0), s = Math.max(1, Math.min(4, 110 / sh)), pad = 14;
    const c = document.createElement('canvas'); c.width = Math.round(sw * s) + pad * 2; c.height = Math.round(sh * s) + pad * 2;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(canvas, x0, y0, sw, sh, pad, pad, sw * s, sh * s);
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  }
  async function closeUp(prepared, words, template, bands, knownTypes, onProgress, readBoxes) {
    const X = root.BBExtract; let out = words.slice();
    const cols = template.columns.filter(c => !CLOSE_UP_SKIP.has(c.field));
    for (let r = 0; r < bands.length; r++) {
      const b = bands[r]; const jobs = [];
      for (const c of cols) if (X.cellAt(out, b, c).length || inkIn(prepared, b, c).frac > 0.006) jobs.push({ c, image: cropBox(prepared, b, c) });
      if (jobs.length) {
        const res = await readBoxes(jobs.map(j => j.image));
        jobs.forEach((j, i) => {
          const here = X.cellAt(out, b, j.c); const pageText = X.readingOrder(here).map(w => w.text).join(' ');
          const pick = X.chooseReading(j.c.field, pageText, (res && res[i]) || [], knownTypes);
          if (!pick) return;
          out = out.filter(w => !here.includes(w));
          out.push({ text: pick.text, conf: Math.round(pick.conf), x0: j.c.x0 + 0.001, x1: j.c.x1 - 0.001, y0: b.y0 + 0.001, y1: b.y1 - 0.001, closeUp: true });
        });
      }
      if (onProgress) onProgress((r + 1) / bands.length);
    }
    return out;
  }

  // Everything after the first whole-page reading. Returns the final list of words.
  async function refine(prepared, words, template, bands, knownTypes, onProgress) {
    let out = words;
    if (root.BBStore.isNative) {
      try { out = await closeUp(prepared, words, template, bands, knownTypes, onProgress, imgs => root.BBStore.ocrCells(imgs)); } catch (e) { out = words; } // an older app without the close-up reader
    } else out = words.concat(await secondLook(prepared, words, template, bands, onProgress));
    return markLines(prepared, out, template, bands);
  }

  root.BBOcr = { refine, closeUp, markLines, inkIn, read, secondLook, engine: () => (root.BBStore.isNative ? "Apple's on-device text reader" : 'Tesseract (runs on this phone)') };
})(typeof window !== 'undefined' ? window : globalThis);
