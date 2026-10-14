import type { ProfileCheck } from "./pipeline";
import { presentation } from "./presentation";

export const reviewStyles = `
:host{color-scheme:light;--gg-ink:#262626;--gg-muted:#666;--gg-line:#dbdbdb;--gg-bg:#fff;--gg-soft:#fafafa;--gg-red:#b51c32;--gg-blue:#0064a6;display:block;color:var(--gg-ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}.gg-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.gg-brand{font-weight:750;font-size:17px;letter-spacing:-.03em}.gg-close{border:0;background:none;min-height:32px;padding:4px;color:var(--gg-muted)}.gg-close svg{width:20px;height:20px}
.gg-view{overflow-wrap:anywhere}.gg-identity{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 12px}.gg-identity h2{font-size:16px;margin:0;letter-spacing:-.02em}.gg-score{white-space:nowrap;font-size:14px;font-weight:650;font-variant-numeric:tabular-nums;color:var(--gg-muted)}.gg-score small{font-size:11px;font-weight:400}
.gg-title{margin:0 0 14px;font-size:22px;line-height:1.15;font-weight:700;letter-spacing:-.025em}.gg-danger .gg-title{color:var(--gg-red)}.gg-caution .gg-title,.gg-listed .gg-title{color:#814900}
.gg-note{font-size:12px;color:var(--gg-muted);margin:8px 0}.gg-evidence{border-top:1px solid var(--gg-line);padding:12px 0;margin:14px 0}.gg-evidence summary{cursor:pointer;font-size:13px;font-weight:600}.gg-evidence p{font-size:13px;margin:10px 0}.gg-evidence blockquote{margin:10px 0;padding:10px 12px;background:var(--gg-soft);font-size:13px;border-radius:6px}.gg-evidence small{display:block;color:var(--gg-muted);font-size:11px;margin-top:4px}.gg-evidence a{color:var(--gg-blue);font-weight:600;font-size:13px;text-underline-offset:3px}
.gg-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0 4px}.gg-button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:10px 12px;border:1px solid var(--gg-line);border-radius:8px;background:var(--gg-bg);color:var(--gg-ink);font:600 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-decoration:none;cursor:pointer}.gg-primary{color:#fff;background:#262626;border-color:#262626}.gg-danger .gg-primary,.gg-listed .gg-primary{background:var(--gg-red);border-color:var(--gg-red)}.gg-button:hover{filter:brightness(.94)}.gg-button:active{transform:translateY(1px)}.gg-button:disabled{opacity:.5;cursor:wait}.gg-button svg{width:16px;height:16px;flex-shrink:0}.gg-minor{display:flex;align-items:center;gap:16px;margin-top:14px}.gg-link{display:flex;align-items:center;min-height:32px;padding:4px 0;border:0;background:none;font:inherit;font-size:12px;font-weight:600;line-height:1.4;color:var(--gg-blue);cursor:pointer;text-decoration:none}.gg-link:hover{text-decoration:underline;text-underline-offset:3px}
.gg-suggest{display:grid;gap:8px;margin-top:14px}.gg-suggest label{font-size:12px;font-weight:600}.gg-suggest textarea{width:100%;min-height:80px;resize:vertical;border:1px solid var(--gg-line);border-radius:6px;padding:10px;background:var(--gg-bg);color:var(--gg-ink);font:inherit;font-size:13px;line-height:1.5}.gg-status:empty{display:none}.gg-status{font-size:12px;color:var(--gg-muted);margin:8px 0;min-height:16px}button:focus-visible,a:focus-visible,summary:focus-visible,textarea:focus-visible{outline:2px solid var(--gg-blue);outline-offset:3px}[hidden]{display:none!important}::selection{background:#d9ecfa;color:#262626}
@media(prefers-reduced-motion:reduce){.gg-button:active{transform:none}}
`;

