import { runRulesEngine, type EngineInput } from "./rules/engine";
import { RULES_VERSION } from "./rules/rules.v1";
import type { ReviewResponse } from "./review-contract";

export interface VisibleProfile {
  username: string;
  biography: string;
  externalUrl?: string | null;
  captions?: string[];
  highlights?: string[];
  landingTexts?: string[];
  landingUrls?: string[];
  ocrTexts?: string[];
  transcript?: string;
}

/** Visible text is ephemeral. No network, storage, or model calls. */
export function reviewVisibleProfile(input: VisibleProfile, source = "manual"): ReviewResponse {
  const highlights = input.highlights ?? [];
  const captions = input.captions ?? [];
  const engineInput: EngineInput = {
    username: input.username, profileUrl: `https://www.instagram.com/${input.username}/`,
    biography: input.biography, externalUrl: input.externalUrl ?? null,
    biographyLinks: [], captions, highlights, landingTexts:input.landingTexts, ocrTexts:input.ocrTexts, transcript:input.transcript,
    followerCount: null, followingCount: null, isVerified: null,
  };
  const result = runRulesEngine(engineInput);
  const present = Boolean(input.biography.trim() || input.externalUrl || highlights.some(x => x.trim()) || captions.some(x => x.trim()) || input.landingTexts?.some(x=>x.trim()) || input.ocrTexts?.some(x=>x.trim()) || input.transcript?.trim());
  const sampled = result.coverage.captionsAnalyzed>=3 && !result.coverage.truncated;
  const insufficient = !present || (result.ruleScore===0 && !result.ambiguous.length && !sampled);
  const analyzedAt = present ? new Date().toISOString() : null;
  const reviewPriority = insufficient ? null : result.ruleScore;
  return {
    schemaVersion: 2, username: input.username, reviewPriority,
    status: insufficient ? "insufficient_data" : result.ambiguous.length ? "needs_review" : "completed",
    source, evidence: result.evidence.map(e=>{
      const index=e.field.match(/^landing\[(\d+)\]$/)?.[1];
      const sourceUrl=index!==undefined?input.landingUrls?.[Number(index)]:undefined;
      return sourceUrl?{...e,sourceUrl}:e;
    }),
    ambiguous: result.ambiguous,
    assessmentScope:sampled ? "sampled" : "limited",
    coverage: { ...result.coverage, missing: [...result.coverage.missing, ...(highlights.length ? [] : ["highlights"]), ...(input.landingTexts?.length ? [] : ["landing_pages"])] },
    analyzedAt, fetchedAt: analyzedAt, expiresAt: analyzedAt ? new Date(Date.parse(analyzedAt) + 86400000).toISOString() : null,
    servedFromCache: false, stale: false,
    summary: insufficient ? "İçerik kapsamı yetersiz. Gönderi veya öne çıkan içeriklerini açarak incelemeyi genişletin." : `Şüpheli söylem puanı: ${reviewPriority}/100. Bu puan dolandırıcılık olasılığı değildir.`,
    model: "rules", analysisMethod: "rules", flags: result.flags, tactics: result.tactics,
    matchedCategories: result.matchedCategories, signals: result.signals,
    rulesVersion: RULES_VERSION, promptVersion: "v4", modelVersion: "off",
  };
}

export function shouldShowBlockReview(result: ReviewResponse): boolean {
  if (["failed","insufficient_data"].includes(result.status) || result.reviewPriority === null) return false;
  const categories = new Set(result.evidence.map(e => e.category));
  const claim=["A","B","C","D","G"].some(c=>categories.has(c));
  const selling=["I","J","K","N"].some(c=>categories.has(c));
  return claim && (result.reviewPriority>=35 || (result.reviewPriority>=20 && selling));
}
