// Content Script for Snatch WhatsApp Exporter v2.3
// Versión con selectores dinámicos - Mayo 2026

console.log('🟢 Snatch Exporter: Content script cargado v2.3');

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

// Palabras del sistema que DEBEN filtrarse (no son contactos reales)
const SYSTEM_SKIP_WORDS = new Set([
    'archivados', 'archived',
    'difusion', 'difusión', 'broadcast',
    'estados', 'status', 'status updates',
    'canales', 'channels', 'channel',
    'comunidades', 'communities', 'community',
    'novedades', 'updates',
    'llamadas', 'calls',
    'ajustes', 'configuración', 'settings',
    'perfil', 'profile',
    'nuevo chat', 'new chat', 'new group',
    'nuevo grupo', 'new community', 'nueva comunidad',
    'lista de difusión', 'broadcast list',
    'mensajes destacados', 'starred messages',
    'whatsapp', 'whatsapp web',
    'invitar', 'invite',
    'buscar', 'search',
    'filtros', 'filters',
    'no hay chats', 'no chats',
    'tú', 'you',
    // Labels de IA / sistema
    'meta ai', 'meta',
    'asistente', 'assistant'
]);

// Palabras que NUNCA son nombres de contacto (regex patterns)
const NON_CONTACT_PATTERNS = [
    /^\d{1,2}:\d{2}(\s*[ap]\.?\s*m\.?)?$/i,  // hora: "12:30", "2:45 PM"
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,             // fecha: "12/31/2024"
    /^(ayer|yesterday|hoy|today|mañana|tomorrow)$/i,
    /^(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)$/i,
    /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
    /^hace\s+\d+\s+(min|minutos?|h|horas?|d|días?|dias?|semanas?)$/i,
    /^\d+\s+(min|minutes?|h|hours?|d|days?|w|weeks?)\s+ago$/i,
    /^en línea$|^online$/i,
    /^escribiendo\.\.\.$|^typing\.\.\.$/i,
    /^click para abrir|^click to open/i,
    /^(sin nombre|unnamed|desconocido)$/i,
    /^\+\d{1,3}\s\d+$/  // solo número sin nombre
];

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
// DESCUBRIMIENTO DINÁMICO DE SELECTORES (v2.3)
// ========================================

// Analiza el DOM para encontrar el selector más efectivo para filas de chat
function discoverChatRowSelector(container) {
    if (!container) return null;

    const results = [];

    // Probar selectores comunes primero
    const selectorsToTry = [
        'div[role="listitem"]',
        'div[role="row"]',
        'div[role="option"]',
        'div[role="button"]',
        'div[role="gridcell"]',
        'div[data-testid^="chat-list-item"]',
        'div[data-testid="cell-frame-container"]',
        'div[data-testid="cell-frame"]',
        'div[data-testid="list-item-content"]',
        'div[data-testid*="list-item"]',
        'div[data-testid*="chat-item"]',
        'div[data-testid*="contact-row"]',
        'div[data-testid*="chat-row"]',
        'li[role="listitem"]',
        'li[role="row"]',
        'div[class*="ListItem"]',
        'div[class*="list-item"]',
        'div[class*="chat-item"]',
        'div[class*="ChatItem"]',
        'div[class*="contact"]',
        // Clases legacy de WhatsApp (pueden haber cambiado)
        'div._ak8l', 'div._ak8o', 'div._ak8k',
        'div._ak72', 'div._ak7l', 'div._ak7m',
        // Nuevas clases 2025-2026
        'div.x1iyjqo2', 'div.x1n2onr6', 'div.x1i10f1l',
        'div.x10l6tqk', 'div.xh8yej3', 'div.x78zum5',
    ];

    for (const selector of selectorsToTry) {
        const elements = container.querySelectorAll(selector);
        if (elements.length > 0) {
            // Validar que los elementos parezcan filas de chat
            const validCount = Array.from(elements).filter(el => looksLikeChatRow(el)).length;
            if (validCount > 0) {
                results.push({
                    selector,
                    total: elements.length,
                    valid: validCount,
                    score: validCount * 10 + elements.length
                });
            }
        }
    }

    // Si no encontramos con selectores específicos, buscar por estructura
    if (results.length === 0) {
        console.log('🔍 Buscando filas por estructura DOM...');
        // Buscar elementos hijos directos que parezcan filas
        const children = Array.from(container.children);
        for (const child of children) {
            if (looksLikeChatRow(child)) {
                // Intentar encontrar un selector que los capture
                const tag = child.tagName.toLowerCase();
                const roles = child.getAttribute('role');
                const testId = child.getAttribute('data-testid');
                const classes = Array.from(child.classList).filter(c => c.length > 1 && c.length < 20);

                if (roles) {
                    results.push({ selector: `${tag}[role="${roles}"]`, total: 0, valid: children.filter(c => looksLikeChatRow(c)).length, score: 50 });
                    break;
                } else if (testId) {
                    results.push({ selector: `${tag}[data-testid="${testId}"]`, total: 0, valid: children.filter(c => looksLikeChatRow(c)).length, score: 50 });
                    break;
                } else if (classes.length > 0) {
                    // Usar la clase más específica
                    const cls = classes[0];
                    const sel = `${tag}.${cls}`;
                    const matchingCount = container.querySelectorAll(sel).length;
                    results.push({ selector: sel, total: matchingCount, valid: children.filter(c => looksLikeChatRow(c)).length, score: 40 });
                }
            }
        }
    }

    // Ordenar por mejor score
    results.sort((a, b) => b.score - a.score);

    if (results.length > 0) {
        console.log(`🎯 Mejor selector encontrado: "${results[0].selector}" (${results[0].valid} filas válidas de ${results[0].total})`);
        return results[0];
    }

    console.warn('⚠️ No se pudo descubrir un selector de filas de chat');
    return null;
}

