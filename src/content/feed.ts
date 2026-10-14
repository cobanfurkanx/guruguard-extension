import { profileUsername } from "./extract";

/** Hide only owner-labelled feed articles selected by this user. Never read captions or messages. */
export function createFeedFilter(doc: Document) {
  const changed = new Map<HTMLElement, {display:string;priority:string}>();
  return {
    apply(path: string, names: readonly string[]) {
      const allowed = path === "/" || /^\/reels\/?$/.test(path);
      const hidden = new Set(names);
      for (const [article, original] of changed) {
        const author = article.querySelector<HTMLAnchorElement>("header a[href]");
        if (!allowed || !article.isConnected || !author || !hidden.has(profileUsername(author.pathname) ?? "")) {
          if (article.style.getPropertyValue("display") === "none" && article.style.getPropertyPriority("display") === "important") {
            if (original.display) article.style.setProperty("display", original.display, original.priority);
            else article.style.removeProperty("display");
          }
          changed.delete(article);
        }
      }
      if (!allowed || !hidden.size) return;
      for (const article of doc.querySelectorAll<HTMLElement>("main article")) {
        const author = article.querySelector<HTMLAnchorElement>("header a[href]");
        if (author && hidden.has(profileUsername(author.pathname) ?? "") && !changed.has(article)) {
          changed.set(article, {display:article.style.getPropertyValue("display"),priority:article.style.getPropertyPriority("display")});
          article.style.setProperty("display", "none", "important");
        }
      }
    },
  };
}
