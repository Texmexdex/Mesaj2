/**
 * lexicon.js
 * ---------------------------------------------------------------------------
 * THREE separate tables, because there are three different jobs.
 *
 *  1. NORMALIZE — texting orthography -> fluent plain English.
 *     Fed INTO the machine translator. Fluent English input produces far
 *     better Creole: "wyd" means nothing to an MT engine, but "what are you
 *     doing" hits a human-reviewed translation-memory entry at quality 100.
 *     Every value must be a grammatical English fragment.
 *
 *  2. SLANG — expressions MT cannot handle, and which are NEVER ordinary
 *     English. Pulled OUT before translation, replaced with a [[n]]
 *     placeholder, and the pre-written Creole is spliced back in afterwards.
 *
 *  3. CONTEXTUAL — slang that IS also ordinary English ("bet", "mood", "goat",
 *     "cooked", "lit", "fire"). Only substituted when a cue pattern proves the
 *     slang reading. "I bet she comes" and "place a bet" are left alone;
 *     a message that is just "bet" is decoded. This table is the reason
 *     "goat cheese" and "he cooked dinner" survive intact.
 *
 * RULES for adding entries — these are the bugs that killed v1:
 *   - A word that is also ordinary English goes in CONTEXTUAL, never SLANG.
 *   - No single letters except "r" and "u", and no bare digits.
 *   - Never put "/" or "(...)" inside a NORMALIZE value or an `ht` value.
 *     That text is real output — a parenthetical gets read as part of the
 *     message and then translated literally. Explanations belong in `en`.
 *
 * CREOLE QUALITY: the `ht` strings are written to be understood rather than
 * idiomatic, and should be reviewed by a native speaker. They are the one
 * part of this app that no test can verify.
 * ---------------------------------------------------------------------------
 */

/* ── 1. Texting orthography -> fluent English ─────────────────────────────── */
const NORMALIZE = {
  // pronouns / spelling
  "u": "you",
  "r": "are",      // safe: standalone "r" is never a word in ordinary English
  "ya": "you",
  "yall": "you all",
  "y'all": "you all",
  "ur": "your",
  "urs": "yours",
  "im": "I am",
  "ive": "I have",
  "dont": "do not",
  "cant": "cannot",
  "wont": "will not",
  "didnt": "did not",
  "isnt": "is not",
  "doesnt": "does not",
  "couldve": "could have",
  "shouldve": "should have",
  "wouldve": "would have",
  "gonna": "going to",
  "wanna": "want to",
  "gotta": "have to",
  "tryna": "trying to",
  "finna": "about to",
  "bouta": "about to",
  "kinda": "kind of",
  "sorta": "sort of",
  "outta": "out of",
  "lemme": "let me",
  "gimme": "give me",
  "dunno": "do not know",
  "cuz": "because",
  "coz": "because",
  "bc": "because",
  "b/c": "because",
  "tho": "though",
  "thru": "through",
  "b4": "before",
  "w/": "with",
  "w/o": "without",

  // shortened words
  "abt": "about",
  "pls": "please",
  "plz": "please",
  "thx": "thanks",
  "thnx": "thanks",
  "ty": "thank you",
  "tysm": "thank you so much",
  "tyvm": "thank you very much",
  "yw": "you are welcome",
  "msg": "message",
  "msgs": "messages",
  "pic": "picture",
  "pics": "pictures",
  "vid": "video",
  "vids": "videos",
  "ppl": "people",
  "tmrw": "tomorrow",
  "tmr": "tomorrow",
  "tmw": "tomorrow",
  "2nite": "tonight",
  "2moro": "tomorrow",
  "bday": "birthday",
  "rly": "really",
  "rlly": "really",
  "srsly": "seriously",
  "smth": "something",
  "sth": "something",
  "smthn": "something",
  "prolly": "probably",
  "probs": "probably",
  "defo": "definitely",
  "obvs": "obviously",
  "convo": "conversation",
  "fav": "favourite",
  "info": "information",
  "sec": "second",
  "mins": "minutes",
  "hrs": "hours",

  // full-phrase abbreviations — the biggest translation-quality win
  "gm": "good morning",
  "gn": "good night",
  "hru": "how are you",
  "hyd": "how are you doing",
  "wyd": "what are you doing",
  "wya": "where are you",
  "wbu": "what about you",
  "hbu": "how about you",
  "wdym": "what do you mean",
  "wdyt": "what do you think",
  "idk": "I do not know",
  "idek": "I do not even know",
  "idc": "I do not care",
  "ik": "I know",
  "ikr": "I know, right",
  "nvm": "never mind",
  "lmk": "let me know",
  "hmu": "send me a message",
  "brb": "I will be right back",
  "bbl": "I will be back later",
  "bbs": "I will be back soon",
  "gtg": "I have to go",
  "g2g": "I have to go",
  "ttyl": "I will talk to you later",
  "ttys": "I will talk to you soon",
  "omw": "I am on my way",
  "otw": "I am on the way",
  "eta": "when will you arrive",
  "asap": "as soon as possible",
  "atm": "at the moment",
  "rn": "right now",
  "irl": "in real life",
  "btw": "by the way",
  "fyi": "just so you know",
  "imo": "in my opinion",
  "imho": "in my honest opinion",
  "iirc": "if I remember correctly",
  "afaik": "as far as I know",
  "tldr": "in short",
  "ofc": "of course",
  "np": "no problem",
  "nw": "no worries",
  "nbd": "it is not a big deal",
  "jk": "I am just kidding",
  "jkjk": "I am just kidding",
  "tbd": "still to be decided",
  "cya": "see you",
  "cul8r": "see you later",
  "l8r": "later",
  "gr8": "great",
  "m8": "friend",
  "tc": "take care",
  "rsvp": "please let me know if you are coming"
};

