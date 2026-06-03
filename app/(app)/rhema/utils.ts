export const OT_BOOK_ORDER = [
  'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT','1SA','2SA',
  '1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB','PSA','PRO',
  'ECC','SNG','ISA','JER','LAM','EZK','DAN','HOS','JOL','AMO',
  'OBA','JON','MIC','NAM','HAB','ZEP','HAG','ZEC','MAL',
];
export const NT_BOOK_ORDER = [
  'MAT','MAR','LUK','JOH','ACT','ROM','1CO','2CO','GAL','EPH',
  'PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAM',
  '1PE','2PE','1JO','2JO','3JO','JUD','REV',
];
export const BOOK_ORDER = [...OT_BOOK_ORDER, ...NT_BOOK_ORDER];

export const BOOK_NAMES: Record<string, string> = {
  GEN:'Genesis', EXO:'Exodus', LEV:'Leviticus', NUM:'Numbers', DEU:'Deuteronomy',
  JOS:'Joshua', JDG:'Judges', RUT:'Ruth', '1SA':'1 Samuel', '2SA':'2 Samuel',
  '1KI':'1 Kings', '2KI':'2 Kings', '1CH':'1 Chronicles', '2CH':'2 Chronicles',
  EZR:'Ezra', NEH:'Nehemiah', EST:'Esther', JOB:'Job', PSA:'Psalms',
  PRO:'Proverbs', ECC:'Ecclesiastes', SNG:'Song of Solomon', ISA:'Isaiah',
  JER:'Jeremiah', LAM:'Lamentations', EZK:'Ezekiel', DAN:'Daniel', HOS:'Hosea',
  JOL:'Joel', AMO:'Amos', OBA:'Obadiah', JON:'Jonah', MIC:'Micah', NAM:'Nahum',
  HAB:'Habakkuk', ZEP:'Zephaniah', HAG:'Haggai', ZEC:'Zechariah', MAL:'Malachi',
  MAT:'Matthew', MAR:'Mark', LUK:'Luke', JOH:'John', ACT:'Acts', ROM:'Romans',
  '1CO':'1 Corinthians', '2CO':'2 Corinthians', GAL:'Galatians', EPH:'Ephesians',
  PHP:'Philippians', COL:'Colossians', '1TH':'1 Thessalonians', '2TH':'2 Thessalonians',
  '1TI':'1 Timothy', '2TI':'2 Timothy', TIT:'Titus', PHM:'Philemon', HEB:'Hebrews',
  JAM:'James', '1PE':'1 Peter', '2PE':'2 Peter', '1JO':'1 John',
  '2JO':'2 John', '3JO':'3 John', JUD:'Jude', REV:'Revelation',
};

