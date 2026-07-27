/**
 * app.js — UI wiring and the translation pipeline.
 *
 * PIPELINE (English -> Creole):
 *   1. normalizeText   "wyd rn" -> "what are you doing right now"
 *   2. protectSlang    "lol" -> "[[0]]"  (Creole stashed aside)
 *   3. translate       machine translation of clean English
 *   4. restoreSlang    "[[0]]" -> "m ap ri"
 *
 * Step 1 exists because MT engines handle fluent English far better than
 * abbreviations. Step 2 exists because MT engines translate idioms literally
 * ("what the heck" came back as "ki sa heck la"), so idioms are never sent.
 *
 * The slang breakdown renders BEFORE the network call, so a failed or
 * rate-limited translation still leaves the reader with something useful.
 */

const $ = id => document.getElementById(id);

const el = {
  input: $("inputText"), go: $("goBtn"), goLabel: $("goLabel"),
  spinner: document.querySelector(".btn-spinner"),
  paste: $("pasteBtn"), clear: $("clearBtn"), copy: $("copyBtn"),
  inputLabel: $("inputLabel"), offlineHint: $("offlineHint"),
  outCard: $("outCard"), outText: $("outText"), outLabel: $("outLabel"),
  outBadge: $("outBadge"), outMeta: $("outMeta"),
  slangCard: $("slangCard"), slangList: $("slangList"),
  slangCount: $("slangCount"), slangLabel: $("slangLabel"),
  stepsCard: $("stepsCard"), normText: $("normText"),
  normHits: $("normHits"), normHitsWrap: $("normHitsWrap"),
  errorCard: $("errorCard"), errorText: $("errorText"),
  dirEnHt: $("dirEnHt"), dirHtEn: $("dirHtEn"),
  refToggle: $("refToggle"), refBody: $("refBody"),
  refSearch: $("refSearch"), refList: $("refList"),
  replaceBtn: $("replaceBtn"), shareBtn: $("shareBtn"), sourceChip: $("sourceChip")
};

let direction = "en|ht";
let busy = false;

/* ── Direction ────────────────────────────────────────────────────────────── */

const COPY = {
  "en|ht": {
    inputLabel: "Paste the English message you received",
    placeholder: "lol np, wyd rn? omw btw 🔥",
    go: "Tradui",
    outLabel: "Tradiksyon an",
    badge: "Kreyòl",
    slangLabel: "Slang nan mesaj la",
    copy: "Kopye"
  },
  "ht|en": {
    inputLabel: "Ekri repons ou an kreyòl",
    placeholder: "M ap vini kounye a, tann mwen yon ti moman",
    go: "Translate",
    outLabel: "English",
    badge: "English",
    slangLabel: "Slang detected",
    copy: "Copy"
  }
};

function setDirection(dir) {
  direction = dir;
  const c = COPY[dir];
  el.inputLabel.textContent = c.inputLabel;
  el.input.placeholder = c.placeholder;
  el.goLabel.textContent = c.go;
  el.outLabel.textContent = c.outLabel;
  el.outBadge.textContent = c.badge;
  el.slangLabel.textContent = c.slangLabel;
  el.copy.textContent = c.copy;

  const enht = dir === "en|ht";
  el.dirEnHt.classList.toggle("is-active", enht);
  el.dirHtEn.classList.toggle("is-active", !enht);
  el.dirEnHt.setAttribute("aria-selected", String(enht));
  el.dirHtEn.setAttribute("aria-selected", String(!enht));
  hideResults();
}

/* ── Main action ──────────────────────────────────────────────────────────── */

async function run() {
  const raw = el.input.value.trim();
  if (!raw) return showError("Type or paste a message first.");

  setBusy(true);
  hideResults();

  // Slang/shorthand handling only makes sense on the English side.
  const englishSide = direction === "en|ht";
  let toTranslate = raw;
  let found = [];
  let counts = [];

  if (englishSide) {
    const norm = protectAndNormalize(raw);
    toTranslate = norm.text;
    found = norm.found;
    counts = norm.counts;
    renderSlang(found);
    renderSteps(norm);
  }

  try {
    const result = await translate(toTranslate, direction);
    const final = englishSide
      ? restoreSlang(result.text, found, counts)
      : { text: result.text, missing: [] };

    el.outText.textContent = final.text;
    el.outCard.hidden = false;
    el.outMeta.textContent = buildMeta(result, final);
  } catch (err) {
    if (err.offline && found.length) {
      el.offlineHint.hidden = false;
    } else if (englishSide && found.length) {
      showError(err.message + " The slang breakdown below still applies.");
    } else {
      showError(err.message || "Something went wrong.");
    }
  } finally {
    setBusy(false);
  }
}

function protectAndNormalize(raw) {
  const n = normalizeText(raw);
  const p = protectSlang(n.text);
  return { text: p.text, found: p.found, counts: p.counts, normalized: n.text, hits: n.hits };
}

