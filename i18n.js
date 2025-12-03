// i18n.js - Sistema de internacionalización para la extensión
// Inicializa traducciones en elementos HTML con atributos data-i18n

(function() {
    'use strict';

    /**
     * Inicializa todas las traducciones en elementos con data-i18n
     */
    function initializeI18n() {
        // Traducir texto de elementos
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.textContent = message;
            }
        });

        // Traducir HTML interno (para elementos con formato como <strong>)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.innerHTML = message;
            }
        });

        // Traducir atributos title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.setAttribute('title', message);
            }
        });

        // Traducir placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const message = chrome.i18n.getMessage(key);
            if (message) {
                element.setAttribute('placeholder', message);
            }
        });

        // Actualizar el atributo lang del documento
        const uiLang = chrome.i18n.getUILanguage();
        document.documentElement.lang = uiLang.split('-')[0] || uiLang;

        // Configurar dirección RTL para árabe y hebreo
        if (uiLang.startsWith('ar') || uiLang.startsWith('he')) {
            document.documentElement.dir = 'rtl';
        }
    }

    /**
     * Obtiene un mensaje traducido con placeholders
     * @param {string} key - Clave del mensaje
     * @param {Array|string} substitutions - Valores para reemplazar $1, $2, etc.
     * @returns {string} Mensaje traducido
     */
    function getMessage(key, substitutions) {
        return chrome.i18n.getMessage(key, substitutions) || key;
    }

    /**
     * Traduce un elemento específico
     * @param {HTMLElement} element - Elemento a traducir
     * @param {string} key - Clave i18n
     * @param {Array|string} substitutions - Valores opcionales para placeholders
     */
    function translateElement(element, key, substitutions) {
        const message = chrome.i18n.getMessage(key, substitutions);
        if (message && element) {
            element.textContent = message;
        }
    }

    // Ejecutar al cargar DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeI18n);
    } else {
        initializeI18n();
    }

    // Exponer funciones globalmente para uso en otros scripts
    window.i18n = {
        init: initializeI18n,
        getMessage: getMessage,
        translateElement: translateElement
    };
})();


