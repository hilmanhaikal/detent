# Security

## Report a problem

Please do not open a public issue for a security problem. Report it privately on GitHub: open the
repository's **Security** tab and choose **Report a vulnerability**. You will get an answer within a
few days.

## How detent is kept safe

- **No dependencies.** detent installs nothing else, so there is nothing else that can be hijacked.
- **No install scripts.** Installing detent runs no code on your machine.
- **Only the built code is published.** The package holds `dist/`, the README, the licence and
  `package.json`, nothing more.
- **A check before every publish** stops it if a dependency, an install script, an unexpected file or
  a sudden jump in size appears (`scripts/check-publish.mjs`).
- **Two-factor sign-in** guards every publish on npm and every change on GitHub.

## Supported versions

Fixes go into the latest version. Before 1.0, update to the newest release to get them.
