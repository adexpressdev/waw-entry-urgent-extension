# Customer Entry - WhatsApp CRM Chrome Extension

**Version:** 7.0  
**Description:** A Chrome extension that integrates WhatsApp Web with Google Sheets for customer relationship management, featuring automatic phone number detection, contact data management, and Google Contacts integration.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Google Sheets Integration](#google-sheets-integration)
- [Installation](#installation)
- [Configuration](#configuration)
- [Permissions](#permissions)

---

## 🎯 Overview

This Chrome extension provides a CRM (Customer Relationship Management) overlay for WhatsApp Web. It allows users to:

- Automatically detect phone numbers from active WhatsApp chats
- Look up and display existing customer data from a Google Sheet
- Create new customer entries or update existing ones
- Save customers to Google Contacts automatically
- Add follow-up reminders for delivery management
- Mark entries as urgent with optional notes

---

## ✨ Features

| Feature                         | Description                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| **Phone Number Extraction**     | Multi-strategy extraction from WhatsApp DOM (data attributes, headers, URL, contact drawer) |
| **Google Sheets Integration**   | Read/write customer data to a configured Google Spreadsheet                                 |
| **Google Contacts Sync**        | Automatically creates contacts in Google Contacts with duplicate prevention                 |
| **Draggable Panel**             | Floating CRM panel that can be repositioned and remembers its position                      |
| **Form Validation**             | Double-entry validation for critical fields (address, phone confirmation)                   |
| **Urgency/Follow-up System**    | Mark entries as urgent and add them to a follow-up sheet                                    |
| **Mandatory Field Enforcement** | Configurable mandatory fields with visual indicators                                        |
| **Real-time Chat Detection**    | Automatically updates when switching between WhatsApp conversations                         |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WhatsApp Web (Browser Tab)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌────────────────────────────────────┐   │
│  │  Floating Button │────▶│         CRM Container              │   │
│  │  (icon48.png)    │     │  ┌──────────────────────────────┐  │   │
│  └──────────────────┘     │  │     Drag Header              │  │   │
│                           │  └──────────────────────────────┘  │   │
│  ┌──────────────────────┐ │  ┌──────────────────────────────┐  │   │
│  │ phone_extractor.js   │ │  │   iframe (panel.html)        │  │   │
│  │  - 8 extraction      │ │  │   ├── config.js              │  │   │
│  │    strategies        │ │  │   └── panel.js               │  │   │
│  │  - extractPhoneNum() │ │  │       - Form rendering       │  │   │
│  └──────────────────────┘ │  │       - Data submission      │  │   │
│            ▲              │  └──────────────────────────────┘  │   │
│            │              └────────────────────────────────────┘   │
│  ┌──────────────────────┐                                          │
│  │    content.js        │                                          │
│  │  - UI injection      │                                          │
│  │  - Event observers   │                                          │
│  │  - Panel management  │                                          │
│  └──────────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     background.js (Service Worker)                   │
│  ┌────────────────────┐  ┌─────────────────────────────────────┐   │
│  │    config.js       │  │  - OAuth2 Authentication            │   │
│  │  (importScripts)   │──│  - Google Sheets API calls          │   │
│  │                    │  │  - Google People API calls          │   │
│  └────────────────────┘  │  - Message routing                  │   │
│                          │  - Caching (headers, phone column)  │   │
│                          └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Google APIs                                   │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐    │
│  │  Google Sheets API  │    │     Google People API           │    │
│  │  - Read headers     │    │     - Search contacts           │    │
│  │  - Search phone col │    │     - Create new contacts       │    │
│  │  - Append/Update    │    │                                 │    │
│  └─────────────────────┘    └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
Entry and urgent indicator V7/
├── manifest.json          # Chrome Extension manifest (v3)
├── config.js              # Centralized configuration settings
├── background.js          # Service worker for API calls
├── phone_extractor.js     # Phone number extraction utilities
├── content.js             # WhatsApp Web DOM manipulation & UI
├── panel.html             # CRM panel UI structure
├── panel.js               # Panel logic and form handling
├── style.css              # Styling for all components
├── README.md              # This documentation
└── icons/
    ├── icon16.png         # 16x16 extension icon
    ├── icon32.png         # 32x32 extension icon
    ├── icon48.png         # 48x48 extension icon
    └── icon128.png        # 128x128 extension icon
```

---

## 🔧 Component Details

### manifest.json

The extension configuration file defining:

- **Manifest Version:** 3 (latest Chrome extension standard)
- **Permissions:** `identity`, `storage`, `scripting`, `tabs`
- **Host Permissions:** Google Sheets API, Google People API, WhatsApp Web
- **OAuth2 Configuration:** Google API client credentials
- **Content Scripts:** `phone_extractor.js` and `content.js` injected into `web.whatsapp.com`

### config.js

Centralized configuration file containing all customizable settings:

````javascript
const CONFIG = {
    // Google Sheets settings
    SPREADSHEET_ID: '168bFU_WQPy50q4QeAq3vpSUt6Q2OCuBrvGZjFQ3uL3A',
    SHEET_NAME: '🔵Team Blue🔵',
    FOLLOWUP_SHEET_NAME: 'Delivery_Followups',

    // Form configuration
    MANDATORY_COLUMN_INDICES: [3, 5, 6, 7, 9, 11, 14, 16],
    EXCLUDED_COLUMNS: [8, 10, 12, 13, 15, 17],
  Configuration:** Uses `CONFIG` from `config.js` via `importScripts()`.

### phone_extractor.js

Dedicated module for phone number extraction from WhatsApp Web DOM:

**Extraction Strategies (in priority order):**

| Strategy | Description |
|----------|-------------|
| `_extractFromLeftPaneSelected()` | Selected chat in left sidebar |
| `_extractFromDataAttrs()` | Data attributes (`data-id`, `data-jid`, etc.) |
| `_extractFromHeaderTel()` | `tel:` links in conversation header |
| `_extractFromHeaderAria()` | Aria-label attributes |
| `_extractFromUrl()` | URL parameters and hash |
| `_extractFromInfoDrawer()` | Contact info drawer (opens if needed) |
| `_extractFromDrawerCopyableSpan()` | Copyable text spans in drawer |

**Helper Functions:**
- `_sleep(ms)` - Promise-based delay
- `_onlyDigits(s)` - Extract only digits from string
- `_hasMinLen(s, len)` - Validate minimum phone length
- `_isVisible(el)` - Check if element is visible in DOM
- `_hasLidContext()` - Detect business (LID) accounts

**Main Function:** `extractPhoneNumber()` - Smart aggregator that tries all strategies with fallbacks.

### content.js

Injects the CRM interface into WhatsApp Web:

**Features:**

- Creates floating button and draggable CRM panel
- Calls `extractPhoneNumber()` from phone_extractor.js
- MutationObserver for chat change detection
- Hash change listener for URL updates
- postMessage communication with iframe
- Position persistence via chrome.storage

### panel.html

Simple HTML structure for the CRM form:

- Urgency container (note input + button)
- Status display area
- Dynamic data container (form fields)
- Footer with submit button
- Loads `config.js` for configuration access

### panel.js

Handles form rendering and data submission:

**Configuration:** Uses `CONFIG` object from `config.js`:

```javascript
const mandatoryColumnIndices = CONFIG.MANDATORY_COLUMN_INDICES;
const excludedColumns = CONFIG.EXCLUDED_COLUMNS;
const dropdownOptions = CONFIG.DROPDOWN_OPTIONS postMessage communication with iframe

### panel.html

Simple HTML structure for the CRM form:

- Urgency container (note input + button)
- Status display area
- Dynamic data container (form fields)
- Footer with submit button

### panel.js

Handles form rendering and data submission:

**Column Configuration:**

```javascript
const mandatoryColumnIndices = [3, 5, 6, 7, 9, 11, 14, 16];  // Required fields
const excludedColumns = [8, 10, 12, 13, 15, 17];              // Hidden columns
const dropdownOptions = {
    5: ['ওয়েলকাম টিউন', 'মাইকিং', 'ভিডিও বিজ্ঞাপন'],
    6: ['ফিমেল-ডিফল্ট', 'পুরুষ-ডিফল্ট', ...],
    11: ['ইয়াম 🔴November 25', ...],
    14: ['বিকাশ 1- (801)', 'নগ‌দ 1- (801)', ...]
};
````

**Validation Features:**

- Double-entry confirmation for columns 7 and 9 (address fields)
- Mandatory field highlighting
- Form pre-population with existing data

### style.css

Complete styling for:

- Floating action button (WhatsApp-themed)
- Draggable CRM container
- Form fields and dropdowns
- Validation indicators
- Urgency button styling
- Dark theme matching WhatsApp Web

---

## 🔄 Data Flow

### Opening the Panel

```
User clicks floating button
        │
        ▼
content.js: togglePanel()
        │
        ▼
content.js: extractPhoneNumber() ──▶ Tries multiple extraction strategies
        │
        ▼
chrome.storage.local.set({ activePhoneNumber: number })
        │
        ▼
panel.html loads in iframe
        │
        ▼
panel.js: Requests headers + contact data
        │
        ▼
background.js: Fetches from Google Sheets API
        │
        ▼
panel.js: Renders form with data
```

### Submitting Entry

```
User fills form and clicks "Submit New Entry"
        │
        ▼
panel.js: handleSubmit() ──▶ Validates mandatory fields
        │
        ▼
chrome.runtime.sendMessage({ action: 'saveNewEntry', data: [...] })
        │
        ▼
background.js: Appends row to Google Sheet
        │
        ▼
background.js: Creates Google Contact (if name provided)
        │
        ▼
panel.js: Shows success, closes panel
```

---

## 📊 Google Sheets Integration

### Main Sheet Structure (`🔵Team Blue🔵`)

| Column | Index | Purpose                                          |
| ------ | ----- | ------------------------------------------------ |
| A      | 0     | Status (auto-populated)                          |
| B      | 1     | Timestamp (auto-generated: DD/MM/YYYY HH:MM:SS)  |
| C      | 2     | (System use)                                     |
| D      | 3     | Customer Name _(mandatory)_                      |
| E      | 4     | (Excluded)                                       |
| F      | 5     | Service Type _(dropdown, mandatory)_             |
| G      | 6     | Voice/Artist _(dropdown, mandatory)_             |
| H      | 7     | Address 1 _(double-entry validation, mandatory)_ |
| I      | 8     | (Excluded)                                       |
| J      | 9     | Address 2 _(double-entry validation, mandatory)_ |
| K      | 10    | (Excluded)                                       |
| L      | 11    | Assigned To _(dropdown, mandatory)_              |
| M      | 12    | Contact Info (auto: Name + Phone)                |
| N      | 13    | (Phone - used for lookup)                        |
| O      | 14    | Payment Method _(dropdown, mandatory)_           |
| P      | 15    | (Excluded)                                       |
| Q      | 16    | _(mandatory)_                                    |
| R      | 17    | (Excluded)                                       |
| S      | 18    | Urgency Flag ("urgent" if set)                   |
| T      | 19    | Urgency Note                                     |
| U      | 20    | (Last column read)                               |

### Follow-up Sheet (`Delivery_Followups`)

| Column | Content                              |
| ------ | ------------------------------------ |
| A      | (Empty)                              |
| B      | Phone Number                         |
| C      | Greeting (আসসালামু আলাইকুম...)       |
| D      | Timestamp (ISO format)               |
| E      | Status ("Pending")                   |
| F      | Note (সেলসে নক দিচ্ছেন; + user note) |

---

## 🔧 Installation

1. **Clone/Download** the extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select the extension folder
5. Navigate to `web.whatsapp.com` and log in
6. Click the floating CRM button to authenticate with Google

---

## ⚙️ Configuration

To customize for your use case, modify these in `background.js`:

```javascript
const SPREADSHEET_ID = "your-spreadsheet-id";
const SHEET_NAME = "Your Sheet Name";
const PHONE_COLUMN_RANGE = `'${SHEET_NAME}'!M:M`; // Column containing phone numbers
```

Update `manifest.json` with your OAuth2 client ID:

```json
"oauth2": {
    "client_id": "your-client-id.apps.googleusercontent.com",
    "scopes": [...]
}
```

---

## 🔐 Permissions

| Permission              | Purpose                           |
| ----------------------- | --------------------------------- |
| `identity`              | Google OAuth2 authentication      |
| `storage`               | Store panel position, cached data |
| `scripting`             | Inject content scripts            |
| `tabs`                  | Access active tab for messaging   |
| `sheets.googleapis.com` | Read/write Google Sheets          |
| `people.googleapis.com` | Create Google Contacts            |
| `web.whatsapp.com`      | Content script injection          |

---

## 🇧🇩 Language Support

The extension is designed for **Bengali (Bangla)** users with:

- Bengali dropdown options
- Bengali placeholder text
- Bengali greeting messages in follow-ups

---

## 📝 License

This project is proprietary software developed for AdExpress customer management.

---

## 🔧 Troubleshooting

| Issue                | Solution                                                    |
| -------------------- | ----------------------------------------------------------- |
| Panel doesn't open   | Refresh WhatsApp Web, check if `#app` element exists        |
| Phone not detected   | Try opening the contact info drawer manually                |
| Authentication fails | Check OAuth2 client configuration, re-authenticate          |
| Data not saving      | Verify spreadsheet ID and sheet name, check API permissions |
| Position not saved   | Clear extension storage and retry                           |

---

_Last updated: January 2026_
