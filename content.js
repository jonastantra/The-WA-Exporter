// Content Script for WhatsApp Contact Exporter
// Versión 2.1 - Corregido y optimizado
// Ejecuta en el contexto de WhatsApp Web

console.log('WA Exporter: Content Script cargado v2.1');

let isScanning = false;
let scanIntervalId = null;

// Escucha de mensajes desde popup/sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('WA Exporter: Mensaje recibido:', request.action);
    
    switch(request.action) {
        case 'START_SCRAPE':
            if (!isScanning) {
                startExtraction();
                sendResponse({ status: 'started' });
            } else {
                sendResponse({ status: 'already_running' });
            }
            break;
            
        case 'STOP_SCRAPE':
            stopExtraction();
            sendResponse({ status: 'stopped' });
            break;
            
        case 'checkWhatsAppStatus':
            const paneExists = document.querySelector('#pane-side') !== null;
            const appLoaded = document.querySelector('#app') !== null;
            sendResponse({ 
                isLoaded: paneExists && appLoaded,
                paneExists: paneExists,
                appLoaded: appLoaded
            });
            break;
            
        case 'GET_STATUS':
            sendResponse({ 
                isScanning: isScanning,
                ready: document.querySelector('#pane-side') !== null
            });
            break;
            
        default:
            sendResponse({ status: 'unknown_action' });
    }
    
    return true; // Mantener el canal abierto para respuestas asíncronas
});

// Auto-resume cuando la página se recarga
(async function autoResume() {
    try {
        const storage = await chrome.storage.local.get(['isScanning', 'lastScrollPosition']);
        if (storage.isScanning) {
            console.log('WA Exporter: Intentando auto-reanudar...');
            let attempts = 0;
            const waitForWA = setInterval(() => {
                attempts++;
                const chatList = document.querySelector('#pane-side');
                if (chatList) {
                    clearInterval(waitForWA);
                    console.log('WA Exporter: WhatsApp cargado, reanudando...');
                    if (storage.lastScrollPosition) {
                        chatList.scrollTop = storage.lastScrollPosition;
                    }
                    setTimeout(() => startExtraction(), 1500);
                } else if (attempts > 30) {
                    clearInterval(waitForWA);
                    console.log('WA Exporter: Tiempo de espera agotado para auto-resume');
                    chrome.storage.local.set({ isScanning: false });
                }
            }, 1000);
        }
    } catch (e) {
        console.error('WA Exporter: Error en auto-resume:', e);
    }
})();

// Encuentra el contenedor de la lista de chats con múltiples selectores
function findChatContainer() {
    // Selectores ordenados por probabilidad de éxito (2024)
    const selectors = [
        '#pane-side',
        '[data-testid="chat-list"]',
        'div[aria-label*="Chat list"]',
        'div[aria-label*="Lista de chats"]',
        'div[aria-label*="chat list"]',
        '#app div[tabindex="-1"] > div > div'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            // Verificar que es scrollable
            if (element.scrollHeight > element.clientHeight) {
                console.log('WA Exporter: Contenedor encontrado con selector:', selector);
                return element;
            }
            // Si el elemento existe pero no es scrollable, buscar hijo scrollable
            const scrollableChild = element.querySelector('[role="grid"]') || 
                                   element.querySelector('[role="list"]') ||
                                   element.querySelector('div[style*="overflow"]');
            if (scrollableChild && scrollableChild.scrollHeight > scrollableChild.clientHeight) {
                console.log('WA Exporter: Contenedor hijo scrollable encontrado');
                return scrollableChild;
            }
            return element;
        }
    }

    console.error('WA Exporter: No se pudo encontrar el contenedor de chats');
    return null;
}

