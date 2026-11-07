/*
 * Diwali Wish Maker: personalization core.
 *
 * Pure functions with no DOM access, so the same code runs in the browser
 * (window.DiwaliPersonalize) and in Node for tests (module.exports).
 *
 * personalize() takes the ORIGINAL template HTML as a string and returns a NEW
 * string. The template itself is never modified: strings are immutable, and
 * every change is a targeted replacement of a known anchor in the copy.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DiwaliPersonalize = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* The template keeps names to 24 characters (state.name.slice(0, 24)), so we do too. */
  const MAX_LEN = 24;

  /* Letters and marks of any script (Hindi, Tamil, Latin…), digits, spaces, and . ' ’ - &.
     ZWJ/ZWNJ (U+200C/U+200D) are allowed because several Indic scripts need them. */
  const ALLOWED = /^[\p{L}\p{M}\p{N} .'’\-&‌‍]+$/u;
  const HAS_LETTER = /\p{L}/u;

  /** Escape text for safe use in HTML text content AND quoted attribute values. */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Trim, collapse inner whitespace, and normalize Unicode so the same name always looks the same. */
  function cleanName(raw) {
    let s = String(raw == null ? '' : raw);
    if (s.normalize) s = s.normalize('NFC');
    return s.replace(/[\s ]+/g, ' ').trim();
  }

  /**
   * Validate one name. Returns { ok: true, value } or { ok: false, error }.
   * `label` is used in the message, e.g. "your name".
   */
  function validateName(raw, label) {
    const value = cleanName(raw);
    if (!value) return { ok: false, error: 'Please enter ' + label + '.' };
    if (value.length > MAX_LEN) return { ok: false, error: 'Please keep ' + label + ' to ' + MAX_LEN + ' characters or fewer.' };
    if (!ALLOWED.test(value)) return { ok: false, error: 'Please use only letters, numbers, spaces and . \' - &' };
    if (!HAS_LETTER.test(value)) return { ok: false, error: 'Please include at least one letter in ' + label + '.' };
    return { ok: true, value: value };
  }

  /** "Rahul Sharma" -> "Happy-Diwali-Rahul-Sharma.html". Keeps non-Latin letters, drops anything a file system dislikes. */
  function fileNameFor(receiver) {
    const part = cleanName(receiver)
      .replace(/[\\/:*?"<>|&'’.\u0000-\u001F‌‍]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return part ? 'Happy-Diwali-' + part + '.html' : 'Happy-Diwali.html';
  }

  /** Replace exactly one occurrence of `find` (string or RegExp) or fail loudly. */
  function replaceOnce(html, find, replacement, what) {
    const isRe = find instanceof RegExp;
    const count = isRe
      ? (html.match(new RegExp(find.source, find.flags.includes('g') ? find.flags : find.flags + 'g')) || []).length
      : html.split(find).length - 1;
    if (count !== 1) {
      throw new Error('The Diwali template has changed and the ' + what + ' could not be found (' + count + ' matches). Nothing was generated.');
    }
    /* A function replacement means "$&" etc. in names can never be interpreted as patterns. */
    return html.replace(find, function () { return replacement; });
  }

  /* Small additions for the personalized copy. They reuse the template's own tokens and fonts,
     and only add new rules; no original rule is changed. */
  const EXTRA_CSS =
    '<style id="wish-personalization">\n' +
    '.w-kicker b{color:var(--gold);font-weight:600}\n' +
    '.fin-from{margin:2px 0 0;font:400 clamp(18px,4.8vw,22px)/1.3 var(--font-display);color:var(--gold);text-shadow:0 0 14px rgba(255,160,40,.45)}\n' +
    '.fin-from small{display:block;font:400 12px/1.4 var(--font-ui);color:var(--ink-dim);text-shadow:none}\n' +
    '#finale.show .fin-card>:nth-child(7){animation-delay:2.9s}\n' +
    '</style>\n';

  const FONT_LINKS = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*">/;

  /**
   * Build a personalized, standalone copy of the template.
   * @param {string} template  Original template HTML (left untouched).
   * @param {{sender:string, receiver:string, fontCss?:string}} opts
   *        fontCss: optional @font-face CSS with data: URIs; when given it replaces the
   *        Google Fonts links so the wish renders with the right fonts fully offline.
   * @returns {string} new HTML document
   */
  function personalize(template, opts) {
    if (typeof template !== 'string' || template.indexOf('id="finale"') < 0) {
      throw new Error('The Diwali template could not be loaded.');
    }
    const s = validateName(opts && opts.sender, 'your name');
    const r = validateName(opts && opts.receiver, 'their name');
    if (!s.ok) throw new Error(s.error);
    if (!r.ok) throw new Error(r.error);
    const S = escapeHtml(s.value), R = escapeHtml(r.value);

    let html = template;

    // 1. Browser tab title.
    html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, '<title>Happy Diwali, ' + R + '! – a wish from ' + S + '</title>', 'page title');

    // 2. Header title (the template's own script also sets this from the name when the wish starts).
    html = replaceOnce(html, '<h1 id="title">Happy Diwali</h1>', '<h1 id="title">Happy Diwali, ' + R + '</h1>', 'header title');

    // 3. Welcome line: who it is from, and who it is for.
    html = replaceOnce(html, '<p class="w-kicker">A little light, just for you</p>',
      '<p class="w-kicker">A little light from <b>' + S + '</b>, just for you, <b>' + R + '</b></p>', 'welcome line');

    // 4. The "Your name (optional)" box becomes a hidden value holding the receiver's name.
    //    The template's script reads #nameInput.value when the wish begins, so its original
    //    logic personalizes the header and the final wish with no code changes.
    html = replaceOnce(html, /<input id="nameInput"[^>]*>/,
      '<input id="nameInput" type="hidden" value="' + R + '">', 'name field');

    // 5. Final wish heading and a signature from the sender.
    html = replaceOnce(html, '<h2 id="finName">Happy Diwali!</h2>', '<h2 id="finName">Happy Diwali, ' + R + '!</h2>', 'final wish heading');
    html = replaceOnce(html, '<div class="fin-actions">',
      '<p class="fin-from"><small>With love and light,</small>' + S + '</p>\n    <div class="fin-actions">', 'final wish buttons');

    // 6. Fonts: inline them when available so the file is fully offline.
    if (opts.fontCss) {
      html = replaceOnce(html, FONT_LINKS, '<style id="wish-fonts">\n' + opts.fontCss + '\n</style>', 'font links');
    }

    // 7. Extra styles for the new bits, plus a generator marker.
    html = replaceOnce(html, '</head>', '<meta name="generator" content="Diwali Wish Maker">\n' + EXTRA_CSS + '</head>', 'document head');

    return html;
  }

  return {
    MAX_LEN: MAX_LEN,
    escapeHtml: escapeHtml,
    cleanName: cleanName,
    validateName: validateName,
    fileNameFor: fileNameFor,
    personalize: personalize
  };
});
