/*
 * Diwali Wish Maker: page logic.
 *
 * Everything lives in this closure, in this browser tab only. Nothing is sent
 * to a server or written to storage, so every visitor gets an independent maker.
 */
(() => {
  'use strict';

  const TEMPLATE_URL = 'template/diwali-template.html';
  const FONT_CSS_URL = 'fonts/fonts.css';
  const RESET_DELAY_MS = 1200;   // let the browser start the download before the page resets
  const REVOKE_DELAY_MS = 30000; // some mobile browsers ask before saving, so keep the Blob URL alive a little longer

  const P = window.DiwaliPersonalize;
  const $ = s => document.querySelector(s);

  const form = $('#wishForm');
  const senderEl = $('#sender'), receiverEl = $('#receiver');
  const senderErr = $('#senderErr'), receiverErr = $('#receiverErr');
  const generateBtn = $('#generateBtn'), clearBtn = $('#clearBtn'), downloadBtn = $('#downloadBtn');
  const statusEl = $('#status'), resultEl = $('#result'), frameBox = $('#frameBox'), fileNameEl = $('#fileName');
  const pv = { from1: $('#pvFrom1'), from2: $('#pvFrom2'), to1: $('#pvTo1'), to2: $('#pvTo2') };

  /* The generated wish for this visitor; null whenever nothing is generated. */
  let generated = null;
  let resetTimer = 0;
  const blobUrls = new Set();

  /* ---------- loading the original template (read-only) ---------- */
  let assetsPromise = null;
  function loadAssets() {
    if (!assetsPromise) {
      assetsPromise = Promise.all([loadTemplate(), loadInlineFonts()])
        .then(([template, fontCss]) => ({ template, fontCss }));
      assetsPromise.catch(() => { assetsPromise = null; }); // allow a retry
    }
    return assetsPromise;
  }
  function loadTemplate() {
    return fetch(TEMPLATE_URL, { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }
  /* Turn fonts/fonts.css into the same CSS with every font file embedded as a data: URI.
     If anything fails, return null and the wish falls back to the template's Google Fonts links. */
  function loadInlineFonts() {
    return fetch(FONT_CSS_URL, { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(css => {
        const files = Array.from(new Set((css.match(/url\(([^)]+)\)/g) || []).map(m => m.slice(4, -1).replace(/["']/g, ''))));
        return Promise.all(files.map(f => fetch('fonts/' + f)
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
          .then(blobToDataUrl)
          .then(uri => [f, uri.replace(/^data:[^;,]*/, 'data:font/woff2')])))
          .then(pairs => {
            const map = new Map(pairs);
            return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\(([^)]+)\)/g, (m, f) => 'url(' + map.get(f.replace(/["']/g, '')) + ')').trim();
          });
      })
      .catch(err => { console.warn('Fonts could not be embedded; the wish will load them online instead.', err); return null; });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  /* ---------- live preview ---------- */
  function setPreview(el, value, fallback) {
    el.textContent = value || fallback;
    el.classList.toggle('ph', !value);
  }
  function updatePreview() {
    const s = P.cleanName(senderEl.value), r = P.cleanName(receiverEl.value);
    setPreview(pv.from1, s, 'you');
    setPreview(pv.from2, s, 'your name');
    setPreview(pv.to1, r, 'them');
    setPreview(pv.to2, r, '…');
  }

  /* ---------- validation ---------- */
  function showError(input, errEl, msg) {
    errEl.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }
  function validate() {
    const s = P.validateName(senderEl.value, 'your name');
    const r = P.validateName(receiverEl.value, 'their name');
    showError(senderEl, senderErr, s.ok ? '' : s.error);
    showError(receiverEl, receiverErr, r.ok ? '' : r.error);
    if (!s.ok) senderEl.focus(); else if (!r.ok) receiverEl.focus();
    return s.ok && r.ok ? { sender: s.value, receiver: r.value } : null;
  }

  function setStatus(msg, bad) {
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('bad', !!bad);
  }

  /* ---------- generated output ---------- */
  function discardGenerated() {
    generated = null;
    frameBox.textContent = '';   // removing the iframe stops its animation and sound
    fileNameEl.textContent = '';
    resultEl.hidden = true;
    downloadBtn.disabled = false;
  }

  function showGenerated() {
    fileNameEl.textContent = generated.fileName;
    const frame = document.createElement('iframe');
    frame.title = 'Preview of the Diwali wish for ' + generated.receiver;
    frame.setAttribute('sandbox', 'allow-scripts'); // the wish runs isolated from this page
    frame.setAttribute('loading', 'eager');
    frame.srcdoc = generated.html;
    frameBox.textContent = '';
    frameBox.appendChild(frame);
    resultEl.hidden = false;
    downloadBtn.disabled = false;
  }

  function generate(ev) {
    if (ev) ev.preventDefault();
    clearTimeout(resetTimer);
    const names = validate();
    if (!names) { setStatus(''); return; }
    discardGenerated();
    generateBtn.disabled = true;
    setStatus('Lighting the diyas…');
    loadAssets()
      .then(({ template, fontCss }) => {
        // Names may have been edited while assets loaded; always use what is on screen now.
        const now = validate();
        if (!now) { setStatus(''); return; }
        const html = P.personalize(template, { sender: now.sender, receiver: now.receiver, fontCss: fontCss });
        generated = { html, fileName: P.fileNameFor(now.receiver), sender: now.sender, receiver: now.receiver };
        showGenerated();
        setStatus('Your wish for ' + now.receiver + ' is ready. Check the preview, then download it.');
        if (window.matchMedia && matchMedia('(max-width: 879px)').matches) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        downloadBtn.focus({ preventScroll: true });
      })
      .catch(err => {
        console.error(err);
        const offlineFile = location.protocol === 'file:';
        setStatus(offlineFile
          ? 'The Diwali template could not be loaded from a local file. Open the maker from its GitHub Pages address, or run a local web server.'
          : (err && err.message && /template|name|letter|characters/i.test(err.message) ? err.message : 'Something went wrong while making the wish. Please try again.'), true);
      })
      .then(() => { generateBtn.disabled = false; });
  }

  /* ---------- download, then reset ---------- */
  function download() {
    if (!generated) return;
    const { html, fileName, receiver } = generated;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    blobUrls.add(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    downloadBtn.disabled = true;
    setTimeout(() => revoke(url), REVOKE_DELAY_MS);

    toast('Downloaded ' + fileName + ' 🪔 Send it to ' + receiver + '!');
    setStatus('Downloaded ' + fileName + '. Getting ready for the next wish…');
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetAll();
      setStatus('Ready for a new wish.');
      senderEl.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, RESET_DELAY_MS);
  }

  function revoke(url) {
    if (blobUrls.delete(url)) URL.revokeObjectURL(url);
  }

  /* Back to the original blank state. Touches only this page's memory and fields:
     the template file, the website and anything already downloaded are left alone. */
  function resetAll() {
    clearTimeout(resetTimer);
    form.reset();
    senderEl.value = '';
    receiverEl.value = '';
    showError(senderEl, senderErr, '');
    showError(receiverEl, receiverErr, '');
    discardGenerated();
    updatePreview();
    setStatus('');
  }

  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- wiring ---------- */
  function onNameInput(input, errEl) {
    if (input.hasAttribute('aria-invalid')) showError(input, errEl, '');
    updatePreview();
    // A generated file must always match the names on screen.
    if (generated) {
      discardGenerated();
      setStatus('Names changed. Press “Generate Diwali Wish” again to update the file.');
    }
  }
  senderEl.addEventListener('input', () => onNameInput(senderEl, senderErr));
  receiverEl.addEventListener('input', () => onNameInput(receiverEl, receiverErr));
  senderEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); receiverEl.focus(); } });
  form.addEventListener('submit', generate);
  clearBtn.addEventListener('click', () => { resetAll(); senderEl.focus(); });
  downloadBtn.addEventListener('click', download);

  // Browsers may restore typed text on reload or from the back/forward cache: always start blank.
  window.addEventListener('pageshow', resetAll);
  window.addEventListener('pagehide', () => { blobUrls.forEach(u => URL.revokeObjectURL(u)); blobUrls.clear(); });

  /* embers, as on the template's welcome screen */
  (function buildEmbers() {
    const box = $('#embers'), rand = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 18; i++) {
      const e = document.createElement('i'); e.className = 'ember';
      e.style.left = rand(0, 100).toFixed(1) + '%';
      e.style.setProperty('--s', rand(3, 8).toFixed(1) + 'px');
      e.style.setProperty('--d', rand(7, 14).toFixed(1) + 's');
      e.style.setProperty('--dl', (-rand(0, 12)).toFixed(1) + 's');
      e.style.setProperty('--dx', rand(-60, 60).toFixed(0) + 'px');
      box.appendChild(e);
    }
  })();

  resetAll();
  loadAssets().catch(() => {}); // warm up so "Generate" is instant; errors are reported on click
})();
