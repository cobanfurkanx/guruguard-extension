// Versioned rule configuration — RULES_VERSION "v1".
// These are STARTING HEURISTICS, not measured frequencies or validated
// classifier weights. Rule scores express REVIEW PRIORITY (0-100), never a
// fraud probability. See README ("How review priority works").
//
// Each rule: id, category, patterns (regex sources, compiled with giu flags),
// weight, requiredContext (must match in the SAME sentence), exclusions
// (same-sentence exclusion wins), description.
// Category caps: one category contributes at most its cap, no matter how
// many of its rules or repeats hit. Repeats are kept as evidence.

export const RULES_VERSION = "v7-2026-10-13";

export interface RuleDef {
  id: string;
  category: string;
  patterns: string[];
  weight: number;
  requiredContext?: string;
  exclusions?: string;
  description: string;
  /** Canonical flag emitted on hit (see src/lib/flags.ts). */
  flag: string;
}

export interface CategoryDef {
  id: string;
  cap: number;
  description: string;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "A", cap: 30, description: "Income guarantee" },
  { id: "B", cap: 30, description: "Risk-free investing" },
  { id: "C", cap: 20, description: "High income in a short time" },
  { id: "D", cap: 12, description: "Effortless income" },
  { id: "E", cap: 10, description: "Easy success without experience" },
  { id: "F", cap: 10, description: "Secret method" },
  { id: "G", cap: 12, description: "Ready-made success system" },
  { id: "H", cap: 8, description: "Time/seat pressure" },
  { id: "I", cap: 5, description: "Engagement-to-sale redirect" },
  { id: "J", cap: 3, description: "Sales call" },
  { id: "K", cap: 5, description: "Paid inner group" },
  { id: "L", cap: 3, description: "Status/lifestyle promise" },
  { id: "M", cap: 5, description: "Student/mentor success claim" },
  // N is infrastructure evidence (funnels), not a claim. Capped separately.
  { id: "N", cap: 30, description: "Sales-funnel infrastructure" },
];

const MONEY_CTX =
  "para|gelir|kazan|kâr|kar\\b|income|profit|earn|return|\\$|₺|€|maaş|salary";
const INVEST_CTX =
  "yatırım|yatirim|getiri|invest|return|trad|portföy|portfolio|fon\\b|fund|hisse|stock|crypto|kripto|forex";
const GAIN_CTX = `kazan|earn|make|para|gelir|income|profit|\\$|₺|€|büyü|grow|scale`;
const OPP_CTX =
  "iş|fırsat|firsat|opportunity|kazan|earn|program|course|kurs|para|income|işe\\s*(al|başla)";
const PRODUCT_WARRANTY =
  "iade|refund|ürün|urun|product|kargo|shipping|cargo|warranty|garanti\\s*(süresi|süres[ıi]|kapsamı|belgesi)";

