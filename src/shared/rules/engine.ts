import {
  CATEGORIES,
  RULES,
  RULES_VERSION,
  type RuleDef,
} from "./rules.v1";
import {
  foldAccents,
  normalizeForMatch,
  splitSentences,
  findQuoteInOriginal,
} from "../normalize";
// Shared browser/edge budget; changing it requires a rule version bump.
const MAX_ANALYZE_CHARS = 12000;

export interface RuleEvidence {
  ruleId: string;
  category: string;
  quote: string;
  field: string;
  weight: number;
}

export interface AmbiguousMatch {
  ruleId: string | null;
  quote: string;
  field: string;
  reason: "quoted" | "reported" | "anti-scam-context";
}

export interface EngineField {
  name: string;
  original: string;
}

export interface EngineInput {
  username: string;
  profileUrl: string;
  biography: string;
  externalUrl: string | null;
  biographyLinks: string[];
  captions: string[];
  highlights?: string[];
  landingTexts?: string[];
  ocrTexts?: string[];
  transcript?: string;
  followerCount: number | null;
  followingCount: number | null;
  isVerified: boolean | null;
}

export interface EngineResult {
  ruleScore: number;
  matchedCategories: { category: string; points: number; ruleIds: string[] }[];
  flags: string[];
  evidence: RuleEvidence[];
  ambiguous: AmbiguousMatch[];
  tactics: string[];
  signals: { label: string; weight: number; hit: boolean }[];
  coverage: {
    fields: string[];
    captionCount: number;
    captionsAnalyzed: number;
    missing: string[];
    truncated: boolean;
  };
}

export { RULES_VERSION };

const regexCache = new Map<string, RegExp>();
function rx(source: string): RegExp {
  let re = regexCache.get(source);
  if (!re) {
    re = new RegExp(source, "giu");
    regexCache.set(source, re);
  }
  re.lastIndex = 0;
  return re;
}

const NEG_RE =
  /\b(yok|değil|degil|değildir|not|no|n't|never|karşıtı|karsiti|yalan|yanlış|yanlis|myth|debunk|false|inanm\w*|kanm\w*|kaçın\w*|kacin\w*|avoid)\b/;
const REPORT_RE =
  /diyor|söylüyor|soyluyor|iddia|claims?|says?|reports?|göre|according to|vaat ediyor|promises?|ortaya çıktı|revealed/;
const THIRD_PARTY_RE = /bu hesap|bu profil|they\b|he\b|she\b|o profil|@\w+/;
const ANTI_SCAM_RE =
  /(dikkat|uyarı|uyari|beware|warning|kaçın|kacin|avoid|alert).{0,40}(scam|dolandır|dolandir|fraud|sahtekar)|(scam|dolandır|dolandir|fraud).{0,40}(uyarısı|uyarisi|warning|alert|mağduru|magduru|victim)/;
const QUOTE_SPAN_RES = [
  /"([^"]{4,220})"/g,
  /"([^"]{4,220})"/g,
  /'([^']{4,220})'/g,
];

function inQuotedSpan(sentence: string, index: number): boolean {
  for (const q of QUOTE_SPAN_RES) {
    q.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = q.exec(sentence)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (index > start && index < end) return true;
    }
  }
  return false;
}

function hasNegationNearby(sentence: string, index: number, length: number): boolean {
  sentence = sentence.slice(0, index) + " ".repeat(length) + sentence.slice(index + length);
  const window = sentence.slice(Math.max(0, index - 60), index + 60);
  NEG_RE.lastIndex = 0;
  return NEG_RE.test(window) || NEG_RE.test(foldAccents(window));
}

/** First pattern hit of a rule in a haystack (normalized or folded). */
function matchRule(
  rule: RuleDef,
  hay: string,
): { index: number; text: string } | null {
  for (const src of rule.patterns) {
    const re = rx(src);
    const m = re.exec(hay);
    if (m?.[0]) return { index: m.index, text: m[0] };
  }
  return null;
}

interface SentenceHit {
  rule: RuleDef;
  field: string;
  sentenceOrig: string;
  outcome: "scored" | "ambiguous";
  reason?: AmbiguousMatch["reason"];
}

