# URLy

A minimal browser extension for moving URLs in and out of your tabs.

- **Copy**: copy the URLs of the tabs in the current window, all windows, or only the tabs you have selected, as plain URLs or Markdown links. Internal pages (`chrome://`, `about:` and so on) and duplicates are skipped.
- **Open**: paste any text and URLy finds the links in it and opens them as background tabs. It asks before opening more than 20.

Press `Alt+Shift+U` to open the popup. Pressing `Ctrl+V` anywhere in the popup switches to Open mode with the pasted text. In the text box, `Ctrl+Enter` opens the links.

Supports Chrome, Edge and Firefox (Manifest V3).

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev            # Chrome with live reload
pnpm dev:firefox    # Firefox with live reload
```

| Command                                           | Purpose                                          |
| ------------------------------------------------- | ------------------------------------------------ |
| `pnpm check`                                      | Typecheck, lint, format check and unit tests     |
| `pnpm test:e2e`                                   | Build, then run Playwright against the extension |
| `pnpm zip` / `pnpm zip:edge` / `pnpm zip:firefox` | Build store-ready zips into `.output/`           |
| `pnpm assets:icons`                               | Re-export PNG icons from `public/icon/icon.svg`  |

Run `pnpm exec playwright install chromium` once before the first e2e run.

## Releasing

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`.

The Release workflow checks that the tag matches the version, runs all checks and attaches the Chrome, Edge and Firefox zips to a GitHub release.

## Privacy

URLy collects no data and makes no network requests. It reads tab URLs and titles only when you open the popup, and stores your preferences (mode, format, window scope) locally in the browser.

## License

MIT
