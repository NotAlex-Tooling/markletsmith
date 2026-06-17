<div align="center">

<img src="./public/markletsmith-logo.png" alt="Markletsmith" width="120" height="120" />

# Markletsmith

Turn JavaScript into drag-and-drop bookmarklets.

</div>

---

## What it does

Markletsmith is a browser-based editor that turns JavaScript into a `javascript:` bookmarklet you can drag straight to your bookmarks bar. Write code, pick your options, and copy or drag the result. Everything runs in the browser — nothing is sent to a server.

## Features

- Full CodeMirror 6 editor with syntax highlighting, search, and folding
- Minify with Terser, wrap in an IIFE, and URI-encode in one click
- Inject external scripts and styles by URL, with optional `!loadOnce` dedup
- Live size meter against the ~2000-character browser limit
- Save and load your own snippets, plus ready-made starter templates
- Share a build as a link, or export it as an importable bookmark file
- Decode mode to recover the source from an existing bookmarklet
- Your work autosaves locally between sessions

## Quick start

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm test         # run unit tests
```

## Usage

1. Write JavaScript in the editor and set a name.
2. Toggle minify, IIFE, and encode as needed.
3. Hit generate, then drag the link to your bookmarks bar or copy it.
4. Click the bookmarklet on any page to run your code.

To go the other way, switch to **decode** and paste an existing bookmarklet to get its source back.

## Notes

- Keep the final output under ~2000 characters for the best browser compatibility.
- Prefix an external URL with `!loadOnce` to avoid injecting it twice on repeat clicks.
- Test your code in the devtools console before generating.