const blockIcon = '<circle cx="12" cy="12" r="8"/><path d="m6.3 6.3 11.4 11.4"/>';
const hideIcon = '<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.4C15 3.5 19 7 22 12a19 19 0 0 1-3.4 4.2M6 6C4 7.5 2.7 9.6 2 12c3 5 7 8.5 13 7"/>';
export function icon(paths: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.8");svg.setAttribute("aria-hidden","true");svg.innerHTML=paths;
  return svg;
}
export function createReviewView(check:ProfileCheck, actions:{block:()=>Promise<void>; hide:()=>Promise<void>; suggest:(username:string,reason:string)=>Promise<{accepted?:boolean;error?:string;reason?:string;status?:number}>; hidden?:boolean}) {
  const {review:r,community,ai}=check;
  const state=presentation(check),root=document.createElement("section");root.className=`gg-view gg-${state.tone}`;
  const element=(tag:string,value:string,parent:HTMLElement=root,cls="")=>{const el=document.createElement(tag);el.textContent=value;el.className=cls;parent.append(el);return el;};
  const heading=element("div","",root,"gg-identity");element("h2",`@${r.username}`,heading);
  if(!community && r.reviewPriority!==null && !r.stale)element("span",`${r.reviewPriority}/100`,heading,"gg-score").title="Claim warning score. Not fraud probability.";
  element("p",state.title,root,"gg-title");
  if(r.pending)element("p","Try again in a moment.",root,"gg-note");
  if(r.reviewPriority===null&&!community)element("p","This profile has not been cleared.",root,"gg-note");
  if(community||r.evidence.length||r.ambiguous.length||ai?.explanation){
    const details=element("details","",root,"gg-evidence");element("summary",community?"Why it’s listed":"See the claims",details);
    if(community){element("p",community.reason,details);const source=element("a","View discussions",details) as HTMLAnchorElement;source.href=`https://guruguard.shepardai.pro/?account=${encodeURIComponent(r.username)}#community-list`;source.target="_blank";source.rel="noopener";element("small","Community reports. Not a fraud finding.",details);}
    for(const evidence of r.evidence.slice(0,3)){const quote=element("blockquote",evidence.quote,details);element("small",evidence.field.replace(/^biography$/,"Bio").replace(/^caption\[(\d+)\]$/,"Post $1").replace(/^landing\[(\d+)\]$/,"Bio link $1"),quote);}
    if(r.ambiguous.length)element("p","Some wording may be a quote or warning. Read it in context.",details);
    if(ai?.available&&ai.explanation)element("p",ai.explanation,details);
    if(!community)element("small",`${r.source==="instagram_visible"?"Visible content only":r.source==="manual"?"Your input only":"Saved profile check"}${r.coverage.fields.includes("landing_pages")?" · Bio links included":""}. Warning score, not fraud probability.`,details);
  }
  const row=element("div","",root,"gg-actions"),status=element("p","",root,"gg-status");status.setAttribute("role","status");
  function button(label:string,cls:string,action:()=>Promise<void>,drawing:string){const btn=element("button","",row,`gg-button ${cls}`) as HTMLButtonElement;btn.type="button";btn.append(icon(drawing),document.createTextNode(label));btn.onclick=()=>{btn.disabled=true;void action().catch(error=>{status.textContent=error instanceof Error?error.message:"Try again.";}).finally(()=>{btn.disabled=false;});};return btn;}
  button("Block","gg-primary",actions.block,blockIcon);
  button(actions.hidden?"Unhide":"Hide", "",actions.hide,hideIcon).title="Hide this account in this browser";
  const minor=element("div","",root,"gg-minor");const open=element("a","Open profile",minor,"gg-link") as HTMLAnchorElement;open.href=`https://www.instagram.com/${encodeURIComponent(r.username)}/`;open.target="_blank";open.rel="noopener";
  const report=element("button","Add to list",minor,"gg-link") as HTMLButtonElement;report.type="button";
  const form=element("form","",root,"gg-suggest") as HTMLFormElement;form.hidden=true;
  const label=element("label","Why should this account be reviewed?",form);const reason=element("textarea","",form) as HTMLTextAreaElement;reason.id=`gg-reason-${r.username}`;label.setAttribute("for",reason.id);reason.minLength=10;reason.maxLength=700;reason.required=true;reason.placeholder="Describe the claim or your experience.";
  const submit=element("button","Submit account",form,"gg-button gg-primary") as HTMLButtonElement;submit.type="submit";
  report.onclick=()=>{form.hidden=!form.hidden;report.setAttribute("aria-expanded",String(!form.hidden));if(!form.hidden)reason.focus();};report.setAttribute("aria-expanded","false");
  form.onsubmit=event=>{event.preventDefault();submit.disabled=true;void actions.suggest(r.username,reason.value.trim()).then(reply=>{if(reply.accepted){form.hidden=true;status.textContent="Submitted for review.";report.hidden=true;}else status.textContent=reply.status===409?"Already on the list.":reply.status===429?"Daily limit reached. Try tomorrow.":reply.error??"Could not submit. Try again.";}).catch(()=>{status.textContent="Could not submit. Try again.";}).finally(()=>{submit.disabled=false;});};
  return root;
}
