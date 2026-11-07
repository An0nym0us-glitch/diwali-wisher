// Run with: node --test tests/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/personalize.js');

const TEMPLATE_PATH = path.join(__dirname, '..', 'template', 'diwali-template.html');
const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

test('personalizes Rahul from Neo', () => {
  const html = P.personalize(template, { sender: 'Neo', receiver: 'Rahul' });
  assert.match(html, /<title>Happy Diwali, Rahul! – a wish from Neo<\/title>/);
  assert.match(html, /<h1 id="title">Happy Diwali, Rahul<\/h1>/);
  assert.match(html, /A little light from <b>Neo<\/b>, just for you, <b>Rahul<\/b>/);
  assert.match(html, /<input id="nameInput" type="hidden" value="Rahul">/);
  assert.match(html, /<h2 id="finName">Happy Diwali, Rahul!<\/h2>/);
  assert.match(html, /<p class="fin-from"><small>With love and light,<\/small>Neo<\/p>/);
  assert.ok(!/placeholder="Your name/.test(html), 'no editable name box is left in the wish');
});

test('keeps every original script and style byte-for-byte', () => {
  const html = P.personalize(template, { sender: 'Neo', receiver: 'Rahul' });
  const script = template.slice(template.indexOf('<script>'), template.indexOf('</script>') + 9);
  const style = template.slice(template.indexOf('<style>'), template.indexOf('</style>') + 8);
  assert.ok(html.includes(script), 'original script preserved');
  assert.ok(html.includes(style), 'original styles preserved');
});

test('does not modify the template', () => {
  const before = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  P.personalize(before, { sender: 'A', receiver: 'B' });
  assert.strictEqual(fs.readFileSync(TEMPLATE_PATH, 'utf8'), before);
});

test('inlines fonts when given', () => {
  const html = P.personalize(template, { sender: 'Neo', receiver: 'Rahul', fontCss: '@font-face{font-family:X;src:url(data:font/woff2;base64,AAAA)}' });
  assert.ok(!html.includes('fonts.googleapis.com'));
  assert.ok(html.includes('<style id="wish-fonts">'));
});

test('escapes HTML in names', () => {
  assert.strictEqual(P.escapeHtml('<b a="1">\'&'), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;');
  const html = P.personalize(template, { sender: "D'Souza & Co", receiver: 'Anu' });
  assert.ok(html.includes('D&#39;Souza &amp; Co'));
});

test('rejects injection, empty and invalid names', () => {
  for (const bad of ['', '   ', '<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', '123', '$&$1', 'a'.repeat(25)]) {
    assert.strictEqual(P.validateName(bad, 'a name').ok, false, JSON.stringify(bad));
    assert.throws(() => P.personalize(template, { sender: 'Neo', receiver: bad }));
  }
});

test('accepts names in Indian scripts and normalizes spaces', () => {
  for (const ok of ['राहुल', 'ராகுல்', 'Anne-Marie', 'Rahul  Sharma ', 'O’Brien']) {
    assert.strictEqual(P.validateName(ok, 'a name').ok, true, ok);
  }
  assert.strictEqual(P.validateName('  Rahul   Sharma ', 'x').value, 'Rahul Sharma');
});

test('file names', () => {
  assert.strictEqual(P.fileNameFor('Rahul'), 'Happy-Diwali-Rahul.html');
  assert.strictEqual(P.fileNameFor('Rahul Sharma'), 'Happy-Diwali-Rahul-Sharma.html');
  assert.strictEqual(P.fileNameFor('राहुल'), 'Happy-Diwali-राहुल.html');
  assert.strictEqual(P.fileNameFor("D'Souza & Co."), 'Happy-Diwali-D-Souza-Co.html');
});

test('fails loudly if the template structure changes', () => {
  assert.throws(() => P.personalize(template.replace('<h2 id="finName">Happy Diwali!</h2>', ''), { sender: 'A', receiver: 'B' }), /template has changed/);
});