/* ── 2. Unambiguous slang -> Creole (protected from MT) ───────────────────── */
const SLANG = {
  // laughing
  "lol":       { ht: "m ap ri",                    en: "laughing out loud" },
  "lmao":      { ht: "m ap mouri ak ri",           en: "laughing extremely hard" },
  "lmfao":     { ht: "m ap mouri ak ri",           en: "laughing extremely hard" },
  "lmaoo":     { ht: "m ap mouri ak ri",           en: "laughing extremely hard" },
  "rofl":      { ht: "m ap woule atè ap ri",       en: "rolling on the floor laughing" },

  // surprise / frustration
  "omg":       { ht: "Bondye mwen",                en: "oh my god" },
  "omfg":      { ht: "Bondye mwen",                en: "oh my god, stronger" },
  "wtf":       { ht: "sa k ap pase la a",          en: "what is going on — surprised or angry" },
  "wth":       { ht: "sa k ap pase la a",          en: "what is going on" },
  "smh":       { ht: "m ap souke tèt mwen",        en: "shaking my head, disappointed" },
  "fml":       { ht: "sa se yon dezas pou mwen",   en: "my life is a disaster right now" },
  "ffs":       { ht: "m pèdi pasyans",             en: "for goodness sake — frustrated" },
  "ugh":       { ht: "aaah",                       en: "frustrated noise" },
  "yikes":     { ht: "mezanmi",                    en: "that is bad or awkward" },
  "oof":       { ht: "aay",                        en: "that hurts or is awkward" },
  "oop":       { ht: "oy",                         en: "awkward moment" },
  "sos":       { ht: "m bezwen èd",                en: "I need help" },
  "meh":       { ht: "m pa two enterese",          en: "I am not that interested" },

  // sincerity markers
  "tbh":       { ht: "pou di w vre",               en: "to be honest" },
  "ngl":       { ht: "san bay manti",              en: "not going to lie" },
  "fr":        { ht: "serye",                      en: "for real" },
  "frfr":      { ht: "serye serye",                en: "for real, I mean it" },
  "deadass":   { ht: "m serye nèt",                en: "I am completely serious" },
  "istg":      { ht: "m sèmante",                  en: "I swear" },
  "stg":       { ht: "m sèmante",                  en: "I swear" },
  "ong":       { ht: "m sèmante",                  en: "on god — I am serious" },
  "no cap":    { ht: "san manti",                  en: "no lie, I am serious" },
  "nocap":     { ht: "san manti",                  en: "no lie, I am serious" },
  "periodt":   { ht: "se sa, fini",                en: "end of discussion, I mean it" },

  // approval / judgement
  "goated":    { ht: "pi bon nan tout tan",        en: "the greatest" },
  "bussin":    { ht: "sa gou anpil",               en: "really good, usually food" },
  "fye":       { ht: "sa cho",                     en: "amazing — spelling of 'fire'" },
  "vibes":     { ht: "bon anbyans",                en: "good feeling or atmosphere" },
  "sus":       { ht: "sispèk",                     en: "suspicious" },
  "sussy":     { ht: "sispèk",                     en: "suspicious" },
  "lowkey":    { ht: "yon ti jan",                 en: "kind of, a little bit" },
  "highkey":   { ht: "klèman",                     en: "very much, openly" },
  "simp":      { ht: "moun k ap kouri dèyè yon moun twòp", en: "someone chasing a crush too hard" },
  "af":        { ht: "anpil",                      en: "as hell — intensifier" },

  // people / relationships
  "bruh":      { ht: "monchè",                     en: "man, dude — disbelief" },
  "bro":       { ht: "frè m",                      en: "brother, friend" },
  "sis":       { ht: "sè m",                       en: "sister, close friend" },
  "fam":       { ht: "fanmi m",                    en: "family, close friends" },
  "bestie":    { ht: "pi bon zanmi m",             en: "best friend" },
  "bff":       { ht: "pi bon zanmi m",             en: "best friend forever" },
  "bae":       { ht: "cheri m",                    en: "sweetheart, partner" },
  "bf":        { ht: "menaj mwen",                 en: "boyfriend" },
  "gf":        { ht: "menaj mwen",                 en: "girlfriend" },
  "hubby":     { ht: "mari m",                     en: "husband" },
  "wifey":     { ht: "madanm mwen",                en: "wife" },
  "homie":     { ht: "bon zanmi m",                en: "close friend" },
  "situationship": { ht: "yon relasyon ki pa klè", en: "an undefined romantic relationship" },
  "ily":       { ht: "mwen renmen w",              en: "I love you" },
  "ily2":      { ht: "mwen renmen w tou",          en: "I love you too" },
  "ilysm":     { ht: "mwen renmen w anpil anpil",  en: "I love you so much" },
  "ilu":       { ht: "mwen renmen w",              en: "I love you" },
  "xoxo":      { ht: "bo ak anbrase",              en: "hugs and kisses" },

  // texting behaviour — the concepts most likely to confuse a new texter
  "ghosted":   { ht: "li sispann reponn nèt",      en: "they suddenly stopped replying" },
  "ghosting":  { ht: "sispann reponn yon moun nèt", en: "suddenly cutting off contact" },
  "left on read":      { ht: "li li mesaj la men li pa reponn", en: "they read the message and did not reply" },
  "left me on read":   { ht: "li li mesaj mwen an men li pa reponn", en: "they read my message and did not reply" },
  "left you on read":  { ht: "li li mesaj ou an men li pa reponn",  en: "they read your message and did not reply" },
  "left him on read":  { ht: "li li mesaj li a men li pa reponn",   en: "they read his message and did not reply" },
  "left her on read":  { ht: "li li mesaj li a men li pa reponn",   en: "they read her message and did not reply" },
  "left them on read": { ht: "li li mesaj yo a men li pa reponn",   en: "they read their message and did not reply" },

  // emoji that carry meaning MT silently drops
  "💀":        { ht: "m ap mouri ak ri",           en: "skull: that is so funny I died" },
  "😭":        { ht: "m ap kriye",                 en: "crying: very sad, OR laughing very hard" },
  "🔥":        { ht: "sa cho",                     en: "fire: amazing" },
  "💯":        { ht: "san pou san dakò",           en: "100: totally agree" },
  "👀":        { ht: "m ap gade",                  en: "eyes: I am watching, I am interested" },
  "🙄":        { ht: "sa anmède m",                en: "eye roll: annoyed" },
  "🤦":        { ht: "mezanmi, m wont",            en: "facepalm: embarrassed or frustrated" },
  "🫡":        { ht: "byen konprann",              en: "salute: understood" },
  "🥺":        { ht: "tanpri",                     en: "pleading face: please" },
  "🤷":        { ht: "m pa konnen",                en: "shrug: I do not know" },
  "🫶":        { ht: "m renmen w",                 en: "heart hands: I care about you" },
  "❤️":        { ht: "mwen renmen w",              en: "red heart: love" },
  "💔":        { ht: "kè m brize",                 en: "broken heart: heartbroken" },
  "🙏":        { ht: "mèsi anpil",                 en: "folded hands: please, or thank you" },
  "👍":        { ht: "dakò",                       en: "thumbs up: okay, good" },
  "😊":        { ht: "m kontan",                   en: "smiling: happy" }
};

