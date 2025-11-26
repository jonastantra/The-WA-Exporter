(() => {
  // Helper function for delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper to identify the chat list container
  function findChatList() {
    const paneSide = document.getElementById('pane-side');
    if (paneSide) return paneSide;

    const ariaList = document.querySelector('div[aria-label="Chat list"]');
    if (ariaList) return ariaList;

    const grids = document.querySelectorAll('div[role="grid"], div[role="treegrid"]');
    for (let grid of grids) {
      const style = window.getComputedStyle(grid);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') {
        return grid;
      }
    }
    return null;
  }

  // Helper to scrape individual contact from a row
  function extractContactData(row) {
    try {
      const rawText = row.innerText.split('\n').filter(t => t.trim().length > 0);
      if (rawText.length === 0) return null;

      let name = rawText[0];
      let lastMessage = "";
      let phone = "";

      const titleEl = row.querySelector('span[title]');
      if (titleEl && titleEl.getAttribute('title')) {
        name = titleEl.getAttribute('title');
      }

      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{2,}[-\s\.]?[0-9]{2,}$/;
      if (phoneRegex.test(name.replace(/\s/g, ''))) {
        phone = name;
      }

      const timeRegex = /^(?:\d{1,2}:\d{2}|Ayer|Yesterday|Hoy|Today|Domingo|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/i;

      const messageCandidate = rawText.find(line => line !== name && !timeRegex.test(line));
      if (messageCandidate) {
        lastMessage = messageCandidate;
      }

      return {
        name: name.trim(),
        phone: phone.trim(),
        lastMessage: lastMessage.substring(0, 100).trim()
      };

    } catch (e) {
      console.error("Error extracting row data", e);
      return null;
    }
  }

  async function scrollAndScrape() {
    const chatList = findChatList();
    if (!chatList) {
      throw new Error("No se encontró la lista de chats. Recarga WhatsApp Web e intenta de nuevo.");
    }

    const contacts = new Map();
    chatList.scrollTop = 0;
    await delay(1000);

    let previousHeight = 0;
    let noChangeCount = 0;
    const MAX_NO_CHANGE = 5;
    const MAX_CYCLES = 300;

    console.log("Iniciando auto-scroll y scraping...");

    for (let i = 0; i < MAX_CYCLES; i++) {
      const rows = chatList.querySelectorAll('div[role="row"]');

      rows.forEach(row => {
        const data = extractContactData(row);
        if (data && data.name) {
          if (!contacts.has(data.name)) {
            contacts.set(data.name, data);
          }
        }
      });

      const scrollStep = Math.floor(chatList.clientHeight * 0.8);
      previousHeight = chatList.scrollTop;
      chatList.scrollTop += scrollStep;

      await delay(1500);

      if (Math.abs(chatList.scrollTop - previousHeight) < 5) {
        noChangeCount++;
        if (noChangeCount >= MAX_NO_CHANGE) break;
      } else {
        noChangeCount = 0;
      }
    }

    return Array.from(contacts.values());
  }

  // --- Sidebar Logic ---
  function toggleSidebar() {
    let container = document.getElementById('wa-exporter-sidebar-container');

    if (!container) {
      container = document.createElement('iframe');
      container.id = 'wa-exporter-sidebar-container';
      container.src = chrome.runtime.getURL('sidebar.html');

      // Inline styles for reliability
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.right = '0';
      container.style.height = '100vh';
      container.style.width = '360px';
      container.style.border = 'none';
      container.style.zIndex = '99999';
      container.style.boxShadow = '-5px 0 15px rgba(0,0,0,0.1)';
      container.style.transition = 'transform 0.3s ease-in-out';
      container.style.transform = 'translateX(100%)'; // Hidden initially
      container.style.background = '#f3f4f6';

      document.body.appendChild(container);

      // Force reflow
      container.offsetHeight;
    }

    const isOpen = container.style.transform === 'translateX(0px)';

    if (isOpen) {
      container.style.transform = 'translateX(100%)';
    } else {
      container.style.transform = 'translateX(0px)';
    }

    // Adjust WhatsApp Main Container
    const app = document.getElementById('app') || document.querySelector('#app') || document.body.firstElementChild;
    if (app) {
      if (!isOpen) {
        app.style.width = 'calc(100% - 360px)';
        app.style.transition = 'width 0.3s ease';
      } else {
        app.style.width = '100%';
      }
    }
  }

  // Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE") {
      scrollAndScrape()
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));

      return true; // Keep channel open
    }

    if (request.action === "TOGGLE_SIDEBAR") {
      toggleSidebar();
      sendResponse({ success: true });
    }
  });
})();
