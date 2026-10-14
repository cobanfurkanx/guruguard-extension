# GuruGuard extension

[Website](https://guruguard.shepardai.pro) · [Privacy](https://guruguard.shepardai.pro/privacy.html) · [Terms](https://guruguard.shepardai.pro/terms.html)

Public source for GuruGuard's Chrome Manifest V3 extension. Checks visible public Instagram profile text, presents source-backed concerns and helps you block or hide unwanted accounts.

## Install

Download the extension from the GuruGuard website, unzip it, then open Chrome → Extensions → Developer mode → Load unpacked. Select the extracted folder. Enable automatic protection once in the popup and reload Instagram.

Alternatively build this repository and load its `dist` folder.

## Build and verify

Node.js 24.13+ (24.x), npm and Python 3:

```sh
npm ci
npm test
npm run typecheck
npm run package
```

The generated ZIP contains built extension files, without source maps. No server credentials or private repository access are needed. CI runs these same checks and a full-history secret scan.

## What it accesses

- Required permissions: `activeTab`, `scripting`, `storage`, plus the GuruGuard API host.
- Optional permission: Instagram. Grant it to check profiles as you browse.
- Reads visible public profile text and author-owned opened captions/highlights. Unopened or unavailable content is excluded.
- Excludes inbox, login/account settings and private-profile checks. Does not request cookie access or read your Instagram password.
- A lookup sends the username to GuruGuard. Bio-link inspection sends the link and username. Explicit contributions/suggestions send the text you choose to submit.
- Optional eligible AI checks send selected text through GuruGuard; AI credits currently remain a labelled demo with model calls, purchases and account connection paused.
- Hiding stores selected usernames locally and is reversible. Blocking opens Instagram's controls; you confirm the final action.

Details and retention are described in the linked privacy policy. This is not a guarantee of fraud detection. A score is review priority in available content, not fraud probability. Community opinions remain separate from scoring.

## Source boundary

`src/background`, `src/content`, `src/popup` and `src/lib` contain the extension. `src/shared` contains only the client contracts, normalization, local rules and request helpers required to build it. Server collection, databases, billing implementation, private datasets and credentials are not included.

Browser-local rules are distributed to users and are intentionally public here. This repository is a standalone extraction of extension 1.1.1; the original application repository is private. Maintainers must keep shared contract/rule versions and extension releases aligned with the service, using reviewed changes in both repositories.

Tests use synthetic Instagram markup and mocked Chrome APIs. They verify privacy boundaries, navigation, review controls, quotas-free mock credits and deterministic false positives. They do not claim live installed-extension or native mobile validation.

MIT license. Not affiliated with Instagram or Meta. Support: [support@shepardai.pro](mailto:support@shepardai.pro).
