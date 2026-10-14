import { priorityLevel } from "../shared/review-contract";
import type { LiveAnalysis } from "../lib/api";
import { analyzeUsername } from "../lib/api";
import type { LookupResult } from "../types";

// Instagram profil sayfasındaki GuruGuard asist paneli.
// Durumlar: analyzing (DB bakılıyor) → found (skor) / unknown (analiz düğmesi)
// → analyzing (canlı tarama) → live result.
// YASAL SINIR: eklenti Instagram'da otomatik tıklama/engelleme YAPMAZ.
// Engelleme her zaman kullanıcının kendi eliyle, Instagram'ın
// kendi arayüzünde yaptığı dokunuşlardır.
const PANEL_ID_PREFIX = "gg-panel-";

const FLAG_LABELS: Record<string, string> = {
  telegram_funnel: "Telegram/WhatsApp funnel",
  external_link_funnel: "Redirect link",
  passive_income_claims: "Passive income claim",
  dm_funnel: "DM funnel",
  young_rich_claims: "Young-rich claim",
  crypto_forex_signals: "Forex/crypto signals",
  course_selling: "Course selling",
  matrix_language: "Matrix language",
  luxury_lifestyle: "Luxury display",
  get_rich_claims: "Get-rich-quick claim",
  follow_ratio_suspicious: "Suspicious follow ratio",
  username_digit_stuffing: "Digit-stuffed username",
  discord_funnel: "Discord funnel",
  day_trading: "Day-trading claims",
};

const MESSAGES = ["Reviewing available text…", "Waiting for analysis…"];

function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

function shell(): HTMLDivElement {
  return el("div", {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "2147483647",
    width: "300px",
    background: "#0f1422",
    color: "#e2e8f0",
    borderRadius: "12px",
    border: "1px solid #334155",
    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    lineHeight: "1.45",
    overflow: "hidden",
  });
}

function header(text: string, red: boolean): HTMLDivElement {
  return el(
    "div",
    {
      background: red ? "#ef4444" : "#1d4ed8",
      color: "#fff",
      padding: "8px 12px",
      fontWeight: "800",
    },
    text,
  );
}

function renderAnalyzing(
  panel: HTMLDivElement,
  username: string,
  note: string,
): () => void {
  panel.innerHTML = "";
  panel.appendChild(header(`🔍 GuruGuard: analyzing @${username}`, false));
  const body = el("div", { padding: "12px", textAlign: "center" });
  const lens = el(
    "div",
    { fontSize: "40px", animation: "ggpulse 1.4s ease-in-out infinite" },
    "🔍",
  );
  const msg = el(
    "p",
    { margin: "8px 0 0 0", color: "#fbbf24", fontSize: "12px" },
    MESSAGES[0],
  );
  const sub = el(
    "p",
    { margin: "6px 0 0 0", color: "#94a3b8", fontSize: "11px" },
    note,
  );
  body.appendChild(lens);
  body.appendChild(msg);
  body.appendChild(sub);
  panel.appendChild(body);

  let i = 0;
  const timer = window.setInterval(() => {
    i = (i + 1) % MESSAGES.length;
    msg.textContent = MESSAGES[i];
  }, 1700);
  return () => window.clearInterval(timer);
}

