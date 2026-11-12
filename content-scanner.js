/*
 * JSner v3 content script.
 *
 * Installs lightweight network hooks at document_start and exposes a snapshot
 * collector used by the pscon bridge. The collector is intentionally
 * self-contained and defensive: failures on unusual pages must never break the
 * page itself.
 */
(() => {
  if (window.__psconScannerInstalled) return;
  window.__psconScannerInstalled = true;

  const network = {
    fetchUrls: new Set(),
    apiCalls: [],
    wsConnections: new Set(),
    events: new Set(),
  };

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function (...args) {
      try {
        const input = args[0];
        if (typeof input === "string") network.fetchUrls.add(input);
        else if (input && input.url) network.fetchUrls.add(input.url);
      } catch {}
      return originalFetch.apply(this, args);
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      if (url) {
        network.apiCalls.push({ method, url: String(url), timestamp: new Date().toISOString() });
        if (network.apiCalls.length > 2000) network.apiCalls.shift();
      }
    } catch {}
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  const OriginalWebSocket = window.WebSocket;
  if (OriginalWebSocket) {
    window.WebSocket = class extends OriginalWebSocket {
      constructor(url, ...args) {
        super(url, ...args);
        try {
          network.wsConnections.add(String(url));
        } catch {}
      }
    };
  }

  if (window.EventSource) {
    const OriginalEventSource = window.EventSource;
    window.EventSource = class extends OriginalEventSource {
      constructor(url, ...args) {
        super(url, ...args);
        try {
          network.events.add(String(url));
        } catch {}
      }
    };
  }

  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      try {
        network.fetchUrls.add(String(url));
      } catch {}
      return originalBeacon(url, data);
    };
  }

  function absolute(value) {
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return value;
    }
  }

  function kindFromUrl(url, contentType) {
    const lower = (url || "").toLowerCase();
    const ct = (contentType || "").toLowerCase();
    if (ct.includes("javascript") || /\.(mjs|cjs|js|jsx|ts|tsx)(\?|$)/.test(lower)) return "javascript";
    if (ct.includes("text/css") || /\.css(\?|$)/.test(lower)) return "css";
    if (ct.includes("json") || /\.json(\?|$)/.test(lower)) return "json";
    if (ct.includes("xml") || /\.(xml|wsdl|xsd)(\?|$)/.test(lower)) return "xml";
    if (ct.includes("graphql") || /\.(graphql|gql)(\?|$)/.test(lower)) return "graphql";
    if (ct.includes("html") || /\.(html?|xhtml)(\?|$)/.test(lower)) return "html";
    if (ct.includes("sourcemap") || /\.map(\?|$)/.test(lower)) return "source_map";
    if (ct.startsWith("image/")) return "image";
    if (ct.startsWith("font/")) return "font";
    if (ct.startsWith("audio/") || ct.startsWith("video/")) return "media";
    return "other";
  }

  function performanceResources() {
    const out = [];
    try {
      for (const entry of performance.getEntriesByType("resource")) {
        if (!entry.name) continue;
        out.push({
          url: entry.name,
          kind: kindFromUrl(entry.name),
          method: "GET",
          status: entry.responseStatus || null,
          content_type: null,
          initiator: entry.initiatorType || null,
          size: entry.transferSize || entry.encodedBodySize || null,
        });
      }
    } catch {}
    return out;
  }

  function domResources() {
    const out = [];
    const seen = new Set();
    const add = (value, kind) => {
      if (!value) return;
      const url = absolute(value);
      if (!/^https?:/i.test(url) || seen.has(url)) return;
      seen.add(url);
      out.push({ url, kind, method: "GET", status: null, content_type: null, initiator: "dom", size: null });
    };
    document.querySelectorAll("script[src]").forEach((el) => add(el.src, "javascript"));
    document.querySelectorAll("link[href]").forEach((el) => {
      const rel = (el.rel || "").toLowerCase();
      const kind = rel.includes("stylesheet") ? "css" : rel.includes("manifest") ? "json" : kindFromUrl(el.href);
      add(el.href, kind);
    });
    document.querySelectorAll("img[src], source[src], video[src], audio[src], iframe[src], embed[src]").forEach((el) => add(el.src, kindFromUrl(el.src)));
    document.querySelectorAll("a[href]").forEach((el) => add(el.href, "page"));
    return out;
  }

  function inlineScripts() {
    const out = [];
    document.querySelectorAll("script:not([src])").forEach((el) => {
      const text = el.textContent || "";
      if (text.trim()) out.push(text.slice(0, 2 * 1024 * 1024));
    });
    return out;
  }

  function storageKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
    } catch {}
    try {
      for (let i = 0; i < sessionStorage.length; i += 1) keys.push(sessionStorage.key(i));
    } catch {}
    return keys.filter(Boolean).slice(0, 500);
  }

  function collectSnapshot() {
    const resources = [...performanceResources(), ...domResources()];
    const byUrl = new Map();
    for (const item of resources) {
      if (!byUrl.has(item.url)) byUrl.set(item.url, item);
    }
    return {
      title: document.title || "",
      html: document.documentElement ? document.documentElement.outerHTML.slice(0, 4 * 1024 * 1024) : "",
      resources: Array.from(byUrl.values()).slice(0, 2000),
      inline_scripts: inlineScripts(),
      storage_keys: storageKeys(),
      network: {
        fetch_urls: Array.from(network.fetchUrls).slice(0, 2000),
        api_calls: network.apiCalls.slice(-2000),
        websockets: Array.from(network.wsConnections).slice(0, 500),
        event_sources: Array.from(network.events).slice(0, 500),
      },
    };
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.type === "pscon_collect_snapshot") {
      try {
        sendResponse(collectSnapshot());
      } catch (err) {
        sendResponse({ error: String(err && err.message ? err.message : err) });
      }
      return false;
    }
    return false;
  });

  // The legacy popup quick-scan asks for the raw network capture.
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request && request.action === "getNetworkData") {
      sendResponse({
        apiCalls: network.apiCalls,
        wsConnections: Array.from(network.wsConnections),
        fetchUrls: Array.from(network.fetchUrls),
      });
      return false;
    }
    return false;
  });

  console.log("[JSner] content scanner initialized");
})();