/** Classify one rule against one sentence. Returns null = no match at all. */
function classifySentenceRule(
  rule: RuleDef,
  sent: string,
  orig: string,
  field: string,
): SentenceHit | null {
  for (const hay of [sent, foldAccents(sent)]) {
    const matched = matchRule(rule, hay);
    if (!matched) continue;
    if (rule.requiredContext && !rx(rule.requiredContext).test(hay)) continue;
    if (rule.exclusions && rx(rule.exclusions).test(hay)) continue;
    if (hasNegationNearby(hay, matched.index, matched.text.length)) continue;
    const quoted = inQuotedSpan(hay, matched.index);
    const reported =
      rx(REPORT_RE.source).test(hay) &&
      (quoted || rx(THIRD_PARTY_RE.source).test(hay));
    if (quoted || reported) {
      return {
        rule,
        field,
        sentenceOrig: orig,
        outcome: "ambiguous",
        reason: quoted ? "quoted" : "reported",
      };
    }
    return { rule, field, sentenceOrig: orig, outcome: "scored" };
  }
  return null;
}

interface ScoredHit {
  rule: RuleDef;
  field: string;
  quoteNorm: string;
  sentenceOrig: string;
}

export function hasAnalyzableContent(input: EngineInput): boolean {
  return (
    input.biography.trim().length > 0 ||
    (input.externalUrl ?? "").trim().length > 0 ||
    input.biographyLinks.some((l) => l.trim().length > 0) ||
    input.captions.some((c) => c.trim().length > 0) ||
    input.highlights?.some(c=>c.trim()) === true || input.landingTexts?.some(c=>c.trim()) === true || input.ocrTexts?.some(c=>c.trim()) === true || Boolean(input.transcript?.trim())
  );
}

