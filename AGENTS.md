# Repository instructions

Use Node.js 24.13+ (24.x), `npm ci`, `npm test`, `npm run typecheck`, `npm run package` (Python 3).

Keep the extension standalone: no imports from private repositories. `src/shared` contains only browser-required modules. Keep rule/schema versions compatible with the service; source synchronization must use reviewed PRs.

Never include provider keys, signing keys, customer data, cookies, databases or recordings. Reject private Instagram routes and preserve ownership checks. Blocking requires user confirmation in Instagram; hiding is local and reversible. Missing data is not a clean result. AI never changes a deterministic score; demo credits do not call models or spend real credits.

Work on focused branches, test relevant behavior, inspect staged files and run a full-history secret scan before publication. Do not bypass protected-branch checks or deploy without authorization. Synthetic browser tests are not live Instagram validation.
