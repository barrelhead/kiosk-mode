// content.js - Handles the kiosk functionality on the page
let kioskModeActive = false;
let kioskOverlay;
let unlockPanel;
let unlockButton;

// Notify background script that content script is ready
function notifyReady() {
  try {
    console.log("Content script loaded, notifying background");
    chrome.runtime.sendMessage({ action: "contentScriptReady" }, response => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.log("Error notifying background script:", lastError.message);
        // Try again after a short delay
        setTimeout(notifyReady, 500);
      } else if (response && response.kioskActive) {
        // If kiosk mode should be active, enable it
        console.log("Content script ready and kiosk should be active");
        enableKioskMode();
      }
    });
  } catch (e) {
    console.error("Exception notifying ready:", e);
  }
}

// Run when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', notifyReady);
} else {
  notifyReady();
}

// Create and inject kiosk UI elements
function createKioskElements() {
  console.log("Creating kiosk UI elements");

  // First remove any existing elements to prevent duplicates
  const existingOverlay = document.getElementById('kiosk-overlay');
  if (existingOverlay && existingOverlay.parentNode) {
    existingOverlay.parentNode.removeChild(existingOverlay);
  }
  
  const existingEscIndicator = document.getElementById('kiosk-esc-indicator');
  if (existingEscIndicator && existingEscIndicator.parentNode) {
    existingEscIndicator.parentNode.removeChild(existingEscIndicator);
  }
  
  // Create overlay
  kioskOverlay = document.createElement('div');
  kioskOverlay.id = 'kiosk-overlay';
  
  // Create unlock panel
  unlockPanel = document.createElement('div');
  unlockPanel.id = 'kiosk-unlock-panel';
  unlockPanel.innerHTML = `
    <div class="kiosk-panel-content">
      <div class="kiosk-logo">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="20" fill="#5E6AD2" />
          <path d="M20 11C15.05 11 11 15.05 11 20C11 24.95 15.05 29 20 29C24.95 29 29 24.95 29 20C29 15.05 24.95 11 20 11ZM14.5 19.5C14.5 17.01 16.51 15 19 15C21.49 15 23.5 17.01 23.5 19.5C23.5 21.99 21.49 24 19 24C16.51 24 14.5 21.99 14.5 19.5ZM26.9 25.32C25.54 27.32 23.22 28.63 20.56 28.92C23.1 27.73 24.93 25.8 25.92 23.23C26.38 23.82 26.71 24.53 26.9 25.32ZM21.75 19.5C21.75 17.97 20.53 16.75 19 16.75C17.47 16.75 16.25 17.97 16.25 19.5C16.25 21.03 17.47 22.25 19 22.25C20.53 22.25 21.75 21.03 21.75 19.5Z" fill="white" />
        </svg>
      </div>
      <h3>Device in Kiosk Mode</h3>
      <p>This device is secure. Enter passcode to unlock:</p>
      <input type="password" id="kiosk-passcode-input" placeholder="Enter passcode">
      <div class="kiosk-button-container">
        <button id="kiosk-unlock-button" class="kiosk-button primary">Unlock</button>
      </div>
      <div class="kiosk-footer">
        <small>For assistance, please contact medical staff</small>
      </div>
    </div>
  `;
  
  // Create floating indicator for ESC instruction
  const escIndicator = document.createElement('div');
  escIndicator.id = 'kiosk-esc-indicator';
  escIndicator.innerHTML = `
    <div class="kiosk-esc-content">
      <div class="kiosk-key">ESC</div>
      <span>Press to unlock</span>
    </div>
  `;
  
  document.body.appendChild(kioskOverlay);
  kioskOverlay.appendChild(unlockPanel);
  document.body.appendChild(escIndicator);
  
  // Add event listener to ESC indicator
  escIndicator.addEventListener('click', function() {
    console.log("ESC indicator clicked, showing unlock panel");
    showUnlockPanel();
  });
  
  // Add event listeners for unlock button
  unlockButton = document.getElementById('kiosk-unlock-button');
  if (unlockButton) {
    unlockButton.addEventListener('click', attemptUnlock);
  } else {
    console.error("Unlock button not found!");
  }
  
  const passcodeInput = document.getElementById('kiosk-passcode-input');
  if (passcodeInput) {
    passcodeInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        attemptUnlock();
      }
    });
  } else {
    console.error("Passcode input not found!");
  }
  
  // Initially hide the unlock panel - this was missing before!
  kioskOverlay.classList.add('kiosk-hidden');
  
  console.log("Kiosk UI elements created successfully");
}