/* ── 3. Slang that is ALSO ordinary English — cue required ─────────────────── */
/*
 * `cue`   words that must appear immediately before the term
 * `after` word that must follow the term
 * `end`   term must sit at the end of the message
 * `alone` term is slang only as a whole one-word message
 *
 * The cue lists deliberately name a SUBJECT rather than just a copula. Bare
 * "is|are|was" cues were tested and rejected — they matched "the soup is too
 * salty", "the food is cooked", "there are extra chairs" and "the room was
 * lit". Slang describes people; ordinary English here describes things.
 * Anything without a cue goes to the translator untouched, which is correct.
 */
/*
 * The lookbehind has to reach back past the copula to the SUBJECT, because
 * "she is so salty" and "the soup is too salty" are identical up to the noun.
 * SUBJ_MOD matches "she is so", "i am really", "we were", etc.
 */
const SUBJ     = "i|he|she|you|u|they|we";
const MOD      = "so|too|really|very|kinda|pretty|mad";
const SUBJ_MOD = `(?:${SUBJ})\\s+(?:is|are|am|was|were)(?:\\s+(?:${MOD}))?|(?:${SUBJ})\\s+(?:${MOD})`;

const CONTEXTUAL = [
  { term: "fire",    ht: "sa cho",                en: "amazing, excellent",
    cue: `that|this|thats|that'?s|it'?s|its|so|too|straight|absolutely|pure|(?:that|this|it|party|show|song|food)\\s+(?:is|was)` },
  { term: "lit",     ht: "sa cho",                en: "exciting, amazing",
    cue: `thats|that'?s|it'?s|its|so|too|(?:party|night|show|club|it|that|this)\\s+(?:is|was)` },
  { term: "mid",     ht: "sa pa gran bagay",      en: "mediocre, disappointing",
    cue: `so|pretty|kinda|really|thats|that'?s|it'?s|its|(?:that|this|it)\\s+(?:is|was)` },
  { term: "dope",    ht: "sa bèl anpil",          en: "very cool",
    cue: `so|pretty|really|too|thats|that'?s|it'?s|its|(?:that|this|it)\\s+(?:is|was)` },
  { term: "cringe",  ht: "sa bay wont",           en: "embarrassing to watch",
    cue: `so|too|pure|mad|thats|that'?s|it'?s|its|(?:that|this|it)\\s+(?:is|was)` },
  { term: "extra",   ht: "twòp",                  en: "over the top, dramatic",
    cue: `being|acting|so|you'?re|youre|he'?s|hes|she'?s|shes|they'?re|theyre|${SUBJ_MOD}` },
  { term: "salty",   ht: "li fache",              en: "bitter or upset about something",
    cue: `being|getting|got|you'?re|youre|he'?s|hes|she'?s|shes|they'?re|theyre|why\\s+so|${SUBJ_MOD}` },
  { term: "cooked",  ht: "li nan ka",             en: "in trouble, finished",
    cue: `i'?m|im|we'?re|were|you'?re|youre|he'?s|hes|she'?s|shes|they'?re|theyre|absolutely|straight|fully|${SUBJ_MOD}` },
  { term: "shook",   ht: "m sezi nèt",            en: "shocked",
    cue: `i'?m|im|so|really|too|had me|got me|left me|${SUBJ_MOD}` },
  { term: "flex",    ht: "fè djòlè",              en: "showing off, bragging",
    cue: `a|the|big|weird|no|that'?s a|thats a` },
  { term: "flexing", ht: "ap fè djòlè",           en: "showing off",
    cue: `is|are|was|been|keep|stop|quit|always|he'?s|hes|she'?s|shes|you'?re|youre|they'?re|theyre` },
  { term: "goat",    ht: "pi bon nan tout tan",   en: "greatest of all time",
    cue: `the|a`, end: true },
  { term: "squad",   ht: "gwoup zanmi m",         en: "close group of friends",
    cue: `my|our|whole` },
  { term: "ate",     ht: "li fè l pafè",          en: "did an amazing job",
    cue: `you|she|he|they`, after: "that", end: true },

  // one-word replies: slang only when the message is nothing but this word
  { term: "bet",   ht: "dakò",              en: "okay, agreed",              alone: true },
  { term: "facts", ht: "se vre nèt",        en: "that is completely true",   alone: true },
  { term: "mood",  ht: "se sa menm m santi", en: "I relate to that completely", alone: true },
  { term: "slay",  ht: "ou fè l byen nèt",  en: "you did that amazingly",    alone: true },
  { term: "rip",   ht: "sa fini nèt",       en: "it is over, dead — often sarcastic", alone: true }
];