export function runRulesEngine(input: EngineInput): EngineResult {
  // Share the remaining budget across source fields; skip oversized sentences,
  // never abandon later fields or fabricate text by joining clipped claims.
  const captions = input.captions.filter((c) => c.trim().length > 0);
  const biography = input.biography.slice(0, 4000);
  let budget = Math.max(0, MAX_ANALYZE_CHARS - biography.length);
  const candidates = [
    ...input.captions.map((original,i)=>({name:`caption[${i}]`,original})),
    ...(input.highlights??[]).map((original,i)=>({name:`highlight[${i}]`,original})),
    ...(input.landingTexts??[]).map((original,i)=>({name:`landing[${i}]`,original})),
    ...(input.ocrTexts??[]).map((original,i)=>({name:`ocr[${i}]`,original})),
    ...(input.transcript?.trim() ? [{name:"transcript",original:input.transcript}] : []),
  ].filter(f=>f.original.trim());
  const sampled:EngineField[]=[];
  let truncated = biography.length < input.biography.length;
  for (const [i,field] of candidates.entries()) {
    const quota=Math.min(2000,Math.floor(budget/(candidates.length-i)));
    let used=0; const sentences:string[]=[];
    for(const sentence of splitSentences(field.original)) {
      if(used+sentence.length+1>quota){truncated=true;continue;}
      sentences.push(sentence);used+=sentence.length+1;
    }
    if(sentences.length){sampled.push({...field,original:sentences.join("\n")});budget-=used;}
  }
  const missing: string[] = [];
  if (!input.biography.trim()) missing.push("biography");
  if (!input.externalUrl && input.biographyLinks.length === 0)
    missing.push("external_url");
  if (captions.length === 0) missing.push("captions");

  const fields: EngineField[] = [
    { name: "biography", original: biography },
    ...Array.from(new Set([input.externalUrl, ...input.biographyLinks].filter((x): x is string => Boolean(x))))
      .filter(link => ![biography, ...sampled.map(f=>f.original)].some(text => text.includes(link.replace(/^https?:\/\//, ""))))
      .map((original, i) => ({ name: i === 0 ? "external_url" : `external_url[${i}]`, original })),
    ...sampled,
  ];
  const scored: ScoredHit[] = [];
  const ambiguous: AmbiguousMatch[] = [];

  // Every source field uses the same context rules. Extracted links retain bio context.
  for (const field of fields) {
    const origSentences = splitSentences(field.original);
    for (const orig of origSentences) {
      const sent = normalizeForMatch(orig);
      if (
        ANTI_SCAM_RE.test(sent) ||
        ANTI_SCAM_RE.test(foldAccents(sent))
      ) {
        ambiguous.push({
          ruleId: null,
          quote: findQuoteInOriginal(field.original, orig),
          field: field.name,
          reason: "anti-scam-context",
        });
        continue;
      }
      for (const rule of RULES.filter(r => !field.name.startsWith("external_url") || r.category === "N")) {
        const hit = classifySentenceRule(rule, sent, orig, field.name);
        if (!hit) continue;
        if (hit.outcome === "ambiguous") {
          ambiguous.push({
            ruleId: rule.id,
            quote: findQuoteInOriginal(field.original, orig),
            field: field.name,
            reason: hit.reason ?? "quoted",
          });
          continue;
        }
        scored.push({
          rule,
          field: field.name,
          quoteNorm: "",
          sentenceOrig: orig,
        });
      }
    }
  }

  // --- Category aggregation: each category scores at most once (its cap). ---
  const capByCat = new Map(CATEGORIES.map((c) => [c.id, c.cap]));
  const descByCat = new Map(CATEGORIES.map((c) => [c.id, c.description]));
  const hitsByCat = new Map<string, ScoredHit[]>();
  for (const h of scored) {
    const arr = hitsByCat.get(h.rule.category) ?? [];
    arr.push(h);
    hitsByCat.set(h.rule.category, arr);
  }

  const matchedCategories: EngineResult["matchedCategories"] = [];
  const flags = new Set<string>();
  const evidence: RuleEvidence[] = [];
  const signals: EngineResult["signals"] = [];
  let total = 0;

  for (const [cat, hits] of hitsByCat) {
    const distinctRules = new Map<string, ScoredHit>();
    for (const h of hits) {
      if (!distinctRules.has(h.rule.id)) distinctRules.set(h.rule.id, h);
    }
    const rules = Array.from(distinctRules.values());
    const cap = capByCat.get(cat) ?? 0;
    const points = Math.min(
      cap,
      Math.max(...rules.map((r) => r.rule.weight)),
    );
    matchedCategories.push({
      category: cat,
      points,
      ruleIds: rules.map((r) => r.rule.id),
    });
    total += points;
    for (const h of hits) {
      flags.add(h.rule.flag);
      evidence.push({
        ruleId: h.rule.id,
        category: cat,
        quote: findQuoteInOriginal(
          fields.find((f) => f.name === h.field)?.original ?? "",
          h.sentenceOrig,
        ),
        field: h.field,
        weight: h.rule.weight,
      });
    }
  }
  for (const c of CATEGORIES) {
    if (hitsByCat.has(c.id)) continue;
    signals.push({ label: `${c.id} · ${c.description}`, weight: 0, hit: false });
  }
  for (const mc of matchedCategories) {
    signals.push({
      label: `${mc.category} · ${descByCat.get(mc.category) ?? mc.category}`,
      weight: mc.points,
      hit: true,
    });
  }

  const ruleScore = Math.max(0, Math.min(100, Math.round(total)));
  const cats = new Set(matchedCategories.map((m) => m.category));
  const tactics = computeTactics(cats);

  return {
    ruleScore,
    matchedCategories,
    flags: Array.from(flags),
    evidence,
    ambiguous,
    tactics,
    signals,
    coverage: {
      fields: [
        ...(biography.trim() ? ["biography"] : []),
        ...(input.externalUrl || input.biographyLinks.length > 0
          ? ["external_url"]
          : []),
        ...(sampled.some(f=>f.name.startsWith("caption[")) ? ["captions"] : []),
        ...(sampled.some(f=>f.name.startsWith("highlight[")) ? ["highlights"] : []),
        ...(sampled.some(f=>f.name.startsWith("landing[")) ? ["landing_pages"] : []),
        ...(sampled.some(f=>f.name.startsWith("ocr[")) ? ["ocr"] : []),
        ...(sampled.some(f=>f.name==="transcript") ? ["speech"] : []),
      ],
      captionCount: captions.length,
      captionsAnalyzed: sampled.filter(f=>f.name.startsWith("caption[")).length,
      missing,
      truncated,
    },
  };
}

/** Tactic combos (§6): labels only, never extra points. */
function computeTactics(cats: Set<string>): string[] {
  const out: string[] = [];
  const earn = ["A", "B", "C", "D"].some((c) => cats.has(c));
  const paid = ["G", "K", "J"].some((c) => cats.has(c));
  if (earn && paid) out.push("profit-promise + paid offer");
  if (cats.has("A") && cats.has("B")) out.push("guarantee + risk-free");
  if (cats.has("E") && cats.has("H")) out.push("easy success + urgency");
  if (cats.has("I") && cats.has("J") && cats.has("K"))
    out.push("free content → call → paid package");
  if (cats.has("M") && (cats.has("G") || cats.has("K")))
    out.push("student-proof selling");
  return out;
}
