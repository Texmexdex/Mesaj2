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
  replaceBtn: $("replaceBtn"), shareBtn: $("shareBtn"), sendBtn: $("sendBtn"),
  sourceChip: $("sourceChip"),
  inboxCard: $("inboxCard"), inboxPrompt: $("inboxPrompt"), inboxEnable: $("inboxEnable"),
  inboxList: $("inboxList"), inboxEmpty: $("inboxEmpty"), inboxRefresh: $("inboxRefresh")
};

let direction = "en|ht";
let busy = false;

/**
 * Who she is replying to, when a reply was started from a text in the inbox.
 * Set only by startReply(); cleared whenever she switches back to reading.
 */
let replyTo = null;

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

  // Going back to reading abandons any reply in progress.
  if (enht) replyTo = null;

  hideResults();
}

/**
 * Start a reply to one of her texts. She writes in Creole; the finished English
 * goes straight to the SMS app addressed to whoever sent it.
 */
function startReply(from) {
  replyTo = from || null;
  setDirection("ht|en");
  replyTo = from || null;            // setDirection cleared it only for en|ht
  el.input.value = "";
  hideResults();
  if (el.sourceChip) {
    el.sourceChip.textContent = replyTo ? `replying to ${replyTo}` : "writing a reply";
    el.sourceChip.hidden = false;
  }
  el.input.focus();
  el.input.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ── Main action ──────────────────────────────────────────────────────────── */

async function run() {
  const raw = el.input.value.trim();
  if (!raw) return showError("Type or paste a message first.");

  setBusy(true);
  hideResults();

  const englishSide = direction === "en|ht";
  const prep = prepare(raw, direction);
  const found = prep.found;

  // Rendered before awaiting the network on purpose: a rate-limited or offline
  // translation still leaves the slang breakdown on screen.
  if (prep.norm) {
    renderSlang(found);
    renderSteps(prep.norm);
  }

  try {
    const { result, final } = await finishTranslate(prep, direction);

    el.outText.textContent = final.text;
    el.outCard.hidden = false;
    el.outMeta.textContent = buildMeta(result, final);

    // Offer one-tap send only when this is a reply to a known number.
    if (NATIVE && replyTo && direction === "ht|en") el.sendBtn.hidden = false;
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

/* prepare() and finishTranslate() now live in pipeline.js, shared with the
 * background notification translator so the two cannot drift apart. */

function buildMeta(result, final) {
  const bits = [];
  if (result.fromDictionary) bits.push("from the dictionary — no translation needed");
  else if (result.fromCache) bits.push("from cache");
  if (!result.fromDictionary && result.quality >= 90) bits.push("human-reviewed match");
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
  if (el.sendBtn) el.sendBtn.hidden = true;
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
  },

  /**
   * Android hands over recent texts read from the system SMS provider.
   * Called on launch, on resume, and whenever a new text lands while open.
   * @param {{id:string,from:string,body:string,at:number}[]} list
   */
  inbox(list) {
    el.inboxCard.hidden = false;
    el.inboxPrompt.hidden = true;
    el.inboxRefresh.hidden = false;

    let added = 0;
    for (const m of list || []) {
      if (!m || !m.id || inboxItems.has(m.id)) continue;
      inboxItems.set(m.id, { ...m, creole: null, slang: [], state: "pending" });
      added++;
    }
    renderInbox();
    if (added) translateInboxBacklog();
  },

  /** READ_SMS not granted — offer the explanation and the button instead. */
  inboxUnavailable() {
    el.inboxCard.hidden = false;
    el.inboxPrompt.hidden = false;
    el.inboxRefresh.hidden = true;
    el.inboxList.innerHTML = "";
    el.inboxEmpty.hidden = true;
  }
};

/* ── SMS inbox ────────────────────────────────────────────────────────────── *
 * Messages live in this Map for as long as the page is open and nowhere else.
 * Nothing is written to localStorage — only the translation cache persists,
 * and that is keyed by text, exactly as it already was for typed input.
 */
const inboxItems = new Map();
let inboxRunning = false;

/**
 * Newest first, everywhere. Used for both display order and translation
 * priority so the two can never disagree.
 *
 * Falls back to the SMS row id when timestamps are missing or equal — ids are
 * monotonic, so they order correctly even if a device's provider hands back a
 * zero date. Without the guard a NaN comparison silently degrades to insertion
 * order, which looks like the sort simply not working.
 */
function byNewest(a, b) {
  const at = Number(a.at) || 0;
  const bt = Number(b.at) || 0;
  if (bt !== at) return bt - at;
  return (Number(b.rowId) || 0) - (Number(a.rowId) || 0);
}

/** Translate anything still pending, oldest first, one at a time. */
async function translateInboxBacklog() {
  if (inboxRunning) return;
  inboxRunning = true;

  try {
    /*
     * NEWEST FIRST — this is a priority order, not a display order.
     *
     * Translating oldest-first meant the message at the top of the list, the
     * one she actually opened the app to read, was translated LAST. It sat on
     * "Ap tann…" while older messages filled in beneath it. Worse: the loop
     * stops on the first quota or network failure, so the messages that got
     * dropped were always the most recent ones.
     */
    const pending = [...inboxItems.values()]
      .filter(m => m.state === "pending")
      .sort(byNewest);

    for (const m of pending) {
      m.state = "working";
      renderInbox();
      try {
        const prep = prepare(m.body, "en|ht");
        const { final } = await finishTranslate(prep, "en|ht");
        m.creole = final.text;
        m.slang  = prep.found;
        m.state  = "done";
      } catch (err) {
        // Quota and connectivity failures affect every remaining message, so
        // stop rather than firing off a dozen more doomed requests.
        m.state = "failed";
        m.error = err.message;
        renderInbox();
        break;
      }
      renderInbox();
    }
  } finally {
    inboxRunning = false;
  }
}

function renderInbox() {
  const items = [...inboxItems.values()].sort(byNewest);
  el.inboxEmpty.hidden = items.length > 0;
  el.inboxList.innerHTML = "";

  for (const m of items) {
    const li = document.createElement("li");
    li.className = "inbox-item";

    const head = node("div", "inbox-head", "");
    head.append(node("span", "inbox-from", m.from || "Unknown"),
                node("span", "inbox-time", formatTime(m.at)));
    li.append(head);

    if (m.state === "done") {
      li.append(node("p", "inbox-creole", m.creole));
    } else if (m.state === "working") {
      li.append(node("p", "inbox-status", "Ap tradui…"));
    } else if (m.state === "failed") {
      li.append(node("p", "inbox-status inbox-failed", m.error || "Pa ka tradui"));
    } else {
      li.append(node("p", "inbox-status", "Ap tann…"));
    }

    li.append(node("p", "inbox-original", m.body));

    if (m.slang && m.slang.length) {
      const chips = node("div", "inbox-chips", "");
      for (const s of m.slang) chips.append(node("span", "inbox-chip", `${s.term} = ${s.ht}`));
      li.append(chips);
    }

    const actions = node("div", "inbox-actions", "");
    const replyBtn = node("button", "btn btn-ghost btn-sm", "Reponn");
    replyBtn.addEventListener("click", (e) => {
      e.stopPropagation();          // don't also trigger the row's own handler
      startReply(m.from);
    });
    actions.append(replyBtn);
    li.append(actions);

    // Tapping the row itself loads it into the translator for the full breakdown.
    li.addEventListener("click", () => {
      el.input.value = m.body;
      setDirection("en|ht");
      run();
      el.input.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    el.inboxList.appendChild(li);
  }
}

function formatTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

if (NATIVE) {
  document.body.classList.add("is-native");

  el.inboxEnable.addEventListener("click", () => MesajNative.enableSms());
  el.inboxRefresh.addEventListener("click", () => {
    for (const m of inboxItems.values()) if (m.state === "failed") m.state = "pending";
    renderInbox();
    translateInboxBacklog();
  });
  if (!MesajNative.hasSms()) window.Mesaj.inboxUnavailable();
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

  el.sendBtn.addEventListener("click", () => {
    const t = el.outText.textContent;
    if (t && replyTo) MesajNative.sendSms(replyTo, t);
  });
}

/* ── Shared into the installed web app ────────────────────────────────────── *
 * When Konprann is added to the home screen, Android treats it as a share target
 * (see share_target in manifest.json) and launches it with ?text=... — the
 * same one-tap route the APK gets, with no install warning to click through.
 */
function readSharedText() {
  let params;
  try { params = new URLSearchParams(location.search); }
  catch { return null; }

  const shared = [params.get("text"), params.get("title"), params.get("url")]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!shared) return null;

  // Drop the query string so a refresh does not re-translate the old message.
  try { history.replaceState(null, "", location.pathname); } catch { /* ignore */ }
  return shared;
}

setDirection("en|ht");

const shared = readSharedText();
if (shared) {
  el.input.value = shared;
  setDirection(guessDirection(shared));
  if (el.sourceChip) {
    el.sourceChip.textContent = "shared from another app";
    el.sourceChip.hidden = false;
  }
  run();
} else if (!NATIVE) {
  el.input.focus();   // avoid the keyboard covering an auto-translated result
}
