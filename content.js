// Content Script for Snatch WhatsApp Exporter v2.2
// Versión simplificada y robusta - Diciembre 2025

console.log('🟢 Snatch Exporter: Content script cargado v2.2');

// ========================================
// Variables Globales
// ========================================
let isScanning = false;
let scanIntervalId = null;
let extractedContacts = new Map();

const CHATLIST_TEST_IDS = [
    'chat-list',
    'chatlist',
    'chat-list-panel',
    'chatlist-panel',
    'chatlist-panel-body',
    'chatlist-panel-main',
    'chatlist-panel-scroll',
    'chat-list-container',
    'chatlist-container',
    'pane-side',
    'chat-list-sidebar'
];

const CHATLIST_ARIA_LABELS = [
    'chat list',
    'lista de chats',
    'liste de discussions',
    'liste des discussions',
    'liste de chats',
    'chatliste',
    'lista di chat',
    'lista de conversas',
    'lista de bate-papos',
    'lista de bate papos',
    'lista de contactos',
    'lista de contactos',
    'lista de contactos de whatsapp business',
    'lista de conversaciones',
    'conversaciones',
    'chats',
    'contact list',
    'contactos',
    'chat overview'
];

const NORMALIZED_ARIA_LABELS = CHATLIST_ARIA_LABELS.map(label => normalizeText(label));

// ========================================
// FUNCIÓN PRINCIPAL: Encontrar Contenedor de Chats
// ========================================
function findChatContainer() {
    console.log('🔍 Buscando contenedor de chats...');

    const primarySelectors = [
        '#pane-side',
        'section#pane-side',
        'main#pane-side',
        '[data-testid="pane-side"]',
        '[data-testid="chatlist-panel"]',
        '[data-testid="chat-list-panel"]',
        '[data-testid="chat-list-container"]',
        '[data-testid="chat-list"]',
        '[data-testid="chatlist-sidebar"]'
    ];

    for (const selector of primarySelectors) {
        const element = document.querySelector(selector);
        const scrollable = getScrollableCandidate(element);
        if (scrollable) {
            console.log(`✅ Contenedor encontrado: ${selector}`);
            return scrollable;
        }
    }

    for (const id of CHATLIST_TEST_IDS) {
        const element = document.querySelector(`[data-testid="${id}"]`);
        const scrollable = getScrollableCandidate(element);
        if (scrollable) {
            console.log(`✅ Contenedor encontrado: [data-testid="${id}"]`);
            return scrollable;
        }
    }

    const ariaCandidates = getAriaLabelCandidates();
    for (const candidate of ariaCandidates) {
        const scrollable = getScrollableCandidate(candidate.element);
        if (scrollable && hasChatIndicators(scrollable)) {
            console.log(`✅ Contenedor encontrado via aria-label (${candidate.label})`);
            return scrollable;
        }
    }

    const appDiv = document.querySelector('#app');
    if (appDiv) {
        const panels = appDiv.querySelectorAll(':scope > * > * > *');
        for (const panel of panels) {
            const scrollable = getScrollableCandidate(panel);
            if (scrollable && hasChatIndicators(scrollable)) {
                console.log('✅ Contenedor encontrado via estructura DOM');
                return scrollable;
            }
        }
    }

    const roleSelectors = ['[role="grid"]', '[role="list"]', '[role="listbox"]', '[role="application"]', '[role="tree"]'];
    for (const selector of roleSelectors) {
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
            const scrollable = getScrollableCandidate(node);
            if (scrollable && hasChatIndicators(scrollable)) {
                console.log(`✅ Contenedor encontrado via role ${selector}`);
                return scrollable;
            }
        }
    }

    console.log('🔍 Búsqueda agresiva...');
    const candidates = [];
    const aggressiveNodes = document.querySelectorAll('div, section, main, nav, article, aside');

    for (const node of aggressiveNodes) {
        if (!isScrollableElement(node)) continue;

        const hasSpanTitle = node.querySelector('span[title]');
        const hasImg = node.querySelector('img[src*="pps.whatsapp"], img[draggable="false"]');
        const hasText = node.innerText && node.innerText.length > 80;
        const hasCells = node.querySelector('[data-testid*="cell"], [data-testid*="chat-list-item"]');

        const isMessagePanel = node.querySelector('footer') ||
            node.querySelector('[data-testid="conversation-compose-box-input"]') ||
            node.querySelector('[contenteditable="true"]');

        if ((hasSpanTitle || hasImg || hasText || hasCells) && !isMessagePanel) {
            candidates.push({
                el: node,
                score: (hasSpanTitle ? 12 : 0) + (hasImg ? 6 : 0) + (hasCells ? 8 : 0) + (node.scrollHeight / 120)
            });
        }
    }

    if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        console.log(`✅ Contenedor encontrado via búsqueda agresiva (${candidates.length} candidatos)`);
        return candidates[0].el;
    }

    console.error('❌ No se encontró contenedor de chats');
    console.log('💡 Intenta hacer scroll manual en la lista de chats y vuelve a intentar');
    return null;
}

