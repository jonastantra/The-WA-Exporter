// sidepanel.js - Panel lateral para WA Exporter
// Versión corregida y sincronizada con content.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');

    // Views
    const viewError = document.getElementById('view-error');
    const viewReady = document.getElementById('view-ready');
    const viewSuccess = document.getElementById('view-success');

    // Actions
    const btnRefresh = document.getElementById('btnRefresh');
    const btnStartScrape = document.getElementById('btnStartScrape');
    const btnScrape = document.getElementById('btnScrape');
    const btnDownload = document.getElementById('btnDownload');
    const btnBack = document.getElementById('btnBack');
    const btnClear = document.getElementById('btnClear');

    // Display
    const statusText = document.getElementById('statusText');
    const contactCount = document.getElementById('contactCount');
    const formatOptions = document.querySelectorAll('.format-option');
    const progressInfo = document.getElementById('progressInfo');

    // FAQ - Usando elemento nativo <details>, no necesita JS

    // State
    let scrapedData = [];
    let currentFormat = 'csv';
    let isScanning = false;

    // --- Initialization ---
    initUI();

    // Listen for storage changes (Real-time updates)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.scrapedData) {
                scrapedData = changes.scrapedData.newValue || [];
                updateCount(scrapedData.length);
            }
            if (changes.isScanning) {
                isScanning = changes.isScanning.newValue;
                updateScrapeButton(isScanning);
            }
            if (changes.scanStatus) {
                if (statusText) statusText.textContent = changes.scanStatus.newValue;
            }
            if (changes.lastScrollPosition) {
                updateProgressInfo();
            }
        }
    });

    async function initUI() {
        const data = await chrome.storage.local.get(['scrapedData', 'isScanning', 'scanStatus', 'lastScrollPosition']);

        scrapedData = data.scrapedData || [];
        isScanning = data.isScanning || false;

        // If we have data or scanning, show success view
        if (scrapedData.length > 0 || isScanning) {
            showView('view-success');
            updateCount(scrapedData.length);
            updateScrapeButton(isScanning);
            
            if (data.scanStatus && statusText) {
                statusText.textContent = data.scanStatus;
            }
            
            updateProgressInfo();
        } else {
            checkWhatsAppTab();
        }
    }

    function updateProgressInfo() {
        if (!progressInfo) return;
        
        chrome.storage.local.get(['lastScrollPosition', 'scrapedData'], (data) => {
            if (data.scrapedData && data.scrapedData.length > 0) {
                const count = data.scrapedData.length;
                const savedStatus = isScanning ? '(guardando automáticamente)' : '(guardado)';
                progressInfo.innerHTML = `<small>📁 ${count} contactos ${savedStatus}</small>`;
                progressInfo.style.display = 'block';
            } else {
                progressInfo.style.display = 'none';
            }
        });
    }

    function updateScrapeButton(scanning) {
        if (!btnScrape) return;
        if (scanning) {
            btnScrape.textContent = "⏹ Detener Extracción";
            btnScrape.style.background = "#ef4444";
            btnScrape.classList.add('scanning');
        } else {
            if (scrapedData.length > 0) {
                btnScrape.textContent = "▶ Reanudar Extracción";
                btnScrape.style.background = "#22c55e";
            } else {
                btnScrape.textContent = "▶ Iniciar Extracción";
                btnScrape.style.background = "";
            }
            btnScrape.classList.remove('scanning');
        }
    }

    // --- Helper: Send Message ---
    async function sendMessageToContent(message) {
        // Buscar la pestaña de WhatsApp Web
        const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
        
        if (!tabs || tabs.length === 0) {
            console.warn("WA Exporter: No se encontró pestaña de WhatsApp");
            return { success: false, error: "WhatsApp Web no está abierto" };
        }

        const tab = tabs[0];

        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("Error de conexión:", chrome.runtime.lastError.message);
                    // Intentar inyectar el script
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    }).then(() => {
                        setTimeout(() => {
                            chrome.tabs.sendMessage(tab.id, message, (res) => {
                                resolve(res || { success: false, error: "Conexión fallida" });
                            });
                        }, 500);
                    }).catch(() => {
                        resolve({ success: false, error: "Por favor recarga WhatsApp Web" });
                    });
                } else {
                    resolve(response || { success: true });
                }
            });
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

    // FAQ usa elemento nativo <details> - no requiere JavaScript

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
        const target = document.getElementById(viewId);
        if (target) target.classList.remove('hidden');
    }

    async function checkWhatsAppTab() {
        const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
        if (tabs && tabs.length > 0) {
            showView('view-ready');
        } else {
            showView('view-error');
        }
    }

    function updateCount(count) {
        if (!contactCount) return;
        contactCount.textContent = count;
        updateProgressInfo();
    }

    // Refresh
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
            if (tabs && tabs.length > 0) {
                await chrome.tabs.update(tabs[0].id, { active: true });
                chrome.tabs.reload(tabs[0].id);
            } else {
                await chrome.tabs.create({ url: "https://web.whatsapp.com" });
            }
            setTimeout(checkWhatsAppTab, 3000);
        });
    }

    // Start button from Ready view
    if (btnStartScrape) {
        btnStartScrape.addEventListener('click', async () => {
            showView('view-success');
            if (statusText) statusText.textContent = "Iniciando extracción...";
            
            // IMPORTANTE: Usar START_SCRAPE que es lo que espera content.js
            const response = await sendMessageToContent({ action: "START_SCRAPE" });

            if (response && (response.status === 'started' || response.status === 'already_running')) {
                isScanning = true;
                updateScrapeButton(true);
            } else {
                if (statusText) statusText.textContent = "Error al iniciar. Recarga WhatsApp Web.";
            }
        });
    }

    // Scrape Button (Start / Stop / Resume) in Success view
    if (btnScrape) {
        btnScrape.addEventListener('click', async () => {
            if (isScanning) {
                // Stop
                if (statusText) statusText.textContent = "Deteniendo...";
                await sendMessageToContent({ action: "STOP_SCRAPE" });
                isScanning = false;
                updateScrapeButton(false);
                if (statusText) statusText.textContent = `Pausado: ${scrapedData.length} contactos guardados`;
            } else {
                // Start or Resume - USAR START_SCRAPE
                if (scrapedData.length > 0) {
                    if (statusText) statusText.textContent = `Reanudando desde ${scrapedData.length} contactos...`;
                } else {
                    if (statusText) statusText.textContent = "Iniciando...";
                }
                
                const response = await sendMessageToContent({ action: "START_SCRAPE" });

                if (response && (response.status === 'started' || response.status === 'already_running')) {
                    isScanning = true;
                    updateScrapeButton(true);
                } else {
                    if (statusText) statusText.textContent = "Error al iniciar. Recarga WhatsApp Web.";
                }
            }
        });
    }

    // Clear Data Button
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            if (confirm('¿Estás seguro de que quieres borrar todos los contactos guardados?')) {
                if (isScanning) {
                    await sendMessageToContent({ action: "STOP_SCRAPE" });
                }
                scrapedData = [];
                await chrome.storage.local.set({
                    scrapedData: [],
                    isScanning: false,
                    scanStatus: 'Listo',
                    lastScrollPosition: 0
                });
                updateCount(0);
                updateScrapeButton(false);
                if (statusText) statusText.textContent = 'Datos borrados. Listo para nueva extracción.';
            }
        });
    }

    // Back
    if (btnBack) {
        btnBack.addEventListener('click', async () => {
            if (isScanning) {
                await sendMessageToContent({ action: "STOP_SCRAPE" });
                isScanning = false;
            }
            showView('view-ready');
            updateScrapeButton(false);
        });
    }

    // Download
    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (scrapedData.length === 0) {
                alert('No hay contactos para descargar');
                return;
            }
            const fileData = generateFileContent(scrapedData, currentFormat);
            downloadFile(fileData);
        });
    }

    // --- File Generation ---
    function generateFileContent(data, format) {
        if (format === 'csv') {
            const header = ['Nombre', 'Teléfono', 'Último Mensaje'];
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
            html += '<table><thead><tr><th>Nombre</th><th>Teléfono</th><th>Último Mensaje</th></tr></thead><tbody>';
            data.forEach(row => {
                const escapedName = (row.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const escapedPhone = (row.phone || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const escapedMsg = (row.lastMessage || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `<tr><td>${escapedName}</td><td>${escapedPhone}</td><td>${escapedMsg}</td></tr>`;
            });
            html += '</tbody></table></body></html>';
            return { mime: 'application/vnd.ms-excel', content: html, ext: 'xls' };
        }
        else if (format === 'json') {
            return { mime: 'application/json', content: JSON.stringify(data, null, 2), ext: 'json' };
        }
        else if (format === 'vcard') {
            const vcardContent = data.map(row => {
                const name = (row.name || 'Desconocido').replace(/\n/g, ' ');
                const phone = row.phone || row.name || '';
                return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${phone}\nEND:VCARD`;
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
            filename: `whatsapp-contactos-${timestamp}.${fileData.ext}`,
            saveAs: true
        });
    }

    // --- Auto-refresh ---
    setInterval(() => {
        if (isScanning) {
            updateProgressInfo();
        }
    }, 3000);
});
