const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
async function waitFor(find: () => HTMLElement | undefined, milliseconds: number): Promise<HTMLElement | undefined> {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { const found = find(); if (found) return found; await new Promise(resolve => setTimeout(resolve, 150)); }
  return undefined;
}
/** Open only the native confirmation. Never click its final Block button. */
export async function openBlockConfirmation(): Promise<boolean> {
  const more = await waitFor(() => Array.from(document.querySelectorAll<HTMLElement>('main header button, main header [role="button"], main [aria-label="Options"], main [aria-label="Seçenekler"]')).map(el => el.closest<HTMLElement>('button, [role="button"]') ?? el).find(el => visible(el) && /^(options|more options|seçenekler|daha fazla seçenek)$/i.test(el.getAttribute("aria-label") ?? el.querySelector("svg")?.getAttribute("aria-label") ?? "")), 5000);
  if (!more) return false;
  more.click();
  const block = await waitFor(() => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] [role="button"], [role="menuitem"]')).find(el => visible(el) && /^(block|engelle)$/i.test(el.innerText.trim())), 2500);
  if (!block) return false;
  block.click();
  // Stop here even if another button named Block appears in the confirmation.
  return true;
}