async function waitForChatContainer(timeoutMs = 15000) {
    const start = performance.now();
    let container = findChatContainer();

    while (!container && performance.now() - start < timeoutMs) {
        await new Promise(resolve => setTimeout(resolve, 400));
        container = findChatContainer();
    }

    return container;
}

function getScrollableCandidate(element) {
    if (!element) return null;
    if (isScrollableElement(element)) return element;
    return findScrollableChild(element);
}

function getAriaLabelCandidates() {
    const elements = document.querySelectorAll('[aria-label], [aria-roledescription]');
    const candidates = [];

    elements.forEach(el => {
        const label = el.getAttribute('aria-label') || el.getAttribute('aria-roledescription');
        if (!label) return;

        const normalized = normalizeText(label);
        const match = NORMALIZED_ARIA_LABELS.some(aria => normalized.includes(aria));

        if (match) {
            candidates.push({ element: el, label });
        }
    });

    return candidates;
}

function hasChatIndicators(element) {
    if (!element) return false;
    return !!element.querySelector(
        '[data-testid="cell-frame-container"],' +
        '[data-testid="list-item-content"],' +
        '[data-testid*="chat-list-item"],' +
        '[role="listitem"],' +
        '[role="row"],' +
        'span[title]'
    );
}

function isScrollableElement(element) {
    if (!element) return false;

    const heightOk = element.clientHeight > 120;
    if (!heightOk) return false;

    const scrollGap = element.scrollHeight - element.clientHeight;
    if (scrollGap > 30) return true;

    const style = window.getComputedStyle(element);
    const overflowY = (style.overflowY || '').toLowerCase();
    return ['auto', 'scroll', 'overlay'].includes(overflowY);
}

function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

// Buscar hijo scrollable dentro de un elemento
function findScrollableChild(parent) {
    if (!parent) return null;

    // Primero verificar si el parent mismo es scrollable
    if (isScrollableElement(parent)) {
        return parent;
    }

    // Buscar en hijos directos
    for (const child of parent.children) {
        if (isScrollableElement(child)) {
            return child;
        }
    }

    // Buscar más profundo (hasta 3 niveles)
    const deepSearch = parent.querySelectorAll(':scope > * > *, :scope > * > * > *');
    for (const el of deepSearch) {
        if (isScrollableElement(el)) {
            return el;
        }
    }

    return null;
}

// ========================================
// FUNCIÓN: Extraer Contactos Visibles
// ========================================
// ========================================
// FUNCIÓN: Extraer Contactos Visibles
// ========================================
function extractVisibleContacts(container) {
    const contacts = [];

    // 1. Selectores específicos conocidos (ordenados por especificidad)
    const chatSelectors = [
        'div[role="listitem"]',
        'div[role="row"]',
        'div[data-testid^="chat-list-item"]',
        'div[data-testid="cell-frame-container"]',
        'div._ak8l', // Clase común para container de fila
        'div._ak8o',
        'div[class*="ListItem"]'
    ];

    let chatElements = [];

    // Intentar selectores
    for (const selector of chatSelectors) {
        const elements = container.querySelectorAll(selector);
        if (elements.length > 0) {
            chatElements = Array.from(elements);
            console.log(`📋 Usando selector: ${selector} (${elements.length} elementos)`);
            break;
        }
    }

    // 2. Si no hay elementos, intentar buscar hijos directos que parezcan filas
    if (chatElements.length === 0) {
        console.log('📋 Intentando búsqueda por hijos directos...');
        const children = Array.from(container.children);
        chatElements = children.filter(child => {
            const h = child.offsetHeight;
            // Altura típica de una fila de chat (72px), permitimos rango amplio
            return h > 40 && h < 150;
        });
    }

    // 3. Fallback: buscar cualquier div con altura apropiada y texto
    if (chatElements.length === 0) {
        console.log('📋 Intentando búsqueda profunda de candidatos...');
        const candidates = container.querySelectorAll('div');
        chatElements = Array.from(candidates).filter(node => {
            const h = node.offsetHeight;
            // Filtrar por altura y asegurarse que tenga algo de texto
            return h > 45 && h < 130 && node.innerText.trim().length > 0;
        });

        // Filtrar anidados (quedarse con el padre más externo que cumpla)
        // Esto evita seleccionar el contenido de la fila Y la fila misma
        chatElements = chatElements.filter(el => {
            return !chatElements.some(parent => parent !== el && parent.contains(el));
        });
    }

    console.log(`👥 Elementos candidatos encontrados: ${chatElements.length}`);

    // Procesar elementos encontrados
    chatElements.forEach(chat => {
        try {
            // Verificar que el elemento sea visible (height > 0)
            if (chat.offsetHeight === 0) return;

            const contact = extractContactInfo(chat);
            if (contact && contact.name) {
                contacts.push(contact);
            }
        } catch (e) {
            // Ignorar errores individuales
        }
    });

    return contacts;
}