const MORPH_POS: Record<string, string> = {
  N:'Noun', V:'Verb', T:'Article', ADJ:'Adjective', A:'Adjective',
  PREP:'Preposition', CONJ:'Conjunction', ADV:'Adverb', PART:'Particle',
  INJ:'Interjection', PRT:'Particle', COND:'Conditional Particle',
  HEB:'Hebrew/Aramaic', ARAM:'Aramaic', INF:'Infinitive',
  P:'Personal Pronoun', PRON:'Pronoun', R:'Relative Pronoun', RI:'Proper Noun',
  C:'Relative Pronoun', D:'Demonstrative Pronoun', F:'Reflexive Pronoun',
  I:'Interrogative Pronoun', K:'Correlative Pronoun', Q:'Correlative Pronoun',
  S:'Possessive Pronoun', X:'Indefinite Pronoun',
};
const MORPH_CASE: Record<string, { l: string; d: string }> = {
  N:{ l:'Nominative', d:'subject of the verb' },
  G:{ l:'Genitive',   d:'possession or relationship' },
  D:{ l:'Dative',     d:'indirect object, location, or means' },
  A:{ l:'Accusative', d:'direct object' },
  V:{ l:'Vocative',   d:'direct address' },
};
const MORPH_NUM: Record<string, string>  = { S:'Singular', P:'Plural' };
const MORPH_GEN: Record<string, string>  = { M:'Masculine', F:'Feminine', N:'Neuter' };
const MORPH_TENSE: Record<string, { l: string; d: string }> = {
  P:{ l:'Present',      d:'ongoing action' },
  I:{ l:'Imperfect',    d:'ongoing past action' },
  F:{ l:'Future',       d:'future action' },
  A:{ l:'Aorist',       d:'completed past action' },
  R:{ l:'Perfect',      d:'completed with present result' },
  L:{ l:'Pluperfect',   d:'completed past with past result' },
  '2A':{ l:'2nd Aorist', d:'completed past action (2nd form)' },
  '2R':{ l:'2nd Perfect',d:'completed with present result (2nd form)' },
};
const MORPH_VOICE: Record<string, { l: string; d: string }> = {
  A:{ l:'Active',           d:'subject performs the action' },
  M:{ l:'Middle',           d:'subject acts for itself' },
  P:{ l:'Passive',          d:'subject receives the action' },
  D:{ l:'Middle/Deponent',  d:'active meaning, middle form' },
  O:{ l:'Middle-Passive',   d:'middle or passive' },
  N:{ l:'Middle or Passive', d:'voice ambiguous' },
  Q:{ l:'Middle Deponent',  d:'deponent with middle form' },
};
const MORPH_MOOD: Record<string, { l: string; d: string }> = {
  I:{ l:'Indicative',  d:'stating a fact' },
  S:{ l:'Subjunctive', d:'possibility or contingency' },
  O:{ l:'Optative',    d:'wish or remote possibility' },
  M:{ l:'Imperative',  d:'command' },
  N:{ l:'Infinitive',  d:'verbal noun' },
  P:{ l:'Participle',  d:'verbal adjective' },
};
const MORPH_PERSON: Record<string, string> = {
  '1':'1st Person', '2':'2nd Person', '3':'3rd Person',
};

export interface MorphRow {
  label: string;
  value: string;
  desc: string;
}

