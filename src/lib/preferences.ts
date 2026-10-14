export const PREFERENCES_KEY = "gg_profile_preferences";
export interface Preferences { hidden: string[]; }
export function parsePreferences(value: unknown): Preferences {
  const raw = value as Partial<Preferences> | null;
  return { hidden: [...new Set(Array.isArray(raw?.hidden) ? raw.hidden.filter(name => typeof name === "string" && /^[a-z0-9._]{1,30}$/.test(name)) : [])].slice(0, 500) };
}
export function updateHidden(value: unknown, username: string, hidden: boolean): Preferences {
  if (!/^[a-z0-9._]{1,30}$/.test(username)) throw new Error("Invalid username");
  const prefs = parsePreferences(value);
  prefs.hidden = prefs.hidden.filter(name => name !== username);
  if (hidden) {
    if (prefs.hidden.length >= 500) throw new Error("Hidden list is full. Remove an account first.");
    prefs.hidden.push(username);
  }
  return prefs;
}
