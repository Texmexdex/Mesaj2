# Mesaj — GitHub Pages bundle

The complete hosted site. Upload the contents of this folder to a repo and turn
on Pages — there is no build step, no bundler and nothing to install.

## Deploy

1. Create a repo (e.g. `mesaj`) and upload **everything in this folder**,
   keeping `icons/` as a folder.
2. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**
3. Live at `https://YOUR-USERNAME.github.io/mesaj` in about a minute.

All paths are relative, so it works at the domain root or in a subfolder with
no changes.

## Contents

```
index.html      app shell
style.css
app.js          UI wiring
lexicon.js      slang tables + the normalise/protect/restore engine
translate.js    MyMemory client
manifest.json   PWA manifest
sw.js           service worker (offline shell)
icons/          three PNG icons
README.md       full documentation
```

## Install on a phone

Open the URL in Chrome on Android → **⋮ → Add to Home screen**.

This is the copy-and-paste version. The APK build — where a message can be
shared or selected straight into the app — is in the other bundle.

## When you change something

Bump `CACHE_NAME` in `sw.js` (e.g. `mesaj-v2` → `mesaj-v3`). Without that,
phones that already installed it keep serving the old files from the service
worker cache and your change appears not to have worked.

## Optional

`translate.js` has a `CONTACT_EMAIL` constant. Setting it raises the MyMemory
quota from 5,000 to 50,000 characters a day. **Leave it blank in a public
repo** — it is sent as a plain URL parameter and scrapers read GitHub.
