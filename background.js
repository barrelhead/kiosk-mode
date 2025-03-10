// background.js - Manages the extension state

// Initialize variables
let kioskActive = false;
let userPasscode = "";
const MASTER_PASSWORD = "ChangeMe123!";
let activeKioskTabId = null;
let kioskTabUrl = '';
const initializedTabs = new Set();

// Safeguards against tab reopening loop
let lastReopenTime = 0;
let reopenAttempts = 0;
const MAX_REOPEN_ATTEMPTS = 2; // Limit consecutive reopens
const REOPEN_COOLDOWN = 5000; // 5 seconds between reopens
let reopenTimeout = null;

// Initialize when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

// Function to safely message a tab
function safelyMessageTab(tabId, message, logPrefix = "") {
  chrome.tabs.get(tabId, (tab) => {
    const tabError = chrome.runtime.lastError;
    if (tabError) {
      console.log(`${logPrefix}: Tab ${tabId} not found: ${tabError.message}`);
      return;
    }
    
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const msgError = chrome.runtime.lastError;
        if (msgError) {
          console.log(`${logPrefix}: Message error: ${msgError.message}`);
        }
      });
    } catch (error) {
      console.error(`${logPrefix}: Exception:`, error);
    }
  });
}

// Helper to check if it's safe to reopen a tab
function canReopenTab() {
  const now = Date.now();
  
  // Check for cooldown period
  if (now - lastReopenTime < REOPEN_COOLDOWN) {
    console.log("Too soon to reopen tab, still in cooldown period");
    return false;
  }
  
  // Check if we've hit the maximum attempts
  if (reopenAttempts >= MAX_REOPEN_ATTEMPTS) {
    console.log("Maximum reopen attempts reached, stopping automatic reopens");
    // Reset after some time
    if (!reopenTimeout) {
      reopenTimeout = setTimeout(() => {
        reopenAttempts = 0;
        reopenTimeout = null;
        console.log("Reopen attempts counter reset");
      }, 30000); // 30 seconds
    }
    return false;
  }
  
  return true;
}

// Message handler
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // Content script ready
  if (message.action === "contentScriptReady") {
    if (sender.tab && sender.tab.id) {
      initializedTabs.add(sender.tab.id);
      if (kioskActive && activeKioskTabId === sender.tab.id) {
        safelyMessageTab(sender.tab.id, { action: "enableKiosk" }, "Content script ready");
        // Reset reopening counter when content script loads successfully
        reopenAttempts = 0;
      }
      sendResponse({ success: true, kioskActive });
    }
    return true;
  }
  
  // Keep-alive
  if (message.action === "kioskKeepAlive") {
    if (sender && sender.tab && sender.tab.id) {
      initializedTabs.add(sender.tab.id);
    }
    sendResponse({});
    return true;
  }
  
  // Store URL
  if (message.action === "storeKioskUrl") {
    if (kioskActive && message.url) {
      kioskTabUrl = message.url;
    }
    sendResponse({});
    return true;
  }
  
  // Get kiosk state
  if (message.action === "getKioskState") {
    sendResponse({ active: kioskActive });
    return true;
  }
  
  // Activate kiosk
  if (message.action === "activateKiosk") {
    userPasscode = message.passcode;
    kioskActive = true;
    
    // Reset the reopen counter when activating a new kiosk
    reopenAttempts = 0;
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        activeKioskTabId = tabs[0].id;
        kioskTabUrl = tabs[0].url;
        
        chrome.tabs.update(activeKioskTabId, { active: true }, () => {
          if (chrome.runtime.lastError) {
            kioskActive = false;
            activeKioskTabId = null;
            kioskTabUrl = '';
            sendResponse({ success: false });
            return;
          }
          
          safelyMessageTab(activeKioskTabId, { action: "enableKiosk" }, "Activating kiosk");
        });
      }
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  // Attempt unlock
  if (message.action === "attemptUnlock") {
    const passcodeCorrect = message.passcode === userPasscode;
    const masterCorrect = message.passcode === MASTER_PASSWORD;
    
    if (passcodeCorrect || masterCorrect) {
      kioskActive = false;
      activeKioskTabId = null;
      kioskTabUrl = '';
      
      if (sender.tab && sender.tab.id) {
        safelyMessageTab(sender.tab.id, { action: "disableKiosk" }, "Unlocking");
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, message: "Tab info missing" });
      }
    } else {
      sendResponse({ success: false, message: "Incorrect passcode" });
    }
    
    return true;
  }
  
  // Verify master password
  if (message.action === "verifyMasterPassword") {
    const isCorrect = message.password === MASTER_PASSWORD;
    sendResponse({ success: isCorrect });
    return true;
  }
  
  // Admin disable kiosk
  if (message.action === "adminDisableKiosk") {
    if (kioskActive && activeKioskTabId) {
      chrome.tabs.get(activeKioskTabId, (tab) => {
        const lastError = chrome.runtime.lastError;
        if (!lastError) {
          safelyMessageTab(activeKioskTabId, { action: "disableKiosk" }, "Admin disable");
        }
        
        kioskActive = false;
        activeKioskTabId = null;
        kioskTabUrl = '';
        sendResponse({ success: true });
      });
    } else {
      kioskActive = false;
      activeKioskTabId = null;
      kioskTabUrl = '';
      sendResponse({ success: true });
    }
    return true;
  }
  
  // Tab closing - we won't auto-reopen here to avoid loops
  if (message.action === "kioskTabClosing") {
    if (kioskActive && message.url) {
      kioskTabUrl = message.url;
      console.log("Tab closing event received, URL saved for potential manual recovery");
    }
    sendResponse({});
    return true;
  }
  
  // Default response for unhandled messages
  sendResponse({});
  return true;
});