// Attempt to unlock with entered passcode
function attemptUnlock() {
  console.log("Attempting to unlock kiosk");
  const passcodeInput = document.getElementById('kiosk-passcode-input');
  if (!passcodeInput) {
    console.error("Passcode input not found during unlock attempt!");
    return;
  }
  
  const passcode = passcodeInput.value;
  
  chrome.runtime.sendMessage(
    { action: "attemptUnlock", passcode: passcode },
    response => {
      console.log("Unlock attempt response received:", response);
      
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.error("Error during unlock attempt:", lastError.message);
        // Show error message
        passcodeInput.classList.add('kiosk-error');
        setTimeout(() => {
          passcodeInput.classList.remove('kiosk-error');
        }, 800);
        passcodeInput.value = '';
        return;
      }
      
      if (response && response.success) {
        console.log("Unlock successful, disabling kiosk mode");
        disableKioskMode();
      } else {
        console.log("Unlock failed:", response ? response.message : "No response");
        // Show error message
        passcodeInput.classList.add('kiosk-error');
        setTimeout(() => {
          passcodeInput.classList.remove('kiosk-error');
        }, 800);
        passcodeInput.value = '';
      }
    }
  );
}

// Enable kiosk mode
function enableKioskMode() {
  console.log("Enabling kiosk mode");
  
  // Wait for document to be fully loaded
  if (document.readyState !== 'complete') {
    console.log("Document not ready yet, waiting to enable kiosk");
    window.addEventListener('load', () => {
      enableKioskMode();
    });
    return;
  }
  
  // Don't re-enable if already active
  if (kioskModeActive) {
    console.log("Kiosk mode already active, skipping re-enablement");
    return;
  }
  
  if (!kioskOverlay) {
    createKioskElements();
  }
  
  kioskModeActive = true;
  
  // Show kiosk status notification with ESC instruction (only once)
  showKioskNotification();
  
  // Disable browser navigation
  disableNavigation(true);
  
  // Protect against back navigation by setting up history state
  setupHistoryProtection();
  
  // Remove any existing Escape key listener to avoid duplicates
  document.removeEventListener('keydown', handleEscapeKey);
  
  // Listen for escape key for unlock dialog
  document.addEventListener('keydown', handleEscapeKey);
  
  // Add beforeunload listener for close warning
  window.addEventListener('beforeunload', preventUnload, { capture: true });
  
  // Use visibilitychange to detect potential tab closure
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Notify background script about current URL for reopening if needed
  try {
    chrome.runtime.sendMessage({ 
      action: "storeKioskUrl", 
      url: window.location.href 
    }, function(response) {
      // Handle possible runtime error
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.log("Error storing kiosk URL:", lastError.message);
      }
    });
  } catch (e) {
    console.error("Error sending URL to background script:", e);
  }
  
  console.log("Kiosk mode enabled successfully");
}

// Handle visibility change to detect potential tab closure
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden' && kioskModeActive) {
    console.log("Tab visibility changed to hidden, possible closure attempt");
    
    // Notify background that tab might be closing
    try {
      chrome.runtime.sendMessage({ 
        action: "kioskTabClosing",
        url: window.location.href
      });
    } catch (e) {
      console.error("Error sending visibility change notification:", e);
    }
  }
}

// Set up history protection to prevent back navigation
function setupHistoryProtection() {
  console.log("Setting up robust history protection");
  
  try {
    // Store current page URL
    const currentUrl = window.location.href;
    
    // Clear existing history by replacing current state
    window.history.replaceState({ kioskProtected: true, timestamp: Date.now() }, document.title, currentUrl);
    
    // Create multiple history entries to completely trap navigation
    for (let i = 0; i < 10; i++) {
      window.history.pushState(
        { kioskProtected: true, level: i, timestamp: Date.now() }, 
        document.title, 
        currentUrl + (i === 0 ? '' : '#kiosk-' + i)
      );
    }
    
    // Set up continuous monitoring for history changes
    startHistoryMonitoring();
    
    console.log("History fully trapped with multiple protection layers");
  } catch (e) {
    console.error("Error setting up history protection:", e);
    // Still start monitoring even if initial setup fails
    startHistoryMonitoring();
  }
}

