# JSner Privacy Policy

**Effective date:** 20 November 2026
**Applies to:** the JSner – Endpoint Extractor browser extension (version 3.0.0 and later)

JSner is a developer and security-research tool that finds API endpoints and URLs
in websites you choose to analyze. This policy explains what the extension
accesses, where that data goes, and what it never does.

## Summary

- JSner has **no servers** and **no analytics, tracking, advertising or telemetry**.
- The developer **does not receive, collect or sell** any of your data.
- Scan results and settings are stored **only in your browser's local extension storage**.
- Data leaves your browser only when **you** start an action: fetching a page's linked
  files, verifying endpoints, or sending a deep scan to the **pscon tool running on your
  own computer** (`127.0.0.1` / `localhost`).

## What the extension accesses

| Data | When | Purpose |
|---|---|---|
| HTML and inline scripts of the active tab | When you click **Scan page** | Find endpoints and URLs |
| JavaScript and CSS files linked from that page | When you click **Scan page** | Scan those files for endpoints; they are requested from the site that hosts them, the same way the page loads them |
| URLs of fetch/XHR, WebSocket and EventSource calls made by pages | While pages load (content script) | Include endpoints the page uses at runtime; kept in that tab's memory only |
| Network request metadata (URL, method, status code, resource type, initiator) | While pages load (`webRequest`) | Same as above. **No request or response bodies, headers or cookies are read.** The data is held in memory, capped at 4,000 entries, and cleared when the tab navigates or closes |
| Names (not values) of the page's `localStorage` / `sessionStorage` keys | Only during a pscon deep scan | Included in the deep-scan snapshot |
| Responses from discovered endpoints | Only when you click **Verify** | Report each endpoint's HTTP status. Rate-limited `GET` requests to the scanned site's own origin |

JSner does not access personal information such as your name, email, passwords,
form input, cookies' contents, browsing history or location, and does not run
in the background to collect anything on its own.

## What is stored, and where

Stored in `chrome.storage.local` on your device only:

- the latest scan results (extracted endpoints and verification status codes);
- your settings (selected file types, base URL, rate limit, theme, last open tab);
- the pscon bridge token and port, if you enter them.

Nothing is synced to a cloud account by the extension. Use **Clear results** in the
popup to delete results, or remove the extension to delete everything.

## Optional pscon bridge (local only)

pscon is a separate command-line tool you run on your own computer. The bridge is
**off until you paste a token and click Connect**. Once paired:

- The extension connects only to `127.0.0.1` / `localhost` on the port you choose,
  authenticated with your token.
- When you click **Deep scan**, it sends a snapshot of the current tab to pscon:
  the page HTML, inline scripts, resource URLs, the network metadata described above,
  and storage key names.
- pscon may ask the extension to fetch specific URLs **using your browser session**
  (so pages that need you to be logged in can be analyzed) and return the responses
  to pscon on your computer.
- A once-a-minute alarm keeps this local connection alive while a token is saved.

The extension never sends this data to any remote server. What pscon does with data
it receives (for example, any calls it makes to AI services) is handled by pscon and
its own settings, not by this extension.

## Sharing and sale of data

The developer does not collect your data, so there is nothing to share or sell.
JSner does not transfer data to third parties, does not use it for advertising or
creditworthiness decisions, and does not use it for any purpose unrelated to the
extension's single purpose of finding endpoints in websites you analyze.

## Permissions

- **activeTab, scripting, tabs:** identify the tab you are scanning and run the scanner in it.
- **storage:** keep results and settings on your device.
- **webRequest:** observe request metadata (read-only; never blocks or modifies requests).
- **alarms:** keep the optional local pscon connection alive.
- **Host access (`<all_urls>`):** read the page you scan and its linked files, which are often served from other domains.
- **`http://127.0.0.1/*`, `http://localhost/*`:** talk to the local pscon bridge.

## Your responsibility

Only scan and verify websites you own or are authorized to test. Verification and
pscon fetches send real requests to the target site.

## Children

JSner is a developer tool and is not directed at children under 13.

## Changes

If this policy changes, the updated version will be published at this address with
a new effective date, and significant changes will be noted in the release notes.

## Contact

Questions about this policy: open an issue at
<https://github.com/vyusec/JSner/issues> or email **contact@ciatech.net**.