// ========================================
// FUNCIÓN: Extraer Info de un Contacto
// ========================================
function extractContactInfo(element) {
    if (!element) return null;

    const text = element.innerText || '';
    if (text.length < 2) return null;

    let name = '';
    let phone = '';

    // ESTRATEGIA 1: Buscar span[title] (El método más fiable)
    const titleSpan = element.querySelector('span[title]');
    if (titleSpan) {
        name = titleSpan.getAttribute('title') || titleSpan.textContent;
    }

    // ESTRATEGIA 2: Analizar líneas de texto
    if (!name) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        if (lines.length > 0) {
            // La primera línea suele ser el nombre o la hora
            // Descartar si parece hora o fecha
            const isTimeOrDate = /^\d{1,2}:\d{2}\s*(?:[ap]\.?\s*m\.?)?$/i.test(lines[0]) ||
                /^(ayer|yesterday|hoy|today)$/i.test(lines[0]) ||
                /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(lines[0]);

            if (!isTimeOrDate) {
                name = lines[0];
            } else if (lines.length > 1) {
                // Si la primera es hora, probamos la segunda
                name = lines[1];
            }
        }
    }

    if (!name) return null;

    // Limpieza y validación del nombre
    name = name.trim();
    if (name.length < 1) return null;

    // Filtrar palabras del sistema (Lista reducida y específica)
    // Solo filtramos si es EXACTAMENTE una de estas palabras
    const skipWords = ['archivados', 'archived', 'difusión', 'broadcast'];
    if (skipWords.includes(name.toLowerCase())) return null;

    // Detectar teléfono
    // Limpiar todo lo que no sea número o +
    const cleanPhone = name.replace(/[^\d+]/g, '');
    // Debe tener al menos 7 dígitos
    if (cleanPhone.length >= 7 && /\d/.test(cleanPhone)) {
        // Es probable que sea un número
        phone = name; // Guardamos el formato original
    }

    // Último mensaje (todo lo que no es el nombre)
    // Intentamos limpiar el nombre del texto completo para dejar el mensaje
    let lastMessage = text.replace(name, '').replace(/\n/g, ' ').trim();

    // Limpieza adicional de hora si quedó al principio
    lastMessage = lastMessage.replace(/^\d{1,2}:\d{2}\s*/, '').trim();

    if (lastMessage.length > 100) lastMessage = lastMessage.substring(0, 100) + '...';

    // Crear ID único
    const id = (phone || name).replace(/[^a-z0-9]/gi, '_').substring(0, 50);

    return {
        id: id,
        name: name.substring(0, 100),
        phone: phone,
        lastMessage: lastMessage,
        extractedAt: new Date().toISOString()
    };
}

