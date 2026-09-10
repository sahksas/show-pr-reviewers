---
name: browser-extension-developer
description: Use this skill when developing or maintaining the Show PR Reviewers browser extension in this repository, including the content script, background service worker, options and popup pages, manifest, styles, or i18n messages.
---

# Browser Extension Developer

Chrome extension (Manifest V3, TypeScript, webpack) that adds a "Reviewers" column with requested-reviewer avatars to GitHub pull request list pages.

## Structure

```plaintext
src/
├── content_script.tsx   # Injects the header and reviewer cells into the PR list
├── background.ts        # Service worker: GitHub GraphQL fetch and chrome.storage.local cache
├── options.tsx          # Token settings page (React)
└── popup.tsx            # Status popup (React)
public/
├── manifest.json
├── content_script.css
├── options.html, popup.html
└── _locales/            # i18n (en, ja)
dist/                    # Build output; load this directory as an unpacked extension
```

## Commands

- `npx webpack --config webpack/webpack.prod.js` - Production build into `dist/`
- `npx webpack --config webpack/webpack.dev.js --watch` - Development build with watch
- `npx tsc --noEmit` - Type check

## GitHub DOM

GitHub serves two PR list DOMs, and `src/content_script.tsx` supports both through `SELECTORS`:

- Classic Primer DOM: rows are `.js-issue-row`, reviewer cells go into the `.col-4.col-md-3` right section, and the header goes before the `Sort` details menu.
- React ListView DOM: rows are `[data-listview-component="items-list"] > li`, and a "Review requested" label with the avatar stack is appended to the `Description-module__container` line under the title. This DOM has no header, and the metadata columns on the right are left to GitHub because their layout differs between the comfortable and compact densities.

Match React ListView elements by `data-*` attributes, `aria-label`, or the stable prefix of CSS module class names, because the hash suffix changes with each GitHub deployment. When GitHub changes the DOM, keep the selectors for every DOM that GitHub still serves.

## i18n

Supported locales: en, ja. When adding a message key, add it to every `public/_locales/*/messages.json`.

## Verification

Load `dist/` into Chromium and check the PR list page in a real browser for both DOM variants before reporting completion.
