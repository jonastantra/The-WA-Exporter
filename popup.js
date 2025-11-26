document.addEventListener('DOMContentLoaded', () => {
  // --- Elements ---
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const btnDock = document.getElementById('btnDock');

  // Views
  const viewError = document.getElementById('view-error');
  const viewReady = document.getElementById('view-ready');
  const viewSuccess = document.getElementById('view-success');

  // Actions
  const btnRefresh = document.getElementById('btnRefresh');
  const btnScrape = document.getElementById('btnScrape');
  const btnDownload = document.getElementById('btnDownload');
  const btnBack = document.getElementById('btnBack');

  // Display
  const statusText = document.getElementById('statusText');
  const contactCount = document.getElementById('contactCount');
  const formatOptions = document.querySelectorAll('.format-option');

  // FAQ
  const faqItems = document.querySelectorAll('.faq-item');

  // State
  let scrapedData = [];
  let currentFormat = 'csv';

  // --- Initialization ---

  // Detect context
  const isSidebar = window.location.pathname.includes('sidebar.html');

  if (isSidebar) {
    // In Sidebar mode:
    // 1. Change Dock button to Close/Undock icon
    if (btnDock) {
      btnDock.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
      btnDock.title = "Close Sidebar";
      // Add a slight background to make it stand out
      btnDock.style.background = '#fee2e2';
      btnDock.style.color = '#ef4444';
      btnDock.style.borderColor = '#fecaca';
    }
    // 2. Ensure body fits iframe
    document.body.style.width = '100%';
    document.body.style.height = '100vh';
  }

  // Load saved data
  chrome.storage.local.get(['scrapedData'], (result) => {
    if (result.scrapedData && result.scrapedData.length > 0) {
      scrapedData = result.scrapedData;
      updateCount(scrapedData.length);
      showView('view-success');
    } else {
      checkWhatsAppTab();
    }
  });

  // --- Navigation ---
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // --- FAQ Logic ---
  faqItems.forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
      item.classList.toggle('open');
      const span = item.querySelector('span');
      if (span) span.textContent = item.classList.contains('open') ? '-' : '+';
    });
  });

  // --- Dock / Sidebar Toggle Logic ---
  if (btnDock) {
    btnDock.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
          console.error("No active tab found");
          return;
        }

        // Send toggle message
        chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_SIDEBAR" }, (response) => {
          // Handle connection errors (e.g., content script not ready)
          if (chrome.runtime.lastError) {
            console.warn("Connection error:", chrome.runtime.lastError.message);
            if (statusText) statusText.textContent = "Please refresh WhatsApp Web first.";
            return;
          }

          // If we are in Popup mode, close the popup after toggling
          if (!isSidebar) {
            window.close();
          }
        });

      } catch (err) {
        console.error("Dock error:", err);
      }
    });
  }

  // --- Format Selection ---
  formatOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      formatOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      currentFormat = opt.getAttribute('data-format');
    });
  });

  // --- Core Logic ---

  function showView(viewId) {
    if (!viewError || !viewReady || !viewSuccess) return;

    viewError.classList.add('hidden');
    viewReady.classList.add('hidden');
    viewSuccess.classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
  }

  async function checkWhatsAppTab() {
    // If we already have data shown, don't override
    if (viewSuccess && !viewSuccess.classList.contains('hidden')) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes("web.whatsapp.com")) {
      showView('view-ready');
    } else {
      showView('view-error');
    }
  }

  function updateCount(target) {
    if (!contactCount) return;
    let current = 0;
    const increment = Math.ceil(target / 30);
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      contactCount.textContent = current;
    }, 20);
  }

  // Refresh
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      chrome.tabs.reload();
      setTimeout(checkWhatsAppTab, 2000);
    });
  }

  // Scrape
  if (btnScrape) {
    btnScrape.addEventListener('click', async () => {
      statusText.textContent = "Initializing scanner...";
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) return;

      chrome.tabs.sendMessage(tab.id, { action: "SCRAPE" }, (response) => {
        if (chrome.runtime.lastError) {
          statusText.textContent = "Connection error. Please refresh WhatsApp.";
          return;
        }

        if (response && response.success) {
          scrapedData = response.data;
          // Save to storage
          chrome.storage.local.set({ scrapedData: scrapedData });

          showView('view-success');
          updateCount(scrapedData.length);
          statusText.textContent = "";
        } else {
          statusText.textContent = "Error: " + (response ? response.error : "Unknown");
        }
      });
    });
  }

  // Back / Reset
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      scrapedData = [];
      chrome.storage.local.remove('scrapedData');
      showView('view-ready');
    });
  }

  // Download
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      if (scrapedData.length === 0) return;
      const fileData = generateFileContent(scrapedData, currentFormat);
      downloadFile(fileData);
    });
  }

  // --- File Generation ---
  function generateFileContent(data, format) {
    if (format === 'csv') {
      const header = ['Name', 'Phone', 'Last Message'];
      const csvContent = [
        header.join(','),
        ...data.map(row => {
          const name = `"${(row.name || '').replace(/"/g, '""')}"`;
          const phone = `"${(row.phone || '').replace(/"/g, '""')}"`;
          const msg = `"${(row.lastMessage || '').replace(/"/g, '""')}"`;
          return `${name},${phone},${msg}`;
        })
      ].join('\n');
      return { mime: 'text/csv;charset=utf-8;', content: '\uFEFF' + csvContent, ext: 'csv' };
    }
    else if (format === 'xlsx') {
      let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
      html += '<head><meta charset="UTF-8"></head><body>';
      html += '<table><thead><tr><th>Name</th><th>Phone</th><th>Last Message</th></tr></thead><tbody>';
      data.forEach(row => {
        html += `<tr><td>${row.name}</td><td>${row.phone || ''}</td><td>${row.lastMessage}</td></tr>`;
      });
      html += '</tbody></table></body></html>';
      return { mime: 'application/vnd.ms-excel', content: html, ext: 'xls' };
    }
    else if (format === 'json') {
      return { mime: 'application/json', content: JSON.stringify(data, null, 2), ext: 'json' };
    }
    else if (format === 'vcard') {
      const vcardContent = data.map(row => {
        return `BEGIN:VCARD\nVERSION:3.0\nFN:${row.name}\nTEL;TYPE=CELL:${row.phone || row.name}\nEND:VCARD`;
      }).join('\n');
      return { mime: 'text/vcard', content: vcardContent, ext: 'vcf' };
    }
  }

  function downloadFile(fileData) {
    const blob = new Blob([fileData.content], { type: fileData.mime });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    chrome.downloads.download({
      url: url,
      filename: `whatsapp-contacts-${timestamp}.${fileData.ext}`,
      saveAs: true
    });
  }
});
