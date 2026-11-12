// Load and display results
let allData = {
  endpoints: [],
  graphql: [],
  apis: [],
  config: [],
  other: []
};

let currentFilter = 'all';
let searchTerm = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupEventListeners();
  const toggle = document.getElementById('themeToggle');
  const refreshTheme = () => toggle.setAttribute('aria-label', `Theme: ${document.documentElement.dataset.mode || 'auto'}`);
  toggle.addEventListener('click', () => { window.jsnerCycleTheme(); refreshTheme(); });
  document.addEventListener('jsner:theme', refreshTheme);
  refreshTheme();
  if (typeof chrome !== 'undefined') chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extractedData) {
      allData = { endpoints: [], apis: [], graphql: [], config: [], other: [], ...changes.extractedData.newValue };
      updateStats(); renderResults();
    }
  });
});

function setupEventListeners() {
  // Search functionality
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderResults();
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderResults();
    });
  });

  // Export button
  document.getElementById('exportAllBtn').addEventListener('click', exportAll);
}

function loadData() {
  // Results can also be opened outside the extension (a plain tab); degrade softly.
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    updateStats();
    renderResults();
    showEmptyState();
    return;
  }
  chrome.storage.local.get('extractedData', (data) => {
    if (data.extractedData) {
      allData = { ...allData, ...data.extractedData };
      updateStats();
      renderResults();
    } else {
      showEmptyState();
    }
  });
}

function updateStats() {
  document.getElementById('totalStat').textContent = 
    allData.endpoints.length + allData.graphql.length + allData.apis.length + allData.config.length + allData.other.length;
  document.getElementById('apiStat').textContent = allData.apis.length;
  document.getElementById('graphqlStat').textContent = allData.graphql.length;
  document.getElementById('configStat').textContent = allData.config.length;
}

function renderResults() {
  const container = document.getElementById('resultsContainer');
  const emptyState = document.getElementById('emptyState');
  
  container.innerHTML = '';
  
  let hasResults = false;

  // Filter data based on current filter and search
  const filteredData = filterData();

  // Render each category
  if (currentFilter === 'all' || currentFilter === 'endpoints') {
    if (filteredData.endpoints.length > 0) {
      container.appendChild(createCategorySection('Endpoints', CATEGORY_ICONS.endpoints, filteredData.endpoints, 'endpoints'));
      hasResults = true;
    }
  }

  if (currentFilter === 'all' || currentFilter === 'apis') {
    if (filteredData.apis.length > 0) {
      container.appendChild(createCategorySection('API endpoints', CATEGORY_ICONS.apis, filteredData.apis, 'apis'));
      hasResults = true;
    }
  }

  if (currentFilter === 'all' || currentFilter === 'graphql') {
    if (filteredData.graphql.length > 0) {
      container.appendChild(createCategorySection('GraphQL', CATEGORY_ICONS.graphql, filteredData.graphql, 'graphql'));
      hasResults = true;
    }
  }

  if (currentFilter === 'all' || currentFilter === 'config') {
    if (filteredData.config.length > 0) {
      container.appendChild(createCategorySection('Configuration', CATEGORY_ICONS.config, filteredData.config, 'config'));
      hasResults = true;
    }
  }

  if (currentFilter === 'all' && filteredData.other.length > 0) {
      container.appendChild(createCategorySection('Other', CATEGORY_ICONS.other, filteredData.other, 'other'));

    hasResults = true;
  }

  const labels = { all: 'All findings', endpoints: 'Endpoints', apis: 'API endpoints', graphql: 'GraphQL', config: 'Configuration' };
  document.getElementById('resultsHeading').textContent = labels[currentFilter];
  const hasData = ['endpoints', 'apis', 'graphql', 'config', 'other'].some(key => allData[key].length);
  document.getElementById('emptyState').querySelector('h2').textContent = hasData ? 'No matching results' : 'No results yet';
  document.getElementById('emptyState').querySelector('p').textContent = hasData ? 'Try another search or category.' : 'Scan a website from the JSner popup to see its endpoints here.';
  // Show empty state if no results
  if (!hasResults) {
    emptyState.style.display = 'block';
    container.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    container.style.display = 'block';
  }
}

function filterData() {
  const filtered = {
    endpoints: [],
    apis: [],
    graphql: [],
    config: [],
    other: []
  };

  // Apply search filter
  if (searchTerm) {
    filtered.endpoints = allData.endpoints.filter(e => e.toLowerCase().includes(searchTerm));
    filtered.apis = allData.apis.filter(e => e.toLowerCase().includes(searchTerm));
    filtered.graphql = allData.graphql.filter(e => e.toLowerCase().includes(searchTerm));
    filtered.config = allData.config.filter(e => e.toLowerCase().includes(searchTerm));
    filtered.other = allData.other.filter(e => e.toLowerCase().includes(searchTerm));
  } else {
    filtered.endpoints = [...allData.endpoints];
    filtered.apis = [...allData.apis];
    filtered.graphql = [...allData.graphql];
    filtered.config = [...allData.config];
    filtered.other = [...allData.other];
  }

  return filtered;
}

const CATEGORY_ICONS = {
  endpoints: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z" /></svg>',
  apis: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" /></svg>',
  graphql: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 20 19H4L12 4Z" /></svg>',
  config: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M18 6l-1.7 1.7M7.7 16.3 6 18M18 18l-1.7-1.7M7.7 7.7 6 6" /></svg>',
  other: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>'
};

const COPY_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></svg>';
const OPEN_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 15 19 5" /><path d="M11 5h8v8" /><path d="M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></svg>';
const CHEVRON_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>';

