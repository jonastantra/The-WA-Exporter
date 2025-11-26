document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  // Views in Home Page
  const viewError = document.getElementById('view-error');
  const viewReady = document.getElementById('view-ready');
  const viewSuccess = document.getElementById('view-success');

  // Elements
  const btnRefresh = document.getElementById('btnRefresh');
  const btnScrape = document.getElementById('btnScrape');
  const btnDownload = document.getElementById('btnDownload');
  const btnBack = document.getElementById('btnBack');
  const statusText = document.getElementById('statusText');
  const contactCount = document.getElementById('contactCount');
  const formatOptions = document.querySelectorAll('.format-option');
  const formatInfo = document.getElementById('formatInfo');

  // State
  let scrapedData = [];
  let currentFormat = 'csv';

  // --- Navigation Logic ---
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all
      navItems.forEach(n => n.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));

      // Add active to clicked
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // --- Format Selection Logic ---
  const formatDescriptions = {
    'csv': 'CSV is compatible with Excel or CRM systems.',
    'xlsx': 'Excel file format (.xlsx) for better compatibility.',
    'json': 'JSON format is useful for developers and integrations.',
    'vcard': 'VCard (.vcf) is standard for importing into phone contacts.'
  };

  formatOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      formatOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      currentFormat = opt.getAttribute('data-format');
      formatInfo.textContent = formatDescriptions[currentFormat];
    });
  });

  // --- Main Logic ---

  function showView(viewId) {
    viewError.classList.add('hidden');
    viewReady.classList.add('hidden');
    viewSuccess.classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
  }

  async function checkWhatsAppTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes("web.whatsapp.com")) {
      showView('view-ready');
    } else {
      showView('view-error');
    }
  }

  // Initial Check
  checkWhatsAppTab();

  // Refresh Button
  btnRefresh.addEventListener('click', () => {
    chrome.tabs.reload();
    setTimeout(checkWhatsAppTab, 1000);
  });

  // Scrape Button
  btnScrape.addEventListener('click', async () => {
    statusText.textContent = "Scanning... Please wait.";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, { action: "SCRAPE" }, (response) => {
      if (chrome.runtime.lastError) {
        statusText.textContent = "Error: Please refresh WhatsApp Web.";
        console.error(chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        scrapedData = response.data;
        contactCount.textContent = scrapedData.length;
        showView('view-success');
        statusText.textContent = "";
      } else {
        statusText.textContent = "Error: " + (response ? response.error : "Unknown error");
      }
    });
  });

  // Back Button
  btnBack.addEventListener('click', () => {
    showView('view-ready');
  });

  // Download Button
  btnDownload.addEventListener('click', () => {
    if (scrapedData.length === 0) return;
    const fileData = generateFileContent(scrapedData, currentFormat);
    downloadFile(fileData);
  });

  // --- Helper Functions ---

  function generateFileContent(data, format) {
    if (format === 'csv') {
      const header = ['Name', 'Phone', 'Last Message'];
      const csvContent = [
        header.join(','),
        ...data.map(row => {
          const name = `"${(row.name || '').replace(/"/g, '""')}"`;
          const phone = `"${(row.phone || '').replace(/"/g, '""')}"`; // Assuming phone might be extracted later
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
