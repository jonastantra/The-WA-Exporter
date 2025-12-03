// background.js - Service Worker para Snatch Exporter v2.1
// Sistema de detección y ligado a WhatsApp Web

// Production mode - disable verbose logging
const DEBUG = false;
const log = (...args) => DEBUG && log('[Snatch]', ...args);

log("Service Worker v2.1 iniciado");

// ========================================
// Estado Global de WhatsApp Web
// ========================================
let whatsappTabId = null;
let whatsappWindowId = null;

// ========================================
// Installation & Setup
// ========================================
chrome.runtime.onInstalled.addListener((details) => {
    log("Extensión instalada/actualizada");
    
    // Inicializar storage con valores por defecto
    chrome.storage.local.get(['scrapedData'], (data) => {
        if (!data.scrapedData) {
            chrome.storage.local.set({ 
                scrapedData: [],
                isScanning: false,
                scanStatus: 'Listo',
                lastScrollPosition: 0,
                extractionCount: 0,
                lastRatingPrompt: 0,
                hasRated: false,
                scanCycles: 0
            });
        }
    });

    // Habilitar side panel
    if (chrome.sidePanel) {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
            .catch((error) => console.error('Error setting panel behavior:', error));
    }
});

// ========================================
// Side Panel Control
// ========================================
chrome.action.onClicked.addListener((tab) => {
    if (chrome.sidePanel) {
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

// ========================================
// Funciones de Detección de WhatsApp Web
// ========================================

// Buscar pestaña de WhatsApp Web
async function findWhatsAppWebTab() {
    try {
        const tabs = await chrome.tabs.query({});
        const waTab = tabs.find(tab => 
            tab.url && tab.url.includes('web.whatsapp.com')
        );
        
        if (waTab) {
            whatsappTabId = waTab.id;
            whatsappWindowId = waTab.windowId;
        }
        
        return waTab || null;
    } catch (error) {
        console.error('Error buscando WhatsApp Web:', error);
        return null;
    }
}

// Abrir o enfocar WhatsApp Web
async function openOrFocusWhatsAppWeb() {
    try {
        const existingTab = await findWhatsAppWebTab();
        
        if (existingTab) {
            // Si ya existe, enfocarla
            await chrome.tabs.update(existingTab.id, { active: true });
            await chrome.windows.update(existingTab.windowId, { focused: true });
            whatsappTabId = existingTab.id;
            whatsappWindowId = existingTab.windowId;
            return existingTab;
        } else {
            // Si no existe, crearla
            const newTab = await chrome.tabs.create({ 
                url: 'https://web.whatsapp.com',
                active: true
            });
            whatsappTabId = newTab.id;
            whatsappWindowId = newTab.windowId;
            return newTab;
        }
    } catch (error) {
        console.error('Error abriendo WhatsApp Web:', error);
        throw error;
    }
}

// Enfocar la pestaña de WhatsApp
async function focusWhatsAppTab() {
    try {
        if (whatsappTabId) {
            await chrome.tabs.update(whatsappTabId, { active: true });
            if (whatsappWindowId) {
                await chrome.windows.update(whatsappWindowId, { focused: true });
            }
            return true;
        } else {
            // Si no tenemos el ID, buscar de nuevo
            const tab = await findWhatsAppWebTab();
            if (tab) {
                await chrome.tabs.update(tab.id, { active: true });
                await chrome.windows.update(tab.windowId, { focused: true });
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error enfocando WhatsApp:', error);
        // La pestaña puede haberse cerrado
        whatsappTabId = null;
        whatsappWindowId = null;
        return false;
    }
}

// Verificar si WhatsApp Web está cargado completamente
async function checkWhatsAppLoaded(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                // Verificar múltiples elementos que indican que WhatsApp cargó
                const paneExists = document.querySelector('#pane-side') !== null;
                const appExists = document.querySelector('#app') !== null;
                const sidebarExists = document.querySelector('[data-testid="chat-list"]') !== null ||
                                     document.querySelector('div[role="grid"]') !== null;
                return paneExists || (appExists && sidebarExists);
            }
        });
        return results[0]?.result || false;
    } catch (error) {
        log('WhatsApp aún cargando...');
        return false;
    }
}

// ========================================
// WhatsApp Tab Detection (content script is auto-injected via manifest)
// ========================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('web.whatsapp.com')) {
        // Actualizar referencia si es WhatsApp Web
        whatsappTabId = tabId;
        whatsappWindowId = tab.windowId;
        log('WhatsApp Web detectado en tab', tabId);
        
        // Notificar al sidebar que WhatsApp está listo
        // El content script ya está inyectado por el manifest
        setTimeout(() => {
            notifySidebar({ action: 'whatsappReady', tabId: tabId });
        }, 1000);
    }
});

// ========================================
// Monitoreo de Pestañas
// ========================================

