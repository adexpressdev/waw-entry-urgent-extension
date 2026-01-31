
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

// --- OAuth Configuration ---
const OAUTH_CLIENT_ID = CONFIG.OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = CONFIG.OAUTH_CLIENT_SECRET;
const OAUTH_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/contacts'
].join(' ');

// --- PKCE HELPERS (for secure authorization code flow) ---
function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += charset[randomValues[i] % charset.length];
    }
    return result;
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return hash;
}

function base64urlencode(arrayBuffer) {
    let str = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(codeVerifier) {
    const hashed = await sha256(codeVerifier);
    return base64urlencode(hashed);
}

// --- PERSISTENT TOKEN STORAGE (with refresh token support) ---
async function getStoredTokens() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['accessToken', 'tokenExpiry', 'refreshToken'], (result) => {
            resolve(result);
        });
    });
}

async function storeTokens(accessToken, refreshToken, expiresInMs = 3600 * 1000) {
    const tokenExpiry = Date.now() + expiresInMs - 60000; // Subtract 1 minute buffer
    return new Promise((resolve) => {
        const data = { accessToken, tokenExpiry };
        if (refreshToken) {
            data.refreshToken = refreshToken;
        }
        chrome.storage.local.set(data, () => {
            console.log('[Auth] Tokens stored, access expires at', new Date(tokenExpiry).toLocaleTimeString());
            if (refreshToken) console.log('[Auth] Refresh token stored for long-term use');
            resolve();
        });
    });
}

async function clearStoredTokens() {
    return new Promise((resolve) => {
        chrome.storage.local.remove(['accessToken', 'tokenExpiry', 'refreshToken'], () => {
            console.log('[Auth] All tokens cleared');
            resolve();
        });
    });
}

// --- REFRESH ACCESS TOKEN (silent, no user interaction) ---
async function refreshAccessToken(refreshToken) {
    console.log('[Auth] Attempting silent token refresh...');
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: OAUTH_CLIENT_ID,
                client_secret: OAUTH_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('[Auth] Token refreshed silently, new token expires in', data.expires_in, 'seconds');
            await storeTokens(data.access_token, refreshToken, data.expires_in * 1000);
            return data.access_token;
        } else {
            const error = await response.json();
            console.error('[Auth] Refresh failed:', error);
            // If refresh token is invalid/revoked, clear everything
            if (error.error === 'invalid_grant') {
                await clearStoredTokens();
            }
            return null;
        }
    } catch (e) {
        console.error('[Auth] Refresh error:', e);
        return null;
    }
}

// --- VALIDATE TOKEN ---
async function isTokenValid(token) {
    if (!token) return false;
    try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
        if (response.ok) {
            const data = await response.json();
            return data.expires_in > 60; // Valid if more than 1 minute left
        }
        return false;
    } catch (e) {
        return false;
    }
}

// --- MAIN AUTHENTICATION HELPER ---
function getAuthToken() {
    return new Promise(async (resolve, reject) => {
        const stored = await getStoredTokens();

        // 1. Check if we have a valid access token
        if (stored.accessToken && stored.tokenExpiry && Date.now() < stored.tokenExpiry) {
            console.log('[Auth] Using cached token, expires in', Math.round((stored.tokenExpiry - Date.now()) / 60000), 'minutes');
            return resolve(stored.accessToken);
        }

        // 2. Try to refresh using refresh token (silent, no user interaction)
        if (stored.refreshToken) {
            const newToken = await refreshAccessToken(stored.refreshToken);
            if (newToken) {
                return resolve(newToken);
            }
            console.log('[Auth] Refresh token expired or revoked, need fresh login');
        }

        // 3. Try Chrome's native getAuthToken (Chrome only)
        if (chrome.identity.getAuthToken) {
            try {
                const token = await new Promise((res, rej) => {
                    chrome.identity.getAuthToken({ interactive: true }, (token) => {
                        if (chrome.runtime.lastError || !token) {
                            rej(new Error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Chrome auth failed'));
                        } else {
                            res(token);
                        }
                    });
                });
                await storeTokens(token, null, 3600 * 1000);
                return resolve(token);
            } catch (e) {
                console.log('[Auth] Chrome getAuthToken failed, using web auth flow:', e.message);
            }
        }

        // 4. Fallback: Full OAuth flow with PKCE (gets refresh token for long-term use)
        try {
            const tokens = await getTokensViaAuthCodeFlow();
            await storeTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in * 1000);
            resolve(tokens.access_token);
        } catch (e) {
            reject(e);
        }
    });
}