// Start monitoring to ensure history protection stays intact
function startHistoryMonitoring() {
  // Clear any existing interval
  if (window._kioskHistoryMonitor) clearInterval(window._kioskHistoryMonitor);
  
  // Set up monitoring interval
  window._kioskHistoryMonitor = setInterval(() => {
    if (!kioskModeActive) {
      clearInterval(window._kioskHistoryMonitor);
      return;
    }
    
    try {
      // Check if our kiosk elements are still in the DOM, if not, reinsert them
      checkAndRestoreKioskElements();
      
      // Reinforce history protection
      const currentUrl = window.location.href;
      window.history.replaceState({ kioskProtected: true, timestamp: Date.now() }, document.title, currentUrl);
      
      // Notify background script that we're still active (keep-alive)
      if (chrome && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "kioskKeepAlive" });
      }
    } catch (e) {
      console.error("Error in kiosk monitoring:", e);
    }
  }, 500);
}

// Check and restore kiosk elements if they're missing
function checkAndRestoreKioskElements() {
  // Check for ESC indicator
  const escIndicator = document.getElementById('kiosk-esc-indicator');
  if (!escIndicator && kioskModeActive) {
    console.log("ESC indicator missing, restoring kiosk elements");
    createKioskElements();
  }
  
  // Check if overlay exists but is hidden when it shouldn't be
  const overlay = document.getElementById('kiosk-overlay');
  if (overlay && overlay.classList.contains('kiosk-hidden') && window._showingUnlockPanel) {
    console.log("Unlock panel should be visible but isn't, restoring");
    overlay.classList.remove('kiosk-hidden');
  }
}

// Show a notification that kiosk mode is active with instructions
function showKioskNotification() {
  // First, remove any existing notification to prevent duplicates
  const existingNotification = document.getElementById('kiosk-notification');
  if (existingNotification && existingNotification.parentNode) {
    existingNotification.parentNode.removeChild(existingNotification);
  }
  
  const notification = document.createElement('div');
  notification.id = 'kiosk-notification';
  notification.innerHTML = `
    <div class="kiosk-notification-content">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 100-16 8 8 0 000 16zm-1-5h2v2h-2v-2zm0-8h2v6h-2V7z" fill="#5E6AD2"/>
      </svg>
      <span>Kiosk Mode Active. Press <strong>ESC</strong> to unlock.</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-hide notification after 8 seconds
  setTimeout(() => {
    if (notification && notification.parentNode) {
      notification.classList.add('kiosk-fade-out');
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 1000);
    }
  }, 8000);
}

// Handle Escape key specifically for unlocking
function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    showUnlockPanel();
    return false;
  }
}

// Disable kiosk mode
function disableKioskMode() {
  console.log("Disabling kiosk mode");
  
  kioskModeActive = false;
  window._showingUnlockPanel = false;
  
  if (kioskOverlay) {
    kioskOverlay.classList.add('kiosk-hidden');
  }
  
  // Remove the ESC indicator
  const escIndicator = document.getElementById('kiosk-esc-indicator');
  if (escIndicator && escIndicator.parentNode) {
    escIndicator.parentNode.removeChild(escIndicator);
  }
  
  // Remove any notification
  const notification = document.getElementById('kiosk-notification');
  if (notification && notification.parentNode) {
    notification.parentNode.removeChild(notification);
  }
  
  // Remove the warning dialog if present
  const warningDialog = document.getElementById('kiosk-close-warning');
  if (warningDialog && warningDialog.parentNode) {
    warningDialog.parentNode.removeChild(warningDialog);
  }
  
  // Stop history monitoring
  if (window._kioskHistoryMonitor) {
    clearInterval(window._kioskHistoryMonitor);
    window._kioskHistoryMonitor = null;
  }
  
  // Remove event listeners
  document.removeEventListener('keydown', handleEscapeKey);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', preventUnload, { capture: true });
  
  // Re-enable browser navigation
  disableNavigation(false);
  
  console.log("Kiosk mode disabled");
}

// Handle keyboard shortcuts
function preventBrowserShortcuts(e) {
  // Block tab-closing keyboard shortcuts
  if ((e.ctrlKey && e.key.toLowerCase() === 'w') || 
      (e.altKey && e.key.toLowerCase() === 'f4') ||
      (e.metaKey && e.key.toLowerCase() === 'w')) {
    e.preventDefault();
    e.stopPropagation();
    showCloseWarningDialog();
    console.log(`Blocked tab close shortcut: ${e.ctrlKey ? 'Ctrl' : e.metaKey ? 'Cmd' : 'Alt'}+${e.key}`);
    return false;
  }
  
  // Block browser-specific keyboard shortcuts
  if ((e.ctrlKey || e.metaKey) && 
      ['t', 'r', 'l', 'h', 'j', 'n', 'd', 'o', 'p', 'f', 's', 'u'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Blocked browser shortcut: ${e.ctrlKey ? 'Ctrl' : 'Cmd'}+${e.key}`);
    return false;
  }
  
  // Block Alt shortcuts (menu)
  if (e.altKey && ['left', 'right', 'home', 'd', 'f', 'e'].includes(e.key.toLowerCase())) {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Blocked Alt shortcut: Alt+${e.key}`);
    return false;
  }
  
  // Block function keys
  if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F11', 'F12'].includes(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Blocked function key: ${e.key}`);
    return false;
  }
  
  // Block tab switching
  if (e.key === 'Tab' && (e.ctrlKey || e.altKey)) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Blocked tab switching shortcut');
    return false;
  }
}

