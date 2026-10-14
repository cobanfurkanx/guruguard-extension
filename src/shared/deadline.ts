/** Cancel underlying I/O and stop waiting even if a dependency ignores abort. */
export function deadline(ms: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason ?? new DOMException("Deadline exceeded", "TimeoutError"));
  const timer = setTimeout(abort, ms);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  return { signal: controller.signal, dispose() { clearTimeout(timer); parent?.removeEventListener("abort", abort); } };
}
export function within<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return work(); }).then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export async function pause(ms: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