// --- AUTHORIZATION CODE FLOW WITH PKCE (provides refresh tokens) ---
async function getTokensViaAuthCodeFlow() {
    const redirectUri = chrome.identity.getRedirectURL();
    console.log('[Auth] Starting auth code flow, redirect URI:', redirectUri);

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Step 1: Get authorization code
    const authCode = await new Promise((resolve, reject) => {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(OAUTH_CLIENT_ID)}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(OAUTH_SCOPES)}` +
            `&code_challenge=${encodeURIComponent(codeChallenge)}` +
            `&code_challenge_method=S256` +
            `&access_type=offline` +  // Request refresh token
            `&prompt=consent`;  // Required for refresh token on first auth

        chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            (responseUrl) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                if (!responseUrl) {
                    return reject(new Error('No response URL received'));
                }

                const url = new URL(responseUrl);
                const code = url.searchParams.get('code');
                const error = url.searchParams.get('error');

                if (error) {
                    return reject(new Error(`Auth error: ${error}`));
                }
                if (code) {
                    resolve(code);
                } else {
                    reject(new Error('No authorization code in response'));
                }
            }
        );
    });

    console.log('[Auth] Got authorization code, exchanging for tokens...');

    // Step 2: Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: OAUTH_CLIENT_ID,
            client_secret: OAUTH_CLIENT_SECRET,
            code: authCode,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri
        })
    });

    if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const tokens = await tokenResponse.json();
    console.log('[Auth] Got tokens! Access token expires in', tokens.expires_in, 'seconds');
    console.log('[Auth] Refresh token received:', tokens.refresh_token ? 'Yes' : 'No');

    return tokens;
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
                // Normalize phone to digits only, then take last 6 digits for matching
                const normalizedPhone = normalizeDigits(request.phone);
                const phoneToSearch = normalizedPhone.slice(-6);
                console.log('[Background] Searching for last 6 digits:', phoneToSearch);

                // Always fetch fresh data to avoid stale cache issues
                const columnResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${PHONE_COLUMN_RANGE}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!columnResponse.ok) throw new Error('API Error fetching phone column.');
                const columnData = await columnResponse.json();

                const phoneNumbersInSheet = columnData.values || [];
                const matchingRows = [];  // Store all matching row indices

                // Start from index 1 to skip header row
                // Index 0 = Row 1 (header), Index 1 = Row 2, etc.
                // So row number = i + 1
                for (let i = 1; i < phoneNumbersInSheet.length; i++) {
                    if (phoneNumbersInSheet[i] && phoneNumbersInSheet[i][0]) {
                        const sheetNumber = normalizeDigits(phoneNumbersInSheet[i][0].toString());
                        if (sheetNumber.endsWith(phoneToSearch)) {
                            const rowIndex = i + 1;
                            matchingRows.push(rowIndex);
                            console.log('[Background] Found match at row:', rowIndex, '| Value:', phoneNumbersInSheet[i][0]);
                        }
                    }
                }
                
                console.log('[Background] Total matches found:', matchingRows.length);
                
                if (matchingRows.length > 0) {
                    // Fetch all matching rows data
                    const allRecords = [];
                    for (const rowIndex of matchingRows) {
                        const range = `'${SHEET_NAME}'!A${rowIndex}:U${rowIndex}`;
                        const rowResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (rowResponse.ok) {
                            const rowData = await rowResponse.json();
                            const aRowOfData = rowData.values ? rowData.values[0] : [];
                            allRecords.push({ data: aRowOfData, rowIndex: rowIndex });
                            console.log('[Background] Fetched row', rowIndex, 'data:', aRowOfData);
                        }
                    }
                    sendResponse({ success: true, exists: true, records: allRecords, count: allRecords.length });
                } else {
                    sendResponse({ success: true, exists: false });
                }
            } else if (request.action === 'saveNewEntry' || request.action === 'updateExistingEntry') {
                console.log('[Background] Action:', request.action);
                console.log('[Background] Data to save:', request.data);
                console.log('[Background] Data length:', request.data ? request.data.length : 0);
                
                if (request.action === 'saveNewEntry') {
                    // Find the last row with actual data in Column D (index 3 = পার্ট নাম)
                    // This avoids appending after empty rows with just dropdowns
                    const findLastRowResponse = await fetch(
                        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/'${SHEET_NAME}'!D:D`,
                        { headers: { 'Authorization': `Bearer ${token}` } }
                    );
                    
                    if (!findLastRowResponse.ok) {
                        throw new Error('Could not determine last row.');
                    }
                    
                    const columnDData = await findLastRowResponse.json();
                    const values = columnDData.values || [];
                    
                    // Find last row with actual data (non-empty)
                    let lastDataRow = 1; // Default to row 1 (header)
                    for (let i = values.length - 1; i >= 0; i--) {
                        if (values[i] && values[i][0] && values[i][0].toString().trim() !== '') {
                            lastDataRow = i + 1; // Convert to 1-based row number
                            break;
                        }
                    }
                    
                    const insertRow = lastDataRow + 1;
                    console.log('[Background] Last data row:', lastDataRow, '| Inserting at row:', insertRow);
                    
                    // Use update (PUT) to insert at specific row instead of append
                    const range = `'${SHEET_NAME}'!A${insertRow}:U${insertRow}`;
                    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
                    
                    console.log('[Background] API URL:', url);
                    
                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            values: [request.data]
                        })
                    });
                    
                    console.log('[Background] API Response status:', response.status, response.statusText);
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('[Background] API Error:', errorData);
                        throw new Error(errorData.error.message || 'Could not save data.');
                    }
                    
                    const responseData = await response.json();
                    console.log('[Background] API Success response:', responseData);
                    
                    cachedPhoneColumn = null;
                    sendResponse({ success: true, insertedRow: insertRow });
                } else {
                    // Update existing entry
                    const range = `'${SHEET_NAME}'!A${request.rowIndex}:U${request.rowIndex}`;
                    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
                    
                    console.log('[Background] API URL:', url);
                    
                    const response = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            values: [request.data]
                        })
                    });
                    
                    console.log('[Background] API Response status:', response.status, response.statusText);
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('[Background] API Error:', errorData);
                        throw new Error(errorData.error.message || 'Could not save data.');
                    }
                    
                    const responseData = await response.json();
                    console.log('[Background] API Success response:', responseData);
                    
                    cachedPhoneColumn = null;
                    sendResponse({ success: true });
                }
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
