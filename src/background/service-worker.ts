import {
  getItems,
  getLists,
  lookupScore,
  markBlocked,
  pairWithCode,
  profileUrl,
  unpair,
  getPairedUser,
} from "../lib/api";
import type { IncomingMessage } from "../types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: unknown; ts: number }>();

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data as T;
  return null;
}

function store(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: unknown) => void) => {
    const msg = message as IncomingMessage;
    void (async () => {
      try {
        switch (msg.type) {
          case "LOOKUP": {
            const key = `lookup:${msg.username.toLowerCase()}`;
            const hit = cached(key);
            if (hit) {
              sendResponse(hit);
              return;
            }
            const data = await lookupScore(msg.username);
            store(key, data);
            sendResponse(data);
            return;
          }
          case "PAIR": {
            const email = await pairWithCode(msg.code);
            sendResponse({ ok: true, email });
            return;
          }
          case "UNPAIR": {
            await unpair();
            sendResponse({ ok: true });
            return;
          }
          case "GET_PAIRED_USER": {
            sendResponse({ user: await getPairedUser() });
            return;
          }
          case "GET_LISTS": {
            sendResponse({ lists: await getLists() });
            return;
          }
          case "GET_ITEMS": {
            sendResponse({ items: await getItems(msg.listId) });
            return;
          }
          case "MARK_BLOCKED": {
            await markBlocked(msg.listId, msg.itemId, msg.blocked);
            sendResponse({ ok: true });
            return;
          }
          case "MARK_CURRENT_BLOCKED": {
            // İçerik panelindeki "Engelledim ✓": kullanıcının listelerinde
            // bu username'i bul, ilk eşleşmeyi engellendi işaretle.
            const target = msg.username.toLowerCase();
            const lists = await getLists();
            for (const list of lists) {
              const items = await getItems(list.id);
              const match = items.find(
                (i) => i.username.toLowerCase() === target && !i.blocked,
              );
              if (match) {
                await markBlocked(list.id, match.id, true);
                sendResponse({ ok: true, list: list.name });
                return;
              }
            }
            sendResponse({ error: "This account was not found in your lists" });
            return;
          }
          case "OPEN_PROFILES": {
            // Toplu akış: her profil ayrı sekmede açılır, engelleme
            // kararı her sekmede kullanıcıya aittir (manuel, yasal).
            for (const username of msg.usernames.slice(0, 20)) {
              await chrome.tabs.create({
                url: profileUrl(username),
                active: false,
              });
            }
            sendResponse({ ok: true, opened: Math.min(msg.usernames.length, 20) });
            return;
          }
          default:
            sendResponse({ error: "Unknown message" });
        }
      } catch (err: unknown) {
        sendResponse({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true; // async sendResponse
  },
);