function renderResult(
  panel: HTMLDivElement,
  username: string,
  score: number | null,
  level: string,
  summary: string,
  flags: string[],
  source: string,
  listName: string | null,
  details: LiveAnalysis,
): void {
  panel.innerHTML = "";
  const high = score !== null && score >= 35;
  panel.appendChild(
    header(score === null ? "Değerlendirme yapılamadı" : `GuruGuard: review priority ${score}/100`, high),
  );
  const body = el("div", { padding: "10px 12px" });
  body.appendChild(
    el("p", { margin: "0 0 8px 0" }, summary || "No summary available."),
  );

  const flagWrap = el("div", {});
  for (const f of flags.slice(0, 6)) {
    flagWrap.appendChild(
      el(
        "span",
        {
          display: "inline-block",
          background: "#3b1116",
          color: "#fca5a5",
          borderRadius: "999px",
          padding: "2px 8px",
          margin: "0 4px 4px 0",
          fontSize: "11px",
        },
        flagLabel(f),
      ),
    );
  }
  body.appendChild(flagWrap);
  body.appendChild(
    el(
      "p",
      { margin: "6px 0", fontSize: "11px", color: "#94a3b8" },
      `Level: ${level} · Source: ${source}`,
    ),
  );

  body.appendChild(el("p", { fontSize: "11px" }, "Status: " + details.status + " · Missing: " + (details.coverage.missing.join(", ") || "none") + (details.stale ? " · Stale" : "")));
  for (const ev of details.evidence.slice(0, 3)) body.appendChild(el("p", { fontSize: "11px" }, ev.field + ": " + ev.quote));
  body.appendChild(el("p", { fontSize: "11px" }, "Review priority is not a fraud probability."));
  const steps = el(
    "ol",
    { margin: "8px 0", paddingLeft: "18px", color: "#cbd5e1", fontSize: "12px" },
  );
  for (const t of [
    "Tap the ••• menu on the profile",
    "Choose “Block” and confirm",
    "Use “Marked blocked ✓” below to update your list",
  ]) {
    const li = document.createElement("li");
    li.textContent = t;
    steps.appendChild(li);
  }
  body.appendChild(steps);

  const btnRow = el("div", { display: "flex", gap: "8px", marginTop: "8px" });
  const blockedBtn = el(
    "button",
    {
      flex: "1",
      border: "1px solid #475569",
      background: "#1e293b",
      color: "#e2e8f0",
      borderRadius: "8px",
      padding: "6px 0",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "700",
    },
    listName ? "Marked blocked ✓" : "Mark blocked ✓",
  );
  blockedBtn.addEventListener("click", () => {
    void chrome.runtime
      .sendMessage({ type: "MARK_CURRENT_BLOCKED", username })
      .then((r: unknown) => {
        const ok = (r as { ok?: boolean }).ok === true;
        blockedBtn.textContent = ok ? "Saved ✓" : "Pair extension first";
        if (ok) blockedBtn.style.borderColor = "#22c55e";
      })
      .catch(() => {
        blockedBtn.textContent = "Pair extension first";
      });
  });
  btnRow.appendChild(blockedBtn);
  body.appendChild(btnRow);
  body.appendChild(
    el(
      "p",
      { margin: "8px 0 0 0", fontSize: "11px", color: "#94a3b8" },
      "GuruGuard never auto-blocks — the decision and taps are yours.",
    ),
  );
  panel.appendChild(body);
}

function renderUnknown(
  panel: HTMLDivElement,
  username: string,
  onAnalyze: () => void,
): void {
  panel.innerHTML = "";
  panel.appendChild(header(`GuruGuard: @${username}`, false));
  const body = el("div", { padding: "10px 12px" });
  body.appendChild(
    el(
      "p",
      { margin: "0 0 8px 0", fontSize: "12px", color: "#cbd5e1" },
      "No current shared analysis. Review available text (up to 20 seconds).",
    ),
  );
  const btn = el(
    "button",
    {
      width: "100%",
      border: "none",
      background: "#1d57f5",
      color: "#fff",
      borderRadius: "8px",
      padding: "8px 0",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "700",
    },
    "Analyze this profile",
  );
  btn.addEventListener("click", onAnalyze);
  body.appendChild(btn);
  panel.appendChild(body);
}

function ensureKeyframes(): void {
  if (document.getElementById("gg-keyframes")) return;
  const style = document.createElement("style");
  style.id = "gg-keyframes";
  style.textContent =
    "@keyframes ggpulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.25);opacity:1}}";
  document.head.appendChild(style);
}

export function mountPanel(
  username: string,
  lookup: () => Promise<LookupResult | null>,
): void {
  ensureKeyframes();
  const panelId = `${PANEL_ID_PREFIX}${username}`;
  if (document.getElementById(panelId)) return;
  const panel = shell();
  panel.id = panelId;
  document.body.appendChild(panel);

  const stopTop = renderAnalyzing(panel, username, "Checking community database…");
  void lookup()
    .then((data) => {
      stopTop();
      if (data && data.found) {
        const score = data.reviewPriority;
        renderResult(
          panel,
          username,
          score,
          priorityLevel(score) ?? "unassessed",
          data.summary,
          data.flags ?? [],
          data.source + (data.servedFromCache ? " (cached)" : ""),
          null,
          data,
        );
      } else {
        renderUnknown(panel, username, () => runAnalyze(panel, username));
      }
    })
    .catch((e: unknown) => {
      stopTop();
      panel.textContent = e instanceof Error ? e.message : "Unable to load analysis";
    });
}

function runAnalyze(panel: HTMLDivElement, username: string): void {
  const stop = renderAnalyzing(
    panel,
    username,
    "Live scraping + AI — keep this tab open…",
  );
  analyzeUsername(username)
    .then((live: LiveAnalysis) => {
      stop();
      renderResult(
        panel,
        username,
        live.reviewPriority,
        priorityLevel(live.reviewPriority) ?? "unassessed",
        live.summary,
        live.flags,
        live.source,
        null,
        live,
      );
    })
    .catch((e: unknown) => {
      stop();
      renderUnknown(panel, username, () => runAnalyze(panel, username));
      panel.appendChild(
        el(
          "p",
          { fontSize: "12px", color: "#f87171" },
          `Analysis failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    });
}
