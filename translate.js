/**
 * translate.js
 * ---------------------------------------------------------------------------
 * MyMemory client, hardened against the three things that actually go wrong:
 *
 *  1. MyMemory returns MULTIPLE alternatives joined by "/", and often slips a
 *     FRENCH translation in among them. v1 printed the whole raw string, so a
 *     Creole reader saw:
 *        "kisa ou ap fè kounye a?/kisa w ap fè kounye a?/que fais-tu…"
 *     pickAlternative() takes the first Creole-looking segment.
 *
 *  2. The best translation is often in the `matches` array (a human-reviewed
 *     translation-memory hit at quality 100) rather than in `responseData`
 *     (raw neural MT at quality 70). pickBest() prefers the good one.
 *
 *  3. The anonymous quota is 5,000 chars/day PER IP. Every repeat costs quota
 *     for nothing, so results are cached in localStorage.
 *
 * QUOTA: set CONTACT_EMAIL below to raise the daily limit from 5,000 to
 * 50,000 characters. Leave it blank if the repo is public — MyMemory does not
 * hide the parameter and scrapers read GitHub.
 * ---------------------------------------------------------------------------
 */

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const CONTACT_EMAIL = ""; // e.g. "you@example.com" — 10x the daily quota
const CACHE_KEY = "mesaj.cache.v2";
const CACHE_MAX = 400;

/* ── Cache ────────────────────────────────────────────────────────────────── */

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
  catch { return {}; }
}

function saveCache(cache) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX) {
      for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* private browsing / quota full — not worth failing over */ }
}

/* ── Public API ───────────────────────────────────────────────────────────── */

/**
 * Translate text between English and Haitian Creole.
 * @param {string} text
 * @param {"en|ht"|"ht|en"} langpair
 * @returns {Promise<{text: string, fromCache: boolean, quality: number}>}
 */
async function translate(text, langpair) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("No text to translate.");

  const cacheId = langpair + "::" + trimmed;
  const cache = loadCache();
  if (cache[cacheId]) {
    return { text: cache[cacheId].t, fromCache: true, quality: cache[cacheId].q };
  }

  const chunks = splitIntoChunks(trimmed, 450);
  const parts = [];
  let worstQuality = 100;

  for (const chunk of chunks) {
    const r = await translateChunk(chunk, langpair);
    parts.push(r.text);
    worstQuality = Math.min(worstQuality, r.quality);
  }

  const out = { text: parts.join(" "), fromCache: false, quality: worstQuality };
  cache[cacheId] = { t: out.text, q: out.quality };
  saveCache(cache);
  return out;
}

/* ── Internals ────────────────────────────────────────────────────────────── */

async function translateChunk(chunk, langpair) {
  const params = new URLSearchParams({ q: chunk, langpair, mt: "1" });
  if (CONTACT_EMAIL) params.set("de", CONTACT_EMAIL);

  let response;
  try {
    response = await fetch(`${MYMEMORY_URL}?${params}`);
  } catch {
    const err = new Error("No internet connection — showing the offline breakdown instead.");
    err.offline = true;
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Translation service returned ${response.status}. Try again in a moment.`);
  }

  let data;
  try { data = await response.json(); }
  catch { throw new Error("Unexpected reply from the translation service."); }

  if (data?.quotaFinished === true) {
    throw new Error("Daily translation limit reached. It resets tomorrow. Shorthand still works offline.");
  }
  if (data?.responseStatus && Number(data.responseStatus) !== 200) {
    throw new Error(`Translation error: ${data.responseDetails || "unknown"}.`);
  }

  const best = pickBest(data, chunk, langpair);
  if (!best) throw new Error("Translation came back empty. Try rephrasing.");
  return best;
}

/**
 * Choose between the raw MT result and the translation-memory matches.
 * A near-exact human-reviewed match beats neural MT almost every time.
 */
function pickBest(data, source, langpair) {
  const targetIsCreole = langpair === "en|ht";
  const candidates = [];

  if (Array.isArray(data.matches)) {
    for (const m of data.matches) {
      if (!m || !m.translation) continue;
      const quality = Number(m.quality) || 0;
      const similarity = Number(m.match) || 0;
      const isMT = m.reference === "Machine Translation." || m["created-by"] === "MT!";
      // Only trust a memory entry if it is essentially the same sentence.
      if (!isMT && (similarity < 0.95 || quality < 90)) continue;
      candidates.push({ translation: m.translation, quality, isMT, similarity });
    }
  }

  if (data?.responseData?.translatedText) {
    candidates.push({
      translation: data.responseData.translatedText,
      quality: 70,
      isMT: true,
      similarity: Number(data.responseData.match) || 0.7
    });
  }

  // Prefer human-reviewed exact matches, then MT.
  candidates.sort((a, b) => (a.isMT === b.isMT ? b.quality - a.quality : a.isMT ? 1 : -1));

  for (const c of candidates) {
    const text = pickAlternative(c.translation, targetIsCreole);
    if (!text) continue;
    if (looksLikeError(text)) continue;
    if (text.toLowerCase() === source.toLowerCase() && candidates.length > 1) continue;
    return { text, quality: c.isMT ? 70 : c.quality };
  }
  return null;
}

/**
 * MyMemory packs alternatives into one string separated by "/", frequently
 * including a French version. Return the first segment that is not French.
 */
function pickAlternative(raw, targetIsCreole) {
  const segments = String(raw).split("/").map(s => s.trim()).filter(Boolean);
  if (segments.length <= 1) return segments[0] || "";
  if (!targetIsCreole) return segments[0];

  const creole = segments.find(s => !looksFrench(s));
  return creole || segments[0];
}

/**
 * Creole and French share a lot of vocabulary, so this checks for words and
 * spellings that exist in French but not in Haitian Creole orthography.
 */
function looksFrench(s) {
  const t = " " + s.toLowerCase() + " ";
  const markers = [
    " je ", " tu ", " vous ", " nous ", " il ", " elle ", " c'est", " qu'",
    " que ", " qui ", " est-ce", " j'ai", " d'un", " d'une", " les ", " des ",
    " une ", " est ", " suis ", " fais", " faites", " veux", " peux",
    "ç", "ê", "î", "û", "ô"   // not part of Haitian Creole orthography
  ];
  return markers.some(m => t.includes(m));
}

function looksLikeError(s) {
  const u = s.toUpperCase();
  return u.includes("MYMEMORY WARNING")
      || u.includes("PLEASE SELECT")
      || u.includes("INVALID LANGUAGE");
}

/** Split to fit MyMemory's ~500 byte per-request limit, on sentence then word boundaries. */
function splitIntoChunks(text, byteLimit) {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= byteLimit) return [text];

  const pieces = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const chunks = [];
  let current = "";

  const flush = () => { if (current.trim()) chunks.push(current.trim()); current = ""; };

  for (const piece of pieces) {
    const p = piece.trim();
    if (!p) continue;
    const candidate = current ? current + " " + p : p;

    if (enc.encode(candidate).length <= byteLimit) { current = candidate; continue; }
    flush();

    if (enc.encode(p).length <= byteLimit) { current = p; continue; }

    for (const word of p.split(/\s+/)) {
      const wc = current ? current + " " + word : word;
      if (enc.encode(wc).length <= byteLimit) current = wc;
      else { flush(); current = word; }
    }
  }
  flush();
  return chunks;
}

if (typeof module !== "undefined") {
  module.exports = { pickBest, pickAlternative, looksFrench, splitIntoChunks };
}
