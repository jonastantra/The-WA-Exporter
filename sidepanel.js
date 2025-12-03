// sidepanel.js - Snatch WhatsApp Exporter v2.1
// Sistema de estados y detección de WhatsApp Web

// Production mode - disable verbose logging
const DEBUG = false;
const log = (...args) => DEBUG && log('[Snatch]', ...args);

// ========================================
// Estados de la Aplicación
// ========================================
const AppState = {
    CHECKING: 'checking',
    NOT_FOUND: 'not_found',
    OPENING: 'opening',
    LOADING: 'loading',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

// ========================================
// Variables Globales
// ========================================
let currentState = AppState.CHECKING;
let whatsappTabId = null;
let whatsappWindowId = null;
let scrapedData = [];
let currentFormat = 'csv';
let isScanning = false;
let currentRating = 0;
let modalRating = 0;

// i18n Helper
const msg = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

// ========================================
// Inicialización
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    log('Snatch Exporter: Sidebar inicializado');
    initializeApp();
    setupMessageListeners();
});

async function initializeApp() {
    setState(AppState.CHECKING);

    // Verificar si WhatsApp Web está abierto
    chrome.runtime.sendMessage({ action: 'checkWhatsAppWeb' }, async (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error:', chrome.runtime.lastError);
            setState(AppState.ERROR);
            return;
        }

        if (response && response.found) {
            whatsappTabId = response.tabId;
            whatsappWindowId = response.windowId;
            setState(AppState.LOADING);

            // Esperar a que WhatsApp Web cargue completamente
            const loaded = await waitForWhatsAppToLoad(response.tabId);

            if (loaded) {
                await loadExistingData();
                setState(AppState.CONNECTED);
            } else {
                setState(AppState.ERROR);
            }
        } else {
            setState(AppState.NOT_FOUND);
        }
    });
}

// ========================================
// Listeners de Mensajes del Background
// ========================================
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'whatsappTabClosed':
                setState(AppState.NOT_FOUND);
                break;

            case 'whatsappReady':
                if (currentState === AppState.LOADING) {
                    loadExistingData().then(() => {
                        setState(AppState.CONNECTED);
                    });
                }
                break;

            case 'tabChanged':
                if (currentState === AppState.CONNECTED && !message.isWhatsAppTab) {
                    setState(AppState.DISCONNECTED);
                } else if (currentState === AppState.DISCONNECTED && message.isWhatsAppTab) {
                    setState(AppState.CONNECTED);
                }
                break;

            case 'showRatingPrompt':
                if (currentState === AppState.CONNECTED) {
                    checkAndShowRatingModal(message.count);
                }
                break;
        }
    });

    // Listener para cambios en storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && currentState === AppState.CONNECTED) {
            if (changes.scrapedData) {
                scrapedData = changes.scrapedData.newValue || [];
                updateContactCount(scrapedData.length);
            }
            if (changes.isScanning) {
                isScanning = changes.isScanning.newValue;
                updateScanningUI(isScanning);
            }
            if (changes.scanStatus) {
                updateStatusMessage(changes.scanStatus.newValue);
            }
            if (changes.scanCycles) {
                updateScrollCount(changes.scanCycles.newValue || 0);
            }
        }
    });
}

// ========================================
// Función para esperar que WhatsApp cargue
// ========================================
async function waitForWhatsAppToLoad(tabId) {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30;

        const checkInterval = setInterval(async () => {
            attempts++;

            try {
                const response = await chrome.runtime.sendMessage({
                    action: 'checkWhatsAppLoaded',
                    tabId: tabId
                });

                if (response && response.loaded) {
                    clearInterval(checkInterval);
                    updateLoadingStep(3); // Paso final
                    resolve(true);
                    return;
                }
            } catch (error) {
                log('Esperando WhatsApp...');
            }

            // Actualizar progreso visual
            updateLoadingProgress(attempts, maxAttempts);

            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                resolve(false);
            }
        }, 1000);
    });
}

function updateLoadingProgress(current, max) {
    const percentage = Math.round((current / max) * 100);
    const progressBar = document.getElementById('loadingProgress');
    const progressText = document.getElementById('loadingText');

    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `Cargando WhatsApp Web... ${percentage}%`;

    // Actualizar pasos
    if (current > 5) updateLoadingStep(2);
}

