/*
 * JSner popup — quick scanner + pscon bridge control.
 */

// Storage for extracted endpoints
let extractedData = {
  endpoints: [],
  graphql: [],
  apis: [],
  config: [],
  other: []
};

const BRIDGE_PORT_DEFAULT = 8787;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.footer-version').textContent = `v${chrome.runtime.getManifest().version}`;
  loadStoredData();
  setupEventListeners();
  setupTheme();
  setupBridge();
  setupPanels();
});

function setupEventListeners() {
  document.getElementById('scanButton').addEventListener('click', performScan);
  document.getElementById('verifyButton').addEventListener('click', verifyEndpoints);
  document.getElementById('clearButton').addEventListener('click', clearData);
  document.getElementById('viewResultsBtn').addEventListener('click', viewResults);
  document.getElementById('downloadJSON').addEventListener('click', () => downloadData('json'));
  document.getElementById('downloadCSV').addEventListener('click', () => downloadData('csv'));
  document.getElementById('downloadTXT').addEventListener('click', () => downloadData('txt'));
  document.getElementById('copyClipboard').addEventListener('click', copyToClipboard);

  // Save base URL when changed
  document.getElementById('baseUrl').addEventListener('change', (e) => {
    chrome.storage.local.set({ baseUrl: e.target.value });
    updateUI();
  });

  // Load saved base URL
  chrome.storage.local.get('baseUrl', (data) => {
    if (data.baseUrl) {
      document.getElementById('baseUrl').value = data.baseUrl;
      updateUI(false);
    }
  });
}

function setupTheme() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  const label = () => `Theme: ${document.documentElement.dataset.mode || 'auto'}`;
  const refresh = () => {
    toggle.setAttribute('aria-label', label());
    toggle.setAttribute('title', label());
  };
  refresh();
  document.addEventListener('jsner:theme', refresh);
  toggle.addEventListener('click', () => {
    window.jsnerCycleTheme();
    refresh();
  });
}

function scanOptions() {
  return Object.fromEntries(['JS', 'CSS', 'JSON', 'HTML', 'GraphQL', 'XML'].map(type => [`scan${type}`, document.getElementById(`scan${type}`).checked]));
}
async function performScan() {
  const button = document.getElementById('scanButton');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Scanning…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('Select an HTTP or HTTPS website tab to scan');
    showStatus('Scanning page and linked scripts…', 'info');
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: runAdvancedScanner, args: [scanOptions()] });
    if (!result?.result) throw new Error('No scan results returned');
    extractedData = result.result;
    document.getElementById('baseUrl').value = new URL(tab.url).origin;
    await chrome.storage.local.set({ baseUrl: new URL(tab.url).origin });
    updateUI();
    showStatus(`Scan complete · ${document.getElementById('totalCount').textContent} findings`, 'success');
  } catch (error) { showStatus(error.message, 'error'); }
  finally { button.disabled = false; button.innerHTML = original; }
}