export const RULES: RuleDef[] = [
  {
    id: "A1-guaranteed-income",
    category: "A",
    patterns: [
      "garant[iı]l[iı]\\s*(kazan[çc]|kâr|kar\\b|gelir|para|income|profit)",
      "kesin\\s*(gelir|kazan[çc]|kâr|kar\\b)",
      "guaranteed\\s+(?:\\d+(?:[.,]\\d+)?\\s*%\\s*(?:(?:daily|weekly|monthly)\\s*)?)?(income|profits?|returns?|earnings)",
      "%\\s?100\\s*(kazan[çc]|garanti|kâr|kar\\b)",
    ],
    weight: 30,
    requiredContext: MONEY_CTX,
    exclusions: PRODUCT_WARRANTY,
    description: "Guaranteed income/profit promise (product warranties excluded).",
    flag: "income_guarantee",
  },
  {
    id: "B1-risk-free",
    category: "B",
    patterns: [
      "s[ıi]f[ıi]r\\s*risk",
      "risksiz",
      "risk[\\s-]?free\\s*(returns|trading|investing|profits|income)?",
      "no[\\s-]?loss\\s*(trading|investing)?",
      "zero\\s*risk",
      "zarar\\s*etmezsin|kaybetmezsin|kaybetme\\s*riskin\\s*yok",
    ],
    weight: 30,
    requiredContext: INVEST_CTX,
    description: "Risk-free investing promise in an investment/return context.",
    flag: "riskfree_investing",
  },
  {
    id: "C1-fast-money",
    category: "C",
    patterns: [
      "\\$\\s?\\d[\\d,.]*\\s*(\\/\\s*(gün|day|month|ay|week|hafta)|per\\s*(day|month|week)|a\\s*(day|month))\\b",
      "(günde|günlük|daily)\\s*\\$?\\s*\\d",
      "\\b\\d+\\s*(günde|gün içinde|günlük)\\b[^.!?…\\n]{0,60}(\\$|₺|€|\\bbin\\b|\\bk\\b|\\bm\\b|kazan|earn|make|gelir|income)",
      "(six|seven|\\b[67]\\b)[\\s-]?figures?\\s*in\\s*\\d+\\s*days",
      "make\\s*\\$10k\\/month",
      "(?:turn(ed|ing)?\\s+\\$[^.!?…\\n]{1,40}into\\s+\\$|\\$\\s?\\d[\\d,.-]*\\s*(to|→|->)\\s*\\$?\\s?[\\d,.]+\\s*[kmb]?\\b)",
      "30\\s*günde\\s*\\d",
    ],
    weight: 20,
    requiredContext: `kazan|earn|make|gelir|income|para|\\$|₺|€`,
    description: "High income in a short time: amount + period + earning promise together.",
    flag: "fast_money",
  },
  {
    id: "D1-passive",
    category: "D",
    patterns: [
      "pasif\\s*gelir",
      "passive\\s*income",
      "uyurken\\s*(para\\s*)?kazan",
      "uykunda\\s*(para\\s*)?kazan",
      "earn\\s+while\\s+you\\s+sleep",
      "autopilot\\s*income",
      "çalışmadan\\s*kazan",
    ],
    weight: 12,
    description: "Effortless/passive income promise.",
    flag: "passive_income_claims",
  },
  {
    id: "E1-easy-win",
    category: "E",
    patterns: [
      "deneyim\\s*(gerekmez|şart\\s*değil|gerek\\s*yok)",
      "tecrübe\\s*(gerekmez|şart\\s*değil)",
      "herkes\\s*yapabilir",
      "no\\s*(skills|experience)\\s*needed",
      "no\\s*experience\\s*(needed|required)",
      "copy[\\s-]?paste\\s*system",
    ],
    weight: 10,
    requiredContext: OPP_CTX,
    description: "Easy success without experience, in a job/opportunity context.",
    flag: "easy_success",
  },
  {
    id: "F1-secret",
    category: "F",
    patterns: [
      "kimsenin\\s*bilmediği",
      "kimseye\\s*(söylemediğim|anlatmadığım)",
      "zenginlerin\\s*sırrı",
      "secret\\s*formula",
      "millionaire\\s*blueprint",
      "gizli\\s*(yöntem|sistem|formül|formula|taktik|method)",
      "hidden\\s*method",
    ],
    weight: 10,
    description: "Secret-method framing.",
    flag: "secret_method",
  },
  {
    id: "G1-system",
    category: "G",
    patterns: [
      "kanıtlanmış\\s*sistem",
      "kazandıran\\s*formül",
      "proven\\s*system",
      "done[\\s-]?for[\\s-]?you",
      "hazır\\s*(sistem|kazanç\\s*sistemi)",
    ],
    weight: 12,
    requiredContext: GAIN_CTX,
    description: "Ready-made success system tied to an earning promise.",
    flag: "proven_system",
  },
  {
    id: "H1-urgency",
    category: "H",
    patterns: [
      "son\\s*\\d+\\s*(kişi|kontenjan|yer|koltuk)",
      "sadece\\s*bugün",
      "last\\s*chance",
      "only\\s*\\d+\\s*(spots?\\s*)?(left|remaining)",
      "kalan\\s*\\d+",
      "kontenjan\\s*(dolmak\\s*üzere|bitiyor|kapanıyor)",
      "doors\\s*(close|closing)",
      "\\bbitmeden\\s*(al|katıl|kaçırma)",
    ],
    weight: 8,
    description: "Time/seat pressure.",
    flag: "urgency_pressure",
  },
  {
    id: "I1-cta",
    category: "I",
    patterns: [
      "dm.{0,25}(para|özgürlük|ozgurluk|rich|start|info|bilgi|money|freedom|freedom\\b)",
      "yorumlara?.{0,25}(özgürlük|ozgurluk|para|rich)",
      "comment\\s*[\"“](rich|freedom|start|money)",
      "dm\\s*[\"“]\\w+[\"”]",
    ],
    weight: 5,
    description: "Engagement-to-sale redirect (DM/comment this word).",
    flag: "dm_funnel",
  },
  {
    id: "J1-call",
    category: "J",
    patterns: [
      "ücretsiz\\s*strateji\\s*görüşmesi",
      "book\\s*a\\s*call",
      "free\\s*discovery\\s*call",
      "ücretsiz\\s*(ön\\s*|tanışma\\s*)?görüşme",
      "discovery\\s*call",
      "strategy\\s*(call|session)",
    ],
    weight: 3,
    description: "Free strategy/sales call offer.",
    flag: "sales_call",
  },
  {
    id: "K1-inner",
    category: "K",
    patterns: [
      "vip\\s*sinyal",
      "özel\\s*mentorluk",
      "inner\\s*circle",
      "mastermind",
      "exclusive\\s*signals?",
      "özel\\s*(grup|topluluk)",
      "kapalı\\s*grup",
      "private\\s*(mentorship|community|group)",
      "1:1\\s*(mentorluk|mentorship|coaching|danışmanlık|danismanlik)",
      "signal(s)?\\s*(group|channel|vip|free)",
      "vip\\s*(?:trading\\s*)?(signals?|group|channel)",
      "copy[\\s-]?trad",
      "copy\\s*(my\\s*)?trades?",
      "trade\\s+(with|w\\/)\\s*me",
      "come\\s+trade",
    ],
    weight: 5,
    description: "Paid inner group / signals / 1:1 mentorship offer.",
    flag: "inner_circle",
  },
  {
    id: "L1-status",
    category: "L",
    patterns: [
      "finansal\\s*özgürlük",
      "financial\\s*freedom",
      "işini\\s*bırak",
      "escape\\s*the\\s*9-?5",
      "9-?5.*(quit|escape|bırak)",
      "laptop\\s*lifestyle",
      "patron\\s*olma",
      "be\\s*your\\s*own\\s*boss",
      "kendi\\s*işinin\\s*patronu",
      "18\\s*yaşında\\s*milyoner",
      "teen\\s*millionaire",
    ],
    weight: 3,
    description: "Status/lifestyle promise (review signal, not proof).",
    flag: "status_promise",
  },
  {
    id: "M1-proof",
    category: "M",
    patterns: [
      "öğrencilerim\\s*.{0,40}kazandı",
      "student\\s*wins",
      "seven[\\s-]?figure\\s*mentor",
      "öğrenci\\s*(sonuçları|kazançları|sonuclari)",
      "kazanan\\s*öğrenciler",
    ],
    weight: 5,
    requiredContext: `kazan|earned|made|\\$|milyon|million`,
    description: "Student/mentor success claim used in selling.",
    flag: "student_proof",
  },
  {
    id: "N1-telegram",
    category: "N",
    patterns: ["t\\.me\\/", "wa\\.me\\/", "tg\\.me\\/"],
    weight: 5,
    description: "Telegram/WhatsApp funnel infrastructure.",
    flag: "telegram_funnel",
  },
  {
    id: "N2-discord",
    category: "N",
    patterns: ["discord\\.gg", "discord\\.com\\/invite"],
    weight: 5,
    description: "Discord funnel infrastructure.",
    flag: "discord_funnel",
  },
  {
    id: "N3-linkhub",
    category: "N",
    patterns: [
      "linktr\\.ee\\/",
      "link\\.me\\/",
      "beacons\\.ai\\/",
      "hoo\\.be\\/",
      "stan\\.store",
      "stanstore",
      "whop\\.io",
      "skool\\.com",
      "solo\\.to",
      "campsite\\.bio",
      "pensight",
      "link\\.in\\.bio",
      "bit\\.ly\\/",
      "tinyurl\\.",
      "cutt\\.ly\\/",
      "heylink\\.me\\/",
      "shopier\\.",
    ],
    weight: 3,
    description: "Link-hub / course-platform redirect infrastructure (weak context only).",
    flag: "external_link_funnel",
  },
  {
    id: "G2-ai-automation-income", category: "G", weight: 12,
    patterns: ["ai[\\s-]*(powered|automation|automated|store|trading|bot)", "yapay\\s*zeka.{0,30}(otomatik|bot|magaza|mağaza)", "done[\\s-]*for[\\s-]*you\\s*(store|ecommerce|business)"],
    requiredContext: "passive|income|profit|earn|gelir|kazanc|kazanç|kazan",
    description: "AI or done-for-you system paired with income claims.", flag: "ready_system",
  },
  {
    id: "A2-winrate-guarantee", category: "A", weight: 30,
    patterns: ["(100|99|98|95)\\s*%.{0,20}(win[\\s-]*rate|success|accuracy)", "(win[\\s-]*rate|success|accuracy).{0,20}(100|99|98|95)\\s*%", "%\\s*(100|99|98|95).{0,20}(basari|başarı|isabet)", "guaranteed\\s*(daily|monthly)\\s*(returns|profits)"],
    requiredContext: "signal|trad|forex|crypto|kripto|yatirim|yatırım|invest|profit|kazanc|kazanç",
    description: "Extreme trading accuracy or periodic return guarantee.", flag: "income_guarantee",
  },
  {
    id: "C2-double-money", category: "C", weight: 20,
    patterns: ["double\\s*your\\s*(money|investment)", "paran[iı]\\s*(ikiye|2.?ye)\\s*katla", "(2x|10x|100x).{0,25}(returns|profit|kazanc|kazanç|getiri)"],
    description: "Extreme investment multiplication promise.", flag: "fast_money",
  },
  {
    id:"N4-commerce",category:"N",weight:8,
    patterns:["ma[gğ]azam", "shop\\s*my", "my\\s*(shop|store)", "sat[iı][sş]\\s*linki"],
    description:"Explicit commercial storefront; not proof of deceptive claims.",flag:"commercial_redirect",
  },
  {
    id:"N5-affiliate",category:"N",weight:20,
    patterns:["affiliate\\s*(link|disclosure|partner)", "sat[iı][sş]\\s*ortakl[iı][gğ][iı]", "komisyon\\s*(kazan|al[iı]r|elde)", "[?&](aff_id|affiliate_id|ref|referral|refcode)="],
    description:"Disclosed affiliate or explicit referral identifier. Tracking alone is excluded.",flag:"affiliate_redirect",
  },
  {
    id:"N6-financial-affiliate",category:"N",weight:30,
    patterns:["affiliate\\s*(link|partner)", "sat[iı][sş]\\s*ortakl[iı][gğ][iı]", "[?&](aff_id|affiliate_id|ref|referral|refcode)="],
    requiredContext:"forex|kripto|crypto|broker|trading|yat[iı]r[iı]m|kald[iı]ra[cç]|leverage",
    description:"Financial product plus referral incentive warrants closer review.",flag:"financial_affiliate_redirect",
  },
];