function updateLoadingStep(step) {
    const steps = document.querySelectorAll('.status-item');
    steps.forEach((item, index) => {
        item.classList.remove('active', 'completed');
        if (index < step - 1) {
            item.classList.add('completed');
        } else if (index === step - 1) {
            item.classList.add('active');
        }
    });
}

// ========================================
// Sistema de Estados
// ========================================
function setState(newState) {
    log('Snatch Exporter: Estado cambiado a', newState);
    currentState = newState;
    renderState(newState);
}

function renderState(state) {
    const container = document.getElementById('appContainer');
    if (!container) return;

    // Añadir clase para animación
    container.classList.add('state-transition');

    setTimeout(() => {
        switch (state) {
            case AppState.CHECKING:
                container.innerHTML = getCheckingHTML();
                break;
            case AppState.NOT_FOUND:
                container.innerHTML = getNotFoundHTML();
                attachOpenWhatsAppListener();
                break;
            case AppState.OPENING:
                container.innerHTML = getOpeningHTML();
                break;
            case AppState.LOADING:
                container.innerHTML = getLoadingHTML();
                break;
            case AppState.CONNECTED:
                container.innerHTML = getConnectedHTML();
                attachMainAppListeners();
                break;
            case AppState.DISCONNECTED:
                container.innerHTML = getDisconnectedHTML();
                attachFocusWhatsAppListener();
                break;
            case AppState.ERROR:
                container.innerHTML = getErrorHTML();
                attachRetryListener();
                break;
        }

        container.classList.remove('state-transition');
    }, 150);
}

// ========================================
// Templates HTML para cada Estado
// ========================================
function getCheckingHTML() {
    return `
        <div class="state-screen checking-screen">
            <div class="logo-container">
                <div class="logo-circle">
                    <svg viewBox="0 0 24 24" class="whatsapp-icon">
                        <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345"/>
                    </svg>
                </div>
                <div class="spinner-ring"></div>
            </div>
            
            <h2 class="state-title">Snatch WhatsApp Exporter</h2>
            <p class="state-subtitle">Buscando WhatsApp Web...</p>
            
            <div class="status-list">
                <div class="status-item active">
                    <div class="status-icon"><div class="mini-spinner"></div></div>
                    <span>Buscando WhatsApp Web</span>
                </div>
                <div class="status-item">
                    <div class="status-icon">○</div>
                    <span>Conectando</span>
                </div>
                <div class="status-item">
                    <div class="status-icon">○</div>
                    <span>Listo</span>
                </div>
            </div>
        </div>
    `;
}

function getNotFoundHTML() {
    return `
        <div class="state-screen not-found-screen">
            <div class="alert-icon-container">
                <div class="alert-icon">📱</div>
            </div>
            
            <h2 class="state-title">WhatsApp Web No Detectado</h2>
            <p class="state-subtitle">Abre WhatsApp Web para comenzar a extraer contactos.</p>
            
            <button id="openWhatsAppBtn" class="btn-primary btn-large">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                </svg>
                Abrir WhatsApp Web
            </button>
            
            <div class="info-card">
                <div class="info-icon">💡</div>
                <div class="info-content">
                    <strong>¿Por qué necesito esto?</strong>
                    <p>Esta extensión trabaja directamente con WhatsApp Web para extraer tus contactos de forma segura y privada.</p>
                </div>
            </div>
        </div>
    `;
}

