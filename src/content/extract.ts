import type { VisibleProfile } from "../shared/local-review";
const RESERVED = new Set(["explore", "reels", "reel", "p", "tv", "accounts", "direct", "stories", "about", "developer", "settings", "challenge", "notifications"]);
export function profileUsername(path: string): string | null {
  const name = path.match(/^\/([A-Za-z0-9._]{1,30})\/?$/)?.[1]?.toLowerCase();
  return name && !RESERVED.has(name) ? name : null;
}
const text = (el: Element | null) => (el as HTMLElement | null)?.innerText?.trim() || el?.textContent?.trim() || "";
export function extractProfile(doc: Document, path: string, owner: string, highlightIds: Set<string>): VisibleProfile | null {
  const name = profileUsername(path);
  if (name) {
    const main=doc.querySelector("main");
    const identityLink=[...main?.querySelectorAll<HTMLAnchorElement>('a[href]')??[]].find(a=>!a.closest("article")&&profileUsername(a.pathname)===name&&text(a).replace(/^@/,"").toLowerCase()===name);
    const header = doc.querySelector("main header") ?? identityLink?.closest("section");
    if (!header || header.querySelector('a[href*="/accounts/login"]') || doc.querySelector('a[href*="/accounts/private"]')) return null;
    // Do not upload private profiles or reuse a previous profile's content during SPA navigation.
    if (/this account is private|bu hesap gizli/i.test(text(doc.querySelector("main")))) return null;
    const identity = identityLink && header.contains(identityLink) ? name : header.querySelector("h1,h2")?.textContent?.trim().toLowerCase();
    if (identity && identity !== name && identity !== `@${name}`) return null;
    const items = [...doc.querySelectorAll<HTMLAnchorElement>('main a[href*="/stories/highlights/"]')];
    highlightIds.clear(); items.forEach(a => { const id = a.pathname.match(/highlights\/(\d+)/)?.[1]; if (id) highlightIds.add(id); });
    const links = [...header.querySelectorAll<HTMLAnchorElement>('a[href]')].flatMap(a => {
      try { const url = new URL(a.href); const external = url.hostname === "l.instagram.com" ? url.searchParams.get("u") : !/(^|\.)instagram\.com$/.test(url.hostname) ? url.href : null; return external && /^https?:\/\//.test(external) ? [external] : []; } catch { return []; }
    });
    return { username: name, biography: text(header), externalUrl: links.find(link=>{try{return new URL(link).hostname==="link.me";}catch{return false;}}) ?? links[0] ?? null, highlights: items.map(text).filter(Boolean), captions: ownedCaptions(doc, name) };
  }
  if (!owner || /^\/direct(?:\/|$)/.test(path)) return null;
  const highlight = path.match(/^\/stories\/highlights\/(\d+)/)?.[1];
  if (highlight && highlightIds.has(highlight)) {
    const dialog = [...doc.querySelectorAll('[role="dialog"]')].find(el => !el.id.startsWith("guruguard"));
    if (dialog) return { username: owner, biography: "", highlights: [text(dialog)] };
  }
  const post=path.match(/^\/(?:([A-Za-z0-9._]+)\/)?(?:p|reel)\//);
  if (post && (!post[1] || post[1].toLowerCase()===owner)) {
    const captions = ownedCaptions(doc, owner);
    if (captions.length) return { username: owner, biography: "", captions };
  }
  return null;
}
function ownedCaptions(doc: Document, owner: string): string[] {
  const articles=[...doc.querySelectorAll("article")].flatMap(article => {
    const author = article.querySelector<HTMLAnchorElement>('header a[href]');
    if (!author || profileUsername(author.pathname) !== owner) return [];
    return [...article.querySelectorAll("h1")].map(text).filter(Boolean);
  });
  // Current Instagram grids expose caption previews in image alt text.
  // Owner-qualified URLs exclude tagged/collaborator posts belonging to others.
  const grid=[...doc.querySelectorAll<HTMLAnchorElement>('main a[href]')].flatMap(a=>{
    const match=a.pathname.match(/^\/([A-Za-z0-9._]+)\/(?:p|reel)\/[^/]+\/?$/);
    if(match?.[1].toLowerCase()!==owner)return [];
    const caption=a.querySelector("img[alt]")?.getAttribute("alt")?.trim();
    if(!caption||/^(?:Photo by |May be an image |Image may contain|Fotoğraf:|Görselde |.* tarafından paylaşılan fotoğraf)/i.test(caption))return [];
    return [caption];
  });
  return [...new Set([...articles,...grid])].slice(0,12);
}
export function mergeVisible(a: VisibleProfile | null, b: VisibleProfile): VisibleProfile {
  if (!a || a.username !== b.username) return b;
  const link=b.externalUrl||a.externalUrl;
  return { username: b.username, biography: b.biography || a.biography, externalUrl:link, captions: [...new Set([...(a.captions ?? []), ...(b.captions ?? [])])].slice(0,12), highlights: [...new Set([...(a.highlights ?? []), ...(b.highlights ?? [])])].slice(0,20),...(link===a.externalUrl?{landingTexts:a.landingTexts,landingUrls:a.landingUrls}:{}) };
}
