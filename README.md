# Medical Kiosk Mode Extension

A Chrome extension that creates a controlled kiosk environment for Chrome.

## Overview

This extension transforms any Chrome tab into a kiosk that prevents users from navigating away, accessing browser controls, or closing the tab. Designed with healthcare usecases where patient privacy and security are paramount.

## Key Features

### Security & Control
- **Complete Navigation Blocking**: Prevents back/forward navigation, URL changes, and refreshing
- **Keyboard Protection**: Disables Ctrl+W, Alt+F4, and other browser shortcuts
- **Focus Enforcement**: Automatically refocuses the kiosk tab if users try to switch
- **Tab Protection**: Blocks new tab creation and prevents tab closure
- **Auto-Recovery**: Safely reopens the kiosk tab if closed (with anti-loop protection)

### User Interface
- **Modern Design**: Frosted glass UI inspired by Arc Browser's design language
- **Visual Indicators**: Always-visible ESC button showing how to unlock
- **Warning Dialogs**: Clear alerts when attempting potentially disruptive actions
- **Status Notifications**: Visual confirmation of kiosk activation and status

### Administration
- **Custom Passcodes**: Set unique passcodes for each kiosk session
- **Master Password**: Universal admin password (default: `ChangeMe123!`)
- **Admin Panel**: Password-protected settings to monitor and control kiosk sessions
- **Remote Disable**: Ability to instantly disable any active kiosk mode

## Installation

### For End Users (Coming Soon)
- Installation via Chrome Web Store

### For Developers
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the repository folder
5. The extension icon should appear in your Chrome toolbar

## How to Use

### Activating Kiosk Mode
1. Navigate to the web page you want to secure
2. Click the Medical Kiosk Mode extension icon
3. Enter and confirm a passcode
4. Click "Activate Kiosk Mode"
5. The page is now locked and can be safely handed to a patient

### Unlocking Kiosk Mode
1. Press the ESC key (or click the ESC indicator in the top-right)
2. Enter the passcode you created (or the master password)
3. Click "Unlock"

### Administrative Access
1. Click the extension icon
2. Select "Admin Settings"
3. Enter the master password (`ChangeMe123!`)
4. Use the admin panel to:
   - Check kiosk status
   - Disable active kiosk sessions
   - View security information

## Security Notes

- The master password is hardcoded as `ChangeMe123!` and can be changed in the `background.js` file
- When in kiosk mode, standard browser controls and keyboard shortcuts are disabled
- The extension employs multiple layers of protection against bypassing kiosk mode
- If a user closes the kiosk tab, it will attempt to safely reopen (up to 2 times)

## Technical Implementation

- Modern Chrome extension using Manifest V3
- Content scripts manage in-page kiosk controls and UI
- Background service worker handles state management and security enforcement
- Frosted glass UI effect created with CSS backdrop filters

## Use Cases

- Patient intake forms
- Medical education materials
- Consent documentation
- Patient portals and health records
- Telemedicine waiting rooms

## License

This project is licensed under the MIT License.

---

*Designed for healthcare environments to enhance privacy and security during patient interactions.*