function createCategorySection(title, icon, items, category) {
  const section = document.createElement('div');
  section.className = 'category-section';
  section.dataset.category = category;

  const header = document.createElement('div');
  header.className = 'category-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'true');

  const headGroup = document.createElement('div');
  headGroup.className = 'category-head-group';

  const categoryIcon = document.createElement('div');
  categoryIcon.className = 'category-icon';
  categoryIcon.innerHTML = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;

  const categoryTitle = document.createElement('span');
  categoryTitle.className = 'category-title';
  categoryTitle.textContent = title;

  headGroup.appendChild(categoryIcon);
  headGroup.appendChild(categoryTitle);

  const headMeta = document.createElement('div');
  headMeta.className = 'category-head-meta';

  const count = document.createElement('div');
  count.className = 'category-count';
  count.textContent = `${items.length} items`;

  const toggle = document.createElement('div');
  toggle.className = 'category-toggle';
  toggle.setAttribute('aria-hidden', 'true');
  toggle.innerHTML = CHEVRON_ICON;

  headMeta.appendChild(count);
  headMeta.appendChild(toggle);

  header.appendChild(headGroup);
  header.appendChild(headMeta);

  const content = document.createElement('div');
  content.className = 'category-content';

  items.forEach(item => {
    const endpointItem = document.createElement('div');
    endpointItem.className = 'endpoint-item';

    // Check verification status
    let badgeClass = 'pending';
    let badgeLabel = 'Pending';
    if (allData.verification && allData.verification[item]) {
      const verified = Object.values(allData.verification[item]).some(v => v.accessible);
      badgeClass = verified ? 'verified' : 'failed';
      badgeLabel = verified ? 'Verified' : 'Failed';
    }

    const text = document.createElement('div');
    text.className = 'endpoint-text';

    const value = document.createElement('span');
    value.textContent = item;
    text.appendChild(value);

    const badge = document.createElement('span');
    badge.className = `verification-badge ${badgeClass}`;
    badge.textContent = badgeLabel;
    text.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'endpoint-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-icon';
    copyBtn.type = 'button';
    copyBtn.title = 'Copy';
    copyBtn.setAttribute('role', 'button');
    copyBtn.setAttribute('aria-label', `Copy ${item}`);
    copyBtn.dataset.action = 'copy';
    copyBtn.dataset.value = item;
    copyBtn.innerHTML = COPY_ICON;

    const openBtn = document.createElement('button');
    openBtn.className = 'action-icon';
    openBtn.type = 'button';
    openBtn.title = 'Open';
    openBtn.setAttribute('role', 'button');
    openBtn.setAttribute('aria-label', `Open ${item}`);
    openBtn.dataset.action = 'open';
    openBtn.dataset.value = item;
    openBtn.innerHTML = OPEN_ICON;

    actions.appendChild(copyBtn);
    actions.appendChild(openBtn);

    endpointItem.appendChild(text);
    endpointItem.appendChild(actions);
    content.appendChild(endpointItem);
  });

  // Toggle functionality (pointer + keyboard)
  function toggleSection() {
    const collapsed = content.classList.toggle('hidden');
    section.classList.toggle('collapsed', collapsed);
    header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  header.addEventListener('click', toggleSection);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSection();
    }
  });

  // Action buttons
  content.addEventListener('click', (e) => {
    const actionIcon = e.target.closest('.action-icon');
    if (actionIcon) {
      const action = actionIcon.dataset.action;
      const value = actionIcon.dataset.value;

      if (action === 'copy') {
        copyToClipboard(value);
      } else if (action === 'open') {
        openUrl(value);
      }
    }
  });

  section.appendChild(header);
  section.appendChild(content);
  return section;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard');
  }).catch(() => {
    showToast('Copy failed', 'error');
  });
}

function openUrl(url) {
  try {
    // If it's a full URL, open it directly
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank');
      return;
    }
    
    // For relative URLs (starting with / or ? or #), use base URL from storage
    if (url.startsWith('/') || url.startsWith('?') || url.startsWith('#')) {
      chrome.storage.local.get('baseUrl', (data) => {
        if (data.baseUrl) {
          let fullUrl;
          if (url.startsWith('/')) {
            fullUrl = data.baseUrl.replace(/\/$/, '') + url;
          } else if (url.startsWith('?') || url.startsWith('#')) {
            // For query params and fragments, append to base URL
            fullUrl = data.baseUrl.replace(/\/$/, '') + '/' + url;
          }
          window.open(fullUrl, '_blank');
        } else {
          showToast('No base URL set — scan a page first', 'error');
        }
      });
    } else {
      showToast('This endpoint is not linkable', 'error');
    }
  } catch (e) {
    showToast('Invalid URL', 'error');
  }
}

function exportAll() {
  const allItems = [
    ...allData.endpoints.map(e => ({ type: 'endpoint', value: e })),
    ...allData.apis.map(e => ({ type: 'api', value: e })),
    ...allData.graphql.map(e => ({ type: 'graphql', value: e })),
    ...allData.config.map(e => ({ type: 'config', value: e })),
    ...allData.other.map(e => ({ type: 'other', value: e }))
  ];

  // Create JSON
  const jsonContent = JSON.stringify(allData, null, 2);
  
  // Create CSV
  const csvContent = 'Type,Value\n' + allItems.map(item => 
    `${item.type},"${item.value.replace(/"/g, '""')}"`
  ).join('\n');

  // Create TXT
  const txtContent = allItems.map(item => item.value).join('\n');

  // Download all formats
  downloadFile(jsonContent, 'jsner-results.json', 'application/json');
  downloadFile(csvContent, 'jsner-results.csv', 'text/csv');
  downloadFile(txtContent, 'jsner-results.txt', 'text/plain');

  showToast('Exported all formats');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function showEmptyState() {
  document.getElementById('emptyState').style.display = 'block';
  document.getElementById('resultsContainer').style.display = 'none';
}