// Prevent navigation keys
function preventNavigationKeys(e) {
  // Block browser navigation keys
  if (['BrowserBack', 'BrowserForward', 'BrowserHome'].includes(e.key)) {
    e.preventDefault();
    e.stopPropagation();
    console.log(`Blocked browser navigation key: ${e.key}`);
    return false;
  }
}

// Prevent unload
function preventUnload(e) {
  if (kioskModeActive) {
    // Show a warning dialog overlay
    showCloseWarningDialog();
    
    // Notify background script that we might close
    try {
      // Use synchronous XHR to ensure this runs before page unloads
      const xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://www.example.com/favicon.ico', false);  // Dummy request to block
      
      // Send a message to the background script that we're about to close
      chrome.runtime.sendMessage({ 
        action: "kioskTabClosing",
        url: window.location.href
      });
      
      // We make the request but we don't care about the response
      try {
        xhr.send(null);
      } catch (e) {
        // This will likely fail, which is fine
      }
    } catch (e) {
      console.log("Error in beforeunload handler:", e);
    }
    
    // Standard browser confirmation dialog (limited by browsers)
    e.preventDefault();
    e.returnValue = 'This device is in kiosk mode. Please use the unlock function to exit properly.';
    console.log('Blocked page unload attempt');
    
    return e.returnValue;
  }
}