// Lógica principal de extracción
async function startExtraction() {
    console.log('WA Exporter: Iniciando extracción...');
    isScanning = true;

    // Guardar estado
    await chrome.storage.local.set({
        isScanning: true,
        scanStatus: 'Escaneando...'
    });

    // Encontrar contenedor
    const chatList = findChatContainer();
    if (!chatList) {
        console.error('WA Exporter: Lista de chats no encontrada');
        await chrome.storage.local.set({ 
            scanStatus: 'Error: Lista de chats no encontrada',
            isScanning: false
        });
        isScanning = false;
        return;
    }

    console.log('WA Exporter: Contenedor encontrado, iniciando scroll...');

    // Cargar datos existentes para evitar duplicados
    const storage = await chrome.storage.local.get(['scrapedData', 'lastScrollPosition']);
    const uniqueContacts = new Map();

    if (storage.scrapedData && Array.isArray(storage.scrapedData)) {
        storage.scrapedData.forEach(c => uniqueContacts.set(c.id, c));
        console.log(`WA Exporter: Cargados ${uniqueContacts.size} contactos existentes`);
    }

    // Restaurar posición de scroll si se está reanudando
    if (storage.lastScrollPosition && storage.lastScrollPosition > 0) {
        chatList.scrollTop = storage.lastScrollPosition;
        console.log(`WA Exporter: Scroll restaurado a ${storage.lastScrollPosition}`);
    }

    let previousScrollHeight = chatList.scrollTop;
    let noChangeCount = 0;
    const maxNoChange = 35;
    let scanCount = 0;
    let lastSaveTime = Date.now();

    // Bucle de scroll
    const scanLoop = async () => {
        if (!isScanning) {
            console.log('WA Exporter: Escaneo detenido por el usuario');
            return;
        }

        scanCount++;

        // 1. Extraer todos los contactos visibles
        const newContacts = scrapeAllVisibleContacts(chatList);
        let addedCount = 0;

        newContacts.forEach(c => {
            if (!uniqueContacts.has(c.id)) {
                uniqueContacts.set(c.id, c);
                addedCount++;
            }
        });

        const statusMsg = `Escaneando... ${uniqueContacts.size} contactos (scroll ${scanCount})`;

        // 2. Guardar progreso periódicamente
        const now = Date.now();
        if (addedCount > 0 || now - lastSaveTime > 2000) {
            await chrome.storage.local.set({
                scrapedData: Array.from(uniqueContacts.values()),
                totalContacts: uniqueContacts.size,
                lastScrollPosition: chatList.scrollTop,
                scanStatus: statusMsg
            });
            lastSaveTime = now;
        }

        if (scanCount % 5 === 0 || addedCount > 0) {
            console.log(`WA Exporter: Scan ${scanCount} - Visibles: ${newContacts.length}, Nuevos: ${addedCount}, Total: ${uniqueContacts.size}`);
        }

        // 3. Hacer scroll
        const scrollBefore = chatList.scrollTop;
        const scrollAmount = 500 + Math.floor(Math.random() * 200);
        
        // Método 1: scrollTop directo
        chatList.scrollTop += scrollAmount;
        
        // Método 2: scrollBy como respaldo
        if (Math.abs(chatList.scrollTop - scrollBefore) < 50) {
            chatList.scrollBy({ top: scrollAmount, behavior: 'auto' });
        }

        // Método 3: Simular wheel event cada 5 scrolls
        if (scanCount % 5 === 0) {
            const wheelEvent = new WheelEvent('wheel', {
                deltaY: scrollAmount,
                bubbles: true,
                cancelable: true
            });
            chatList.dispatchEvent(wheelEvent);
        }

        // Verificar si llegamos al final
        const maxScroll = chatList.scrollHeight - chatList.clientHeight;
        const isAtBottom = chatList.scrollTop >= maxScroll - 20;
        const scrollDifference = Math.abs(chatList.scrollTop - previousScrollHeight);

        if (scrollDifference < 10 || isAtBottom) {
            noChangeCount++;
            if (noChangeCount % 5 === 0) {
                console.log(`WA Exporter: Sin cambio en scroll (${noChangeCount}/${maxNoChange})`);
            }
        } else {
            noChangeCount = 0;
            previousScrollHeight = chatList.scrollTop;
        }

        // Condición de parada
        if (noChangeCount >= maxNoChange) {
            console.log('WA Exporter: Fin de la lista alcanzado.');
            
            // Guardar final
            await chrome.storage.local.set({
                scrapedData: Array.from(uniqueContacts.values()),
                totalContacts: uniqueContacts.size,
                lastScrollPosition: 0,
                scanStatus: `✓ Completado: ${uniqueContacts.size} contactos`,
                isScanning: false
            });
            
            stopExtraction();
            return;
        }

        // Continuar con delay variable
        const delay = 180 + Math.floor(Math.random() * 120);
        scanIntervalId = setTimeout(scanLoop, delay);
    };

    // Iniciar el bucle
    scanLoop();
}

function stopExtraction() {
    console.log('WA Exporter: Deteniendo extracción...');
    isScanning = false;
    
    if (scanIntervalId) {
        clearTimeout(scanIntervalId);
        scanIntervalId = null;
    }
    
    chrome.storage.local.set({ isScanning: false });
}