function getOpeningHTML() {
    return `
        <div class="state-screen opening-screen">
            <div class="logo-container">
                <div class="logo-circle pulse">
                    <svg viewBox="0 0 24 24" class="whatsapp-icon">
                        <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345"/>
                    </svg>
                </div>
            </div>
            
            <h2 class="state-title">Abriendo WhatsApp Web</h2>
            <p class="state-subtitle">Espera un momento...</p>
            
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
}

function getLoadingHTML() {
    return `
        <div class="state-screen loading-screen">
            <div class="logo-container success">
                <div class="logo-circle">
                    <svg viewBox="0 0 24 24" class="check-icon">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                </div>
                <div class="spinner-ring"></div>
            </div>
            
            <h2 class="state-title">Snatch WhatsApp Exporter</h2>
            
            <div class="progress-container">
                <div class="progress-bar-bg">
                    <div id="loadingProgress" class="progress-bar-fill"></div>
                </div>
                <p id="loadingText" class="progress-text">Cargando WhatsApp Web... 0%</p>
            </div>
            
            <div class="status-list">
                <div class="status-item completed">
                    <div class="status-icon">✓</div>
                    <span>Buscando WhatsApp Web</span>
                </div>
                <div class="status-item active">
                    <div class="status-icon"><div class="mini-spinner"></div></div>
                    <span>Conectando</span>
                </div>
                <div class="status-item">
                    <div class="status-icon">○</div>
                    <span>Listo</span>
                </div>
            </div>
        </div>
    `;
}

function getDisconnectedHTML() {
    return `
        <div class="state-screen disconnected-screen">
            <div class="warning-icon-container">
                <div class="warning-icon">⚠️</div>
            </div>
            
            <h2 class="state-title">WhatsApp Web no está en foco</h2>
            <p class="state-subtitle">Mantén la pestaña de WhatsApp Web activa durante la extracción.</p>
            
            <button id="focusWhatsAppBtn" class="btn-primary btn-large">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                Ir a WhatsApp Web
            </button>
            
            <div class="info-card warning">
                <div class="info-icon">💡</div>
                <div class="info-content">
                    <strong>Consejo</strong>
                    <p>Mantén esta ventana y WhatsApp Web visibles al mismo tiempo para seguir el progreso.</p>
                </div>
            </div>
        </div>
    `;
}

function getErrorHTML() {
    return `
        <div class="state-screen error-screen">
            <div class="error-icon-container">
                <div class="error-icon">❌</div>
            </div>
            
            <h2 class="state-title">Error de Conexión</h2>
            <p class="state-subtitle">No se pudo conectar con WhatsApp Web.</p>
            
            <button id="retryBtn" class="btn-primary">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
                Reintentar
            </button>
        </div>
    `;
}

function getConnectedHTML() {
    return `
        <!-- Header de Estado Conectado -->
        <div class="connected-banner">
            <div class="connected-indicator">
                <span class="pulse-dot"></span>
                <span>Conectado a WhatsApp Web</span>
            </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="nav-tabs">
            <div class="nav-tab active" data-target="page-home">
                <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span>Inicio</span>
            </div>
            <div class="nav-tab" data-target="page-help">
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
                <span>Ayuda</span>
            </div>
            <div class="nav-tab" data-target="page-rating">
                <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                <span>Valorar</span>
            </div>
        </nav>

        <!-- Content Area -->
        <div class="content-area">
            <!-- Page: Home -->
            <div id="page-home" class="page active">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div id="contactCount" class="stat-number">0</div>
                        <div class="stat-label">Contactos</div>
                    </div>
                    <div class="stat-card">
                        <div id="scrollCount" class="stat-number">0</div>
                        <div class="stat-label">Scrolls</div>
                    </div>
                </div>

                <div id="progressContainer" class="extraction-progress hidden">
                    <div class="progress-header">
                        <span id="extractionStatus">Extrayendo...</span>
                        <span id="progressPercent">0%</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div id="extractionProgress" class="progress-bar-fill scanning"></div>
                    </div>
                </div>

                <div class="action-buttons">
                    <button id="btnStart" class="btn-primary btn-large">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        <span>Iniciar Extracción</span>
                    </button>
                    
                    <div id="scanningButtons" class="btn-row hidden">
                        <button id="btnPause" class="btn-secondary">
                            <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            Pausar
                        </button>
                        <button id="btnStop" class="btn-danger">
                            <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                            Detener
                        </button>
                    </div>
                </div>

                <div id="exportSection" class="export-section hidden">
                    <div class="export-title">Formato de Exportación</div>
                    <div class="format-grid">
                        <div class="format-option active" data-format="csv">CSV</div>
                        <div class="format-option" data-format="xlsx">Excel</div>
                        <div class="format-option" data-format="json">JSON</div>
                        <div class="format-option" data-format="vcard">VCard</div>
                    </div>
                    
                    <button id="btnDownload" class="btn-primary mt-4">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        Descargar Contactos
                    </button>
                </div>

                <button id="btnClear" class="btn-text-danger mt-4 hidden">
                    🔄 Volver a empezar
                </button>
            </div>

            <!-- Page: Help -->
            <div id="page-help" class="page">
                <h3 class="section-title">Preguntas Frecuentes</h3>
                
                <div class="faq-list">
                    <details class="faq-item">
                        <summary>¿Cómo funciona?</summary>
                        <p>La extensión hace scroll automático por tu lista de chats y extrae nombres y números de teléfono de forma local.</p>
                    </details>
                    
                    <details class="faq-item">
                        <summary>¿Es seguro?</summary>
                        <p>Sí, todo ocurre en tu computadora. No enviamos datos a ningún servidor.</p>
                    </details>
                    
                    <details class="faq-item">
                        <summary>¿Por qué se detuvo?</summary>
                        <p>Se detiene al llegar al final de la lista. Puedes reanudar en cualquier momento.</p>
                    </details>
                    
                    <details class="faq-item">
                        <summary>¿Cómo exportar a iPhone?</summary>
                        <p>Usa el formato VCard (.vcf) y ábrelo en tu iPhone para importar los contactos.</p>
                    </details>
                </div>
            </div>

            <!-- Page: Rating -->
            <div id="page-rating" class="page">
                <div class="rating-container">
                    <h3 class="section-title">¿Te gusta Snatch Exporter?</h3>
                    <p class="rating-subtitle">Tu opinión nos ayuda a mejorar</p>
                    
                    <div class="star-rating" id="starRating">
                        <span class="star" data-value="1">★</span>
                        <span class="star" data-value="2">★</span>
                        <span class="star" data-value="3">★</span>
                        <span class="star" data-value="4">★</span>
                        <span class="star" data-value="5">★</span>
                    </div>

                    <div id="feedbackForm" class="feedback-section hidden">
                        <p>¿Qué podemos mejorar?</p>
                        <textarea id="feedbackText" placeholder="Cuéntanos tu experiencia..."></textarea>
                        <button id="btnSendFeedback" class="btn-primary">Enviar Feedback</button>
                    </div>

                    <div id="positiveRating" class="positive-section hidden">
                        <div class="success-emoji">🎉</div>
                        <h4>¡Gracias!</h4>
                        <p>Tu apoyo significa mucho. ¿Te gustaría dejarnos una reseña?</p>
                        <button id="btnRateStore" class="btn-primary">
                            ⭐ Calificar en Chrome Web Store
                        </button>
                        <button id="btnSkipRating" class="btn-text">Ahora no</button>
                    </div>

                    <div id="alreadyRated" class="already-rated hidden">
                        <div class="success-emoji">💚</div>
                        <h4>¡Gracias por tu apoyo!</h4>
                        <p>Ya nos has valorado. Seguimos trabajando para darte la mejor experiencia.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Rating Modal -->
        <div id="ratingModal" class="modal-overlay">
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-icon">🎉</div>
                    <h3>¡Extracción Completada!</h3>
                    <p id="modalContactCount">Se extrajeron 0 contactos</p>
                </div>
                <div class="modal-body">
                    <p>¿Qué te pareció la experiencia?</p>
                    <div class="star-rating" id="modalStarRating">
                        <span class="star" data-value="1">★</span>
                        <span class="star" data-value="2">★</span>
                        <span class="star" data-value="3">★</span>
                        <span class="star" data-value="4">★</span>
                        <span class="star" data-value="5">★</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="btnModalRate" class="btn-primary" disabled>Enviar Valoración</button>
                    <button id="btnModalSkip" class="btn-text">Ahora no</button>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Event Listeners para Cada Estado
// ========================================
function attachOpenWhatsAppListener() {
    const btn = document.getElementById('openWhatsAppBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            setState(AppState.OPENING);

            chrome.runtime.sendMessage({ action: 'openWhatsAppWeb' }, async (response) => {
                if (response && response.success) {
                    whatsappTabId = response.tabId;
                    whatsappWindowId = response.windowId;
                    setState(AppState.LOADING);

                    const loaded = await waitForWhatsAppToLoad(response.tabId);
                    if (loaded) {
                        await loadExistingData();
                        setState(AppState.CONNECTED);
                    } else {
                        setState(AppState.ERROR);
                    }
                } else {
                    setState(AppState.ERROR);
                }
            });
        });
    }
}

