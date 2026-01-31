# AdExpress CRM - WhatsApp Chrome Extension

**Version:** 7.2  
**Last Updated:** January 2026  
**Description:** A Chrome/Opera extension that integrates WhatsApp Web with Google Sheets for customer relationship management, featuring manual phone search, contact data management, and Google Contacts integration.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Architecture](#project-architecture)
- [File Structure](#file-structure)
- [Authentication Flow](#authentication-flow)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This Chrome/Opera extension provides a CRM (Customer Relationship Management) overlay for WhatsApp Web. It allows users to:

- Search for customers by phone number (manual entry)
- View existing customer records from a Google Sheet
- Create new customer entries with form validation
- Save customers to Google Contacts automatically
- Add follow-up reminders for delivery management
- Mark entries as urgent with optional notes

---

## ✨ Features

| Feature                         | Description                                                            |
| ------------------------------- | ---------------------------------------------------------------------- |
| **Manual Phone Search**         | Enter phone number to search existing records (last 6 digits matching) |
| **Multiple Records View**       | Display all matching records in a scrollable viewer                    |
| **Google Sheets Integration**   | Read/write customer data to a configured Google Spreadsheet            |
| **Google Contacts Sync**        | Automatically creates contacts with duplicate prevention               |
| **Draggable & Resizable Panel** | Floating CRM panel that can be repositioned and resized                |
| **Form Validation**             | Double-entry validation for address fields, mandatory phone number     |
| **Smart Row Insertion**         | Inserts at the last row with data (not at sheet end)                   |
| **Toast Notifications**         | Visual feedback for success/error states                               |
| **Enter Key Navigation**        | Press Enter to move between fields, auto-opens dropdowns               |
| **Persistent OAuth**            | Refresh tokens for long-term authentication (no repeated logins)       |
| **Cross-Browser Support**       | Works on Chrome, Opera, Edge, and Brave                                |

---

## 🏗️ Project Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WhatsApp Web (Browser Tab)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌────────────────────────────────────┐   │
│  │  Floating Button │────▶│         CRM Container              │   │
│  │  🍓 (strawberry) │     │  ┌──────────────────────────────┐  │   │
│  └──────────────────┘     │  │     Drag Header (movable)    │  │   │
│                           │  ├──────────────────────────────┤  │   │
│                           │  │   iframe (panel.html)        │  │   │
│                           │  │   ├── Search Input           │  │   │
│                           │  │   ├── Records Viewer         │  │   │
│                           │  │   ├── Entry Form             │  │   │
│                           │  │   └── Toast Notifications    │  │   │
│                           │  └──────────────────────────────┘  │   │
│  ┌──────────────────────┐ └────────────────────────────────────┘   │
│  │    content.js        │                                          │
│  │  - UI injection      │                                          │
│  │  - Drag/resize logic │                                          │
│  │  - Panel management  │                                          │
│  └──────────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────┘
                                      │
                          chrome.runtime.sendMessage
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     background.js (Service Worker)                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Authentication (OAuth 2.0 with PKCE)                          │ │
│  │  ├── Access Token (1 hour)                                     │ │
│  │  ├── Refresh Token (months, silent refresh)                    │ │
│  │  └── Persistent Storage (chrome.storage.local)                 │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │  API Handlers                                                  │ │
│  │  ├── getHeadersRequest    → Fetch sheet column headers         │ │
│  │  ├── fetchContactData     → Search & return matching records   │ │
│  │  ├── saveNewEntry         → Insert row at correct position     │ │
│  │  ├── saveFollowUp         → Add to follow-up sheet             │ │
│  │  └── createGoogleContact  → Add to Google Contacts             │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Google APIs                                   │
│  ┌─────────────────────────┐    ┌───────────────────────────────┐  │
│  │   Google Sheets API     │    │     Google People API         │  │
│  │   - Read headers (A1:U1)│    │     - Search by phone         │  │
│  │   - Search column M     │    │     - Create contact          │  │
│  │   - Insert/Update rows  │    │     - Duplicate prevention    │  │
│  └─────────────────────────┘    └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
Entry and urgent indicator V7/
├── manifest.json          # Chrome Extension manifest (v3)
├── config.js              # Centralized configuration settings
├── background.js          # Service worker (auth + API calls)
├── content.js             # WhatsApp Web UI injection
├── panel.html             # CRM panel HTML structure
├── panel.js               # Panel logic and form handling
├── formatters.js          # Reusable formatting functions
├── style.css              # All component styling
├── README.md              # This documentation
├── docs/
│   └── setup-for-opera.md # Opera browser setup guide
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔐 Authentication Flow

The extension uses **OAuth 2.0 Authorization Code Flow with PKCE** for secure, long-lasting authentication.

### Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                            │
└──────────────────────────────────────────────────────────────────┘

First Time Login:
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  User   │───▶│ Google OAuth │───▶│ Auth Code   │───▶│ Tokens   │
│ Action  │    │   Consent    │    │ + PKCE      │    │ Stored   │
└─────────┘    └──────────────┘    └─────────────┘    └──────────┘
                                                            │
                                          ┌─────────────────┘
                                          ▼
                              ┌───────────────────────┐
                              │ chrome.storage.local  │
                              │ ├── accessToken       │
                              │ ├── tokenExpiry       │
                              │ └── refreshToken      │
                              └───────────────────────┘

Subsequent Uses:
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Check Token │────▶│ Token Valid?     │─Yes─▶│ Use Token      │
│ in Storage  │     │ (expiry check)   │     │ (No popup!)    │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │ No
                            ▼
                    ┌──────────────────┐     ┌─────────────────┐
                    │ Refresh Token    │─OK─▶│ New Access Token│
                    │ (Silent, no UI)  │     │ (No popup!)     │
                    └──────────────────┘     └─────────────────┘
                            │ Failed
                            ▼
                    ┌──────────────────┐
                    │ Full OAuth Login │
                    │ (Only if revoked)│
                    └──────────────────┘
```

### Token Lifecycle

| Token Type    | Lifetime  | Storage                | Renewal                  |
| ------------- | --------- | ---------------------- | ------------------------ |
| Access Token  | 1 hour    | `chrome.storage.local` | Silent via refresh token |
| Refresh Token | ~6 months | `chrome.storage.local` | Only on revocation       |

### PKCE Security

The extension uses **Proof Key for Code Exchange (PKCE)** which:

- Generates a random `code_verifier` (64 characters)
- Creates SHA-256 hash as `code_challenge`
- No client secret required (safe for extensions)
- Prevents authorization code interception attacks

---

## 🔧 Component Details

### config.js

Centralized configuration for easy customization:

```javascript
const CONFIG = {
    // Google Sheets
    SPREADSHEET_ID: 'your-spreadsheet-id',
    SHEET_NAME: '🔵Team Blue🔵',
    FOLLOWUP_SHEET_NAME: 'Delivery_Followups',

    // OAuth
    OAUTH_CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
    OAUTH_CLIENT_SECRET: 'your-client-secret',

    // Form Settings
    PHONE_NUMBER_FIELD_ID: 'custom-phone-number',  // Custom phone field
    MANDATORY_COLUMN_INDICES: [3, 5, 6, 7, 9, 11, 14, 16],
    EXCLUDED_COLUMNS: [8, 10, 12, 13, 15, 17],
    VALIDATION_COLUMNS: [7, 9],  // Double-entry fields

    // Dropdown Options
    DROPDOWN_OPTIONS: {
        5: ['ওয়েলকাম টিউন', 'মাইকিং', 'ভিডিও বিজ্ঞাপন'],
        6: ['ফিমেল-ডিফল্ট', 'পুরুষ-ডিফল্ট', ...],
        // ...
    },

    // Auto-populated Columns
    AUTO_COLUMNS: {
        STATUS: 0,          // Column A
        TIMESTAMP: 1,       // Column B
        CONTACT_INFO: 12,   // Column M (শর্ট নাম + 3 spaces + phone)
    }
};
```

### formatters.js

Reusable formatting functions with English month names:

```javascript
FORMATTERS = {
    formatDateTime(dateStr)  // "22/11/2025 19:56" → "22 November 2025, 07:56 PM"
    formatDate(dateStr)      // "19-1-2026" → "19 January 2026"
    formatMoney(value)       // "500" → "500 টাকা"
    normalizePhone(phone)    // "+880 1712-345678" → "8801712345678"
    getCurrentTimestamp()    // Returns "DD/MM/YYYY HH:MM:SS"
}

// English month names array
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];
```

### background.js

Service worker handling:

- OAuth 2.0 with PKCE and refresh tokens
- Google Sheets API (read headers, search, insert, update)
- Google People API (search and create contacts)
- Token caching and silent refresh

Key functions:

- `generateCodeChallenge()` - PKCE code challenge generation
- `getTokensViaAuthCodeFlow()` - Full OAuth with `access_type=offline`
- `refreshAccessToken()` - Silent token refresh
- `storeTokens()` / `getStoredTokens()` - Persistent storage
- `getAuthToken()` - Main auth helper (cached → refresh → login)

### panel.js

Form handling:

- Manual phone search with last 6 digits matching
- Multiple records viewer with formatted data
- Form rendering with validation
- Enter key navigation between fields
- Toast notifications for success/error
- Auto-opens dropdowns on Enter

### content.js

WhatsApp Web integration:

- Injects floating 🍓 button
- Creates draggable/resizable CRM container
- Loads panel.html in iframe
- Handles drag and resize events
- Saves panel position to storage

---

## 🔄 Data Flow

### Search Flow

```
User enters phone number → Click Search
        │
        ▼
panel.js: searchPhoneNumber()
        │
        ▼
background.js: fetchContactData
        │
        ├── Fetch Column M (রেফারেন্স)
        │
        ├── Find ALL rows where last 6 digits match
        │
        └── Fetch full row data for each match
        │
        ▼
panel.js: showExistingRecordsViewer(records)
        │
        ▼
Display formatted records with:
  - Timestamps → "22 November 2025, 07:56 PM"
  - Money fields → "500 টাকা"
  - All matching records shown
```

### New Entry Flow

```
User fills form → Click "Submit New Entry"
        │
        ▼
panel.js: handleSubmit()
        │
        ├── Validate mandatory fields (including phone number)
        ├── Build row data array
        └── Auto-populate: Status, Timestamp, Contact Info
            (CONTACT_INFO = শর্ট নাম + 3 spaces + phone)
        │
        ▼
background.js: saveNewEntry
        │
        ├── Find last row with data in Column D
        ├── Insert at lastDataRow + 1 (not sheet end!)
        └── Return inserted row number
        │
        ▼
panel.js: showToast("✔️ Entry saved at row X!")
        │
        ▼
background.js: createGoogleContact (async)
```

---

## 📥 Installation

### For Chrome

1. Download/clone this extension folder
2. Open `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder
6. Pin the extension for easy access

### For Opera

1. Open `opera://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension folder
5. See `docs/setup-for-opera.md` for OAuth setup

### For Edge

1. Open `edge://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension folder

---

## ⚙️ Configuration

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Google Sheets API
   - Google People API
4. Create OAuth Credentials:
   - Type: **Web Application**
   - Authorized redirect URI: `https://<extension-id>.chromiumapp.org/`
5. Copy Client ID to `config.js`

### Spreadsheet Setup

1. Create a Google Sheet with headers in row 1
2. Copy the Spreadsheet ID from the URL
3. Update `CONFIG.SPREADSHEET_ID` in `config.js`
4. Update `CONFIG.SHEET_NAME` to match your sheet tab name

### Column Configuration

Update in `config.js`:

```javascript
// Which columns are mandatory (0-indexed)
MANDATORY_COLUMN_INDICES: [3, 5, 6, 7, 9, 11, 14, 16],

// Which columns to exclude from the form
EXCLUDED_COLUMNS: [8, 10, 12, 13, 15, 17],

// Phone search column (Column M = index 12)
PHONE_COLUMN_INDEX: 12,
```

---

## 📖 Usage Guide

### 1. Open the CRM Panel

- Click the 🍓 floating button on WhatsApp Web
- The CRM panel appears on the right side
- Drag the header to reposition, use corner to resize

### 2. Search for a Contact

- Enter phone number in the search box
- Click "🔍 Search" or press Enter
- Results show all records with matching last 6 digits

### 3. View Existing Records

- All matching records display in scrollable cards
- Each card shows row number from the sheet
- Timestamps formatted as "22 November 2025, 07:56 PM"
- Money fields show "টাকা" (Taka) suffix

### 4. Create New Entry

- Form is shown on panel open (or after search returns no results)
- Fill mandatory fields including:
  - শর্ট নাম (name)
  - ফোন নাম্বার (phone number - required in form)
  - Other mandatory fields marked with indicator
- Press Enter to move between fields
- Dropdowns auto-open when focused via Enter
- Click "Submit New Entry"
- রেফারেন্স (Column M) is auto-populated as: শর্ট নাম + 3 spaces + phone
- Toast shows success with row number

### 5. Keyboard Shortcuts

| Key    | Action                                             |
| ------ | -------------------------------------------------- |
| Enter  | Move to next field / Open dropdown / Submit search |
| Tab    | Move to next field                                 |
| Escape | Close panel                                        |

---

## 🔧 Troubleshooting

### "OAuth Error" on first use

1. Check `OAUTH_CLIENT_ID` in `config.js`
2. Verify redirect URI in Google Cloud Console matches:
   - `https://<extension-id>.chromiumapp.org/`
3. Get extension ID from `chrome://extensions`

### Entries going to wrong row

- Fixed in v7.2! Now inserts after last row with data in Column D
- Ignores empty rows that only have dropdown formatting

### Repeated login prompts

- Fixed in v7.2! Refresh tokens now stored persistently
- Silent refresh without user interaction
- Only re-login if token revoked by user

### Search not finding records

- Check that Column M contains the phone number data
- Search uses last 6 digits matching
- Console logs show all matching rows

### Extension not loading on WhatsApp

1. Refresh WhatsApp Web page
2. Check console for errors (F12 → Console)
3. Verify manifest.json has correct host permissions

---

## 📄 Permissions Explained

| Permission  | Purpose                              |
| ----------- | ------------------------------------ |
| `identity`  | OAuth 2.0 authentication with Google |
| `storage`   | Store tokens and panel position      |
| `scripting` | Inject CRM UI into WhatsApp Web      |
| `tabs`      | Detect active WhatsApp tab           |

### Host Permissions

- `https://web.whatsapp.com/*` - Inject CRM panel
- `https://sheets.googleapis.com/*` - Sheets API
- `https://people.googleapis.com/*` - Contacts API
- `https://accounts.google.com/*` - OAuth
- `https://oauth2.googleapis.com/*` - Token exchange

---

## 📝 Changelog

### v7.2 (January 2026)

- Added OAuth with PKCE and refresh tokens
- Added multiple records viewer
- Added `formatters.js` with English month names
- Fixed row insertion (inserts at correct position)
- Added toast notifications
- Added Enter key navigation
- Removed 4-digit field restriction

### v7.0

- Initial release with Google Sheets integration
- Phone number extraction from WhatsApp
- Google Contacts sync

---

## 📄 License

This project is proprietary software for AdExpress internal use.

---

## 🤝 Support

For issues or feature requests, contact the development team.
