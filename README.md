# JSner - Advanced Endpoint Extractor

**Version 3.0.1** - Professional endpoint scanner with verification and pscon bridge support

## 🎯 Overview
JSner is a powerful Chrome extension that extracts and verifies API endpoints from any website. Built for security researchers, penetration testers, API developers, and web developers who need to discover and test endpoints efficiently.

Pair it with the [`pscon` CLI](https://github.com/vyusec/pscon) to turn the live browser session into a structured recon snapshot.

### ✨ Key Features (v3.0)

#### pscon Bridge (NEW in v3.0)
- **Local WebSocket bridge** — token-authenticated, loopback-only connection to the `pscon` CLI
- **Deep Scan** — sends a full page snapshot (HTML, resources, network requests, inline scripts, storage keys) to pscon for deep parsing, crawling, secret detection, and decision-model triage
- **Authenticated fetch** — pscon can request page resources through the logged-in browser session
- **Auto-reconnect** — the bridge stays alive across MV3 service-worker suspensions

#### Endpoint Verification (v2.0)
- **Auto-detected Base URL** - Automatically captures the scanned website's URL
- **HTTP verification** - Uses GET requests and records real response status codes
- **Rate Limiting** - Configurable delay (10-1000ms) to prevent server overload
- **Verification Badges** - Visual indicators showing which endpoints are accessible
- **Bulk Testing** - Verify all discovered endpoints with one click
- **Results Persistence** - Verification results saved in Chrome storage

#### Multiple File Type Scanning
- **JavaScript** - Inline scripts and external JS files
- **CSS** - Embedded and external stylesheets
- **JSON** - Embedded JSON data and configs
- **HTML** - Attributes, comments, and embedded content
- **GraphQL** - Queries, mutations, and subscriptions
- **XML/SOAP** - Web service endpoints

#### Advanced Pattern Recognition
- REST API endpoints (`/api/v1/users`)
- Full URLs (`https://api.example.com/endpoint`)
- Query parameters (`?focus=great-ideas`)
- Hash fragments (`#section-name`)
- GraphQL endpoints and queries
- Configuration references
- Service paths and routes
- SOAP/WSDL endpoints

#### Export Formats
- **JSON** - Structured data export with categorization and verification status
- **CSV** - Spreadsheet-compatible format with endpoint types
- **TXT** - Simple text file with one endpoint per line
- **Copy to Clipboard** - Quick copy functionality

#### Modern UI/UX
- Light and dark interface, auto-detected from the OS with a manual override
- One restrained design system: sharp radii, visible focus, quiet interactions
- Accessible contrast (AA) in both grades, reduced-motion support
- Real-time filtering and search
- Categorized results (APIs, GraphQL, Config, Other)
- Statistics dashboard showing counts
- Deduplication of results

## 📦 Installation

### From Source
1. Download the repository or clone it:
   ```bash
   git clone https://github.com/vyusec/JSner.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top right)

4. Click "Load unpacked" and select the JSner folder

5. The extension will appear in your Chrome toolbar

### Development and packaging

This repository contains the browser extension. The CLI lives separately at
[vyusec/pscon](https://github.com/vyusec/pscon). For local development, keep
`JSner/` and `pscon/` as sibling folders, each with its own Git remote.

Load this repository root as an unpacked extension. After editing, reload JSner
on `chrome://extensions`. No CLI build is required for extension changes.

```bash
./scripts/install.sh   # show the local folder to load
./scripts/package.sh   # create dist/JSner-<version>.zip (requires Python 3)
```

The ZIP contains extension runtime files, icons, the license, and privacy policy.
Bridge behavior is documented in the CLI repository
([protocol](https://github.com/vyusec/pscon/blob/main/docs/bridge-protocol.md)).

### From Chrome Web Store
Visit [JSner on Chrome Web Store](https://chromewebstore.google.com/detail/JSner/gkmpnokjlhmbhppemigkhcddiiigjmcc)

## 🚀 Usage

### Basic Scanning
1. Navigate to any website
2. Click the JSner icon in your Chrome toolbar
3. Select which file types you want to scan (JS, CSS, JSON, HTML, GraphQL, XML)
4. Click **Scan page**
5. Wait for the scan to complete (status will update)
6. Open **Results**, then **View all results** for the full results tab

### Endpoint Verification (v2.0)
1. After scanning, the Base URL is auto-detected from the website
2. Set your desired rate limit (10-1000ms) to control request speed
3. Click **Verify endpoints** on the **Scan page** tab to check endpoints on the scanned origin using GET
4. View verification badges in the results page:
   - Green "VERIFIED" badge: Endpoint is accessible
   - Red "FAILED" badge: Endpoint returned an error
   - Gray "PENDING" badge: Not yet verified

### Deep Scan with pscon (v3.0)
1. Start the pscon bridge: `pscon tui` or `pscon bridge serve`
2. Get the token: `pscon bridge token`
3. Open the **pscon** tab in the JSner popup, paste the token, click **Connect**
4. Click **DEEP SCAN WITH PSCON** — the snapshot is sent to the loopback bridge and a full scan starts automatically in either the TUI or headless bridge

### Results Management
- Use the search bar to filter endpoints
- Click category filters (ALL, API, GRAPHQL, CONFIG, OTHER)
- Click individual endpoints to open them in a new tab
- Export all results in JSON, CSV, or TXT format
- Copy individual endpoints to clipboard

## 🛠️ Advanced Options

### Scan Options
- **JavaScript**: Scans all JS files (inline and external) for API calls and endpoints
- **CSS**: Extracts URLs from stylesheets and embedded styles
- **JSON**: Finds endpoints in JSON data structures and config files
- **HTML**: Scans HTML attributes, comments, and embedded content
- **GraphQL**: Identifies GraphQL endpoints, queries, mutations, and subscriptions
- **XML/SOAP**: Finds SOAP service endpoints and WSDL references

### Verification Options
- **Base URL**: Auto-detected from scanned website, can be manually edited
- **Rate Limit**: Delay between verification requests (10-1000ms)
  - Lower values (10-50ms): Faster but may trigger rate limiting
  - Higher values (500-1000ms): Slower but safer for production sites
- **HTTP method**: GET, with a timeout and a delay between requests

### Export Formats

**JSON** - Full structured output:
```json
{
  "endpoints": ["/api/users", "/api/posts"],
  "graphql": ["/graphql", "query GetUsers {...}"],
  "apis": ["/api/v1", "/api/v2"],
  "config": ["config.json", "settings"],
  "other": [...]
}
```

**CSV** - Spreadsheet format:
```csv
Type,Value
endpoint,/api/users
api,/api/v1
graphql,/graphql
```

**TXT** - Plain text, one per line:
```
/api/users
/api/posts
/graphql
```

## 🔒 Privacy & Security

- **Local Processing**: All scanning happens locally in your browser
- **No Data Collection**: We don't collect or send your data anywhere
- **Open Source**: Full transparency - review the code yourself
- **No Network Requests**: Results are never sent to external servers

## 📊 Statistics

The popup displays real-time statistics:
- **Total**: Total number of endpoints found
- **APIs**: Number of REST API endpoints
- **GraphQL**: Number of GraphQL endpoints/queries

## 🐛 Troubleshooting

### Extension not finding any endpoints?
- Try different scan options (some sites may have content in CSS or JSON)
- The website might not expose endpoints in the page source
- Try refreshing the page and scanning again
- Check if the website uses dynamic loading (SPA frameworks)

### Verification not working?
- Ensure the Base URL is correct (it should auto-detect from the scanned site)
- Check if the website has CORS restrictions
- Try increasing the rate limit to avoid being blocked
- Some endpoints may require authentication (will show as FAILED)

### Some endpoints are missing?
- Enable all scan options to get comprehensive results
- Endpoints loaded dynamically via JavaScript might not be visible
- Check the browser console for any blocked requests (CORS issues)
- Try the content scanner feature for dynamic content

### Export not working?
- Ensure there are endpoints found (stats should show > 0)
- Check browser permissions for downloads
- Try using a different export format
- Clear browser cache and try again

## 📝 What Gets Extracted?

JSner looks for:
- ✅ API paths like `/api/users`, `/v1/products`
- ✅ Full URLs like `https://api.example.com/endpoint`
- ✅ Query parameters like `?focus=great-ideas`, `?page=1`
- ✅ Hash fragments like `#section-name`, `#/route`
- ✅ GraphQL queries and mutations
- ✅ Configuration endpoints
- ✅ Service paths and routes
- ✅ SOAP/WSDL endpoints
- ✅ Data in JSON structures
- ✅ URLs in HTML attributes
- ✅ Paths in CSS files

It filters out:
- ❌ Image files (.png, .jpg, .gif, .svg)
- ❌ Font files (.woff, .ttf)
- ❌ Media files
- ❌ Data URIs
- ❌ JavaScript protocols

## 🤝 Contribution

We welcome contributions! This project is community-driven. You can:
- Report bugs and issues
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

Licensed under the Mozilla Public License 2.0 - see [LICENSE](LICENSE) for details

## 🔗 Links

- **Main Repository**: [JSner GitHub](https://github.com/vyusec/JSner)
- **Chrome Web Store**: [JSner Extension](https://chromewebstore.google.com/detail/JSner/gkmpnokjlhmbhppemigkhcddiiigjmcc)
- **Report Issues**: [GitHub Issues](https://github.com/vyusec/JSner/issues)

---

**Note**: Firefox support is coming soon!

## 📋 Changelog

### v3.0.1 (November 2026)

- Compact Scan, Results, and pscon tabs keep the popup within the browser height limit.
- Connection attempts report authentication failures and replace sockets when credentials change.
- WebSocket heartbeat keeps the MV3 connection active; scan progress and completion survive reopening the popup.
- Existing tabs get a snapshot collector on demand after extension installation or reload.
- Quick scan reads linked JavaScript and stylesheets instead of returning only their URLs.
- Verification uses safe GET requests with real status codes, timeouts, deduplication, and rate limiting.
- Fixed result category filters, live storage updates, theme controls, keyboard actions, and narrow layouts.


### v3.0.0 (November 2026)

**pscon Bridge:**
- ✅ Token-authenticated WebSocket bridge to the local pscon CLI (loopback only, default port 8787)
- ✅ Deep scan snapshot upload: HTML, resources, network requests, inline scripts, storage keys
- ✅ Authenticated resource fetch forwarding (`/ingest/resource`)
- ✅ Background service worker with webRequest capture and alarm-based reconnection
- ✅ Bridge status, connect flow, and scan progress shown in the popup

**Complete UI redesign (light + dark, accessibility-first):**
- ✅ Shared design tokens (`theme.css`): one color, spacing, type, radius and motion system
- ✅ Light and dark grades via `prefers-color-scheme` plus a manual override, persisted across the popup and results page
- ✅ System font stack — the Google Fonts CDN dependency is gone (all processing now really is local)
- ✅ Rebuilt popup layout: scan options as toggles, stats, verification controls, exports, and a dedicated pscon bridge card with connection pill and progress bar
- ✅ Rebuilt results page: sticky header, live filter, category chips, verification badges (verified / failed / pending), toast feedback
- ✅ Accessibility: AA contrast in both grades, visible focus rings, `aria-expanded` result sections, `role="status"` live regions, reduced-motion support

**Scanning Improvements:**
- ✅ Content scanner rewritten: network hooks (fetch/XHR/WebSocket/SSE/sendBeacon) install at `document_start`
- ✅ Snapshot collector used by the pscon bridge (`pscon_collect_snapshot`)
- ✅ Legacy quick-scan and content scanner features unchanged

**Verification & Exports:**
- ✅ RESTful method testing (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD) with rate limiting
- ✅ JSON, CSV, TXT exports and clipboard copy (unchanged behavior)

**Bug Fixes:**
- ✅ The pscon bridge section is now fully wired (the vendored v3 previously shipped controls that did not render)
- ✅ Verification results render as badges on every endpoint, including a pending state
- ✅ Endpoint rows are built with DOM APIs — no more broken rows for endpoints containing quotes or markup characters

### v2.0.0 (November 2025)

**Major Features:**
- ✅ Endpoint verification with all RESTful HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
- ✅ Auto-detection of base URL from scanned website
- ✅ Configurable rate limiting for bulk endpoint testing (10-1000ms per request)
- ✅ Verification status badges (verified/failed/pending) in results view
- ✅ Dedicated results page with advanced filtering and search
- ✅ Content scanner for dynamic endpoint detection via network monitoring

**Scanning Improvements:**
- ✅ Support for CSS file scanning
- ✅ JSON structure scanning for embedded endpoints
- ✅ GraphQL query and mutation detection
- ✅ XML/SOAP endpoint detection
- ✅ Query parameter extraction (`?param=value`)
- ✅ Hash fragment extraction (`#section`)
- ✅ Improved regex patterns for better accuracy

**Export & Data Management:**
- ✅ Multiple export formats (JSON, CSV, TXT)
- ✅ Copy to clipboard functionality
- ✅ Persistent storage of scan results and verification status
- ✅ Categorized results (APIs, GraphQL, Config, Other)

**UI/UX Enhancements:**
- ✅ Clean hacker-themed interface with Matrix green aesthetics
- ✅ Gaussian blur background with subtle gradients
- ✅ Rounded corners and frosted glass effects
- ✅ Minimal animations for professional appearance
- ✅ Real-time statistics dashboard
- ✅ Improved button states and visual feedback

**Bug Fixes:**
- ✅ Fixed URL opening for relative paths, query strings, and fragments
- ✅ Fixed chrome.runtime.onMessage listener syntax in content scanner
- ✅ Fixed base URL handling for different endpoint types
- ✅ Improved error handling for verification requests

### v1.0.0 (Initial Release)
- Basic JavaScript endpoint extraction
- Simple popup interface
- Text export functionality 
