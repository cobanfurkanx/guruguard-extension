import { parseReviewResponse, type ReviewResponse } from "../shared/review-contract";
import type { BlockListItem, BlockListSummary, LookupResult } from "../types";

// Geliştirmede localhost, yayında https://cobanfurkan.dev/guruguard gibi
// gerçek adres yazılır (sonradan options sayfasına taşınabilir).
export const API_BASE = "https://guruguard.shepardai.pro";

const TOKEN_KEY = "gg_token";
const USER_KEY = "gg_user";

export async function getToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  const token = stored[TOKEN_KEY];
  return typeof token === "string" && token.length > 0 ? token : null;
}

export async function getPairedUser(): Promise<{ email: string } | null> {
  const stored = await chrome.storage.local.get(USER_KEY);
  const user = stored[USER_KEY] as { email?: string } | undefined;
  return user?.email ? { email: user.email } : null;
}

async function authed(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error("Extension not paired — enter the pairing code first.");
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

export async function lookupScore(username: string): Promise<LookupResult> {
  const url = `${API_BASE}/api/v1/scores/lookup?username=${encodeURIComponent(
    username,
  )}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-GuruGuard-Version": "2" },
    signal: AbortSignal.timeout(22000),
  });
  if (!res.ok) {
    throw new Error(res.status === 426 ? "Update the GuruGuard extension." : `GuruGuard lookup failed: ${res.status}`);
  }
  const data = await res.json();
  return { ...parseReviewResponse(data), found: data.found === true, instagramUrl: profileUrl(username), reportCount: typeof data.reportCount === "number" ? data.reportCount : 0 };
}

export type LiveAnalysis = ReviewResponse;

/**
 * DB'de olmayan kullanıcılar için canlı analiz (herkese açık endpoint,
 * kimlik gerekmez). Bilinen profillerde önce lookup kullanılır; bu çağrı
 * 10 sn ile birkaç dakika sürebilir (canlı kazıma + AI).
 */
export async function analyzeUsername(username: string): Promise<LiveAnalysis> {
  const url = `${API_BASE}/api/check?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", "X-GuruGuard-Version": "2" },
    signal: AbortSignal.timeout(22000),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? `Analysis failed: ${res.status}`);
  }
  return parseReviewResponse(await res.json());
}

export async function pairWithCode(code: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/auth/exchange-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ code: code.trim() }),
  });
  const data = (await res.json()) as {
    token?: string;
    error?: string;
    user?: { email: string };
  };
  if (!res.ok || !data.token) {
    throw new Error(data.error ?? "Pairing failed");
  }
  await chrome.storage.local.set({
    [TOKEN_KEY]: data.token,
    [USER_KEY]: data.user ?? null,
  });
  return data.user?.email ?? "";
}

export async function unpair(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
}

export async function getLists(): Promise<BlockListSummary[]> {
  const res = await authed("/api/lists");
  const data = (await res.json()) as {
    lists?: BlockListSummary[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Could not load lists");
  return data.lists ?? [];
}

export async function getItems(listId: string): Promise<BlockListItem[]> {
  const res = await authed(`/api/lists/${encodeURIComponent(listId)}/items`);
  const data = (await res.json()) as {
    list?: { items?: BlockListItem[] };
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Could not load items");
  return data.list?.items ?? [];
}

export async function markBlocked(
  listId: string,
  itemId: string,
  blocked: boolean,
): Promise<void> {
  const res = await authed(`/api/lists/${encodeURIComponent(listId)}/items`, {
    method: "PATCH",
    body: JSON.stringify({ itemId, blocked }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(data?.error ?? "Marking failed");
  }
}

export function profileUrl(username: string): string {
  return `https://www.instagram.com/${username.replace(/^@/, "")}/`;
}