/* ── Engine ───────────────────────────────────────────────────────────────── */

const SLANG_PHRASES = Object.keys(SLANG)
  .filter(k => k.includes(" "))
  .sort((a, b) => b.length - a.length);   // longest first: "left me on read" before "on read"

const EMOJI_KEYS = Object.keys(SLANG).filter(k => /\p{Extended_Pictographic}/u.test(k));

/*
 * Contextual patterns use lookbehind so the match is exactly the term, which
 * makes substitution trivial. Lookbehind needs Safari 16.4+ / Chrome 62+; if
 * the engine rejects it the contextual layer is skipped and those words are
 * simply left for the translator. Degrading is correct here — a missing gloss
 * is a much smaller failure than a corrupted sentence.
 */
const CONTEXTUAL_RULES = (() => {
  const rules = [];
  for (const c of CONTEXTUAL) {
    try {
      let src;
      if (c.alone) {
        src = `(?<=^|[\\s.,!?])${c.term}(?=[\\s.,!?]*$)`;
      } else {
        src = `(?<=\\b(?:${c.cue})\\s)${c.term}\\b`;
        if (c.after)     src += `(?=\\s+(?:${c.after})${c.end ? "[\\s.,!?]*$" : "\\b"})`;
        else if (c.end)  src += `(?=[\\s.,!?]*$)`;
      }
      rules.push({ ...c, re: new RegExp(src, "gi") });
    } catch { /* no lookbehind support — skip this rule */ }
  }
  return rules;
})();