// ========================================
// FUNCIÓN: Iniciar Extracción
// ========================================
async function startExtraction() {
    console.log('🚀 INICIANDO EXTRACCIÓN...');

    if (isScanning) {
        console.warn('⚠️ Ya hay una extracción en progreso');
        return { status: 'already_running' };
    }

    // Buscar contenedor con espera activa
    const container = await waitForChatContainer();

    if (!container) {
        console.error('❌ No se pudo encontrar la lista de chats después de esperar 15s');
        await chrome.storage.local.set({
            scanStatus: 'Error: Lista de chats no encontrada',
            isScanning: false
        });
        return { status: 'error', error: 'container_not_found' };
    }

    isScanning = true;

    // Cargar contactos existentes
    const stored = await chrome.storage.local.get(['scrapedData']);
    if (stored.scrapedData && Array.isArray(stored.scrapedData)) {
        stored.scrapedData.forEach(c => extractedContacts.set(c.id, c));
        console.log(`📂 Cargados ${extractedContacts.size} contactos existentes`);
    }

    await chrome.storage.local.set({
        isScanning: true,
        scanStatus: 'Escaneando...'
    });

    console.log('✅ Contenedor encontrado. Iniciando escaneo automático...');

    let scrollCount = 0;
    let noNewContactsCount = 0;

    // Función de escaneo
    const scan = async () => {
        if (!isScanning) {
            console.log('⏹️ Escaneo detenido');
            return;
        }

        scrollCount++;
        const beforeCount = extractedContacts.size;

        // Extraer contactos visibles
        const newContacts = extractVisibleContacts(container);

        newContacts.forEach(contact => {
            if (!extractedContacts.has(contact.id)) {
                extractedContacts.set(contact.id, contact);
            }
        });

        const addedCount = extractedContacts.size - beforeCount;

        console.log(`📊 Scan #${scrollCount}: +${addedCount} nuevos, Total: ${extractedContacts.size}`);

        // Guardar progreso
        const contactsArray = Array.from(extractedContacts.values());
        await chrome.storage.local.set({
            scrapedData: contactsArray,
            totalContacts: contactsArray.length,
            scanStatus: `Escaneando... ${contactsArray.length} contactos`,
            lastScrollPosition: container.scrollTop,
            scanCycles: scrollCount
        });

        // Notificar al sidebar
        try {
            chrome.runtime.sendMessage({
                action: 'updateProgress',
                total: contactsArray.length,
                scrollCount: scrollCount
            });
        } catch (e) {
            // Sidebar puede no estar abierto
        }

        // Hacer scroll
        const scrollBefore = container.scrollTop;
        container.scrollTop += 400 + Math.random() * 200;

        // Verificar si llegamos al final
        if (addedCount === 0) {
            noNewContactsCount++;
        } else {
            noNewContactsCount = 0;
        }

        const atBottom = container.scrollTop >= container.scrollHeight - container.clientHeight - 50;

        if (noNewContactsCount >= 10 || (atBottom && noNewContactsCount >= 3)) {
            console.log('🏁 Extracción completada');
            await stopExtraction(true);
            return;
        }

        // Continuar después de delay
        const delay = 800 + Math.random() * 400;
        scanIntervalId = setTimeout(scan, delay);
    };

    // Iniciar primer scan
    scan();

    return { status: 'started' };
}

// ========================================
// FUNCIÓN: Detener Extracción
// ========================================
async function stopExtraction(completed = false) {
    console.log('⏹️ Deteniendo extracción...');

    isScanning = false;

    if (scanIntervalId) {
        clearTimeout(scanIntervalId);
        scanIntervalId = null;
    }

    const contactsArray = Array.from(extractedContacts.values());

    await chrome.storage.local.set({
        isScanning: false,
        scanStatus: completed ? `✓ Completado: ${contactsArray.length} contactos` : `Pausado: ${contactsArray.length} contactos`,
        scrapedData: contactsArray,
        totalContacts: contactsArray.length
    });

    // Notificar completado
    if (completed && contactsArray.length > 0) {
        try {
            chrome.runtime.sendMessage({
                action: 'extractionCompleted',
                contactCount: contactsArray.length
            });
        } catch (e) {
            // Sidebar puede no estar abierto
        }
    }

    return { status: 'stopped', contacts: contactsArray.length };
}

// ========================================
// FUNCIÓN: Limpiar Datos
// ========================================
async function clearData() {
    console.log('🗑️ Limpiando datos...');

    isScanning = false;
    extractedContacts.clear();

    if (scanIntervalId) {
        clearTimeout(scanIntervalId);
        scanIntervalId = null;
    }

    await chrome.storage.local.set({
        scrapedData: [],
        totalContacts: 0,
        isScanning: false,
        scanStatus: 'Listo',
        lastScrollPosition: 0,
        scanCycles: 0
    });

    return { status: 'cleared' };
}

