(() => {
  // Helper function for delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper to identify the chat list container
  function findChatList() {
    // Priority 1: The specific ID used by WA Web for the scrollable side pane
    const paneSide = document.getElementById('pane-side');
    if (paneSide) {
      console.log("Contenedor encontrado por ID: #pane-side");
      return paneSide;
    }

    // Priority 2: Aria label "Chat list"
    const ariaList = document.querySelector('div[aria-label="Chat list"]');
    if (ariaList) {
      console.log("Contenedor encontrado por aria-label");
      return ariaList;
    }

    // Priority 3: Look for any div with role="grid"/treegrid that is scrollable
    const grids = document.querySelectorAll('div[role="grid"], div[role="treegrid"]');
    for (let grid of grids) {
        // Check if it has a vertical scrollbar capability
        const style = window.getComputedStyle(grid);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') {
            console.log("Contenedor encontrado por role y overflow");
            return grid;
        }
    }
    
    console.error("No se encontró el contenedor de la lista de chats.");
    return null;
  }

  // Helper to scrape individual contact from a row
  function extractContactData(row) {
    try {
      // Attempt to get all text content broken by newlines
      const rawText = row.innerText.split('\n').filter(t => t.trim().length > 0);
      
      if (rawText.length === 0) return null;

      let name = rawText[0]; // Default assumption: first line is name
      let lastMessage = "";
      let time = "";

      // Heuristics to improve name detection
      // 1. Look for specific elements with title attributes (common in WA)
      const titleEl = row.querySelector('span[title]');
      if (titleEl && titleEl.getAttribute('title')) {
        name = titleEl.getAttribute('title');
      }

      // 2. Identify last message
      // Usually the last message is the second substantial line of text
      // Exclude timestamps (e.g. "12:30", "Ayer", "Martes")
      const timeRegex = /^(?:\d{1,2}:\d{2}|Ayer|Yesterday|Hoy|Today|Domingo|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/i;
      
      // Find a line that doesn't look like the name and doesn't look like a time
      const messageCandidate = rawText.find(line => line !== name && !timeRegex.test(line));
      if (messageCandidate) {
        lastMessage = messageCandidate;
      }

      return { 
        name: name.trim(), 
        lastMessage: lastMessage.substring(0, 100).trim() // Limit length
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

    // Store unique contacts
    // Key: Name + partial message to ensure uniqueness if names are duplicated (e.g. two "Juan")
    const contacts = new Map();

    // Reset scroll to top to ensure we get everything
    chatList.scrollTop = 0;
    await delay(1000);

    let previousHeight = 0;
    let noChangeCount = 0;
    // Increase patience for "no change" since network can be slow
    const MAX_NO_CHANGE = 5; 
    
    // Limit maximum scroll cycles to prevent infinite loops (e.g., 2000 contacts approx)
    const MAX_CYCLES = 300; 

    console.log("Iniciando auto-scroll y scraping...");

    for (let i = 0; i < MAX_CYCLES; i++) {
      // 1. Capture currently visible rows
      // WA Web uses div[role="row"] or specific classes depending on version.
      // We use a broad selector to be safe.
      const rows = chatList.querySelectorAll('div[role="row"]');
      
      if (rows.length === 0) {
        // Fallback for potential layout changes
        console.warn("No se encontraron filas con role='row'. Buscando hijos directos...");
      }

      // Scrape visible
      rows.forEach(row => {
        const data = extractContactData(row);
        if (data && data.name) {
          // Use name as unique key. 
          // Note: This deduplicates contacts with the EXACT same name.
          // If you have two "Juan", only one will be saved.
          // To fix this, we could append a counter, but usually for export unique names are desired.
          if (!contacts.has(data.name)) {
            contacts.set(data.name, data);
          }
        }
      });

      // 2. Scroll logic
      // Scroll by the height of the visible area (minus a small overlap)
      const scrollStep = Math.floor(chatList.clientHeight * 0.8); 
      previousHeight = chatList.scrollTop;
      chatList.scrollTop += scrollStep;

      // 3. Wait for data to load
      // Wait longer (1.5s - 2s) because WA lazy loads data from server
      await delay(1500);

      // 4. Termination check
      // If we haven't moved (meaning we are at the bottom)
      if (Math.abs(chatList.scrollTop - previousHeight) < 5) {
        noChangeCount++;
        console.log(`Sin movimiento de scroll (${noChangeCount}/${MAX_NO_CHANGE})`);
        if (noChangeCount >= MAX_NO_CHANGE) {
          console.log("Final del scroll alcanzado.");
          break;
        }
      } else {
        noChangeCount = 0;
        // Visual feedback in console
        console.log(`Scroll paso ${i+1}: ${contacts.size} contactos recolectados hasta ahora...`);
      }
    }

    return Array.from(contacts.values());
  }

  // Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE") {
      scrollAndScrape()
        .then(data => sendResponse({ success: true, data: data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      
      return true; // Keep channel open
    }
  });
})();
