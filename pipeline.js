/**
 * pipeline.js
 * ---------------------------------------------------------------------------
 * The translation pipeline, with no reference to the DOM.
 *
 * WHY THIS FILE EXISTS
 * Two places need to translate: the visible app (app.js) and the background
 * code that posts translated SMS notifications, which runs the same JS inside
 * a headless WebView (engine.js). Reimplementing the pipeline in Java for the
 * background path would mean two copies of the subtlest logic in the project —
 * the slang tables, the placeholder protection, the cleanup pass — drifting
 * apart the first time either is touched. So both paths call in here.
 *
 * Split into two halves on purpose:
 *   prepare()        synchronous, offline-safe, no network
 *   finishTranslate()the network call and placeholder restoration
 *
 * The UI needs that seam: it renders the slang breakdown from prepare() BEFORE
 * awaiting the network, so a failed or rate-limited translation still leaves
 * something readable on screen.
 *
 * Depends on lexicon.js and translate.js being loaded first.
 * ---------------------------------------------------------------------------
 */

/**
 * Everything that happens before the network call.
 * @param {string} raw
 * @param {"en|ht"|"ht|en"} dir
 */
function prepare(raw, dir) {
  // Shorthand and slang handling only makes sense on the English side.
  if (dir !== "en|ht") {
    return { toTranslate: raw, found: [], counts: [], norm: null };
  }
  const n = normalizeText(raw);
  const p = protectSlang(n.text);
  return {
    toTranslate: p.text,
    found: p.found,
    counts: p.counts,
    norm: { text: p.text, found: p.found, counts: p.counts, normalized: n.text, hits: n.hits }
  };
}

/**
 * The network call plus placeholder restoration.
 * @returns {Promise<{result: object, final: object}>}
 */
async function finishTranslate(prep, dir) {
  /*
   * Nothing but slang left? The dictionary already holds the whole answer.
   * Skipping the round trip makes "lol wtf 💀" instant, costs no quota, and
   * beats whatever an MT engine would invent for "smh".
   */
  if (dir === "en|ht" && isSlangOnly(prep.toTranslate)) {
    const final = restoreSlang(prep.toTranslate, prep.found, prep.counts);
    return {
      result: { text: final.text, fromCache: false, quality: 100, fromDictionary: true },
      final
    };
  }

  const result = await translate(prep.toTranslate, dir);
  const final = dir === "en|ht"
    ? restoreSlang(result.text, prep.found, prep.counts)
    : { text: result.text, missing: [] };
  return { result, final };
}

/**
 * Both halves in one call, for callers that have no UI to update in between.
 * @returns {Promise<{text:string, slang:object[], quality:number,
 *                    fromDictionary:boolean, fromCache:boolean, missing:number[]}>}
 */
async function translateFully(raw, dir) {
  const prep = prepare(raw, dir);
  const { result, final } = await finishTranslate(prep, dir);
  return {
    text: final.text,
    slang: prep.found,
    quality: result.quality,
    fromDictionary: !!result.fromDictionary,
    fromCache: !!result.fromCache,
    missing: final.missing || []
  };
}

if (typeof module !== "undefined") {
  module.exports = { prepare, finishTranslate, translateFully };
}
