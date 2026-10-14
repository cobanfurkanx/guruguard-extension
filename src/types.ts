import type { ReviewResponse } from "./shared/review-contract";
export type LookupResult = ReviewResponse & { found: boolean; instagramUrl: string; reportCount: number };

export interface ApiError {
  error: string;
}

export interface BlockListSummary {
  id: string;
  name: string;
  isPublic: boolean;
  _count?: { items: number };
}

export interface BlockListItem {
  id: string;
  username: string;
  note?: string | null;
  blocked: boolean;
}

export type IncomingMessage =
  | { type: "LOOKUP"; username: string }
  | { type: "PAIR"; code: string }
  | { type: "UNPAIR" }
  | { type: "GET_PAIRED_USER" }
  | { type: "GET_LISTS" }
  | { type: "GET_ITEMS"; listId: string }
  | { type: "MARK_BLOCKED"; listId: string; itemId: string; blocked: boolean }
  | { type: "MARK_CURRENT_BLOCKED"; username: string }
  | { type: "OPEN_PROFILES"; usernames: string[] };

export type ScoreResponse = LookupResult | ApiError;

export const HIGH_RISK_THRESHOLD = 35;