export function decodeMorph(code: string): MorphRow[] {
  if (!code) return [];
  const rows: MorphRow[] = [];
  const segs = code.split('-');
  const posRaw = segs[0];
  const vSegs = segs.slice(1);

  const INDECLINABLE: Record<string, number> = {
    PREP:1, CONJ:1, ADV:1, PART:1, INJ:1, PRT:1, COND:1, HEB:1, ARAM:1,
  };
  if (INDECLINABLE[posRaw]) {
    return [{ label:'Part of Speech', value: MORPH_POS[posRaw] || posRaw, desc:'' }];
  }

  let tensePrefix = '';
  if (vSegs[0] && /^2[ARILP]/.test(vSegs[0])) {
    tensePrefix = '2';
    vSegs[0] = vSegs[0].substring(1);
  }

  const posLabel = MORPH_POS[posRaw];
  if (posLabel) rows.push({ label:'Part of Speech', value: posLabel, desc:'' });

  if (posRaw === 'V') {
    const tvm = vSegs[0] || '';
    const pn  = vSegs[1] || '';
    const t = tensePrefix + tvm[0];
    const v = tvm[1];
    const m = tvm[2];
    const tObj = MORPH_TENSE[t] || MORPH_TENSE[tvm[0]];
    if (tObj) rows.push({ label:'Tense', value: tObj.l, desc: tObj.d });
    const vObj = MORPH_VOICE[v];
    if (vObj) rows.push({ label:'Voice', value: vObj.l, desc: vObj.d });
    const mObj = MORPH_MOOD[m];
    if (mObj) rows.push({ label:'Mood',  value: mObj.l, desc: mObj.d });
    if (m === 'N') {
      // infinitive — no person/number
    } else if (m === 'P') {
      const c = MORPH_CASE[pn[0]];
      const n = MORPH_NUM[pn[1]];
      const g = MORPH_GEN[pn[2]];
      if (c) rows.push({ label:'Case',   value: c.l, desc: c.d });
      if (n) rows.push({ label:'Number', value: n,   desc: '' });
      if (g) rows.push({ label:'Gender', value: g,   desc: '' });
    } else if (pn) {
      const person = MORPH_PERSON[pn[0]];
      const num    = MORPH_NUM[pn[1]];
      if (person) rows.push({ label:'Person', value: person, desc:'' });
      if (num)    rows.push({ label:'Number', value: num,    desc:'' });
    }
  } else if (['P','PRON'].includes(posRaw)) {
    const seg = vSegs[0] || '';
    if (seg[0] === '1' || seg[0] === '2') {
      const person = MORPH_PERSON[seg[0]];
      const c = MORPH_CASE[seg[1]];
      const n = MORPH_NUM[seg[2]];
      if (person) rows.push({ label:'Person', value: person, desc:'' });
      if (c) rows.push({ label:'Case',   value: c.l, desc: c.d });
      if (n) rows.push({ label:'Number', value: n,   desc: '' });
    } else {
      const c = MORPH_CASE[seg[0]];
      const n = MORPH_NUM[seg[1]];
      const g = MORPH_GEN[seg[2]];
      if (c) rows.push({ label:'Case',   value: c.l, desc: c.d });
      if (n) rows.push({ label:'Number', value: n,   desc: '' });
      if (g) rows.push({ label:'Gender', value: g,   desc: '' });
    }
  } else if (posRaw === 'F') {
    const seg = vSegs[0] || '';
    const person = MORPH_PERSON[seg[0]];
    const c = MORPH_CASE[seg[1]];
    const n = MORPH_NUM[seg[2]];
    const g = MORPH_GEN[seg[3]];
    if (person) rows.push({ label:'Person', value: person, desc:'' });
    if (c) rows.push({ label:'Case',   value: c.l, desc: c.d });
    if (n) rows.push({ label:'Number', value: n,   desc: '' });
    if (g) rows.push({ label:'Gender', value: g,   desc: '' });
  } else if (['N','T','ADJ','A','R','C','D','I','K','Q','X','S'].includes(posRaw)) {
    const cng = vSegs[0] || '';
    if (['PRI','NUI','LI','OI'].includes(cng)) {
      const label = cng === 'PRI' ? 'Proper Noun (Indeclinable)' :
                    cng === 'NUI' ? 'Numeral (Indeclinable)' : 'Indeclinable';
      rows.push({ label:'Form', value: label, desc:'' });
    } else {
      const c = MORPH_CASE[cng[0]];
      const n = MORPH_NUM[cng[1]];
      const g = MORPH_GEN[cng[2]];
      if (c) rows.push({ label:'Case',   value: c.l, desc: c.d });
      if (n) rows.push({ label:'Number', value: n,   desc: '' });
      if (g) rows.push({ label:'Gender', value: g,   desc: '' });
    }
  }
  return rows;
}

export function normalizePosKey(morphCode: string): string | null {
  if (!morphCode) return null;
  const raw = morphCode.split('-')[0];
  if (raw === 'A') return 'ADJ';
  if (['P','R','C','D','F','I','K','Q','X','PRON'].includes(raw)) return 'PRON';
  if (raw === 'RI') return 'N';
  if (['PART','PRT','INJ','COND'].includes(raw)) return 'PART';
  return raw;
}

/* ── Hebrew OSHB morphology decoder ───────────────────────────── */

const HEBREW_VERB_STEMS: Record<string, string> = {
  q:'Qal', N:'Niphal', p:'Piel', P:'Pual', h:'Hiphil', H:'Hophal', t:'Hithpael',
  o:'Polel', O:'Polal', r:'Hithpolel', m:'Poel', M:'Poal',
  k:'Palel', K:'Pulal', D:'Nithpael', f:'Hithpalpel',
  l:'Pilpel', L:'Polpal', Q:'Pealal', v:'Hishtaphel',
  w:'Nithpalel', y:'Nithpoel', z:'Hithpoel', u:'Hothpaal', c:'Tiphil',
};

const HEBREW_VERB_FORMS: Record<string, { l: string; d: string }> = {
  p: { l:'Perfect (Qatal)',        d:'completed action; expresses certainty or past events' },
  q: { l:'Imperfect (Yiqtol)',     d:'incomplete action; future, habitual, or modal' },
  w: { l:'Waw-Consecutive',        d:'sequential narrative; drives the story forward' },
  v: { l:'Imperative',             d:'direct command or strong request' },
  r: { l:'Active Participle',      d:'ongoing action or characteristic; often substantive' },
  s: { l:'Passive Participle',     d:'state resulting from a completed action' },
  a: { l:'Infinitive Absolute',    d:'emphasizes the verbal idea; often paired with a finite verb' },
  c: { l:'Infinitive Construct',   d:'verbal noun; like English "to ___" or "the ___ing"' },
  e: { l:'Jussive',                d:'third-person volitional — let him / may he' },
  i: { l:'Cohortative',            d:'first-person volitional — let us / I will' },
};

