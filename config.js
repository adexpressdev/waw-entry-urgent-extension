// --- config.js ---
// Centralized configuration for the WhatsApp CRM Extension

// === Google Sheets Configuration ===
const CONFIG = {
    // Spreadsheet settings
    SPREADSHEET_ID: '1uz2hWwPmOrDnGYt5UfzCm3_s4lCXsf_sfQDDQCX45Xw',
    SHEET_NAME: '🔵Team Blue🔵',
    FOLLOWUP_SHEET_NAME: 'Delivery_Followups',

    // Column ranges
    get PHONE_COLUMN_RANGE() {
        return `'${this.SHEET_NAME}'!M:M`;
    },

    get HEADERS_RANGE() {
        return `'${this.SHEET_NAME}'!A1:U1`;
    },

    // === Form Configuration ===
    // Columns that must be filled before submission (0-indexed)
    MANDATORY_COLUMN_INDICES: [3, 5, 6, 7, 9, 11, 14, 16],

    // Columns that should not be displayed in the form (0-indexed)
    EXCLUDED_COLUMNS: [8, 10, 12, 13, 15, 17],

    // Default values for dropdown fields (column index: default value)
    DEFAULT_DROPDOWN_VALUES: {
        5: 'ওয়েলকাম টিউন'
    },

    // === Dropdown Options Configuration ===
    DROPDOWN_OPTIONS: {
        5: ['ওয়েলকাম টিউন', 'মাইকিং', 'ভিডিও বিজ্ঞাপন'], // Column F - Service Type
        6: ['ফিমেল-ডিফল্ট', 'পুরুষ-ডিফল্ট', 'তিন্নি', 'ফামিম', 'রোজা', 'আনাস', 'রাশেদ', 'তোহা', 'সঙ্গীতা', 'রাজ'], // Column G - Voice/Artist
        11: ['ইয়াম', 'মোনা', 'Rose', 'ইফতি', 'ফামিম', 'মিমি', 'তুলি', 'স্মৃতি', 'শারমিন', 'Delivery Dep.', 'সোহাগী', 'আনাস'], // Column L - Assigned To
        14: ['বিকাশ 1- (801)', 'নগ‌দ 1- (801)', 'বিকাশ পেমেন্ট (444)', 'বিকাশ 2- (184)', 'নগ‌দ 2- (184)', 'ডাচ বাংলা- (801)', 'ব্যাংক একাউন্ট', '0 advance', 'অফিস-ক্যাশ', 'বিকাশ 3- (497)']  // Column O - Payment Method
    },

    // === Column Configuration ===
    // Special columns with double-entry validation
    VALIDATION_COLUMNS: [7, 9], // Address fields that require confirmation

    // Auto-populated columns
    AUTO_COLUMNS: {
        STATUS: 0,          // Column A - Auto-populated status
        TIMESTAMP: 1,       // Column B - Auto-generated timestamp
        CONTACT_INFO: 12,   // Column M - Name + Phone combination
        PHONE: 13,          // Column N - Phone number (used for lookup)
        URGENCY_FLAG: 18,   // Column S - "urgent" if set
        URGENCY_NOTE: 19    // Column T - Urgency note text
    },

    // === Follow-up Sheet Configuration ===
    FOLLOWUP_COLUMNS: {
        EMPTY: 0,           // Column A - Empty
        PHONE: 1,           // Column B - Phone Number
        GREETING: 2,        // Column C - Default greeting
        TIMESTAMP: 3,       // Column D - ISO timestamp
        STATUS: 4,          // Column E - Status
        NOTE: 5             // Column F - Note with prefix
    },

    FOLLOWUP_DEFAULT_GREETING: 'আসসালামু আলাইকুম...',
    FOLLOWUP_DEFAULT_STATUS: 'Pending',
    FOLLOWUP_NOTE_PREFIX: 'সেলসে নক দিচ্ছেন; ',

    // === Phone Extraction Configuration ===
    PHONE_EXTRACTION: {
        MIN_LENGTH: 8,                  // Minimum digits for valid phone
        SETTLE_TIMEOUT: 5000,          // Max wait time for DOM settle (ms)
        DRAWER_TIMEOUT: 2000,          // Default drawer wait time (ms)
        DRAWER_TIMEOUT_AGGRESSIVE: 6000, // Extended wait for business profiles (ms)
        RETRY_DELAY: 150,              // Delay between extraction retries (ms)
        POST_OPEN_RETRY_DELAYS: [400, 1200] // Delays for retries after panel open (ms)
    }
};

// Make CONFIG available globally for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
