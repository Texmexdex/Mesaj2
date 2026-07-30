# 🇭🇹 Konprann

A free, installable web app that helps a Haitian Creole speaker **read English
text messages** — including slang like `lol`, `wyd`, `left me on read`, `ngl` —
and **write replies back in English**.

No API key, no build step, no server. Static files on GitHub Pages.

---

## How it works

Machine translation handles plain sentences well and idioms badly. So the app
separates the two before it ever calls the translator.

```
"omw btw, wyd later? ily 🔥"
  │
  ├─ 1. normalise   omw → I am on my way    wyd → what are you doing
  │                 (fluent English translates far better than abbreviations)
  │
  ├─ 2. protect     ily → [[1]]    🔥 → [[0]]
  │                 (idioms are never sent to the translator — it would
  │                  render them word-by-word)
  │
  ├─ 3. translate   "I am on my way by the way, what are you doing later? [[1]] [[0]]"
  │                          ↓
  │                 "Mwen sou wout la, kisa w ap fè pita? [1] [0]"
  │
  └─ 4. restore     [1] → mwen renmen w    [0] → sa cho
```

Result: **`Mwen sou wout la, kisa w ap fè pita? mwen renmen w sa cho`**

Every slang term is also listed separately with its Creole meaning, and that list
renders *before* the network call — so a failed or rate-limited translation still
leaves something readable.

---

## Files

```
index.html            app shell
style.css             dark, mobile-first
lexicon.js            the three lookup tables, the normalise/protect/restore
                      engine, and language direction guessing
translate.js          MyMemory client: response cleanup, caching, chunking
app.js                UI wiring + the optional native bridge
manifest.json         PWA manifest (relative paths — works on a project page)
sw.js                 service worker (offline shell, web build only)
icons/                three generated PNG icons
test/pipeline.test.js regression tests — node test/pipeline.test.js
android/              Android APK project — see android/README.md
REVIEW.md             review of the v1 prototype and what changed
v1-archive/           the original prototype, untouched
```

The same files run in both builds. `app.js` looks for a `MesajNative` object
that only the Android host injects; in a browser it isn't there and the app
behaves exactly as it does on GitHub Pages.

The three tables in `lexicon.js` do different jobs and have different rules.
**Read the header comment in that file before adding entries** — putting an
ordinary English word in the wrong table is how the previous version came to
translate "I like your post" as "I tap the heart or thumbs up on a post".

---

## Deploy to GitHub Pages

1. Upload every file **except** `v1-archive/` and `test/` (harmless to include,
   just unused in the browser).
2. **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**
3. Live at `https://YOUR-USERNAME.github.io/YOUR-REPO` in about a minute.

Paths are relative, so it works at the root or in a subfolder with no changes.

> **Two names that must not change, despite the app being renamed:**
> the **repo name**, because it forms the Pages URL and an installed home-screen
> icon points at it; and the Android **`applicationId`** (`net.mesaj.app`),
> because Android treats a changed id as a different app and would force an
> uninstall. Only the display name moved to Konprann.

### Install on Android

Open the URL in Chrome → **⋮ → Add to Home screen**. It then launches
full-screen like a normal app.

For the real thing — where a message can be shared or selected straight into
the app instead of copy-pasted — build the APK. See **`android/README.md`**.

> Bump `CACHE_NAME` in `sw.js` on every deploy, or installed copies keep serving
> the old version.

---

## Translation

[MyMemory](https://mymemory.translated.net) — free, no key, works from the
browser, both `en→ht` and `ht→en`.

- **Quota: 5,000 characters/day per IP** anonymously. Translations are cached in
  `localStorage`, so repeats are free.
- To raise it to 50,000/day, set `CONTACT_EMAIL` in `translate.js`. Don't commit
  a real address to a public repo — MyMemory sends it as a plain URL parameter.
- The slang dictionary and shorthand expansion work with no connection at all.

---

## Tests

```bash
node test/pipeline.test.js
```

No dependencies. Every case is either a bug that shipped in v1 or a verbatim
response observed from the live API — including the two quirks worth knowing
about: MyMemory rewrites `[[0]]` as `[0]`, and it occasionally duplicates a
placeholder.

---

## Known limits

- **The Creole glosses in `lexicon.js` need a native-speaker review.** They were
  written to be understood rather than idiomatic, and no test can verify them.
  This is the highest-value remaining task.
- The contextual layer is intentionally conservative: it would rather miss a
  slang term than corrupt an ordinary sentence, so some real slang goes
  undecoded.
- Contextual matching needs Safari 16.4+ / Chrome 62+. Where unsupported it
  disables itself instead of breaking.
