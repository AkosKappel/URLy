# URLy

A minimal browser extension for moving URLs in and out of your tabs.

- **Copy**: copy the URLs of the tabs in the current window, all windows, or only the tabs you have selected. Internal pages (`chrome://`, `about:` and so on) and duplicates are skipped.
- **Formats**: plain URLs, Markdown links, title and URL, HTML links (also copied as rich text), CSV, JSON, or a custom template using `{title}`, `{url}`, `{host}`, `{domain}`, `{path}`, `{index}`, `\t` and `\n`.
- **Preview**: the popup shows the copied text before you copy.
- **Remove tracking**: optionally strip `utm_*`, `fbclid`, `gclid` and similar parameters.
- **Open**: paste any text and URLy finds the links in it and opens them as background tabs, or in a new window. It asks before opening more than 20.
- **Context menus**: right-click the toolbar icon to copy tab URLs (with your saved format or any other), or right-click selected text to open the links in it.

| Shortcut      | Action                                            |
| ------------- | ------------------------------------------------- |
| `Alt+Shift+U` | Open the popup                                    |
| `Alt+Shift+C` | Copy tab URLs with your saved format, no popup    |
| `Ctrl+V`      | In the popup: switch to Open with the pasted text |
| `Ctrl+Enter`  | In the Open text box: open the links              |

Shortcuts can be changed at `chrome://extensions/shortcuts` (Chrome, Edge) or Manage Extension Shortcuts in `about:addons` (Firefox).

Supports Chrome, Edge and Firefox (Manifest V3).

## Development

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev            # Chrome with live reload
pnpm dev:firefox    # Firefox with live reload
```

| Command                                           | Purpose                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `pnpm check`                                      | Typecheck, lint, format check and unit tests        |
| `pnpm test:e2e`                                   | Build, then run Playwright against the extension    |
| `pnpm zip` / `pnpm zip:edge` / `pnpm zip:firefox` | Build store-ready zips into `.output/`              |
| `pnpm assets:icons`                               | Re-export PNG icons from `public/icon/icon.svg`     |
| `pnpm assets:store`                               | Regenerate store screenshots and images in `store/` |

Run `pnpm exec playwright install chromium` once before the first e2e run.

## Releasing

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`.

The Release workflow checks that the tag matches the version, runs all checks and attaches the Chrome, Edge and Firefox zips (plus the Firefox sources zip for AMO review) to a GitHub release. Store listing texts, permission justifications and images are in [store/](store/listing.md).

## Privacy

URLy collects no data and makes no network requests. See [PRIVACY.md](PRIVACY.md).

## License

MIT