function attachFocusWhatsAppListener() {
    const btn = document.getElementById('focusWhatsAppBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'focusWhatsAppTab' });
        });
    }
}

function attachRetryListener() {
    const btn = document.getElementById('retryBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            initializeApp();
        });
    }
}

function attachMainAppListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.target;

            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(targetId)?.classList.add('active');
        });
    });

    // Format selection
    document.querySelectorAll('.format-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.format-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            currentFormat = opt.dataset.format;
        });
    });

    // Action buttons
    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnStop = document.getElementById('btnStop');
    const btnDownload = document.getElementById('btnDownload');
    const btnClear = document.getElementById('btnClear');

    if (btnStart) {
        btnStart.addEventListener('click', startExtraction);
    }

    if (btnPause) {
        btnPause.addEventListener('click', pauseExtraction);
    }

    if (btnStop) {
        btnStop.addEventListener('click', stopExtraction);
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', downloadContacts);
    }

    if (btnClear) {
        btnClear.addEventListener('click', clearAllData);
    }

    // Rating system
    setupStarRating(document.getElementById('starRating'), (rating) => {
        currentRating = rating;
        handleRatingSelection(rating);
    });

    setupStarRating(document.getElementById('modalStarRating'), (rating) => {
        modalRating = rating;
        const btn = document.getElementById('btnModalRate');
        if (btn) btn.disabled = false;
    });

    // Rating buttons
    document.getElementById('btnSendFeedback')?.addEventListener('click', sendFeedback);
    document.getElementById('btnRateStore')?.addEventListener('click', openChromeStore);
    document.getElementById('btnSkipRating')?.addEventListener('click', () => {
        document.getElementById('positiveRating')?.classList.add('hidden');
        document.getElementById('feedbackForm')?.classList.add('hidden');
    });

    document.getElementById('btnModalRate')?.addEventListener('click', handleModalRating);
    document.getElementById('btnModalSkip')?.addEventListener('click', hideRatingModal);

    // Close modal on overlay click
    document.getElementById('ratingModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'ratingModal') hideRatingModal();
    });

    // Check rating status
    checkRatingStatus();
}

