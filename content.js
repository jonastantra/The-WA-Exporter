// Content Script for WhatsApp Contact Exporter
// Versión 2.2 - Selectores actualizados y robustos (Nov 2025)
// Ejecuta en el contexto de WhatsApp Web

console.log('WA Exporter: Content Script cargado v2.2');

let isScanning = false;
let scanIntervalId = null;
let debugMode = true; // Activar para ver logs detallados

// Escucha de mensajes desde popup/sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('WA Exporter: Mensaje recibido:', request.action);
    
    switch(request.action) {
        case 'PING':
            // Handler PING - Verificar si el script está activo
            sendResponse({ 
                success: true, 
                status: 'active',
                message: 'Content script activo y funcionando',
                isScanning: isScanning
            });
            break;
            
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
            console.warn('WA Exporter: Acción desconocida:', request.action);
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
    // Selectores actualizados para WhatsApp Web 2024-2025
    // Ordenados por probabilidad de éxito
    const selectors = [
        // Selectores primarios más estables
        '#pane-side',
        '[data-testid="chat-list"]',
        '[data-testid="pane-side"]',
        
        // Selectores por estructura
        'div[role="grid"][tabindex="0"]',
        'div[role="list"]',
        
        // Multi-idioma para aria-label (WhatsApp actualiza esto frecuentemente)
        'div[aria-label*="Chat list"]',
        'div[aria-label*="chat list"]',
        'div[aria-label*="Lista de chats"]',
        'div[aria-label*="Lista de conversaciones"]',
        'div[aria-label*="Chats"]',
        'div[aria-label*="Liste de discussions"]', // Francés
        'div[aria-label*="Chatliste"]',            // Alemán
        'div[aria-label*="Lista di chat"]',        // Italiano
        'div[aria-label*="Lista de conversas"]',   // Portugués
        'div[aria-label*="Sohbet listesi"]',       // Turco
        'div[aria-label*="聊天列表"]',              // Chino
        'div[aria-label*="チャットリスト"]',         // Japonés
        'div[aria-label*="채팅 목록"]',             // Coreano
        'div[aria-label*="قائمة المحادثات"]',       // Árabe
        'div[aria-label*="Список чатов"]',         // Ruso
        
        // Fallbacks por estructura DOM
        '#app div[tabindex="-1"] > div > div',
        '#main > div > div > div',
        'div._aigv', // Clase interna de WhatsApp (puede cambiar)
    ];

    if (debugMode) console.log('WA Exporter: Buscando contenedor de chats...');

    for (const selector of selectors) {
        try {
            const element = document.querySelector(selector);
            if (element) {
                // Verificar que es scrollable (tiene contenido más alto que su viewport)
                if (element.scrollHeight > element.clientHeight + 50) {
                    if (debugMode) console.log('WA Exporter: ✅ Contenedor scrollable encontrado:', selector);
                    return element;
                }
                
                // Si el elemento existe pero no es scrollable, buscar hijo scrollable
                const scrollableSelectors = [
                    '[role="grid"]',
                    '[role="list"]',
                    'div[style*="overflow"]',
                    'div[style*="scroll"]',
                    ':scope > div > div'
                ];
                
                for (const childSel of scrollableSelectors) {
                    const scrollableChild = element.querySelector(childSel);
                    if (scrollableChild && scrollableChild.scrollHeight > scrollableChild.clientHeight + 50) {
                        if (debugMode) console.log('WA Exporter: ✅ Contenedor hijo scrollable encontrado via:', selector, '->', childSel);
                        return scrollableChild;
                    }
                }
                
                // Si encontramos el elemento pero no es scrollable, puede que la lista esté vacía
                // o que WhatsApp aún está cargando
                if (debugMode) console.log('WA Exporter: ⚠️ Elemento encontrado pero no scrollable:', selector);
            }
        } catch (e) {
            if (debugMode) console.warn('WA Exporter: Error con selector', selector, e.message);
        }
    }

    // Último intento: buscar cualquier contenedor scrollable grande en el panel izquierdo
    const leftPanel = document.querySelector('#app > div > div > div');
    if (leftPanel) {
        const allDivs = leftPanel.querySelectorAll('div');
        for (const div of allDivs) {
            if (div.scrollHeight > 500 && div.scrollHeight > div.clientHeight + 100) {
                const hasClickableChildren = div.querySelector('[role="button"], [role="listitem"], [role="row"]');
                if (hasClickableChildren) {
                    if (debugMode) console.log('WA Exporter: ✅ Contenedor encontrado por búsqueda heurística');
                    return div;
                }
            }
        }
    }

    console.error('WA Exporter: ❌ No se pudo encontrar el contenedor de chats');
    console.error('WA Exporter: Verifica que estés en la pantalla principal de WhatsApp Web');
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

    // Estrategia 1: role="listitem" (muy común en WhatsApp)
    scrapeWithSelector(container, 'div[role="listitem"]', contacts, seenIds);

    // Estrategia 2: role="row" (usado en listas virtualizadas de WhatsApp)
    scrapeWithSelector(container, 'div[role="row"]', contacts, seenIds);

    // Estrategia 3: data-testid (WhatsApp actualizado 2024-2025)
    const testIdSelectors = [
        '[data-testid="cell-frame-container"]',
        '[data-testid="list-item-content"]',
        '[data-testid="chat-row"]',
        '[data-testid="conversation-panel-wrapper"]',
        '[data-testid="chatlist-item"]',
        '[data-testid="chat-list-item"]'
    ];
    testIdSelectors.forEach(sel => scrapeWithSelector(container, sel, contacts, seenIds));

    // Estrategia 4: aria-label (múltiples idiomas)
    const ariaSelectors = [
        '[aria-label*="Chat with"]',
        '[aria-label*="Conversación con"]',
        '[aria-label*="Chat con"]',
        '[aria-label*="Conversation with"]',
        '[aria-label*="Discuter avec"]',
        '[aria-label*="Chat mit"]',
        '[aria-label*="Conversa com"]',
        '[aria-label*="与"]', // Chino
        '[aria-label*="채팅"]' // Coreano
    ];
    ariaSelectors.forEach(sel => scrapeWithSelector(container, sel, contacts, seenIds));

    // Estrategia 5: role="gridcell" (alternativa en algunas versiones)
    scrapeWithSelector(container, 'div[role="gridcell"]', contacts, seenIds);

    // Estrategia 6: Búsqueda por estructura de altura (fallback)
    // WhatsApp usa elementos de altura fija (72px aprox) para cada chat
    const allDivs = container.querySelectorAll(':scope > div > div, :scope > div');
    allDivs.forEach(row => {
        const height = row.offsetHeight;
        // Los chats típicamente tienen entre 60-90px de altura
        if (height > 55 && height < 100) {
            const text = row.innerText;
            if (text && text.trim().length > 0) {
                const contact = extractContactFromElement(row);
                if (contact && !seenIds.has(contact.id)) {
                    seenIds.add(contact.id);
                    contacts.push(contact);
                }
            }
        }
    });

    // Estrategia 7: Elementos con avatar (indicador de chat)
    const avatarContainers = container.querySelectorAll('div:has(img[src*="pps.whatsapp.net"]), div:has(span[data-testid="default-user"])');
    avatarContainers.forEach(el => {
        // Subir al contenedor padre que tiene toda la info del chat
        let parent = el.parentElement;
        for (let i = 0; i < 5 && parent; i++) {
            if (parent.offsetHeight > 55 && parent.offsetHeight < 100) {
                const contact = extractContactFromElement(parent);
                if (contact && !seenIds.has(contact.id)) {
                    seenIds.add(contact.id);
                    contacts.push(contact);
                }
                break;
            }
            parent = parent.parentElement;
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

        // Filtrar elementos del sistema de WhatsApp (expandido y multi-idioma)
        const skipPatterns = [
            // Español
            'archivados', 'difusión', 'lista de difusión', 'destacados',
            'ajustes', 'configuración', 'nuevo chat', 'comunidades',
            'estados', 'canales', 'no leídos', 'silenciado', 'nuevo grupo', 'buscar',
            // Inglés
            'archived', 'broadcast', 'starred', 'settings', 'new chat',
            'communities', 'status', 'channels', 'unread', 'muted', 'new group', 'search',
            // Francés
            'archivé', 'diffusion', 'paramètres', 'nouvelle discussion',
            // Alemán
            'archiviert', 'broadcast', 'einstellungen', 'neuer chat',
            // Portugués
            'arquivados', 'transmissão', 'configurações', 'nova conversa',
            // Italiano
            'archiviati', 'trasmissione', 'impostazioni', 'nuova chat',
            // General
            'loading', 'cargando', 'carregando', 'chargement',
            'yesterday', 'ayer', 'ontem', 'hier', 'gestern',
            'today', 'hoy', 'hoje', "aujourd'hui", 'heute'
        ];

        const lowerName = rawName.toLowerCase();
        
        // Si el nombre es SOLO un patrón de skip, ignorar
        if (skipPatterns.some(p => lowerName === p || lowerName === p.toLowerCase())) return null;
        
        // Si el nombre CONTIENE y ES MUY CORTO (probable encabezado), ignorar
        if (rawName.length < 15 && skipPatterns.some(p => lowerName.includes(p))) return null;
        
        // Saltar si es solo un emoji o muy corto
        if (rawName.length < 2) return null;
        
        // Saltar si parece ser una fecha/hora (ej: "10:30", "10:30 AM")
        if (/^\d{1,2}:\d{2}(\s?(AM|PM|a\.m\.|p\.m\.))?$/i.test(rawName)) return null;

        // Extraer datos
        let name = rawName;
        let phone = '';

        // Verificar si el nombre es un número de teléfono
        const cleanedForPhone = rawName.replace(/[\s\-\(\)\+\u00A0\.]/g, '');
        if (/^\d{7,15}$/.test(cleanedForPhone)) {
            phone = rawName;
        }

        // Buscar teléfono en el aria-label del elemento (más confiable)
        const ariaLabel = element.getAttribute('aria-label') || '';
        const phoneInAria = ariaLabel.match(/[\+]?[\d\s\-\(\)]{10,}/);
        if (phoneInAria && !phone) {
            phone = phoneInAria[0].trim();
        }

        // Buscar teléfono en otras líneas del texto
        if (!phone) {
            for (let i = 1; i < Math.min(textLines.length, 4); i++) {
                const line = textLines[i].trim();
                const cleanedLine = line.replace(/[\s\-\(\)\+\u00A0\.]/g, '');
                if (/^\d{7,15}$/.test(cleanedLine)) {
                    phone = line;
                    break;
                }
            }
        }

        // Último mensaje - intentar extraer de forma más inteligente
        let lastMessage = '';
        let timestamp = '';
        
        if (textLines.length >= 2) {
            // La segunda línea podría ser hora o mensaje
            const secondLine = textLines[1].trim();
            
            // Si parece una hora, buscar mensaje en la tercera línea
            if (/^\d{1,2}:\d{2}(\s?(AM|PM|a\.m\.|p\.m\.))?$/i.test(secondLine) || 
                /^(yesterday|ayer|ontem|hier|gestern)$/i.test(secondLine)) {
                timestamp = secondLine;
                if (textLines.length >= 3) {
                    lastMessage = textLines.slice(2).join(' ').substring(0, 200);
                }
            } else {
                // La segunda línea es probablemente el mensaje
                lastMessage = textLines.slice(1).join(' ').substring(0, 200);
            }
        }

        // Limpiar caracteres especiales del nombre
        name = name.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
        
        // Si el nombre quedó vacío después de limpiar, ignorar
        if (!name || name.length < 2) return null;

        // Crear ID único
        const id = phone ? 
            `${name}_${phone}`.replace(/[\s\+\-\(\)]/g, '_') : 
            name.replace(/[\s\+\-\(\)]/g, '_');

        return {
            id: id,
            name: name,
            phone: phone,
            lastMessage: lastMessage,
            timestamp: timestamp,
            extractedAt: new Date().toISOString()
        };

    } catch (e) {
        // Error silencioso para no saturar la consola
        return null;
    }
}

// Función de diagnóstico para debugging
function runDiagnostics() {
    console.log('=== WA Exporter: DIAGNÓSTICO ===');
    
    const diagnostics = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        isWhatsApp: window.location.href.includes('web.whatsapp.com'),
        elements: {}
    };
    
    // Verificar elementos clave
    const checkElements = {
        'app': '#app',
        'pane-side': '#pane-side',
        'chat-list': '[data-testid="chat-list"]',
        'listitem': 'div[role="listitem"]',
        'row': 'div[role="row"]',
        'grid': 'div[role="grid"]'
    };
    
    for (const [name, selector] of Object.entries(checkElements)) {
        const el = document.querySelector(selector);
        diagnostics.elements[name] = {
            found: !!el,
            selector: selector,
            scrollHeight: el ? el.scrollHeight : 0,
            clientHeight: el ? el.clientHeight : 0,
            childCount: el ? el.children.length : 0
        };
    }
    
    // Contar posibles contactos
    const possibleContacts = document.querySelectorAll('div[role="listitem"], div[role="row"]');
    diagnostics.possibleContacts = possibleContacts.length;
    
    console.log('📊 Resultados del diagnóstico:', diagnostics);
    
    // Sugerencias
    if (!diagnostics.elements['pane-side'].found) {
        console.warn('⚠️ No se encontró #pane-side. Asegúrate de estar en la pantalla principal de WhatsApp');
    }
    if (diagnostics.possibleContacts === 0) {
        console.warn('⚠️ No se encontraron contactos. WhatsApp podría estar cargando o usar selectores diferentes.');
    }
    
    return diagnostics;
}

// Agregar handler para diagnóstico
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'RUN_DIAGNOSTICS') {
        const result = runDiagnostics();
        sendResponse(result);
        return true;
    }
});

// Indicador visual de que el script está activo
console.log('WA Exporter: Script listo y esperando comandos');

// Ejecutar diagnóstico automático al cargar (solo en modo debug)
if (debugMode) {
    setTimeout(() => {
        if (document.querySelector('#app')) {
            console.log('WA Exporter: WhatsApp Web detectado');
            runDiagnostics();
        }
    }, 3000);
}