// Extracción con múltiples estrategias
function scrapeAllVisibleContacts(container) {
    const contacts = [];
    const seenIds = new Set();

    // Estrategia 1: role="listitem" (más común)
    scrapeWithSelector(container, 'div[role="listitem"]', contacts, seenIds);

    // Estrategia 2: data-testid (WhatsApp más reciente)
    scrapeWithSelector(container, '[data-testid="cell-frame-container"]', contacts, seenIds);
    scrapeWithSelector(container, '[data-testid="list-item-content"]', contacts, seenIds);
    scrapeWithSelector(container, '[data-testid="chat-row"]', contacts, seenIds);

    // Estrategia 3: aria-label
    scrapeWithSelector(container, '[aria-label*="Chat with"]', contacts, seenIds);
    scrapeWithSelector(container, '[aria-label*="Conversación con"]', contacts, seenIds);

    // Estrategia 4: Estructura de div anidada (fallback)
    const directRows = container.querySelectorAll(':scope > div > div');
    directRows.forEach(row => {
        if (row.innerText && row.innerText.trim().length > 0 && row.offsetHeight > 50 && row.offsetHeight < 150) {
            const contact = extractContactFromElement(row);
            if (contact && !seenIds.has(contact.id)) {
                seenIds.add(contact.id);
                contacts.push(contact);
            }
        }
    });

    return contacts;
}

function scrapeWithSelector(container, selector, contacts, seenIds) {
    try {
        const elements = container.querySelectorAll(selector);
        elements.forEach(el => {
            const contact = extractContactFromElement(el);
            if (contact && !seenIds.has(contact.id)) {
                seenIds.add(contact.id);
                contacts.push(contact);
            }
        });
    } catch (e) {
        console.warn('WA Exporter: Error con selector', selector, e);
    }
}

function extractContactFromElement(element) {
    try {
        if (!element || !element.innerText) return null;

        const text = element.innerText.trim();
        if (!text || text.length === 0) return null;

        const textLines = text.split('\n').filter(t => t.trim().length > 0);
        if (textLines.length === 0) return null;

        let rawName = textLines[0].trim();
        if (!rawName || rawName.length === 0) return null;

        // Filtrar elementos del sistema de WhatsApp
        const skipPatterns = [
            'archived', 'archivados', 'archiv',
            'broadcast', 'difusión', 'lista de difusión',
            'starred', 'destacados',
            'settings', 'ajustes', 'configuración',
            'new chat', 'nuevo chat',
            'communities', 'comunidades',
            'status', 'estados',
            'channels', 'canales',
            'unread', 'no leídos',
            'muted', 'silenciado',
            'new group', 'nuevo grupo',
            'search', 'buscar'
        ];

        const lowerName = rawName.toLowerCase();
        if (skipPatterns.some(p => lowerName.includes(p))) return null;
        
        // Saltar si es solo un emoji o muy corto
        if (rawName.length < 2) return null;

        // Extraer datos
        let name = rawName;
        let phone = '';

        // Verificar si el nombre es un número de teléfono
        const cleanedForPhone = rawName.replace(/[\s\-\(\)\+\u00A0]/g, '');
        if (/^\d{7,15}$/.test(cleanedForPhone)) {
            phone = rawName;
        }

        // Buscar teléfono en otras líneas
        if (!phone) {
            for (let i = 1; i < Math.min(textLines.length, 4); i++) {
                const line = textLines[i].trim();
                const cleanedLine = line.replace(/[\s\-\(\)\+\u00A0]/g, '');
                if (/^\d{7,15}$/.test(cleanedLine)) {
                    phone = line;
                    break;
                }
            }
        }

        // Último mensaje
        let lastMessage = '';
        if (textLines.length >= 3) {
            lastMessage = textLines.slice(2).join(' ').substring(0, 200);
        } else if (textLines.length === 2 && textLines[1].length > 8) {
            lastMessage = textLines[1].substring(0, 200);
        }

        // Limpiar caracteres especiales del nombre
        name = name.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

        // Crear ID único
        const id = phone ? `${name}_${phone}`.replace(/\s+/g, '_') : name.replace(/\s+/g, '_');

        return {
            id: id,
            name: name,
            phone: phone,
            lastMessage: lastMessage,
            extractedAt: new Date().toISOString()
        };

    } catch (e) {
        // No logear cada error para evitar spam en consola
        return null;
    }
}

// Indicador visual de que el script está activo
console.log('WA Exporter: Script listo y esperando comandos');