const HEBREW_GENDERS: Record<string, string> = { m:'Masculine', f:'Feminine', b:'Both', c:'Common' };
const HEBREW_NUMBERS: Record<string, string> = { s:'Singular', p:'Plural', d:'Dual' };
const HEBREW_STATES: Record<string, { l: string; d: string }> = {
  a: { l:'Absolute',   d:'independent; noun stands alone' },
  c: { l:'Construct',  d:'bound state; links to following noun ("of")' },
  d: { l:'Determined', d:'definite/emphatic (mainly Aramaic)' },
};
const HEBREW_NOUN_TYPES: Record<string, string> = {
  c:'Common Noun', g:'Gentilic Noun', p:'Proper Noun',
};
const HEBREW_PERSON: Record<string, string> = {
  '1':'1st Person', '2':'2nd Person', '3':'3rd Person', c:'Common Person',
};
const HEBREW_PRON_TYPES: Record<string, string> = {
  p:'Personal Pronoun', d:'Demonstrative Pronoun', r:'Relative Pronoun',
  f:'Reflexive Pronoun', i:'Interrogative Pronoun', x:'Indefinite Pronoun',
  e:'Pronominal Suffix',
};
const HEBREW_PARTICLE_TYPES: Record<string, string> = {
  a:'Interrogative Particle', d:'Definite Article', e:'Demonstrative Particle',
  f:'Exhortation Particle',  i:'Interjection',      k:'Comparative Particle',
  l:'Directional He',        m:'Discourse Marker',  n:'Negative Particle',
  o:'Other Particle',        r:'Relative Particle', s:'Exhortation Particle',
};

export interface HebrewMorphRow { label: string; value: string; desc: string }

/* Strip OSHB H-prefix and resolve compound morphs (e.g. "HR/Ncfsa" → main="Ncfsa", prefix="R") */
function parseOSHBMorph(code: string): { main: string; prefixes: string[] } {
  let c = code.startsWith('H') ? code.slice(1) : code;
  const parts = c.split('/');
  const main = parts.pop() || '';
  const prefixes = parts;
  return { main, prefixes };
}

