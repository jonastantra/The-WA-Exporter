document.addEventListener('DOMContentLoaded', () => {
  const btnScrape = document.getElementById('btnScrape');
  const formatSelect = document.getElementById('formatSelect');
  const statusArea = document.getElementById('statusArea');
  const statusText = document.getElementById('statusText');

  // Helper to update status
  function updateStatus(msg, type = 'info') {
    statusArea.classList.remove('d-none');
    statusText.textContent = msg;
    statusText.className = `m-0 text-${type === 'error' ? 'danger' : 'muted'}`;
  }

  // Generate file content
  function generateFileContent(data, format) {
    if (format === 'csv') {
      // CSV with BOM for Excel compatibility
      const header = ['Nombre', 'Último Mensaje'];
      const csvContent = [
        header.join(','),
        ...data.map(row => {
          // Escape quotes and wrap in quotes
          const name = `"${(row.name || '').replace(/"/g, '""')}"`;
          const msg = `"${(row.lastMessage || '').replace(/"/g, '""')}"`;
          return `${name},${msg}`;
        })
      ].join('\n');
      return { mime: 'text/csv;charset=utf-8;', content: '\uFEFF' + csvContent, ext: 'csv' };
    } 
    
    else if (format === 'xlsx') {
      // Simple HTML Table approach for basic Excel compatibility without libraries
      // Note: True .xlsx requires a binary zip library (like SheetJS).
      // This creates an .xls file that Excel can open.
      let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
      html += '<head><meta charset="UTF-8"></head><body>';
      html += '<table><thead><tr><th>Nombre</th><th>Último Mensaje</th></tr></thead><tbody>';
      data.forEach(row => {
        html += `<tr><td>${row.name}</td><td>${row.lastMessage}</td></tr>`;
      });
      html += '</tbody></table></body></html>';
      return { mime: 'application/vnd.ms-excel', content: html, ext: 'xls' };
    }
    
    else {
      // TXT
      const txtContent = data.map(row => 
        `Nombre: ${row.name}\nMensaje: ${row.lastMessage}\n-------------------`
      ).join('\n');
      return { mime: 'text/plain', content: txtContent, ext: 'txt' };
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

  btnScrape.addEventListener('click', async () => {
    updateStatus("Escaneando... Esto puede tardar unos minutos. No cierres el popup.", "info");
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes("web.whatsapp.com")) {
      updateStatus("Error: Abre WhatsApp Web primero.", "error");
      return;
    }

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { action: "SCRAPE" }, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus("Error: Refresca la página de WhatsApp e intenta de nuevo.", "error");
        console.error(chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        const count = response.data.length;
        updateStatus(`¡Éxito! ${count} contactos encontrados. Generando archivo...`, "success");
        
        if (count > 0) {
          const format = formatSelect.value;
          const fileData = generateFileContent(response.data, format);
          downloadFile(fileData);
        }
      } else {
        updateStatus("Error: " + (response ? response.error : "Desconocido"), "error");
      }
    });
  });
});

