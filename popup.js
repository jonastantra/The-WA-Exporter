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
    if (btnDock) {
      btnDock.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
      btnDock.title = "Close Sidebar";
      btnDock.style.background = '#fee2e2';
      btnDock.style.color = '#ef4444';
      btnDock.style.borderColor = '#fecaca';
    }
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

  // --- Helper: Inject Script if Missing ---
  async function ensureContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content.css']
      });
      console.log("Scripts injected successfully");
      return true;
    } catch (err) {
      console.error("Failed to inject scripts:", err);
      return false;
    }
  }

  // --- Helper: Send Message with Retry ---
  async function sendMessageToContent(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return { success: false, error: "No active tab" };

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, message, async (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Connection failed, attempting injection...", chrome.runtime.lastError.message);

          // Attempt to inject script
          const injected = await ensureContentScript(tab.id);
          if (injected) {
            // Retry message after small delay
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, message, (retryResponse) => {
                if (chrome.runtime.lastError) {
                  resolve({ success: false, error: "Please refresh the page" });
                } else {
                  resolve(retryResponse || { success: true });
                }
              });
            }, 100);
          } else {
            resolve({ success: false, error: "Injection failed" });
          }
        } else {
          resolve(response || { success: true });
        }
      });
    });
  }

  // --- Dock / Sidebar Toggle Logic ---
  if (btnDock) {
    btnDock.addEventListener('click', async () => {
      const response = await sendMessageToContent({ action: "TOGGLE_SIDEBAR" });

      if (!response.success && response.error) {
        if (statusText) statusText.textContent = response.error;
        // If injection failed, we might need to reload
        if (response.error.includes("refresh")) {
          chrome.tabs.reload();
          window.close();
        }
        return;
      }

      if (!isSidebar) {
        window.close();
      }
    });
  }

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

      const response = await sendMessageToContent({ action: "SCRAPE" });

      if (response && response.success) {
        scrapedData = response.data;
        chrome.storage.local.set({ scrapedData: scrapedData });
        showView('view-success');
        updateCount(scrapedData.length);
        statusText.textContent = "";
      } else {
        statusText.textContent = "Error: " + (response ? response.error : "Connection failed. Try refreshing.");
      }
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