export function decodeHebrewMorph(code: string): HebrewMorphRow[] {
  if (!code) return [];
  const rows: HebrewMorphRow[] = [];
  const { main, prefixes } = parseOSHBMorph(code);

  // Show any attached prefixes first
  for (const pf of prefixes) {
    const pfPos = pf[0];
    if (pfPos === 'R') rows.push({ label:'Prefix', value:'Preposition', desc:'inseparable preposition prefix' });
    else if (pfPos === 'C') rows.push({ label:'Prefix', value:'Conjunction', desc:'waw-conjunction prefix' });
    else if (pfPos === 'T') rows.push({ label:'Prefix', value:'Article', desc:'definite article prefix' });
    else if (pfPos === 'S') rows.push({ label:'Prefix', value:'Pronominal Suffix', desc:'' });
    else if (pf) rows.push({ label:'Prefix', value:pf, desc:'' });
  }

  const pos = main[0];

  if (pos === 'V') {
    rows.push({ label:'Part of Speech', value:'Verb', desc:'' });
    const stem = main[1]; const form = main[2];
    const person = main[3]; const gender = main[4]; const number = main[5];
    if (stem && HEBREW_VERB_STEMS[stem]) rows.push({ label:'Stem', value:HEBREW_VERB_STEMS[stem], desc:'' });
    if (form) { const f = HEBREW_VERB_FORMS[form]; if (f) rows.push({ label:'Form', value:f.l, desc:f.d }); }
    if (person && HEBREW_PERSON[person]) rows.push({ label:'Person', value:HEBREW_PERSON[person], desc:'' });
    if (gender && HEBREW_GENDERS[gender]) rows.push({ label:'Gender', value:HEBREW_GENDERS[gender], desc:'' });
    if (number && HEBREW_NUMBERS[number]) rows.push({ label:'Number', value:HEBREW_NUMBERS[number], desc:'' });
  } else if (pos === 'N') {
    const type = main[1]; const gender = main[2]; const number = main[3]; const state = main[4];
    rows.push({ label:'Part of Speech', value:HEBREW_NOUN_TYPES[type] || 'Noun', desc:'' });
    if (gender && HEBREW_GENDERS[gender]) rows.push({ label:'Gender', value:HEBREW_GENDERS[gender], desc:'' });
    if (number && HEBREW_NUMBERS[number]) rows.push({ label:'Number', value:HEBREW_NUMBERS[number], desc:'' });
    if (state) { const s = HEBREW_STATES[state]; if (s) rows.push({ label:'State', value:s.l, desc:s.d }); }
  } else if (pos === 'A') {
    rows.push({ label:'Part of Speech', value:'Adjective', desc:'' });
    const gender = main[2]; const number = main[3]; const state = main[4];
    if (gender && HEBREW_GENDERS[gender]) rows.push({ label:'Gender', value:HEBREW_GENDERS[gender], desc:'' });
    if (number && HEBREW_NUMBERS[number]) rows.push({ label:'Number', value:HEBREW_NUMBERS[number], desc:'' });
    if (state) { const s = HEBREW_STATES[state]; if (s) rows.push({ label:'State', value:s.l, desc:s.d }); }
  } else if (pos === 'P') {
    const type = main[1]; const person = main[2]; const gender = main[3]; const number = main[4];
    rows.push({ label:'Part of Speech', value:HEBREW_PRON_TYPES[type] || 'Pronoun', desc:'' });
    if (person && HEBREW_PERSON[person]) rows.push({ label:'Person', value:HEBREW_PERSON[person], desc:'' });
    if (gender && HEBREW_GENDERS[gender]) rows.push({ label:'Gender', value:HEBREW_GENDERS[gender], desc:'' });
    if (number && HEBREW_NUMBERS[number]) rows.push({ label:'Number', value:HEBREW_NUMBERS[number], desc:'' });
  } else if (pos === 'R') {
    rows.push({ label:'Part of Speech', value:'Preposition', desc:'' });
    if (main[1] === 'd') rows.push({ label:'Note', value:'with Definite Article', desc:'' });
  } else if (pos === 'C') {
    rows.push({ label:'Part of Speech', value:'Conjunction', desc:'' });
  } else if (pos === 'D') {
    rows.push({ label:'Part of Speech', value:'Adverb', desc:'' });
  } else if (pos === 'T') {
    const label = main[1] ? (HEBREW_PARTICLE_TYPES[main[1]] || 'Particle') : 'Particle';
    rows.push({ label:'Part of Speech', value:label, desc:'' });
  } else if (pos === 'S') {
    rows.push({ label:'Part of Speech', value:'Pronominal Suffix', desc:'' });
    const person = main[2]; const gender = main[3]; const number = main[4];
    if (person && HEBREW_PERSON[person]) rows.push({ label:'Person', value:HEBREW_PERSON[person], desc:'' });
    if (gender && HEBREW_GENDERS[gender]) rows.push({ label:'Gender', value:HEBREW_GENDERS[gender], desc:'' });
    if (number && HEBREW_NUMBERS[number]) rows.push({ label:'Number', value:HEBREW_NUMBERS[number], desc:'' });
  } else {
    rows.push({ label:'Morphology', value:main || code, desc:'' });
  }
  return rows;
}

/* Maps OSHB morph code (with H prefix + optional compound) → highlight category key */
export function normalizeHebrewPosKey(morphCode: string): string | null {
  if (!morphCode) return null;
  const { main } = parseOSHBMorph(morphCode);
  const pos = main[0];
  if (pos === 'N') return main[1] === 'p' ? 'Np' : 'N';
  if (pos === 'A') return 'A';
  if (pos === 'P') return 'P';
  if (pos === 'V') return 'V';
  if (pos === 'R') return 'R';
  if (pos === 'C') return 'C';
  if (pos === 'D') return 'D';
  if (pos === 'T') return 'T';
  if (pos === 'S') return 'S';
  return null;
}
