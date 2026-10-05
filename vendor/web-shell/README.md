# Vendored: SLU Web Shell

A fresh `tsc` build of [mikeylambo/Web-Game-Shell-v1.02](https://github.com/mikeylambo/Web-Game-Shell-v1.02) at commit `6f08d17` (package version 1.1.0).
Its 68 tests passed before vendoring (`node --test tests/*.test.mjs`).

It's vendored rather than installed because that repo is private (a Vercel build can't fetch it), and because its committed `dist/` is behind its `src/` (`platform/browser/InputFamilyDetector.js`, for example, is missing there).

Imported as `@slu/web-shell/...` through a Vite alias (`vite.config.js`).
In use: `ui-shell/DOMGameUI` (screens + keyboard/gamepad focus navigation), `input/InputManager` + `platform/browser/BrowserInputSource` (UI actions), `persistence/SaveManager` + `platform/browser/BrowserStorage` (versioned, checksummed saves with staging/backup recovery), and `platform/browser/InputFamilyDetector`.

To update: rebuild the shell (`npm run build` there), then replace this folder's contents with its `dist/`.