// Tab updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && kioskActive && tabId === activeKioskTabId) {
    initializedTabs.add(tabId);
    safelyMessageTab(tabId, { action: "enableKiosk" }, "Tab updated");
  }
});

// Tab removed - with controlled tab reopening
chrome.tabs.onRemoved.addListener((tabId) => {
  initializedTabs.delete(tabId);
  
  // If this was our kiosk tab and kiosk mode is active
  if (kioskActive && activeKioskTabId === tabId && kioskTabUrl) {
    console.log(`Kiosk tab ${tabId} was closed`);
    
    // Safety checks before reopening
    if (canReopenTab()) {
      console.log(`Attempting to reopen kiosk (attempt ${reopenAttempts + 1})`);
      
      // Update tracking variables
      lastReopenTime = Date.now();
      reopenAttempts++;
      
      // Clear the tab ID first to avoid potential race conditions
      const urlToReopen = kioskTabUrl;
      activeKioskTabId = null;
      
      // Create new tab with delay
      setTimeout(() => {
        chrome.tabs.create({ url: urlToReopen, active: true }, (newTab) => {
          if (newTab) {
            activeKioskTabId = newTab.id;
            console.log(`New kiosk tab created with ID: ${newTab.id}`);
            
            // Wait before enabling kiosk mode
            setTimeout(() => {
              if (kioskActive) {
                safelyMessageTab(newTab.id, { action: "enableKiosk" }, "Recreating closed kiosk");
              }
            }, 1500);
          } else {
            console.log("Failed to create new tab, giving up");
            kioskActive = false;
            activeKioskTabId = null;
          }
        });
      }, 1000);
    } else {
      console.log("Not reopening kiosk tab due to safety constraints");
      // If we're not reopening, just reset the kiosk state
      kioskActive = false;
      activeKioskTabId = null;
    }
  }
});

// Tab switch detection
chrome.tabs.onActivated.addListener(info => {
  if (kioskActive && activeKioskTabId && info.tabId !== activeKioskTabId) {
    // Don't constantly try to refocus if there's a problem
    chrome.tabs.get(activeKioskTabId, (tab) => {
      if (!chrome.runtime.lastError) {
        chrome.tabs.update(activeKioskTabId, { active: true });
      } else {
        // Tab doesn't exist anymore
        console.log("Kiosk tab no longer exists, deactivating kiosk mode");
        kioskActive = false;
        activeKioskTabId = null;
      }
    });
  }
});

// Block new tabs during kiosk mode - with safety check
chrome.tabs.onCreated.addListener(tab => {
  if (kioskActive && activeKioskTabId && tab.id !== activeKioskTabId) {
    // Verify kiosk tab still exists before closing the new one
    chrome.tabs.get(activeKioskTabId, (kioskTab) => {
      if (!chrome.runtime.lastError) {
        // Only close the new tab if our kiosk tab still exists
        chrome.tabs.remove(tab.id, () => {
          chrome.tabs.update(activeKioskTabId, { active: true });
        });
      } else {
        // Our kiosk tab is gone, so don't close this new tab
        console.log("Kiosk tab not found, allowing new tab");
        kioskActive = false;
        activeKioskTabId = null;
      }
    });
  }
});

// Monitor navigation
chrome.webNavigation.onBeforeNavigate.addListener(details => {
  if (kioskActive && activeKioskTabId && details.tabId === activeKioskTabId && details.frameId === 0) {
    chrome.tabs.get(activeKioskTabId, tab => {
      if (chrome.runtime.lastError) return;
      
      const currentUrl = tab.url.split('#')[0];
      const newUrl = details.url.split('#')[0];
      
      if (currentUrl !== newUrl) {
        chrome.tabs.update(activeKioskTabId, { url: tab.url });
      }
    });
  }
});