const CONTEXTUAL_OK = CONTEXTUAL_RULES.length === CONTEXTUAL.length;

/**
 * Stage 1 — normalise texting spelling into fluent English.
 * @returns {{ text: string, hits: {from:string,to:string}[] }}
 */
function normalizeText(input) {
  const hits = [];
  const text = input.replace(/[A-Za-z][A-Za-z0-9'/]*|\d+[a-z]+/g, (word) => {
    const repl = NORMALIZE[word.toLowerCase()];
    if (!repl) return word;
    hits.push({ from: word, to: repl });
    return repl;
  });
  return { text, hits };
}

/**
 * Stage 2 — pull slang out, leaving [[n]] placeholders.
 * @returns {{ text: string, found: {term:string, ht:string, en:string}[] }}
 */
function protectSlang(input) {
  let text = input;
  const found = [];

  const stash = (term, entry) => {
    const at = found.findIndex(f => f.term === term);
    if (at !== -1) return at;
    found.push({ term, ht: entry.ht, en: entry.en });
    return found.length - 1;
  };

  // a) multi-word phrases, longest first
  for (const phrase of SLANG_PHRASES) {
    const re = new RegExp(`(?<![A-Za-z])${escapeRegex(phrase)}(?![A-Za-z])`, "gi");
    text = text.replace(re, () => `[[${stash(phrase, SLANG[phrase])}]]`);
  }

  // b) ordinary-English words, only where a cue proves the slang reading
  for (const rule of CONTEXTUAL_RULES) {
    rule.re.lastIndex = 0;
    text = text.replace(rule.re, () => `[[${stash(rule.term, rule)}]]`);
  }

  // c) emoji — no word boundaries apply
  for (const key of EMOJI_KEYS) {
    if (!text.includes(key)) continue;
    const i = stash(key, SLANG[key]);
    text = text.split(key).join(` [[${i}]] `);
  }

  // d) single words
  text = text.replace(/[A-Za-z][A-Za-z0-9']*/g, (word) => {
    const entry = SLANG[word.toLowerCase()];
    return entry ? `[[${stash(word.toLowerCase(), entry)}]]` : word;
  });

  const out = text.replace(/\s{2,}/g, " ").trim();

  // How many times each placeholder legitimately appears. The translator has
  // been observed duplicating them, so restoreSlang caps against this.
  const counts = found.map((_, i) =>
    (out.match(new RegExp(`\\[\\[${i}\\]\\]`, "g")) || []).length
  );

  return { text: out, found, counts };
}