// ========================================
// Funciones de Extracción
// ========================================
async function loadExistingData() {
    const data = await chrome.storage.local.get([
        'scrapedData',
        'isScanning',
        'scanStatus',
        'scanCycles'
    ]);

    scrapedData = data.scrapedData || [];
    isScanning = data.isScanning || false;

    updateContactCount(scrapedData.length);
    updateScrollCount(data.scanCycles || 0);
    updateScanningUI(isScanning);
}

async function startExtraction() {
    log('Iniciando extracción...');

    // Mostrar estado de carga
    const btnStart = document.getElementById('btnStart');
    if (btnStart) {
        btnStart.disabled = true;
        btnStart.innerHTML = '<div class="mini-spinner"></div> Conectando...';
    }

    const response = await sendMessageToContent({ action: 'START_SCRAPE' });

    if (response && (response.status === 'started' || response.status === 'already_running')) {
        isScanning = true;
        updateScanningUI(true);
        log('Extracción iniciada correctamente');
    } else {
        // Mostrar error
        if (btnStart) {
            btnStart.disabled = false;
            btnStart.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                <span>Iniciar Extracción</span>
            `;
        }

        // Mostrar mensaje de error
        const errorMsg = response?.error || 'No se pudo conectar. Recarga WhatsApp Web.';
        alert(errorMsg);
        log('Error iniciando extracción:', errorMsg);
    }
}

async function pauseExtraction() {
    await sendMessageToContent({ action: 'STOP_SCRAPE' });
    isScanning = false;
    updateScanningUI(false);
}

async function stopExtraction() {
    await sendMessageToContent({ action: 'STOP_SCRAPE' });
    isScanning = false;
    updateScanningUI(false);

    // Trigger rating check
    const data = await chrome.storage.local.get(['extractionCount']);
    const count = (data.extractionCount || 0) + 1;
    await chrome.storage.local.set({ extractionCount: count });
    checkAndShowRatingModal(count);
}

async function clearAllData() {
    if (confirm('¿Estás seguro de que quieres volver a empezar? Esto borrará los contactos actuales.')) {
        await sendMessageToContent({ action: 'STOP_SCRAPE' });
        scrapedData = [];
        await chrome.storage.local.set({
            scrapedData: [],
            isScanning: false,
            scanStatus: 'Listo',
            lastScrollPosition: 0,
            scanCycles: 0
        });
        updateContactCount(0);
        updateScrollCount(0);
        updateScanningUI(false);

        document.getElementById('exportSection')?.classList.add('hidden');
        document.getElementById('btnClear')?.classList.add('hidden');
    }
}

function downloadContacts() {
    if (scrapedData.length === 0) {
        alert('No hay contactos para descargar');
        return;
    }
    const fileData = generateFileContent(scrapedData, currentFormat);
    downloadFile(fileData);
}

// ========================================
// UI Updates
// ========================================
function updateContactCount(count) {
    const el = document.getElementById('contactCount');
    if (el) el.textContent = count;

    if (count > 0) {
        document.getElementById('exportSection')?.classList.remove('hidden');
        document.getElementById('btnClear')?.classList.remove('hidden');
    }
}

function updateScrollCount(count) {
    const el = document.getElementById('scrollCount');
    if (el) el.textContent = count;
}

function updateStatusMessage(message) {
    const el = document.getElementById('extractionStatus');
    if (el) el.textContent = message;
}

function updateScanningUI(scanning) {
    const btnStart = document.getElementById('btnStart');
    const scanningButtons = document.getElementById('scanningButtons');
    const progressContainer = document.getElementById('progressContainer');

    if (scanning) {
        btnStart?.classList.add('hidden');
        scanningButtons?.classList.remove('hidden');
        progressContainer?.classList.remove('hidden');
    } else {
        btnStart?.classList.remove('hidden');
        scanningButtons?.classList.add('hidden');

        if (scrapedData.length > 0 && btnStart) {
            btnStart.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                <span>Reanudar Extracción</span>
            `;
        }
    }
}