// Verifica si un elemento se parece a una fila de chat
function looksLikeChatRow(element) {
    if (!element || element.offsetHeight === 0) return false;

    const h = element.offsetHeight;
    // Altura típica de fila de chat: 60-85px (puede variar con temas)
    if (h < 40 || h > 150) return false;

    // Debe tener contenido de texto
    const text = (element.innerText || '').trim();
    if (text.length < 2) return false;

    // Indicadores positivos de fila de chat
    const hasSpanTitle = element.querySelector('span[title]');
    const hasProfileImg = element.querySelector('img[src*="pps.whatsapp"]') ||
                          element.querySelector('img[draggable="false"]');
    const hasChatIndicators = element.querySelector(
        '[data-testid*="cell"], [data-testid*="chat"], [data-testid*="list-item"],' +
        '[role="listitem"], [role="row"], [role="gridcell"],' +
        'span[dir="auto"]'
    );

    // NO debe parecer un elemento UI/decorativo
    const textOnly = text.replace(/\s/g, '');
    if (textOnly.length < 2) return false;

    // Si tiene span[title] o imagen de perfil, es muy probable que sea fila
    if (hasSpanTitle || hasProfileImg || hasChatIndicators) return true;

    // Si tiene texto de varias líneas (nombre + mensaje), probablemente es fila
    if (text.split('\n').filter(l => l.trim()).length >= 2) return true;

    return false;
}

