// background.js - Service Worker para WA Exporter
// Versión simplificada y corregida

console.log("WA Exporter: Service Worker iniciado");

// Inicialización al instalar la extensión
chrome.runtime.onInstalled.addListener(() => {
    console.log("WA Exporter: Extensión instalada");
    
    // Inicializar storage con valores por defecto
    chrome.storage.local.get(['scrapedData'], (data) => {
        if (!data.scrapedData) {
            chrome.storage.local.set({ 
                scrapedData: [],
                isScanning: false,
                scanStatus: 'Listo',
                lastScrollPosition: 0
            });
        }
    });
});

// Inyectar content script cuando se detecta WhatsApp Web
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
        // Intentar inyectar el content script
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }).then(() => {
            console.log('WA Exporter: Content script inyectado en tab', tabId);
        }).catch(err => {
            // Ignorar si ya está inyectado
            if (!err.message.includes('already')) {
                console.log('WA Exporter: Script ya inyectado o error:', err.message);
            }
        });
    }
});

// Manejar mensajes desde popup/sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_SCRAPED_DATA') {
        chrome.storage.local.get(['scrapedData', 'isScanning', 'scanStatus'], (data) => {
            sendResponse(data);
        });
        return true;
    }
    
    if (request.action === 'SAVE_DATA') {
        chrome.storage.local.set(request.data, () => {
            sendResponse({ success: true });
        });
        return true;
    }
    
    if (request.action === 'CLEAR_DATA') {
        chrome.storage.local.set({
            scrapedData: [],
            isScanning: false,
            scanStatus: 'Listo',
            lastScrollPosition: 0
        }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

// Log cuando el service worker se suspende
chrome.runtime.onSuspend.addListener(() => {
    console.log('WA Exporter: Service worker suspendido, datos guardados en storage');
});