// Show a custom warning dialog when tab closure is attempted
function showCloseWarningDialog() {
  // Check if dialog already exists
  if (document.getElementById('kiosk-close-warning')) {
    return;
  }
  
  // Create warning dialog
  const warningDialog = document.createElement('div');
  warningDialog.id = 'kiosk-close-warning';
  warningDialog.innerHTML = `
    <div class="kiosk-warning-content">
      <div class="kiosk-warning-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" fill="#e53e3e"/>
        </svg>
      </div>
      <h3>Warning: Device in Kiosk Mode</h3>
      <p>Please do not close this tab. This device is in secure kiosk mode for patient use.</p>
      <p>If you need to exit kiosk mode, please press <strong>ESC</strong> and enter the unlock code.</p>
      <div class="kiosk-warning-buttons">
        <button id="kiosk-warning-dismiss" class="kiosk-button secondary">I Understand</button>
        <button id="kiosk-warning-unlock" class="kiosk-button primary">Unlock Device</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(warningDialog);
  
  // Add event listeners to buttons
  const dismissButton = document.getElementById('kiosk-warning-dismiss');
  const unlockButton = document.getElementById('kiosk-warning-unlock');
  
  if (dismissButton) {
    dismissButton.addEventListener('click', () => {
      warningDialog.classList.add('kiosk-fade-out');
      setTimeout(() => {
        if (warningDialog.parentNode) {
          warningDialog.parentNode.removeChild(warningDialog);
        }
      }, 300);
    });
  }
  
  if (unlockButton) {
    unlockButton.addEventListener('click', () => {
      // Remove warning dialog
      if (warningDialog.parentNode) {
        warningDialog.parentNode.removeChild(warningDialog);
      }
      // Show unlock panel
      showUnlockPanel();
    });
  }
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    if (warningDialog.parentNode) {
      warningDialog.classList.add('kiosk-fade-out');
      setTimeout(() => {
        if (warningDialog.parentNode) {
          warningDialog.parentNode.removeChild(warningDialog);
        }
      }, 300);
    }
  }, 8000);
}

// Prevent popstate (back/forward navigation)
function preventPopstate(e) {
  console.log('Intercepted popstate (history navigation) event');
  
  // Immediately cancel the event (though this doesn't fully work for popstate)
  e.stopPropagation();
  
  // Get current URL before any navigation happens
  const currentUrl = window.location.href;
  
  // Force push our controlled state back into history
  window.history.pushState({ kioskProtected: true, timestamp: Date.now() }, document.title, currentUrl);
  
  // Re-setup our history trap in case something changed
  setupHistoryProtection();
  
  // Check that our kiosk UI is still intact
  checkAndRestoreKioskElements();
  
  return false;
}

// Create a fullscreen overlay container that captures all events
function insertFullscreenContainer() {
  // Check if it already exists
  if (document.getElementById('kiosk-fullscreen-container')) {
    return;
  }
  
  // Create a container that will capture all events
  const container = document.createElement('div');
  container.id = 'kiosk-fullscreen-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483646; /* One less than our overlay */
    pointer-events: none; /* Allow interaction with page content */
  `;
  
  document.body.appendChild(container);
  
  // Add event listeners to capture and prevent navigation
  container.addEventListener('mousedown', function(e) {
    // Only block clicking on browser chrome areas (very top/bottom/sides of window)
    const threshold = 5;
    if (e.clientY < threshold || e.clientY > window.innerHeight - threshold || 
        e.clientX < threshold || e.clientX > window.innerWidth - threshold) {
      e.stopPropagation();
      console.log('Blocked potential browser chrome interaction');
      return false;
    }
  }, true);
}

// Remove the fullscreen container
function removeFullscreenContainer() {
  const container = document.getElementById('kiosk-fullscreen-container');
  if (container) {
    container.parentNode.removeChild(container);
  }
}

// Show the unlock panel
function showUnlockPanel() {
  kioskOverlay.classList.remove('kiosk-hidden');
  document.getElementById('kiosk-passcode-input').focus();
}

