// popup.js - Handles the extension popup UI
document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const mainView = document.getElementById('main-view');
  const adminView = document.getElementById('admin-view');
  const adminLogin = document.getElementById('admin-login');
  const adminPanel = document.getElementById('admin-panel');
  const notification = document.getElementById('notification');
  const kioskStatus = document.getElementById('kiosk-status');
  
  // Buttons
  const activateKioskButton = document.getElementById('activate-kiosk');
  const showAdminButton = document.getElementById('show-admin');
  const verifyAdminButton = document.getElementById('verify-admin');
  const backToMainButton = document.getElementById('back-to-main');
  const backToMainFromLoginButton = document.getElementById('back-to-main-from-login');
  const disableKioskModeButton = document.getElementById('disable-kiosk-mode');
  
  // Inputs
  const passcodeInput = document.getElementById('passcode');
  const confirmPasscodeInput = document.getElementById('confirm-passcode');
  const adminPasswordInput = document.getElementById('admin-password');
  
  // Check if kiosk mode is already active
  chrome.runtime.sendMessage({ action: "getKioskState" }, response => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.error("Error checking kiosk state:", lastError.message);
      showNotification("Could not verify kiosk state. Please try again.", "error");
    } else if (response && response.active) {
      showNotification("Kiosk mode is already active. Use the unlock code to disable it.", "error");
      activateKioskButton.disabled = true;
    }
  });
  
  // Event Listeners
  activateKioskButton.addEventListener('click', activateKiosk);
  showAdminButton.addEventListener('click', showAdminLogin);
  verifyAdminButton.addEventListener('click', verifyAdminAccess);
  backToMainButton.addEventListener('click', showMainView);
  backToMainFromLoginButton.addEventListener('click', showMainView);
  disableKioskModeButton.addEventListener('click', disableKioskMode);
  
  // Activate kiosk mode
  function activateKiosk() {
    const passcode = passcodeInput.value;
    const confirmPasscode = confirmPasscodeInput.value;
    
    // Validate passcode
    if (!passcode) {
      showNotification("Please enter a passcode", "error");
      return;
    }
    
    if (passcode !== confirmPasscode) {
      showNotification("Passcodes do not match", "error");
      return;
    }
    
    // Send message to activate kiosk mode
    chrome.runtime.sendMessage(
      { action: "activateKiosk", passcode: passcode },
      response => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.error("Error activating kiosk:", lastError.message);
          showNotification("Error activating kiosk mode. Please try again.", "error");
        } else if (response && response.success) {
          showNotification("Kiosk mode activated", "success");
          setTimeout(() => window.close(), 1500); // Close popup after 1.5 seconds
        } else {
          showNotification(response && response.message || "Failed to activate kiosk mode", "error");
        }
      }
    );
  }
  
  // Show admin login
  function showAdminLogin() {
    mainView.classList.add('hidden');
    adminView.classList.remove('hidden');
    adminLogin.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    notification.classList.add('hidden');
    
    // Focus the admin password input
    adminPasswordInput.focus();
  }
  
  // Verify admin access
  function verifyAdminAccess() {
    const password = adminPasswordInput.value;
    
    if (!password) {
      showNotification("Please enter the master password", "error");
      return;
    }
    
    // Send message to verify master password
    chrome.runtime.sendMessage(
      { action: "verifyMasterPassword", password: password },
      response => {
        if (response && response.success) {
          // Show admin panel if password is correct
          adminLogin.classList.add('hidden');
          adminPanel.classList.remove('hidden');
          showNotification("Admin access verified", "success");
          
          // Clear the password field
          adminPasswordInput.value = '';
          
          // Check current kiosk state
          updateKioskStatus();
        } else {
          showNotification("Incorrect master password", "error");
          adminPasswordInput.value = '';
        }
      }
    );
  }
  
  // Update the kiosk status display
  function updateKioskStatus() {
    chrome.runtime.sendMessage({ action: "getKioskState" }, response => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        kioskStatus.textContent = "Status: Error checking kiosk state";
        disableKioskModeButton.disabled = true;
      } else if (response && response.active) {
        kioskStatus.textContent = "Status: Kiosk Mode ACTIVE";
        kioskStatus.style.color = "#e53e3e";
        kioskStatus.style.fontWeight = "bold";
        disableKioskModeButton.disabled = false;
      } else {
        kioskStatus.textContent = "Status: No active kiosk session";
        kioskStatus.style.color = "#38a169";
        disableKioskModeButton.disabled = true;
      }
    });
  }
  
  // Disable any active kiosk mode from admin panel
  function disableKioskMode() {
    chrome.runtime.sendMessage({ action: "adminDisableKiosk" }, response => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        showNotification("Error disabling kiosk mode: " + lastError.message, "error");
        return;
      }
      
      if (response && response.success) {
        showNotification("Kiosk mode has been disabled", "success");
        // Update status display
        updateKioskStatus();
      } else {
        showNotification("Failed to disable kiosk mode", "error");
      }
    });
  }
  
  // Show main view
  function showMainView() {
    adminView.classList.add('hidden');
    mainView.classList.remove('hidden');
    notification.classList.add('hidden');
    
    // Clear admin password field
    adminPasswordInput.value = '';
  }
  
  // Show notification
  function showNotification(message, type = "info") {
    notification.textContent = message;
    notification.className = ''; // Reset classes
    notification.classList.add(type);
    notification.classList.remove('hidden');
    
    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 3000);
  }
});