// ========================================
// Communication with Content Script
// ========================================
async function sendMessageToContent(message) {
    // Obtener tab de WhatsApp si no lo tenemos
    if (!whatsappTabId) {
        const response = await chrome.runtime.sendMessage({ action: 'getWhatsAppTabId' });
        if (response && response.tabId) {
            whatsappTabId = response.tabId;
        } else {
            // Buscar pestaña de WhatsApp directamente
            const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
            if (tabs && tabs.length > 0) {
                whatsappTabId = tabs[0].id;
            } else {
                setState(AppState.NOT_FOUND);
                return { success: false, error: 'WhatsApp Web no encontrado' };
            }
        }
    }

    // Enviar mensaje con reintentos
    return new Promise(async (resolve) => {
        const sendWithRetry = async (retries = 2) => {
            try {
                chrome.tabs.sendMessage(whatsappTabId, message, (response) => {
                    if (chrome.runtime.lastError) {
                        log('Error comunicando:', chrome.runtime.lastError.message);
                        if (retries > 0) {
                            // Reintentar después de un delay
                            setTimeout(() => sendWithRetry(retries - 1), 500);
                        } else {
                            // Intentar inyectar el script y reintentar
                            injectAndRetry(message, resolve);
                        }
                    } else {
                        resolve(response || { success: true });
                    }
                });
            } catch (error) {
                log('Excepción al enviar mensaje:', error);
                resolve({ success: false, error: error.message });
            }
        };

        sendWithRetry();
    });
}

// Inyectar content script si no está cargado
async function injectAndRetry(message, resolve) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: whatsappTabId },
            files: ['content.js']
        });

        // Esperar a que el script se cargue
        setTimeout(() => {
            chrome.tabs.sendMessage(whatsappTabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ success: false, error: 'No se pudo conectar con WhatsApp Web' });
                } else {
                    resolve(response || { success: true });
                }
            });
        }, 1000);
    } catch (error) {
        log('Error inyectando script:', error);
        resolve({ success: false, error: 'Error al cargar el script' });
    }
}

// ========================================
// Rating System
// ========================================
async function checkRatingStatus() {
    const data = await chrome.storage.local.get(['hasRated']);
    if (data.hasRated) {
        document.getElementById('starRating')?.classList.add('hidden');
        document.getElementById('feedbackForm')?.classList.add('hidden');
        document.getElementById('positiveRating')?.classList.add('hidden');
        document.getElementById('alreadyRated')?.classList.remove('hidden');
    }
}

function setupStarRating(container, callback) {
    if (!container) return;

    const stars = container.querySelectorAll('.star');

    stars.forEach(star => {
        star.addEventListener('mouseenter', () => {
            const value = parseInt(star.dataset.value);
            stars.forEach(s => {
                s.classList.toggle('hovered', parseInt(s.dataset.value) <= value);
            });
        });

        star.addEventListener('mouseleave', () => {
            stars.forEach(s => s.classList.remove('hovered'));
        });

        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.dataset.value) <= value);
            });
            callback(value);
        });
    });
}

