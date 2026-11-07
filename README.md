# Diwali Wish Maker 🪔

Type two names (who it's **from** and who it's **for**) and download a personal,
animated Diwali wish as **one HTML file**. The file works offline in Chrome,
Edge, Firefox, Safari and mobile browsers.

## How it works

There are two separate things:

| | What | Where |
|---|---|---|
| **A** | The generator website (`index.html`) | Hosted on GitHub Pages, never changes |
| **B** | Each personalized wish, e.g. `Happy-Diwali-Rahul.html` | Built in the visitor's browser and downloaded |

1. The generator loads the original wish, `template/diwali-template.html`, as read-only text.
2. On **Generate Diwali Wish**, `js/personalize.js` builds a new copy of that text with the names inserted:
   - tab title: *Happy Diwali, Rahul! – a wish from Neo*
   - welcome line: *A little light from **Neo**, just for you, **Rahul***
   - header and final wish: *Happy Diwali, Rahul!*
   - a signature on the final card: *With love and light, Neo*
   - the optional "Your name" box becomes a hidden value, so the template's own script uses the receiver's name with no code changes
   - fonts are embedded (base64) so the wish looks the same offline

   All the original CSS, JavaScript, animations, sounds and effects are kept byte for byte.
3. **Download HTML** saves `Happy-Diwali-<Receiver>.html`. About a second later the maker resets
   itself: the name fields, preview and generated HTML are cleared, and the temporary Blob URL is revoked.
   It never deletes anything from GitHub or from the visitor's device.

Everything runs in the visitor's browser: no backend, no database, no storage and no tracking. Each
visitor's names stay in their own tab, so people using the site at the same time can't affect each other.

### Safety

Names are trimmed and Unicode-normalized, then limited to 24 characters (the template's own limit).
Only letters and marks from any script, digits, spaces and `. ' ’ - &` are allowed. Every name is also
HTML-escaped before it goes into the file, so `<script>` and similar input can't be injected.

## Project layout

```
index.html                    the generator page
js/personalize.js             pure personalization logic (browser and Node)
js/app.js                     generator UI: preview, generate, download, reset
template/diwali-template.html the original wish (never modified at runtime)
fonts/                        self-hosted Poppins and Yatra One (SIL OFL 1.1) plus fonts.css
tests/personalize.test.js     unit tests
```

## Hosting on GitHub Pages

In the repository, open **Settings → Pages**, set **Source** to *Deploy from a branch*, pick the
branch and the `/ (root)` folder, then save.

Because the generator reads `template/diwali-template.html` with `fetch`, it must be served over
http(s). That works on GitHub Pages. To try it locally, run a small server instead of
double-clicking `index.html`:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The **downloaded wishes** themselves need no server and open directly.

## Editing the wish

You can edit `template/diwali-template.html` freely. The generator looks for a few anchors in it
(`<title>`, `<h1 id="title">`, `<p class="w-kicker">`, `<input id="nameInput" …>`,
`<h2 id="finName">`, `<div class="fin-actions">`). If one of them goes missing, it shows a clear error
instead of producing a broken file. Run the tests after editing:

```bash
node --test tests/*.test.js
```

## Fonts

`fonts/` holds copies of [Poppins](https://fonts.google.com/specimen/Poppins) and
[Yatra One](https://fonts.google.com/specimen/Yatra+One), both under the
[SIL Open Font License 1.1](https://openfontlicense.org).
