
// ---background.js ---

// Import configuration
importScripts('config.js');

// Use CONFIG from config.js
const SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
const SHEET_NAME = CONFIG.SHEET_NAME;
const PHONE_COLUMN_RANGE = CONFIG.PHONE_COLUMN_RANGE;

// --- CACHING ---
let cachedHeaders = null;
let cachedPhoneColumn = null;

// --- AUTHENTICATION HELPER ---
function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Authentication failed.'));
            } else {
                resolve(token);
            }
        });
    });
}

// --- CONTACT HELPERS ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reuse the same normalization logic as phone_extractor.js
const normalizeDigits = (s) => (s || '').replace(/\D/g, '');

function numbersMatch(a, b) {
    const A = normalizeDigits(a);
    const B = normalizeDigits(b);
    // Compare last 8 digits to be resilient to country codes
    return A && B && A.slice(-8) === B.slice(-8);
}

async function searchContactByPhone(token, rawPhone) {
    const url = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(rawPhone)}&readMask=names,phoneNumbers`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];
    for (const r of results) {
        const phones = (r.person && r.person.phoneNumbers) || [];
        if (phones.some(p => numbersMatch(p.value || '', rawPhone))) {
            return r.person; // found
        }
    }
    return null;
}

async function createContactOnce(token, contact) {
    const body = {
        names: [{ givenName: contact.name }],
        phoneNumbers: [{ value: contact.phone }]
    };
    const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        let err;
        try { err = await res.json(); } catch { }
        throw new Error((err && err.error && err.error.message) || 'createContact failed');
    }
    return res.json();
}

// --- MESSAGE LISTENER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {

        if (request.action === 'getActiveNumber') {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || !tabs.length) return sendResponse({ ok: false, message: 'No active tab' });
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getActiveNumber' }, (resp) => {
                    if (chrome.runtime.lastError) {
                        return sendResponse({ ok: false, message: chrome.runtime.lastError.message });
                    }
                    sendResponse(resp || { ok: false });
                });
            });
            return true; // async
        }

        try {
            const token = await getAuthToken();
            if (request.action === 'getHeadersRequest') {
                if (cachedHeaders) {
                    sendResponse({ success: true, data: cachedHeaders });
                    return;
                }
                const range = CONFIG.HEADERS_RANGE;
                const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || 'Could not fetch headers.');
                }
                const data = await response.json();
                cachedHeaders = data.values ? data.values[0] : [];
                sendResponse({ success: true, data: cachedHeaders });

            }
            // In background.js, add this new 'else if' block inside the onMessage listener
            else if (request.action === 'saveFollowUp') {
                const followUpSheetName = CONFIG.FOLLOWUP_SHEET_NAME;
                const now = new Date();

                // Construct the row in the correct order for the new sheet
                // Replace it with this new version...
                const newRow = [
                    '',                                   // Column A: Empty
                    request.followUp.phone,               // Column B: Phone Number
                    CONFIG.FOLLOWUP_DEFAULT_GREETING,     // Column C: সালাম
                    now.toISOString(),                    // Column D: Timestamp
                    CONFIG.FOLLOWUP_DEFAULT_STATUS,       // Column E: Status
                    `${CONFIG.FOLLOWUP_NOTE_PREFIX}${request.followUp.note}`    // Column F: Optional Note
                ];

                // Append this new row to the 'Delivery_Followups' sheet
                const appendResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${followUpSheetName}!A1:append?valueInputOption=USER_ENTERED`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [newRow]
                    })
                });

                if (!appendResponse.ok) {
                    const errorData = await appendResponse.json();
                    throw new Error(errorData.error.message || 'Could not save follow-up data.');
                }

                sendResponse({ success: true });
            }
            else if (request.action === 'fetchContactData') {
                // Use last 6 digits for phone matching (more flexible than full number)
                const phoneToSearch = request.phone.slice(-6);
                let columnData;
                if (cachedPhoneColumn) {
                    columnData = { values: cachedPhoneColumn };
                } else {
                    const columnResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${PHONE_COLUMN_RANGE}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!columnResponse.ok) throw new Error('API Error fetching phone column.');
                    columnData = await columnResponse.json();
                    cachedPhoneColumn = columnData.values || [];
                }
                const phoneNumbersInSheet = columnData.values || [];
                let foundRowIndex = -1;
                for (let i = 0; i < phoneNumbersInSheet.length; i++) {
                    if (phoneNumbersInSheet[i] && phoneNumbersInSheet[i][0]) {
                        const sheetNumber = normalizeDigits(phoneNumbersInSheet[i][0].toString());
                        if (sheetNumber.endsWith(phoneToSearch)) {
                            foundRowIndex = i + 2;
                            break;
                        }
                    }
                }
                if (foundRowIndex !== -1) {
                    const range = `'${SHEET_NAME}'!A${foundRowIndex}:U${foundRowIndex}`;
                    const rowResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!rowResponse.ok) throw new Error('API Error fetching matched row.');
                    const rowData = await rowResponse.json();
                    const aRowOfData = rowData.values ? rowData.values[0] : [];
                    sendResponse({ success: true, exists: true, data: aRowOfData, rowIndex: foundRowIndex });
                } else {
                    sendResponse({ success: true, exists: false });
                }
            } else if (request.action === 'saveNewEntry' || request.action === 'updateExistingEntry') {
                const range = request.action === 'saveNewEntry'
                    ? `'${SHEET_NAME}'!A:A`
                    : `'${SHEET_NAME}'!A${request.rowIndex}:U${request.rowIndex}`;
                const method = request.action === 'saveNewEntry' ? 'POST' : 'PUT';
                let url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;
                if (request.action === 'saveNewEntry') {
                    url += ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
                } else {
                    url += '?valueInputOption=USER_ENTERED';
                }
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [request.data]
                    })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || 'Could not save data.');
                }
                cachedPhoneColumn = null; // Invalidate phone cache on save/update
                sendResponse({ success: true });
                // --- NEW: Add this block to handle Google Contact creation ---

            } else if (request.action === 'createGoogleContact') {
                const contact = request.contact;

                try {
                    // If already exists, skip creating duplicates
                    const existing = await searchContactByPhone(token, contact.phone);
                    if (existing) {
                        return; // Already present
                    }

                    // 1st attempt
                    const first = await createContactOnce(token, contact);

                    // Short wait, then confirm presence
                    await sleep(500);
                    const confirm = await searchContactByPhone(token, contact.phone);

                    // If still not visible, do a 2nd attempt
                    if (!confirm) {
                        const second = await createContactOnce(token, contact);
                    }
                } catch (e) {
                }
                sendResponse({});
            }



            // --- END OF NEW BLOCK ---
        } catch (error) {
            sendResponse({ success: false, message: error.message });
        }
    })();
    return true;
}); 