function buildMeta(result, final) {
  const bits = [];
  if (result.fromCache) bits.push("from cache");
  if (result.quality >= 90) bits.push("human-reviewed match");
  if (final.missing && final.missing.length) {
    bits.push(`${final.missing.length} slang term${final.missing.length > 1 ? "s" : ""} listed separately`);
  }
  return bits.join(" · ");
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

function renderSlang(found) {
  if (!found.length) { el.slangCard.hidden = true; return; }
  el.slangList.innerHTML = "";
  for (const f of found) {
    const li = document.createElement("li");
    li.className = "slang-item";
    li.append(
      node("span", "slang-term", f.term),
      node("span", "slang-ht", f.ht),
      node("span", "slang-en", f.en)
    );
    el.slangList.appendChild(li);
  }
  el.slangCount.textContent = String(found.length);
  el.slangCard.hidden = false;
}

function renderSteps(norm) {
  el.normText.textContent = norm.normalized;
  if (norm.hits.length) {
    el.normHits.textContent = norm.hits.map(h => `${h.from} → ${h.to}`).join("   ·   ");
    el.normHitsWrap.hidden = false;
  } else {
    el.normHitsWrap.hidden = true;
  }
  el.stepsCard.hidden = false;
}

function node(tag, cls, text) {
  const n = document.createElement(tag);
  n.className = cls;
  n.textContent = text;
  return n;
}

/* ── Dictionary panel ─────────────────────────────────────────────────────── */

function buildRefList(filter = "") {
  const q = filter.toLowerCase().trim();
  const items = getLexiconList().filter(i =>
    !q || i.abbr.toLowerCase().includes(q) ||
    i.en.toLowerCase().includes(q) || i.ht.toLowerCase().includes(q)
  );

  el.refList.innerHTML = "";
  if (!items.length) {
    el.refList.innerHTML = `<p class="hint">Pa gen rezilta.</p>`;
    return;
  }

  for (const i of items.slice(0, 300)) {
    const row = document.createElement("button");
    row.className = "ref-row";
    row.append(node("span", "ref-abbr", i.abbr));
    const body = node("span", "ref-body", "");
    if (i.ht) body.append(node("span", "ref-ht", i.ht));
    body.append(node("span", "ref-en", i.en));
    row.append(body);
    row.addEventListener("click", () => {
      el.input.value = (el.input.value + " " + i.abbr).trim();
      el.input.focus();
    });
    el.refList.appendChild(row);
  }
}

/* ── State helpers ────────────────────────────────────────────────────────── */

function setBusy(state) {
  busy = state;
  el.go.disabled = state;
  el.goLabel.hidden = state;
  el.spinner.hidden = !state;
}

function hideResults() {
  el.outCard.hidden = true;
  el.slangCard.hidden = true;
  el.stepsCard.hidden = true;
  el.errorCard.hidden = true;
  el.offlineHint.hidden = true;
}

function showError(msg) {
  el.errorText.textContent = msg;
  el.errorCard.hidden = false;
}

/* ── Events ───────────────────────────────────────────────────────────────── */

el.go.addEventListener("click", run);
el.dirEnHt.addEventListener("click", () => setDirection("en|ht"));
el.dirHtEn.addEventListener("click", () => setDirection("ht|en"));

el.clear.addEventListener("click", () => {
  el.input.value = "";
  hideResults();
  el.input.focus();
});

el.paste.addEventListener("click", async () => {
  try {
    el.input.value = await navigator.clipboard.readText();
    run();
  } catch {
    showError("Your browser blocked clipboard access — paste with a long press instead.");
  }
});

el.copy.addEventListener("click", async () => {
  const text = el.outText.textContent;
  if (!text) return;
  const label = el.copy.textContent;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
  }
  el.copy.textContent = "✓";
  setTimeout(() => { el.copy.textContent = label; }, 1500);
});

el.refToggle.addEventListener("click", () => {
  const open = el.refToggle.getAttribute("aria-expanded") === "true";
  el.refToggle.setAttribute("aria-expanded", String(!open));
  el.refBody.hidden = open;
  if (!open && !el.refList.children.length) buildRefList();
});

el.refSearch.addEventListener("input", () => buildRefList(el.refSearch.value));

el.input.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!busy) run();
  }
});

/* ── Native bridge — only active inside the Android APK ────────────────────── *
 * The web build ignores all of this: `MesajNative` simply does not exist, so
 * the app behaves exactly as it does on GitHub Pages. Nothing below is
 * required for the browser version to work.
 */
const NATIVE = typeof MesajNative !== "undefined";

window.Mesaj = {
  /**
   * Called by the Android host when text arrives from another app.
   * @param {string} text
   * @param {"read"|"reply"|"auto"} hint  read = shared message, reply = editable field
   */
  receive(text, hint) {
    if (!text || !text.trim()) return;
    el.input.value = text;
    setDirection(hint === "reply" ? "ht|en"
               : hint === "read"  ? "en|ht"
               : guessDirection(text));
    if (el.sourceChip) {
      el.sourceChip.textContent = hint === "reply" ? "from your draft" : "shared from another app";
      el.sourceChip.hidden = false;
    }
    run();                       // zero taps: translate on arrival
  },

  /** Android reads the finished translation back out through this. */
  getTranslation() {
    return el.outText.textContent || "";
  }
};

if (NATIVE) {
  document.body.classList.add("is-native");
  el.shareBtn.hidden = false;
  // Only offered when the host launched us on an EDITABLE selection.
  if (MesajNative.canReplace()) el.replaceBtn.hidden = false;

  el.shareBtn.addEventListener("click", () => {
    const t = el.outText.textContent;
    if (t) MesajNative.shareText(t);
  });

  el.replaceBtn.addEventListener("click", () => {
    const t = el.outText.textContent;
    if (t) MesajNative.replaceSelection(t);   // swaps the text in place, then closes
  });
}

setDirection("en|ht");
if (!NATIVE) el.input.focus();   // avoid the keyboard covering an auto-translated result