// Detecta elementos que NO son contactos (status bubbles, headers, etc.)
function isNonContactElement(element) {
    if (!element) return true;

    const text = (element.innerText || '').trim().toLowerCase();

    // Verificar contra palabras del sistema
    if (SYSTEM_SKIP_WORDS.has(text)) return true;

    // Verificar contra patrones de no-contacto
    for (const pattern of NON_CONTACT_PATTERNS) {
        if (pattern.test(text)) return true;
    }

    // Status bubbles: suelen ser más pequeños o tener estructura diferente
    const h = element.offsetHeight;
    if (h < 45 && !element.querySelector('span[title]')) return true;

    // Elementos con iconos de cámara (status)
    if (element.querySelector('svg[data-testid*="camera"]') ||
        element.querySelector('svg[data-testid*="status"]') ||
        element.querySelector('[data-testid*="status"]')) {
        return true;
    }

    // Elementos que son solo iconos/avatares sin texto de nombre
    if (element.querySelector('div[style*="width"]') &&
        !element.querySelector('span[title]') &&
        text.length < 5) {
        return true;
    }

    // Sección headers / encabezados
    if (element.querySelector('h1, h2, h3, h4, h5, h6')) return true;

    // Elementos con solo emojis/icons
    if (/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}●◉○◎◉●]+$/u.test(text)) return true;

    return false;
}
function extractVisibleContacts(container) {
    const contacts = [];

    // DESCUBRIR el mejor selector dinámicamente
    const discovered = discoverChatRowSelector(container);
    let chatElements = [];

    if (discovered && discovered.selector) {
        chatElements = Array.from(container.querySelectorAll(discovered.selector));
        console.log(`📋 Selector dinámico: "${discovered.selector}" → ${chatElements.length} elementos`);
    }

    // Si el descubrimiento falló, intentar fallbacks
    if (chatElements.length === 0) {
        console.log('📋 Intentando búsqueda por hijos directos...');
        const children = Array.from(container.children);
        chatElements = children.filter(child => {
            const h = child.offsetHeight;
            return h > 40 && h < 150;
        });
    }

    // Último recurso: búsqueda profunda
    if (chatElements.length === 0) {
        console.log('📋 Intentando búsqueda profunda de candidatos...');
        const candidates = container.querySelectorAll('div');
        chatElements = Array.from(candidates).filter(node => {
            const h = node.offsetHeight;
            return h > 45 && h < 130 && node.innerText.trim().length > 0;
        });

        // Filtrar anidados
        chatElements = chatElements.filter(el => {
            return !chatElements.some(parent => parent !== el && parent.contains(el));
        });
    }

    console.log(`👥 Elementos candidatos encontrados: ${chatElements.length}`);

    // Procesar elementos encontrados, filtrando no-contactos
    chatElements.forEach(chat => {
        try {
            if (chat.offsetHeight === 0) return;

            // Filtrar elementos que NO son contactos (status, headers, etc.)
            if (isNonContactElement(chat)) return;

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

    // ==========================================
    // ESTRATEGIAS MÚLTIPLES de extracción (v2.3)
    // ==========================================

    // ESTRATEGIA 1: span[title] (método más fiable)
    const titleSpan = element.querySelector('span[title]');
    if (titleSpan) {
        name = titleSpan.getAttribute('title') || titleSpan.textContent;
        name = name.trim();
    }

    // ESTRATEGIA 2: span[dir="auto"] con texto significativo
    if (!name) {
        const dirSpans = element.querySelectorAll('span[dir="auto"]');
        for (const span of dirSpans) {
            const spanText = (span.textContent || '').trim();
            if (spanText.length > 1 && !/^\d{1,2}:\d{2}/.test(spanText)) {
                name = spanText;
                break;
            }
        }
    }

    // ESTRATEGIA 3: Buscar el texto más largo en un span (probablemente el nombre)
    if (!name) {
        const allSpans = element.querySelectorAll('span');
        let bestSpan = null;
        let bestLen = 0;
        for (const span of allSpans) {
            const t = (span.textContent || '').trim();
            if (t.length > bestLen && t.length > 1 && !isTimeOrDateText(t)) {
                bestSpan = t;
                bestLen = t.length;
            }
        }
        if (bestSpan) name = bestSpan;
    }

    // ESTRATEGIA 4: aria-label en el elemento o ancestro
    if (!name) {
        const ariaLabel = element.querySelector('[aria-label]');
        if (ariaLabel) {
            const label = ariaLabel.getAttribute('aria-label') || '';
            if (label.length > 1 && !isTimeOrDateText(label)) {
                name = label;
            }
        }
    }

    // ESTRATEGIA 5: data-testid con nombre
    if (!name) {
        const testIdEls = element.querySelectorAll('[data-testid]');
        for (const el of testIdEls) {
            const t = (el.textContent || '').trim();
            if (t.length > 2 && t.length < 60 && !isTimeOrDateText(t)) {
                name = t;
                break;
            }
        }
    }

    // ESTRATEGIA 6: Analizar líneas de texto (último recurso)
    if (!name) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        for (const line of lines) {
            if (line.length > 1 && line.length < 80 && !isTimeOrDateText(line)) {
                name = line;
                break;
            }
        }
    }

    if (!name) return null;

    // ==========================================
    // VALIDACIÓN Y LIMPIEZA
    // ==========================================
    name = name.trim();
    if (name.length < 1 || name.length > 120) return null;

    // Filtrar palabras del sistema
    const nameLower = name.toLowerCase();
    if (SYSTEM_SKIP_WORDS.has(nameLower)) return null;

    // Filtrar patrones de no-contacto
    for (const pattern of NON_CONTACT_PATTERNS) {
        if (pattern.test(name)) return null;
    }

    // No debe ser solo números (a menos que sea un teléfono válido)
    if (/^\d+$/.test(name) && name.length < 7) return null;

    // No debe ser solo caracteres especiales
    if (/^[^\w\s]+$/.test(name)) return null;

    // ==========================================
    // DETECCIÓN DE TELÉFONO
    // ==========================================
    const cleanPhone = name.replace(/[^\d+]/g, '');
    if (cleanPhone.length >= 7 && /\d/.test(cleanPhone)) {
        phone = name;
    }

    // También buscar teléfono en el texto secundario
    if (!phone) {
        const secondaryText = element.querySelector('span[dir="auto"]:nth-child(2),' +
            'span:nth-child(2), div:nth-child(2) > span');
        if (secondaryText) {
            const st = (secondaryText.textContent || '').replace(/[^\d+]/g, '');
            if (st.length >= 7) {
                phone = secondaryText.textContent.trim();
            }
        }
    }

    // ==========================================
    // ÚLTIMO MENSAJE
    // ==========================================
    let lastMessage = text.replace(name, '').replace(/\n/g, ' ').trim();
    lastMessage = lastMessage.replace(/^\d{1,2}:\d{2}\s*/, '').trim();
    lastMessage = lastMessage.replace(/^[▼▲▶●◉○◎◆◇▪▫]/, '').trim();
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

// Helper: verifica si un texto parece hora o fecha
function isTimeOrDateText(text) {
    if (!text) return false;
    return /^\d{1,2}:\d{2}(\s*[ap]\.?\s*m?\.?)?$/i.test(text.trim()) ||
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text.trim()) ||
        /^(ayer|yesterday|hoy|today)$/i.test(text.trim()) ||
        text.trim().length < 2;
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
            const paneSideExists = document.querySelector('#pane-side') !== null;
            const appExists = document.querySelector('#app') !== null;
            const listItemsExist = document.querySelectorAll('div[role="listitem"]').length > 0;
            const rowsExist = document.querySelectorAll('div[role="row"]').length > 0;
            sendResponse({
                isScanning: isScanning,
                contactCount: extractedContacts.size,
                ready: paneSideExists || (appExists && (listItemsExist || rowsExist))
            });
            break;

        case 'checkWhatsAppStatus':
            const paneExists = document.querySelector('#pane-side') !== null;
            const appLoaded = document.querySelector('#app') !== null;
            const hasListItems = document.querySelectorAll('div[role="listitem"]').length > 0;
            const hasRows = document.querySelectorAll('div[role="row"]').length > 0;
            const hasSpanTitles = document.querySelectorAll('span[title]').length > 3;
            const hasChatIndicators = hasListItems || hasRows || hasSpanTitles;
            sendResponse({
                isLoaded: paneExists || (appLoaded && hasChatIndicators),
                paneExists: paneExists,
                appLoaded: appLoaded,
                hasChatIndicators: hasChatIndicators
            });
            break;

        case 'RUN_DIAGNOSTICS':
            const diagnostics = runDiagnostics();
            sendResponse(diagnostics);
            break;

        case 'CAPTURE_DOM_SNAPSHOT':
            const snapshot = captureFullDOMSnapshot();
            sendResponse(snapshot);
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
    console.log('\n=== 🔍 DIAGNÓSTICO SNATCH EXPORTER v2.3 ===\n');

    const results = {
        timestamp: new Date().toISOString(),
        contentScriptLoaded: true,
        whatsappDetected: false,
        containerFound: false,
        containerDetails: null,
        discoveredSelector: null,
        chatsVisible: 0,
        domSnapshot: null,
        errors: []
    };

    // 1. WhatsApp detectado?
    const app = document.querySelector('#app');
    const pane = document.querySelector('#pane-side');
    results.whatsappDetected = !!(app || pane);
    console.log(`1. WhatsApp detectado: ${results.whatsappDetected ? '✅' : '❌'}`);
    if (app) console.log('   - #app: ✅ presente');
    if (pane) console.log('   - #pane-side: ✅ presente');

    // 2. Contenedor encontrado?
    const container = findChatContainer();
    results.containerFound = !!container;
    console.log(`2. Contenedor de chats: ${results.containerFound ? '✅' : '❌'}`);

    if (container) {
        results.containerDetails = {
            tagName: container.tagName,
            id: container.id || '(sin id)',
            className: container.className || '(sin class)',
            role: container.getAttribute('role') || '(sin role)',
            testId: container.getAttribute('data-testid') || '(sin data-testid)',
            ariaLabel: container.getAttribute('aria-label') || '(sin aria-label)',
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            scrollTop: container.scrollTop,
            childrenCount: container.children.length,
            isScrollable: container.scrollHeight > container.clientHeight + 30
        };
        console.log(`   - Tag: ${results.containerDetails.tagName}`);
        console.log(`   - ID: ${results.containerDetails.id}`);
        console.log(`   - Class: ${results.containerDetails.className.substring(0, 80)}`);
        console.log(`   - Role: ${results.containerDetails.role}`);
        console.log(`   - data-testid: ${results.containerDetails.testId}`);
        console.log(`   - scrollHeight: ${results.containerDetails.scrollHeight}`);
        console.log(`   - clientHeight: ${results.containerDetails.clientHeight}`);
        console.log(`   - hijos directos: ${results.containerDetails.childrenCount}`);
        console.log(`   - scrollable: ${results.containerDetails.isScrollable ? '✅' : '❌'}`);

        // Descubrir selector dinámico
        const discovered = discoverChatRowSelector(container);
        results.discoveredSelector = discovered;
        if (discovered) {
            console.log(`3. Selector dinámico: "${discovered.selector}" (${discovered.total} elem, ${discovered.valid} válidos)`);
        } else {
            console.log('3. Selector dinámico: ❌ No se pudo descubrir');
            results.errors.push('No se pudo descubrir un selector de filas de chat');
        }
    }

    // 4. Elementos encontrados en el DOM global
    const listItems = document.querySelectorAll('div[role="listitem"]').length;
    const rows = document.querySelectorAll('div[role="row"]').length;
    const spanTitles = document.querySelectorAll('span[title]').length;
    const options = document.querySelectorAll('div[role="option"]').length;
    const buttons = document.querySelectorAll('div[role="button"]').length;
    const gridcells = document.querySelectorAll('div[role="gridcell"]').length;
    results.chatsVisible = Math.max(listItems, rows, options);

    console.log('4. Elementos DOM globales:');
    console.log(`   - div[role="listitem"]: ${listItems}`);
    console.log(`   - div[role="row"]: ${rows}`);
    console.log(`   - div[role="option"]: ${options}`);
    console.log(`   - div[role="button"]: ${buttons}`);
    console.log(`   - div[role="gridcell"]: ${gridcells}`);
    console.log(`   - span[title]: ${spanTitles}`);

    // 5. Snapshot de clases CSS activas (primeros 5 elementos)
    if (container && container.children.length > 0) {
        const classSnapshot = [];
        const maxItems = Math.min(container.children.length, 5);
        for (let i = 0; i < maxItems; i++) {
            const child = container.children[i];
            const classes = Array.from(child.classList).filter(c => c.length > 1 && c.length < 30);
            const textSample = (child.innerText || '').substring(0, 50);
            classSnapshot.push({
                index: i,
                tag: child.tagName,
                classes: classes.join(' '),
                role: child.getAttribute('role') || '',
                testId: child.getAttribute('data-testid') || '',
                height: child.offsetHeight,
                textSample: textSample,
                hasSpanTitle: !!child.querySelector('span[title]'),
                hasProfileImg: !!child.querySelector('img[draggable="false"]')
            });
        }
        results.domSnapshot = classSnapshot;

        console.log('5. Snapshot DOM (primeros elementos del contenedor):');
        classSnapshot.forEach(item => {
            console.log(`   [${item.index}] <${item.tag}> role="${item.role}" testid="${item.testId}" h=${item.height}px`);
            console.log(`       classes: ${item.classes || '(ninguna)'}`);
            console.log(`       texto: "${item.textSample}"`);
            console.log(`       span[title]: ${item.hasSpanTitle ? '✅' : '❌'}  img: ${item.hasProfileImg ? '✅' : '❌'}`);
        });
    }

    // 6. Estado actual
    console.log('6. Estado:');
    console.log(`   - isScanning: ${isScanning}`);
    console.log(`   - contactos extraídos: ${extractedContacts.size}`);
    console.log(`   - scanIntervalId: ${scanIntervalId ? 'activo' : 'null'}`);

    // 7. Errores
    if (results.errors.length > 0) {
        console.log('7. Errores:');
        results.errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
    } else {
        console.log('7. Sin errores detectados ✅');
    }

    console.log('\n=== FIN DIAGNÓSTICO ===\n');
    console.log('💡 Para compartir estos resultados, copia todo el contenido de la consola.');
    console.log('💡 También puedes ejecutar: copy(JSON.stringify(window.snatchExporter.runDiagnostics(), null, 2))');

    return results;
}

// ========================================
// FUNCIÓN DE SNAPSHOT COMPLETO DEL DOM
// ========================================
function captureFullDOMSnapshot() {
    console.log('📸 Capturando snapshot completo del DOM...');

    const snapshot = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        // Estructura del app
        app: null,
        paneSide: null,
        containers: [],
        chatRows: [],
        // Selectores disponibles
        availableSelectors: {},
        // Resumen
        summary: ''
    };

    // Analizar #app
    const app = document.querySelector('#app');
    if (app) {
        snapshot.app = {
            childrenCount: app.children.length,
            childrenTags: Array.from(app.children).map(c => ({
                tag: c.tagName,
                id: c.id || '',
                className: (c.className || '').substring(0, 100),
                childrenCount: c.children.length,
                role: c.getAttribute('role') || ''
            }))
        };
    }

    // Analizar #pane-side
    const pane = document.querySelector('#pane-side');
    if (pane) {
        snapshot.paneSide = {
            tagName: pane.tagName,
            className: (pane.className || '').substring(0, 200),
            childrenCount: pane.children.length,
            scrollHeight: pane.scrollHeight,
            clientHeight: pane.clientHeight,
            childrenTags: Array.from(pane.children).map(c => ({
                tag: c.tagName,
                className: (c.className || '').substring(0, 80),
                role: c.getAttribute('role') || '',
                testId: c.getAttribute('data-testid') || '',
                height: c.offsetHeight
            }))
        };
    }

    // Buscar todos los contenedores scrollables con indicadores de chat
    const allDivs = document.querySelectorAll('div, section, main');
    allDivs.forEach(div => {
        if (div.clientHeight > 100 && div.scrollHeight > div.clientHeight + 30) {
            const chatIndicators = div.querySelectorAll('span[title], div[role="listitem"], div[role="row"], img[draggable="false"]');
            if (chatIndicators.length > 2) {
                snapshot.containers.push({
                    tag: div.tagName,
                    id: div.id || '',
                    className: (div.className || '').substring(0, 100),
                    role: div.getAttribute('role') || '',
                    testId: div.getAttribute('data-testid') || '',
                    aria: div.getAttribute('aria-label') || '',
                    scrollHeight: div.scrollHeight,
                    clientHeight: div.clientHeight,
                    childrenCount: div.children.length,
                    chatIndicatorsCount: chatIndicators.length
                });
            }
        }
    });

    // Verificar qué selectores están disponibles
    const selectorTests = {
        '#pane-side': document.querySelector('#pane-side'),
        '[data-testid="pane-side"]': document.querySelector('[data-testid="pane-side"]'),
        '[data-testid="chat-list"]': document.querySelector('[data-testid="chat-list"]'),
        '[data-testid="chatlist-panel"]': document.querySelector('[data-testid="chatlist-panel"]'),
        'div[role="listitem"]': document.querySelectorAll('div[role="listitem"]').length,
        'div[role="row"]': document.querySelectorAll('div[role="row"]').length,
        'div[role="option"]': document.querySelectorAll('div[role="option"]').length,
        'div[role="button"]': document.querySelectorAll('div[role="button"]').length,
        'div[role="gridcell"]': document.querySelectorAll('div[role="gridcell"]').length,
        'span[title]': document.querySelectorAll('span[title]').length,
        'img[draggable="false"]': document.querySelectorAll('img[draggable="false"]').length,
        '[data-testid*="cell"]': document.querySelectorAll('[data-testid*="cell"]').length,
        '[data-testid*="chat-list-item"]': document.querySelectorAll('[data-testid*="chat-list-item"]').length,
        '[data-testid*="list-item"]': document.querySelectorAll('[data-testid*="list-item"]').length,
        // Clases legacy
        'div._ak8l': document.querySelectorAll('div._ak8l').length,
        'div._ak8o': document.querySelectorAll('div._ak8o').length,
        'div._ak8k': document.querySelectorAll('div._ak8k').length,
        'div._ak72': document.querySelectorAll('div._ak72').length,
        'div._ak7l': document.querySelectorAll('div._ak7l').length,
        // Nuevas clases 2025-2026
        'div.x1iyjqo2': document.querySelectorAll('div.x1iyjqo2').length,
        'div.x1n2onr6': document.querySelectorAll('div.x1n2onr6').length,
        'div.x10l6tqk': document.querySelectorAll('div.x10l6tqk').length,
        'div.xh8yej3': document.querySelectorAll('div.xh8yej3').length,
        'div[class*="ListItem"]': document.querySelectorAll('div[class*="ListItem"]').length,
        'div[class*="list-item"]': document.querySelectorAll('div[class*="list-item"]').length,
        'div[class*="chat-item"]': document.querySelectorAll('div[class*="chat-item"]').length,
    };

    snapshot.availableSelectors = {};
    for (const [key, value] of Object.entries(selectorTests)) {
        if (value instanceof Element) {
            snapshot.availableSelectors[key] = { found: true, tag: value.tagName };
        } else if (typeof value === 'number') {
            snapshot.availableSelectors[key] = { count: value };
        } else {
            snapshot.availableSelectors[key] = { found: false };
        }
    }

    // Generar resumen
    const hasPaneSide = !!snapshot.availableSelectors['#pane-side']?.found;
    const hasListItems = (snapshot.availableSelectors['div[role="listitem"]']?.count || 0) > 0;
    const hasRows = (snapshot.availableSelectors['div[role="row"]']?.count || 0) > 0;
    const hasSpanTitles = (snapshot.availableSelectors['span[title]']?.count || 0) > 3;
    const hasLegacy = (snapshot.availableSelectors['div._ak8l']?.count || 0) > 0;

    const parts = [];
    if (hasPaneSide) parts.push('#pane-side presente');
    if (hasListItems) parts.push(`role=listitem (${snapshot.availableSelectors['div[role="listitem"]'].count})`);
    if (hasRows) parts.push(`role=row (${snapshot.availableSelectors['div[role="row"]'].count})`);
    if (hasSpanTitles) parts.push(`span[title] (${snapshot.availableSelectors['span[title]'].count})`);
    if (hasLegacy) parts.push(`clases legacy (_ak8l) presentes`);
    if (parts.length === 0) parts.push('NINGÚN selector conocido funciona');

    snapshot.summary = parts.join(' | ');

    console.log('📸 Snapshot capturado:');
    console.log(`   Resumen: ${snapshot.summary}`);
    console.log(`   Contenedores con chats: ${snapshot.containers.length}`);
    if (snapshot.paneSide) {
        console.log(`   #pane-side: ${snapshot.paneSide.childrenCount} hijos, scroll=${snapshot.paneSide.scrollHeight}px`);
    }

    return snapshot;
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
    captureFullDOMSnapshot,
    discoverChatRowSelector,
    discoverContainer: findChatContainer,
    getContacts: () => Array.from(extractedContacts.values()),
    getStatus: () => ({ isScanning, contactCount: extractedContacts.size }),
    getDetailedStatus: () => ({
        isScanning,
        contactCount: extractedContacts.size,
        scanIntervalId: scanIntervalId ? 'active' : null,
        extractedContacts: Array.from(extractedContacts.values()).slice(0, 5)
    })
};

console.log('✅ Snatch Exporter v2.3 listo. Comandos disponibles:');
console.log('   window.snatchExporter.runDiagnostics()          - Diagnóstico completo');
console.log('   window.snatchExporter.captureFullDOMSnapshot()  - Snapshot del DOM');
console.log('   window.snatchExporter.discoverChatRowSelector() - Descubrir selector dinámico');
console.log('   window.snatchExporter.getDetailedStatus()       - Estado detallado');