async function runAdvancedScanner(options) {
  const results = {
    endpoints: new Set(),
    graphql: new Set(),
    apis: new Set(),
    config: new Set(),
    other: new Set()
  };

  // Helper function to check if endpoint is valid
  function isValidEndpoint(str) {
    if (!str || str.length < 2) return false;
    // Filter out common false positives
    const excluded = ['javascript:', 'data:', 'mailto:', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.woff', '.woff2', '.ttf', '.eot', '.ico'];
    for (let exc of excluded) {
      if (str.toLowerCase().includes(exc)) return false;
    }
    return true;
  }

  // Helper function to scan content with patterns
  function scanContent(content) {
    if (!content) return;

    // Pattern 1: API/REST endpoints (paths starting with /)
    const endpointPattern = /(?:["'`])(\/[a-zA-Z0-9_?&=\/\-\#\.]+)(?:["'`])/g;
    let match;
    while ((match = endpointPattern.exec(content)) !== null) {
      if (match[1] && isValidEndpoint(match[1])) {
        results.endpoints.add(match[1]);
      }
    }

    // Pattern 2: Query parameters (starting with ?)
    const queryPattern = /(?:["'`])(\?[a-zA-Z0-9_&=\/\-\#\.]+)(?:["'`])/g;
    while ((match = queryPattern.exec(content)) !== null) {
      if (match[1] && match[1].length > 2) {
        results.endpoints.add(match[1]);
      }
    }

    // Pattern 3: Hash/Fragment URLs (starting with #)
    const hashPattern = /(?:["'`])(\#[a-zA-Z0-9_&=\/\-\.]+)(?:["'`])/g;
    while ((match = hashPattern.exec(content)) !== null) {
      if (match[1] && match[1].length > 2) {
        results.endpoints.add(match[1]);
      }
    }

    // Pattern 4: Full URLs
    const urlPattern = /https?:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}[a-zA-Z0-9\-\._~:\/\?#\[\]@!\$&'\(\)\*\+,;=]*/g;
    while ((match = urlPattern.exec(content)) !== null) {
      if (match[0] && isValidEndpoint(match[0])) {
        results.endpoints.add(match[0]);
      }
    }

    // Pattern 5: API endpoints
    const apiPattern = /\/(?:api|v[0-9]|graphql|rest|service|endpoint)[a-zA-Z0-9_?&=\/\-]*/gi;
    while ((match = apiPattern.exec(content)) !== null) {
      if (match[0]) {
        results.apis.add(match[0]);
      }
    }

    // Pattern 6: GraphQL
    const graphqlPattern = /(?:query|mutation|subscription)\s+\w+/gi;
    while ((match = graphqlPattern.exec(content)) !== null) {
      if (match[0]) {
        results.graphql.add(match[0]);
      }
    }

    // Pattern 7: Config files
    const configPattern = /(?:config|settings|env|\.json|\.xml)[a-zA-Z0-9_\/\-\.]*/gi;
    while ((match = configPattern.exec(content)) !== null) {
      if (match[0] && match[0].length > 4) {
        results.config.add(match[0]);
      }
    }
  }

  // Get page content
  const pageContent = document.documentElement.outerHTML;
  const external = new Set();

  // 1. Scan JavaScript
  if (options.scanJS) {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].textContent) {
        scanContent(scripts[i].textContent);
      }
      if (scripts[i].src) {
        external.add(scripts[i].src);
      }
    }
  }

  // 2. Scan CSS
  if (options.scanCSS) {
    const styles = document.getElementsByTagName('style');
    for (let i = 0; i < styles.length; i++) {
      scanContent(styles[i].textContent);
    }

    const links = document.getElementsByTagName('link');
    for (let i = 0; i < links.length; i++) {
      if (links[i].rel === 'stylesheet' && links[i].href) {
        external.add(links[i].href);
      }
    }
  }

  // 3. Scan JSON
  if (options.scanJSON) {
    const jsonScripts = document.querySelectorAll('script[type="application/json"]');
    for (let script of jsonScripts) {
      scanContent(script.textContent);
    }
  }

  // 4. Scan HTML
  if (options.scanHTML) {
    scanContent(pageContent);

    // Extract from attributes
    const attrPattern = /(?:href|src|data-url|action|data-endpoint)=["']([^"']+)["']/g;
    let match;
    while ((match = attrPattern.exec(pageContent)) !== null) {
      if (match[1] && isValidEndpoint(match[1])) {
        results.endpoints.add(match[1]);
      }
    }
  }

  // 5. Scan GraphQL
  if (options.scanGraphQL) {
    const graphqlEndpointPattern = /["']?(\/graphql|\/gql|\/query)[a-zA-Z0-9_?&=\/\-]*["']?/gi;
    let match;
    while ((match = graphqlEndpointPattern.exec(pageContent)) !== null) {
      results.graphql.add(match[0].replace(/["']/g, ''));
    }
  }

  // 6. Scan XML/SOAP
  if (options.scanXML) {
    const xmlPattern = /(?:soap|xml|service|asmx|wsdl)[a-zA-Z0-9_?&=\/\-\.]*/gi;
    let match;
    while ((match = xmlPattern.exec(pageContent)) !== null) {
      if (match[0]) {
        results.other.add(match[0]);
      }
    }
  }

  // Read linked source files instead of only returning their script URLs.
  const queue = [...external].slice(0, 40);
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        const response = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(8000) });
        if (response.ok) scanContent((await response.text()).slice(0, 2 * 1024 * 1024));
      } catch { /* A blocked file must not discard other scan results. */ }
    }
  }));

  // Convert Sets to Arrays and filter
  return {
    endpoints: Array.from(results.endpoints).filter(e => e && e.length > 1),
    graphql: Array.from(results.graphql).filter(e => e && e.length > 1),
    apis: Array.from(results.apis).filter(e => e && e.length > 1),
    config: Array.from(results.config).filter(e => e && e.length > 1),
    other: Array.from(results.other).filter(e => e && e.length > 1)
  };
}

function updateUI(save = true) {
  const totalCount = ['endpoints', 'graphql', 'apis', 'config', 'other'].reduce((sum, key) => sum + extractedData[key].length, 0);
  document.getElementById('totalCount').textContent = totalCount;
  document.getElementById('resultsTabCount').textContent = totalCount;
  document.getElementById('apiCount').textContent = extractedData.apis.length;
  document.getElementById('graphqlCount').textContent = extractedData.graphql.length;

  // Enable export buttons if data exists
  const hasData = totalCount > 0;
  const baseUrl = document.getElementById('baseUrl').value;

  document.getElementById('viewResultsBtn').disabled = !hasData;
  document.getElementById('verifyButton').disabled = !hasData || !baseUrl;
  document.getElementById('downloadJSON').disabled = !hasData;
  document.getElementById('downloadCSV').disabled = !hasData;
  document.getElementById('downloadTXT').disabled = !hasData;
  document.getElementById('copyClipboard').disabled = !hasData;

  // Loading settings must not overwrite stored results with the empty initial state.
  if (save) chrome.storage.local.set({ extractedData });
}

function viewResults() {
  // Open results page in a new tab
  chrome.tabs.create({
    url: chrome.runtime.getURL('results.html')
  });
}

async function verifyEndpoints() {
  const button = document.getElementById('verifyButton');
  let base;
  try {
    base = new URL(document.getElementById('baseUrl').value.trim());
    if (!/^https?:$/.test(base.protocol)) throw new Error();
  } catch { showStatus('Enter a valid HTTP or HTTPS base URL', 'error'); return; }
  const endpoints = [...new Set([...extractedData.endpoints, ...extractedData.apis])].filter(value => {
    try { const url = new URL(value, base); return url.origin === base.origin && /^(\/|https?:)/.test(value); } catch { return false; }
  });
  if (!endpoints.length) { showStatus('No endpoints on this origin to verify', 'info'); return; }
  const original = button.innerHTML;
  button.disabled = true;
  document.getElementById('scanButton').disabled = true;
  document.getElementById('clearButton').disabled = true;
  button.textContent = 'Verifying…';
  const delay = Math.max(10, Math.min(1000, Number(document.getElementById('rateLimit').value) || 100));
  extractedData.verification ||= {};
  let reachable = 0;
  try {
    for (const [index, endpoint] of endpoints.entries()) {
      try {
        const response = await fetch(new URL(endpoint, base).href, { method: 'GET', credentials: 'include', signal: AbortSignal.timeout(10000) });
        const accessible = response.status > 0 && response.ok;
        extractedData.verification[endpoint] = { GET: { status: response.status, accessible, timestamp: new Date().toISOString() } };
        if (accessible) reachable++;
        await response.body?.cancel();
      } catch (error) {
        extractedData.verification[endpoint] = { GET: { status: 'error', accessible: false, error: error.message, timestamp: new Date().toISOString() } };
      }
      showStatus(`Verifying ${index + 1}/${endpoints.length} · ${Math.round((index + 1) / endpoints.length * 100)}%`, 'info');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    await chrome.storage.local.set({ extractedData });
    showStatus(`Verified · ${reachable} reachable, ${endpoints.length - reachable} failed`, reachable ? 'success' : 'error');
  } finally {
    button.innerHTML = original;
    document.getElementById('scanButton').disabled = false;
    document.getElementById('clearButton').disabled = false;
    updateUI();
  }
}

function loadStoredData() {
  chrome.storage.local.get('extractedData', (data) => {
    if (data.extractedData) {
      extractedData = { ...extractedData, ...data.extractedData };
      updateUI(false);
    }
  });
}

function clearData() {
  extractedData = {
    endpoints: [],
    graphql: [],
    apis: [],
    config: [],
    other: []
  };
  chrome.storage.local.set({ extractedData });
  updateUI();
  showStatus('Results cleared', 'info');
}

function downloadData(format) {
  const allData = [
    ...extractedData.endpoints,
    ...extractedData.graphql,
    ...extractedData.apis,
    ...extractedData.config,
    ...extractedData.other
  ];

  if (allData.length === 0) {
    showStatus('Nothing to export yet', 'error');
    return;
  }

  let content, filename, mimeType;

  switch (format) {
    case 'json':
      content = JSON.stringify(extractedData, null, 2);
      filename = 'jsner-endpoints.json';
      mimeType = 'application/json';
      break;
    case 'csv':
      const headers = 'Type,Value\n';
      const rows = allData.map((item, idx) => {
        let type = 'unknown';
        if (extractedData.endpoints.includes(item)) type = 'endpoint';
        else if (extractedData.graphql.includes(item)) type = 'graphql';
        else if (extractedData.apis.includes(item)) type = 'api';
        else if (extractedData.config.includes(item)) type = 'config';
        return `${type},"${item.replace(/"/g, '""')}"`;
      }).join('\n');
      content = headers + rows;
      filename = 'jsner-endpoints.csv';
      mimeType = 'text/csv';
      break;
    case 'txt':
      content = allData.join('\n');
      filename = 'jsner-endpoints.txt';
      mimeType = 'text/plain';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  showStatus(`Saved ${filename}`, 'success');
}

function copyToClipboard() {
  const allData = [
    ...extractedData.endpoints,
    ...extractedData.graphql,
    ...extractedData.apis,
    ...extractedData.config,
    ...extractedData.other
  ];

  if (allData.length === 0) {
    showStatus('Nothing to copy yet', 'error');
    return;
  }

  const text = allData.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    showStatus('Copied to clipboard', 'success');
  }).catch(() => {
    showStatus('Copy failed', 'error');
  });
}

function showStatus(message, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status status--${type}`;
}

function setupPanels() {
  function select(panel, focus = false) {
    for (const name of ['scan', 'results', 'bridge']) {
      const tab = document.getElementById(`tab-${name}`);
      const selected = panel === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(`panel-${name}`).hidden = !selected;
      if (selected && focus) tab.focus();
    }
    chrome.storage.local.set({ uiPanel: panel });
  }
  for (const name of ['scan', 'results', 'bridge']) {
    const tab = document.getElementById(`tab-${name}`);
    tab.addEventListener('click', () => select(name));
    tab.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); select(event.key === 'Home' ? 'scan' : event.key === 'End' ? 'bridge' : ['scan', 'results', 'bridge'][(['scan', 'results', 'bridge'].indexOf(name) + (event.key === 'ArrowLeft' ? 2 : 1)) % 3], true);
      }
    });
  }
  chrome.storage.local.get('uiPanel', data => select(['scan', 'results', 'bridge'].includes(data.uiPanel) ? data.uiPanel : 'scan'));
}

function setupBridge() {
  const tokenInput = document.getElementById('bridgeToken');
  const portInput = document.getElementById('bridgePort');
  const connect = document.getElementById('bridgeConnect');
  const deep = document.getElementById('deepScanButton');
  function status(connected, message, bridgePort) {
    if (connected && Number.isInteger(bridgePort)) portInput.value = bridgePort;
    document.getElementById('bridgeStatus').textContent = message || (connected ? 'Connected' : 'Not connected');
    document.getElementById('bridgePill').classList.toggle('is-connected', connected);
    document.getElementById('connectionDot').classList.toggle('is-connected', connected);
  }
  function progress(data) {
    if (!data) return;
    const value = Math.round(Math.max(0, Math.min(1, Number(data.progress) || 0)) * 100);
    document.getElementById('bridgeProgress').classList.add('is-active');
    document.getElementById('bridgeProgressBar').style.width = `${value}%`;
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', value);
    document.getElementById('bridgeStage').textContent = data.message || data.stage;
    if (data.stage === 'failed') showStatus(data.message, 'error');
    if (data.stage === 'complete') showStatus(data.message, 'success');
  }
  chrome.storage.local.get(['psconBridgeToken', 'psconBridgePort'], data => {
    tokenInput.value = data.psconBridgeToken || '';
    portInput.value = data.psconBridgePort || BRIDGE_PORT_DEFAULT;
  });
  function request(type, button) {
    const token = tokenInput.value.trim();
    const port = Number(portInput.value);
    if (!token) { showStatus('Paste the bridge token first', 'error'); tokenInput.focus(); return; }
    if (!Number.isInteger(port) || port < 1 || port > 65535) { showStatus('Port must be between 1 and 65535', 'error'); portInput.focus(); return; }
    connect.disabled = deep.disabled = true;
    const original = button.innerHTML;
    button.textContent = type === 'pscon_connect' ? 'Connecting…' : 'Sending…';
    chrome.runtime.sendMessage({ type, token, port, options: scanOptions() }, response => {
      const error = chrome.runtime.lastError;
      connect.disabled = deep.disabled = false;
      button.innerHTML = original;
      if (error || !response?.ok) showStatus(error?.message || response?.error || 'The connector did not respond', 'error');
      else showStatus(type === 'pscon_connect' ? 'Connected to pscon' : 'Snapshot sent · follow live progress below', 'success');
    });
  }
  connect.addEventListener('click', () => request('pscon_connect', connect));
  deep.addEventListener('click', () => request('pscon_deep_scan', deep));
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'pscon_bridge_status') status(Boolean(message.connected), message.message, message.port);
    if (message.type === 'pscon_scan_progress') progress(message);
  });
  chrome.runtime.sendMessage({ type: 'pscon_get_status' }, response => {
    const error = chrome.runtime.lastError;
    if (error || !response) { status(false, 'Connector unavailable'); return; }
    status(Boolean(response.connected), response.message, response.port);
    progress(response.progress);
  });
}