// Detectar cuando se cierra la pestaña de WhatsApp
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === whatsappTabId) {
        log('Snatch Exporter: Pestaña de WhatsApp cerrada');
        whatsappTabId = null;
        whatsappWindowId = null;
        notifySidebar({ action: 'whatsappTabClosed' });
    }
});

// Detectar cambios de pestaña activa
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        const isWhatsAppTab = tab.url && tab.url.includes('web.whatsapp.com');
        
        notifySidebar({
            action: 'tabChanged',
            isWhatsAppTab: isWhatsAppTab,
            currentTabId: activeInfo.tabId,
            whatsappTabId: whatsappTabId
        });
    } catch (error) {
        log('Error obteniendo info de pestaña:', error);
    }
});

// Detectar navegación fuera de WhatsApp en la misma pestaña
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === whatsappTabId && changeInfo.url) {
        if (!changeInfo.url.includes('web.whatsapp.com')) {
            log('Snatch Exporter: Usuario navegó fuera de WhatsApp');
            whatsappTabId = null;
            whatsappWindowId = null;
            notifySidebar({ action: 'whatsappTabClosed' });
        }
    }
});

// Función auxiliar para notificar al sidebar
function notifySidebar(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // El sidebar puede no estar abierto, ignorar error
    });
}

// ========================================
// Message Handling Principal
// ========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    log('Snatch Exporter BG: Mensaje recibido:', request.action);

    switch (request.action) {
        // === Sistema de Detección WhatsApp ===
        case 'checkWhatsAppWeb':
            findWhatsAppWebTab().then(tab => {
                if (tab) {
                    sendResponse({ 
                        found: true, 
                        tabId: tab.id,
                        windowId: tab.windowId,
                        url: tab.url 
                    });
                } else {
                    sendResponse({ found: false });
                }
            });
            return true;

        case 'openWhatsAppWeb':
            openOrFocusWhatsAppWeb().then(tab => {
                sendResponse({ 
                    success: true,
                    tabId: tab.id,
                    windowId: tab.windowId,
                    url: tab.url 
                });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true;

        case 'focusWhatsAppTab':
            focusWhatsAppTab().then(success => {
                sendResponse({ success: success });
            });
            return true;

        case 'checkWhatsAppLoaded':
            if (request.tabId) {
                checkWhatsAppLoaded(request.tabId).then(loaded => {
                    sendResponse({ loaded: loaded });
                });
            } else {
                sendResponse({ loaded: false });
            }
            return true;

        case 'getWhatsAppTabId':
            sendResponse({ 
                tabId: whatsappTabId,
                windowId: whatsappWindowId
            });
            return true;

        // === Sistema de Datos ===
        case 'GET_SCRAPED_DATA':
            chrome.storage.local.get(['scrapedData', 'isScanning', 'scanStatus'], (data) => {
                sendResponse(data);
            });
            return true;

        case 'SAVE_DATA':
            chrome.storage.local.set(request.data, () => {
                sendResponse({ success: true });
            });
            return true;

        case 'CLEAR_DATA':
            chrome.storage.local.set({
                scrapedData: [],
                isScanning: false,
                scanStatus: 'Listo',
                lastScrollPosition: 0,
                scanCycles: 0
            }, () => {
                sendResponse({ success: true });
            });
            return true;

        // === Sistema de Extracción ===
        case 'extractionCompleted':
            handleExtractionComplete(request.contactCount);
            sendResponse({ success: true });
            return true;

        case 'updateScanCycles':
            chrome.storage.local.set({ scanCycles: request.count });
            sendResponse({ success: true });
            return true;

        default:
            break;
    }
});

// ========================================
// Extraction Complete Handler
// ========================================
async function handleExtractionComplete(contactCount) {
    log('Snatch Exporter: Extracción completada con', contactCount, 'contactos');

    const data = await chrome.storage.local.get(['extractionCount']);
    const count = (data.extractionCount || 0) + 1;
    await chrome.storage.local.set({ extractionCount: count });

    notifySidebar({
        action: 'showRatingPrompt',
        count: count,
        contactCount: contactCount
    });
}

// ========================================
// Keep Alive durante escaneo
// ========================================
let keepAliveInterval = null;

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.isScanning) {
        if (changes.isScanning.newValue) {
            keepAliveInterval = setInterval(() => {
                chrome.storage.local.get(['isScanning'], () => {});
            }, 20000);
        } else {
            if (keepAliveInterval) {
                clearInterval(keepAliveInterval);
                keepAliveInterval = null;
            }
        }
    }
});

// ========================================
// Ping periódico para verificar WhatsApp
// ========================================
setInterval(() => {
    if (whatsappTabId) {
        chrome.tabs.get(whatsappTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
                whatsappTabId = null;
                whatsappWindowId = null;
                notifySidebar({ action: 'whatsappTabClosed' });
            }
        });
    }
}, 30000);

// ========================================
// Lifecycle Events
// ========================================
chrome.runtime.onSuspend.addListener(() => {
    log('Snatch Exporter: Service worker suspendido');
});