function handleRatingSelection(stars) {
    const feedbackForm = document.getElementById('feedbackForm');
    const positiveRating = document.getElementById('positiveRating');

    if (stars <= 3) {
        feedbackForm?.classList.remove('hidden');
        positiveRating?.classList.add('hidden');
    } else {
        feedbackForm?.classList.add('hidden');
        positiveRating?.classList.remove('hidden');
    }
}

async function sendFeedback() {
    const feedback = document.getElementById('feedbackText')?.value.trim();
    if (feedback) {
        // Formulario de feedback para valoraciones 1-3 estrellas
        chrome.tabs.create({ url: 'https://docs.google.com/forms/d/1R0BRruk9NQjhmbsPy6wuJMLp9FHHL7Wxq8htAYP1phI/viewform' });
        await chrome.storage.local.set({ hasRated: true, userRating: currentRating });
        showThankYouMessage();
    } else {
        alert('Por favor, escribe tu feedback antes de enviar.');
    }
}

async function openChromeStore() {
    // Chrome Web Store para valoraciones 4-5 estrellas
    chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/dmjddkogpfnnjbcenpfffdoplkilpkjf/reviews' });
    await chrome.storage.local.set({ hasRated: true, userRating: currentRating });
}

function showThankYouMessage() {
    document.getElementById('starRating')?.classList.add('hidden');
    document.getElementById('feedbackForm')?.classList.add('hidden');
    document.getElementById('positiveRating')?.classList.add('hidden');
    document.getElementById('alreadyRated')?.classList.remove('hidden');
}

// Rating Modal
async function checkAndShowRatingModal(count) {
    const data = await chrome.storage.local.get(['hasRated', 'lastRatingPrompt']);

    if (data.hasRated) return;

    const lastPrompt = data.lastRatingPrompt || 0;
    if (count - lastPrompt >= 3 && scrapedData.length > 0) {
        showRatingModal();
        await chrome.storage.local.set({ lastRatingPrompt: count });
    }
}

function showRatingModal() {
    const modal = document.getElementById('ratingModal');
    const countEl = document.getElementById('modalContactCount');

    if (countEl) countEl.textContent = `Se extrajeron ${scrapedData.length} contactos`;
    modal?.classList.add('show');
    modalRating = 0;

    const btn = document.getElementById('btnModalRate');
    if (btn) btn.disabled = true;

    document.querySelectorAll('#modalStarRating .star').forEach(s => s.classList.remove('active'));
}

function hideRatingModal() {
    document.getElementById('ratingModal')?.classList.remove('show');
}

async function handleModalRating() {
    if (modalRating <= 3) {
        // Formulario de feedback para valoraciones 1-3 estrellas (modal)
        chrome.tabs.create({ url: 'https://docs.google.com/forms/d/1R0BRruk9NQjhmbsPy6wuJMLp9FHHL7Wxq8htAYP1phI/viewform' });
    } else {
        // Chrome Web Store para valoraciones 4-5 estrellas (modal)
        chrome.tabs.create({ url: 'https://chromewebstore.google.com/detail/dmjddkogpfnnjbcenpfffdoplkilpkjf/reviews' });
    }

    await chrome.storage.local.set({ hasRated: true, userRating: modalRating });
    hideRatingModal();
}

// ========================================
// File Generation & Download
// ========================================
function generateFileContent(data, format) {
    const headerName = msg('csvHeaderName') || 'Nombre';
    const headerPhone = msg('csvHeaderPhone') || 'Teléfono';
    const headerMsg = msg('csvHeaderLastMessage') || 'Último Mensaje';

    if (format === 'csv') {
        const header = [headerName, headerPhone, headerMsg];
        const csvContent = [
            header.join(','),
            ...data.map(row => {
                const name = `"${(row.name || '').replace(/"/g, '""')}"`;
                const phone = `"${(row.phone || '').replace(/"/g, '""')}"`;
                const msgText = `"${(row.lastMessage || '').replace(/"/g, '""')}"`;
                return `${name},${phone},${msgText}`;
            })
        ].join('\n');
        return { mime: 'text/csv;charset=utf-8;', content: '\uFEFF' + csvContent, ext: 'csv' };
    }
    else if (format === 'xlsx') {
        let html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel">';
        html += '<head><meta charset="UTF-8"></head><body>';
        html += `<table><thead><tr><th>${headerName}</th><th>${headerPhone}</th><th>${headerMsg}</th></tr></thead><tbody>`;
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
        filename: `whatsapp-contacts-${timestamp}.${fileData.ext}`,
        saveAs: true
    });
}