// ========================================
// LISTENER DE MENSAJES
// ========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📩 Mensaje recibido:', request.action);

    // Manejar cada acción
    switch (request.action) {
        case 'PING':
            sendResponse({
                success: true,
                status: 'active',
                isScanning: isScanning,
                contactCount: extractedContacts.size
            });
            break;

        case 'START_SCRAPE':
            startExtraction().then(result => {
                sendResponse(result);
            });
            return true; // Mantener canal abierto para async

        case 'STOP_SCRAPE':
            stopExtraction(false).then(result => {
                sendResponse(result);
            });
            return true;

        case 'CLEAR_DATA':
            clearData().then(result => {
                sendResponse(result);
            });
            return true;

        case 'GET_STATUS':
            sendResponse({
                isScanning: isScanning,
                contactCount: extractedContacts.size,
                ready: document.querySelector('#pane-side') !== null || document.querySelector('#app') !== null
            });
            break;

        case 'checkWhatsAppStatus':
            const paneExists = document.querySelector('#pane-side') !== null;
            const appLoaded = document.querySelector('#app') !== null;
            sendResponse({
                isLoaded: paneExists || appLoaded,
                paneExists: paneExists,
                appLoaded: appLoaded
            });
            break;

        case 'RUN_DIAGNOSTICS':
            const diagnostics = runDiagnostics();
            sendResponse(diagnostics);
            break;

        default:
            console.warn('⚠️ Acción desconocida:', request.action);
            sendResponse({ status: 'unknown_action' });
    }

    return true;
});

// ========================================
// FUNCIÓN DE DIAGNÓSTICO
// ========================================
function runDiagnostics() {
    console.log('\n=== 🔍 DIAGNÓSTICO SNATCH EXPORTER ===\n');

    const results = {
        timestamp: new Date().toISOString(),
        contentScriptLoaded: true,
        whatsappDetected: false,
        containerFound: false,
        chatsVisible: 0
    };

    // 1. WhatsApp detectado?
    const app = document.querySelector('#app');
    const pane = document.querySelector('#pane-side');
    results.whatsappDetected = !!(app || pane);
    console.log(`1. WhatsApp detectado: ${results.whatsappDetected ? '✅' : '❌'}`);

    // 2. Contenedor encontrado?
    const container = findChatContainer();
    results.containerFound = !!container;
    console.log(`2. Contenedor de chats: ${results.containerFound ? '✅' : '❌'}`);

    if (container) {
        console.log(`   - scrollHeight: ${container.scrollHeight}`);
        console.log(`   - clientHeight: ${container.clientHeight}`);
    }

    // 3. Chats visibles?
    const listItems = document.querySelectorAll('div[role="listitem"]').length;
    const rows = document.querySelectorAll('div[role="row"]').length;
    const spanTitles = document.querySelectorAll('span[title]').length;
    results.chatsVisible = Math.max(listItems, rows);

    console.log(`3. Elementos encontrados:`);
    console.log(`   - role="listitem": ${listItems}`);
    console.log(`   - role="row": ${rows}`);
    console.log(`   - span[title]: ${spanTitles}`);

    // 4. Estado actual
    console.log(`4. Estado:`);
    console.log(`   - isScanning: ${isScanning}`);
    console.log(`   - contactos extraídos: ${extractedContacts.size}`);

    console.log('\n=== FIN DIAGNÓSTICO ===\n');

    return results;
}

// ========================================
// AUTO-RESUME AL RECARGAR
// ========================================
(async function autoResume() {
    try {
        const storage = await chrome.storage.local.get(['isScanning', 'scrapedData']);

        if (storage.scrapedData && Array.isArray(storage.scrapedData)) {
            storage.scrapedData.forEach(c => extractedContacts.set(c.id, c));
            console.log(`📂 Restaurados ${extractedContacts.size} contactos del storage`);
        }

        if (storage.isScanning) {
            console.log('🔄 Detectado escaneo previo, esperando para reanudar...');
            setTimeout(() => {
                if (document.querySelector('#pane-side') || document.querySelector('#app')) {
                    console.log('🔄 Reanudando extracción...');
                    startExtraction();
                }
            }, 3000);
        }
    } catch (e) {
        console.error('Error en auto-resume:', e);
    }
})();

// ========================================
// EXPONER FUNCIONES PARA DEBUG
// ========================================
window.snatchExporter = {
    startExtraction,
    stopExtraction,
    clearData,
    runDiagnostics,
    findChatContainer,
    getContacts: () => Array.from(extractedContacts.values()),
    getStatus: () => ({ isScanning, contactCount: extractedContacts.size })
};

console.log('✅ Snatch Exporter listo. Usa window.snatchExporter para debug.');
console.log('   Ejecuta runDiagnostics() para ver el estado.');
