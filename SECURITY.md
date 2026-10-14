# Security policy

Report privately through GitHub Security → Report a vulnerability, or support@shepardai.pro. Include synthetic reproduction steps and affected version. Never post credentials or personal data publicly.

The default branch is maintained. Provider secrets remain server-side and are not needed to build the extension. CI scans Git history with Gitleaks; a clean result is not a complete security audit. Revoke exposed keys immediately.

The active worker is `src/background/local-worker.ts`, selected by manifest.json. The older service-worker/panel/API helpers remain source history within this extraction but are not selected by the current manifest. Review permissions and active entry points when auditing runtime access.