// Disable browser navigation functions
function disableNavigation(disable) {
  console.log(`${disable ? "Enabling" : "Disabling"} navigation restrictions`);
  
  if (disable) {
    // Override browser history methods
    if (window.history) {
      window._historyPushState = window.history.pushState;
      window._historyReplaceState = window.history.replaceState;
      window._historyBack = window.history.back;
      window._historyForward = window.history.forward;
      window._historyGo = window.history.go;
      
      window.history.pushState = function() { console.log("pushState blocked"); return false; };
      window.history.replaceState = function() { console.log("replaceState blocked"); return false; };
      window.history.back = function() { console.log("back blocked"); return false; };
      window.history.forward = function() { console.log("forward blocked"); return false; };
      window.history.go = function() { console.log("go blocked"); return false; };
    }
    
    // Override location methods
    if (window.location) {
      window._locationAssign = window.location.assign;
      window._locationReplace = window.location.replace;
      window._locationReload = window.location.reload;
      
      window.location.assign = function() { console.log("assign blocked"); return false; };
      window.location.replace = function() { console.log("replace blocked"); return false; };
      window.location.reload = function() { console.log("reload blocked"); return false; };
      
      // Store current URL to prevent navigation
      const currentHref = window.location.href;
      
      // Handle href indirectly instead of redefining property (which can cause errors)
      try {
        // Monitor attempts to change href without redefining the property
        const originalDescriptor = Object.getOwnPropertyDescriptor(window.Location.prototype, 'href');
        if (originalDescriptor && originalDescriptor.set) {
          const originalSet = originalDescriptor.set;
          
          Object.defineProperty(window.Location.prototype, 'href', {
            set: function(val) {
              console.log("href change attempt intercepted");
              if (val.startsWith('#') && currentHref.split('#')[0] === val.split('#')[0]) {
                // Allow same-page hash changes only
                return originalSet.call(this, val);
              }
              console.log("href change blocked");
              return currentHref;
            },
            get: originalDescriptor.get
          });
        }
      } catch (e) {
        console.log("Could not override location.href, using alternative blocking method", e);
      }
    }
    
    // Block global navigation functions
    window._open = window.open;
    window.open = function() { console.log("window.open blocked"); return null; };
    
    // Disable right-click context menu
    document.addEventListener('contextmenu', preventDefaultHandler, true);
    
    // Capture all link clicks
    document.addEventListener('click', handleLinkClick, true);
    
    // Block navigation keys
    document.addEventListener('keydown', preventNavigationKeys, true);
    
    // Block browser shortcut combinations
    document.addEventListener('keydown', preventBrowserShortcuts, true);
    
    // Prevent unload events
    window.addEventListener('beforeunload', preventUnload, true);
    
    // Intercept popstate event (back/forward)
    window.addEventListener('popstate', preventPopstate, true);
    
    // Insert fullscreen container if not already present
    insertFullscreenContainer();
    
    console.log("All navigation restrictions applied");
  } else {
    // Restore original methods
    if (window._historyPushState) window.history.pushState = window._historyPushState;
    if (window._historyReplaceState) window.history.replaceState = window._historyReplaceState;
    if (window._historyBack) window.history.back = window._historyBack;
    if (window._historyForward) window.history.forward = window._historyForward;
    if (window._historyGo) window.history.go = window._historyGo;
    
    if (window._locationAssign) window.location.assign = window._locationAssign;
    if (window._locationReplace) window.location.replace = window._locationReplace;
    if (window._locationReload) window.location.reload = window._locationReload;
    
    // Restore location.href setter
    if (window._locationHref) {
      Object.defineProperty(window.location, 'href', {
        set: window._locationHref
      });
    }
    
    if (window._open) window.open = window._open;
    
    // Remove event listeners
    document.removeEventListener('contextmenu', preventDefaultHandler, true);
    document.removeEventListener('click', handleLinkClick, true);
    document.removeEventListener('keydown', preventNavigationKeys, true);
    document.removeEventListener('keydown', preventBrowserShortcuts, true);
    window.removeEventListener('beforeunload', preventUnload, true);
    window.removeEventListener('popstate', preventPopstate, true);
    
    // Remove fullscreen container
    removeFullscreenContainer();
    
    console.log("All navigation restrictions removed");
  }
}

// Prevent default action for events
function preventDefaultHandler(e) {
  e.preventDefault();
  e.stopPropagation();
  return false;
}

// Handle link clicks to prevent navigation
function handleLinkClick(e) {
  // Find if the click is on or within an anchor tag
  const target = e.target.closest('a');
  if (target && target.href) {
    // Allow javascript: links (they don't navigate away)
    if (target.href.startsWith('javascript:')) {
      return true;
    }
    
    // Allow anchor links within the same page
    if (target.href.includes('#') && target.href.split('#')[0] === window.location.href.split('#')[0]) {
      // It's an anchor within the current page, allow it
      return true;
    }
    
    // Block all other links
    e.preventDefault();
    e.stopPropagation();
    console.log('Blocked navigation link click:', target.href);
    return false;
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message.action);
  
  if (message.action === "enableKiosk") {
    enableKioskMode();
    sendResponse({ success: true, status: "kiosk_enabled" });
  } 
  else if (message.action === "disableKiosk") {
    disableKioskMode();
    sendResponse({ success: true, status: "kiosk_disabled" });
  }
  
  return true; // Required for async response
});

// Initialize appropriate listeners for page events
window.addEventListener('load', () => {
  console.log("Window fully loaded, checking kiosk state");
  chrome.runtime.sendMessage({ action: "getKioskState" }, response => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.log("Error checking kiosk state:", lastError.message);
    } else if (response && response.active) {
      console.log("Kiosk should be active, enabling");
      enableKioskMode();
    }
  });
});