/**
 * Stage 3 — splice the Creole back in.
 *
 * Two observed MT behaviours are handled here, both seen in live responses:
 *  - [[1]] comes back reformatted as [1] or [ 1 ]  -> tolerant regex
 *  - a placeholder is DUPLICATED ("[1] [0] [0]")   -> capped at `counts[i]`
 *    so the Creole is not repeated in the output
 *
 * @returns {{ text: string, restored: number, missing: number[], duplicates: number }}
 */
function restoreSlang(translated, found, counts) {
  const cap = counts || found.map(() => 1);
  const used = found.map(() => 0);
  let duplicates = 0;

  const text = translated.replace(/\[+\s*(\d+)\s*\]+/g, (_, n) => {
    const i = Number(n);
    if (!found[i]) return "";
    if (used[i] >= (cap[i] || 1)) { duplicates++; return ""; }
    used[i]++;
    return found[i].ht;
  });

  return {
    text: tidySpacing(text),
    restored: used.filter(Boolean).length,
    missing: found.map((_, i) => i).filter(i => !used[i]),
    duplicates
  };
}

function tidySpacing(s) {
  return s.replace(/\s+([,.!?;:])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Guess which way to translate, so text arriving from another app (a shared
 * message, a text selection) does not need the direction picked by hand first.
 *
 * Deliberately biased toward "en|ht". Reading an incoming English message is
 * the common case; getting that wrong is worse than getting a reply wrong.
 *
 * @param {string} text
 * @returns {"en|ht"|"ht|en"}
 */
function guessDirection(text) {
  if (!text || !text.trim()) return "en|ht";

  /*
   * Lookarounds, not \s on both sides: a consuming pattern eats the space
   * after a match, so the following word has no leading delimiter left and
   * silently fails to match. "Mwen pa konnen" scored 1 instead of 3 that way.
   * \b is no good either — it is ASCII-only, so it breaks on "mèsi".
   *
   * "yo" is deliberately absent: it is also English slang, and on a
   * three-word message one false hit is enough to flip the direction.
   */
  const HT = /(?<![\p{L}\p{N}])(mwen|mw|nou|ou|li|yon|ap|map|kap|nap|tap|pa|nan|ki|kisa|kijan|poukisa|se|te|pral|prale|kounye|pita|jodi|pou|paske|epi|ak|avèk|gen|genyen|vle|konnen|konprann|tande|wè|fè|di|ale|vini|bay|byen|anpil|tout|zanmi|renmen|mèsi|mesi|tanpri|sak|sa|w|m|n)(?![\p{L}\p{N}])/giu;

  /*
   * These settle it alone — no English lookalike. Without this shortcut
   * "sak pase" (two words, one marker) falls under the minimum-hits floor.
   */
  const STRONG = /(?<![\p{L}\p{N}])(sak\s+pase|sa\s+k\s+pase|n\s*ap\s+boule|bonjou|bonswa|orevwa|mwen|kounye|mèsi|tanpri|kijan|kisa|poukisa|konnen|zanmi|pral|anpil|byenveni)(?![\p{L}\p{N}])/iu;
  if (STRONG.test(text)) return "ht|en";

  const hits  = (text.match(HT) || []).length;
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;

  // Two markers minimum: on very short input a single hit is noise.
  if (hits < 2) return "en|ht";
  return hits / words > 0.3 ? "ht|en" : "en|ht";
}

/** Reference-panel data: all three tables, flattened and sorted. */
function getLexiconList() {
  return [
    ...Object.entries(SLANG).map(([abbr, v]) => ({ abbr, en: v.en, ht: v.ht, kind: "slang" })),
    ...CONTEXTUAL.map(c => ({ abbr: c.term, en: c.en, ht: c.ht, kind: "contextual" })),
    ...Object.entries(NORMALIZE).map(([abbr, en]) => ({ abbr, en, ht: "", kind: "short" }))
  ].sort((a, b) => a.abbr.localeCompare(b.abbr));
}

if (typeof module !== "undefined") {
  module.exports = {
    NORMALIZE, SLANG, CONTEXTUAL, CONTEXTUAL_OK,
    normalizeText, protectSlang, restoreSlang, getLexiconList, guessDirection
  };
}
