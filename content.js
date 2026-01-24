console.log("WhatsApp CRM Draggable Frame: Content script loaded.");

function injectCrm() {
  // --- 1. CREATE CRM PANEL ELEMENTS ---
  const crmContainer = document.createElement("div");
  crmContainer.id = "crm-container";
  crmContainer.style.display = "none";

  const dragHeader = document.createElement("div");
  dragHeader.id = "crm-drag-header";
  const headerTitle = document.createElement("h3");
  headerTitle.textContent = "AdExpress CRM";
  const closeButton = document.createElement("button");
  closeButton.id = "crm-header-close-btn";
  closeButton.innerHTML = "&times;";
  closeButton.title = "Close";
  dragHeader.appendChild(headerTitle);
  dragHeader.appendChild(closeButton);

  const iframe = document.createElement("iframe");
  iframe.id = "sheet-viewer-iframe";
  iframe.src = chrome.runtime.getURL("panel.html");

  crmContainer.appendChild(dragHeader);
  crmContainer.appendChild(iframe);
  document.body.appendChild(crmContainer);

  const floatingButton = document.createElement("button");
  floatingButton.id = "crm-floating-btn";
  floatingButton.innerHTML = `<img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="CRM">`;
  document.body.appendChild(floatingButton);

  // --- 2. DRAG AND DROP LOGIC ---
  function makeDraggable(element, handle) {
    let isDragging = false;
    let offsetX, offsetY;
    handle.addEventListener("mousedown", (e) => {
      isDragging = true;
      const rect = element.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
      window.addEventListener("mousemove", doDrag);
      window.addEventListener("mouseup", stopDrag);
    });
    function doDrag(e) {
      if (!isDragging) return;
      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;
      newX = Math.max(0, Math.min(newX, window.innerWidth - element.offsetWidth));
      newY = Math.max(0, Math.min(newY, window.innerHeight - element.offsetHeight));
      element.style.left = `${newX}px`;
      element.style.top = `${newY}px`;
    }
    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener("mousemove", doDrag);
      window.removeEventListener("mouseup", stopDrag);
      chrome.storage.local.set({
        panelPosition: { top: element.style.top, left: element.style.left },
      });
    }
  }
  makeDraggable(crmContainer, dragHeader);

  // Listen for messages from iframe
  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (event.data.action === "hidePanel") {
      crmContainer.style.display = "none";
    }
  });

  // --- 3. EVENT LISTENERS ---
  function togglePanel() {
    const isHidden = crmContainer.style.display === "none";
    if (isHidden) {
      iframe.src = chrome.runtime.getURL("panel.html");
      crmContainer.style.display = "flex";
    } else {
      crmContainer.style.display = "none";
    }
  }
  floatingButton.addEventListener("click", togglePanel);
  closeButton.addEventListener("click", togglePanel);

  // --- 4. INITIALIZATION ---
  chrome.storage.local.get("panelPosition", (result) => {
    if (result.panelPosition && result.panelPosition.top) {
      crmContainer.style.top = result.panelPosition.top;
      crmContainer.style.left = result.panelPosition.left;
    } else {
      const panelWidth = 420;
      crmContainer.style.top = "20px";
      crmContainer.style.left = `${window.innerWidth - panelWidth - 20}px`;
    }
  });
}

// Wait for WhatsApp to be ready before injecting CRM
const observer = new MutationObserver((mutations, obs) => {
  if (document.querySelector("#app")) {
    injectCrm();
    obs.disconnect();
  }
});
observer.observe(document.body, { childList: true, subtree: true });
