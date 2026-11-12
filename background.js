/* JSner: authenticated localhost bridge and browser snapshot collection. */
const DEFAULT_PORT = 8787;
const EXTENSION_VERSION = chrome.runtime.getManifest().version;
const RECONNECT_MS = 5000;
let socket = null;
let connection = null;
let token = "";
let port = DEFAULT_PORT;
let reconnectTimer = null;
let heartbeatTimer = null;
let lastStatus = { connected: false, message: "Not connected" };
let scanProgress = null;
let scanBusy = false;
let webRequestLog = [];
const MAX_WEB_REQUESTS = 4000;

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (data) => resolve(data || {})));
}
function storageSet(values) {
  return new Promise((resolve) => chrome.storage.local.set(values, resolve));
}
function notifyPopup(message) {
  try { chrome.runtime.sendMessage(message)?.catch(() => {}); } catch {}
}
function setStatus(connected, message) {
  lastStatus = { connected, message };
  notifyPopup({ type: "pscon_bridge_status", ...lastStatus, port });
}
function setProgress(stage, message, progress) {
  scanProgress = { stage, message, progress };
  notifyPopup({ type: "pscon_scan_progress", ...scanProgress });
}
async function loadSettings() {
  const data = await storageGet(["psconBridgeToken", "psconBridgePort"]);
  token = data.psconBridgeToken || "";
  port = Number(data.psconBridgePort) || DEFAULT_PORT;
}
async function activeTab() {
  return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs?.[0] || null)));
}
function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  if (token) reconnectTimer = setTimeout(() => connectBridge().catch(() => {}), RECONNECT_MS);
}
function send(message) {
  if (socket?.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}
async function connectBridge(explicitToken, explicitPort) {
  await settingsReady;
  const nextToken = explicitToken === undefined ? token : String(explicitToken).trim();
  const nextPort = explicitPort === undefined ? port : Number(explicitPort);
  if (!nextToken) throw new Error("Paste the bridge token first");
  if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) throw new Error("Port must be between 1 and 65535");
  if (nextToken === token && nextPort === port && connection) return connection.promise;

  // Retire the old socket before applying new credentials. Old callbacks may
  // still fire, so each callback checks its own socket identity.
  const previous = socket;
  socket = null;
  connection?.reject(new Error("Connection settings changed"));
  connection = null;
  previous?.close();
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  token = nextToken;
  port = nextPort;
  storageSet({ psconBridgeToken: token, psconBridgePort: port });
  setStatus(false, "Connecting…");

  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`);
  socket = ws;
  let resolveAttempt, rejectAttempt;
  const promise = new Promise((resolve, reject) => { resolveAttempt = resolve; rejectAttempt = reject; });
  connection = { promise, reject: rejectAttempt };
  const timeout = setTimeout(() => { if (socket === ws) ws.close(); rejectAttempt(new Error("Bridge connection timed out")); }, 5000);
  ws.onopen = async () => {
    const tab = await activeTab();
    if (socket !== ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "hello", protocol: 1, extension_version: EXTENSION_VERSION, browser: navigator.userAgent, tab_url: tab?.url || null }));
  };
  ws.onmessage = event => {
    if (socket !== ws) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "hello_ack") {
      if (message.protocol !== 1 || message.tool !== "pscon") { ws.close(); return; }
      clearTimeout(timeout);
      setStatus(true, `pscon ${message.version} · port ${port}`);
      // Chrome's MV3 worker needs socket activity inside its 30s idle window.
      heartbeatTimer = setInterval(() => send({ type: "ping" }), 20000);
      resolveAttempt({ ok: true });
    } else if (message.type === "scan_progress") {
      setProgress(message.stage, message.message, message.progress);
    } else if (message.type === "start_scan") {
      runDeepScan(message.options || {}).catch(error => setProgress("failed", error.message, 0));
    } else if (message.type === "fetch_resource") {
      handleFetchResource(message).catch(() => {});
    } else if (message.type === "ping") send({ type: "pong" });
  };
  ws.onerror = () => {}; // onclose supplies one consistent, actionable error.
  ws.onclose = () => {
    clearTimeout(timeout);
    rejectAttempt(new Error("Cannot connect. Start pscon and check the token and port."));
    if (socket !== ws) return;
    clearInterval(heartbeatTimer);
    socket = null;
    connection = null;
    setStatus(false, "Disconnected · check pscon, token and port");
    scheduleReconnect();
  };
  return promise;
}

async function handleFetchResource(message) {
  const requestId = message.request_id;
  try {
    const response = await fetch(message.url, {
      method: message.method || "GET",
      headers: message.headers || {},
      credentials: "include",
      redirect: "follow",
    });
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 2 * 1024 * 1024));
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    const body_base64 = btoa(binary);
    await postIngestResource({
      request_id: requestId,
      url: message.url,
      status: response.status,
      content_type: response.headers.get("content-type"),
      body_base64,
    });
  } catch (err) {
    await postIngestResource({
      request_id: requestId,
      url: message.url,
      status: 0,
      content_type: null,
      body_base64: "",
      error: err.message,
    });
  }
}

async function postIngestResource(payload) {
  if (!token) return;
  await fetch(`http://127.0.0.1:${port}/ingest/resource`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

async function runDeepScan(options = {}, explicitToken, explicitPort) {
  if (scanBusy) throw new Error("A snapshot is already being collected");
  scanBusy = true;
  try {
    await connectBridge(explicitToken, explicitPort);
    const tab = await activeTab();
    if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("Select an HTTP or HTTPS website tab to scan");
    setProgress("collect", "Collecting browser snapshot…", 0.05);
    const snapshot = await collectFromTab(tab.id, options);
    const payload = {
      target: new URL(tab.url).origin, page_url: tab.url,
      title: tab.title || snapshot.title || "", html: snapshot.html || null,
      resources: snapshot.resources || [],
      network: webRequestLog.filter(item => item.tabId === tab.id),
      inline_scripts: snapshot.inline_scripts || [], storage_keys: snapshot.storage_keys || [],
      extension_version: EXTENSION_VERSION, captured_at: new Date().toISOString(),
    };
    setProgress("upload", "Sending snapshot to pscon…", 0.1);
    const response = await fetch(`http://127.0.0.1:${port}/ingest`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Snapshot upload failed (HTTP ${response.status})`);
    // Do not overwrite scan events that may arrive before the HTTP response.
    if (["collect", "upload"].includes(scanProgress?.stage)) setProgress("queued", "Snapshot accepted · waiting for scan progress", 0.1);
    return { ok: true };
  } catch (error) {
    setProgress("failed", error.message, 0);
    throw error;
  } finally { scanBusy = false; }
}
function messageTab(tabId, options) {
  return new Promise((resolve, reject) => chrome.tabs.sendMessage(tabId, { type: "pscon_collect_snapshot", options }, response => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else if (!response || response.error) reject(new Error(response?.error || "No snapshot returned"));
    else resolve(response);
  }));
}
async function collectFromTab(tabId, options) {
  try { return await messageTab(tabId, options); }
  catch (error) {
    if (!/receiving end|connection|establish/i.test(error.message)) throw error;
    // Tabs opened before installation/reload do not yet have a content script.
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content-scanner.js"] });
    return messageTab(tabId, options);
  }
}

const settingsReady = loadSettings();
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;
  if (message.type === "pscon_connect") operation = connectBridge(message.token, message.port);
  else if (message.type === "pscon_deep_scan") operation = runDeepScan(message.options, message.token, message.port);
  else if (message.type === "pscon_get_status") operation = settingsReady.then(() => ({ ...lastStatus, port, hasToken: Boolean(token), progress: scanProgress }));
  else return false;
  operation.then(result => sendResponse(result), error => sendResponse({ ok: false, error: error.message }));
  return true;
});
chrome.webRequest.onCompleted.addListener(details => {
  if (details.tabId < 0) return;
  webRequestLog.push({ url: details.url, method: details.method, status: details.statusCode,
    resource_type: details.type, tabId: details.tabId, initiator: details.initiator || null });
  if (webRequestLog.length > MAX_WEB_REQUESTS) webRequestLog = webRequestLog.slice(-MAX_WEB_REQUESTS);
}, { urls: ["<all_urls>"] });
chrome.tabs.onRemoved.addListener(tabId => { webRequestLog = webRequestLog.filter(item => item.tabId !== tabId); });
chrome.webRequest.onBeforeRequest.addListener(details => {
  if (details.type === "main_frame") webRequestLog = webRequestLog.filter(item => item.tabId !== details.tabId);
}, { urls: ["<all_urls>"], types: ["main_frame"] });
chrome.alarms.create("pscon-reconnect", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "pscon-reconnect") connectBridge().catch(() => {});
});
settingsReady.then(() => { if (token) connectBridge().catch(() => {}); });
