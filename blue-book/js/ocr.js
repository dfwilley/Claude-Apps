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
      const words = await root.BBStore.ocr(photoId);
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

  root.BBOcr = { read, secondLook, engine: () => (root.BBStore.isNative ? "Apple's on-device text reader" : 'Tesseract (runs on this phone)') };
})(typeof window !== 'undefined' ? window : globalThis);
