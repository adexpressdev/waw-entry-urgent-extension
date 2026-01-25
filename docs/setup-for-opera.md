# Setting Up WhatsApp CRM Extension for Opera Browser

This guide provides detailed instructions for configuring the WhatsApp CRM Chrome Extension to work in Opera browser. Since Opera uses the Chromium engine, it can run Chrome extensions with some configuration changes for Google OAuth authentication.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Understanding the Problem](#understanding-the-problem)
3. [Step 1: Load the Extension in Opera](#step-1-load-the-extension-in-opera)
4. [Step 2: Get Your Opera Extension ID](#step-2-get-your-opera-extension-id)
5. [Step 3: Configure Google Cloud Console](#step-3-configure-google-cloud-console)
6. [Step 4: Update Extension Configuration](#step-4-update-extension-configuration)
7. [Step 5: Reload and Test](#step-5-reload-and-test)
8. [Troubleshooting](#troubleshooting)
9. [How the Cross-Browser Authentication Works](#how-the-cross-browser-authentication-works)

---

## Prerequisites

Before you begin, ensure you have:

- ✅ Opera browser installed (version 60 or later recommended)
- ✅ A Google Cloud Console account with an existing project
- ✅ Google Sheets API and Google People API enabled in your project
- ✅ The extension source code folder

---

## Understanding the Problem

### Why Chrome Extensions Don't Work Directly in Opera

The original extension uses `chrome.identity.getAuthToken()`, which is a **Chrome-specific API** that:

1. Relies on the user being signed into Chrome with a Google account
2. Uses Chrome's internal OAuth flow tied to the Chrome Web Store
3. Validates the extension ID registered in Google Cloud Console as a "Chrome App"

**Opera does not support this API** because:

- Opera users are not signed into Google through the browser itself
- Opera uses different extension IDs than Chrome
- The Chrome App client type in Google Cloud Console only works with Chrome

### The Solution

We use `chrome.identity.launchWebAuthFlow()` instead, which:

- Opens a popup window for Google OAuth authentication
- Works in **all Chromium-based browsers** (Opera, Edge, Brave, Vivaldi, etc.)
- Requires a "Web Application" OAuth client type in Google Cloud Console

---

## Step 1: Load the Extension in Opera

1. **Open Opera browser**

2. **Navigate to Extensions page**
   - Type `opera://extensions` in the address bar and press Enter
   - Or go to Menu → Extensions → Extensions

3. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner to **ON**

4. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to and select your extension folder:
     ```
     Entry and urgent indicator V7-20260122T122422Z-1-001/
     ```
   - Click "Select Folder"

5. **Verify Installation**
   - The extension should appear in the list with its icon
   - Note: It won't work yet until you complete the OAuth configuration

---

## Step 2: Get Your Opera Extension ID

After loading the extension, you need to find its unique ID:

1. **On the Extensions page** (`opera://extensions`)

2. **Locate your extension** in the list

3. **Find the Extension ID**
   - It's displayed below the extension name
   - It looks like a 32-character string of lowercase letters
   - Example: `abcdefghijklmnopqrstuvwxyzabcdef`

4. **Copy this ID** - you'll need it for the next step

> ⚠️ **Important**: The extension ID in Opera will be **different** from the Chrome extension ID. Each browser generates its own unique ID for unpacked extensions.

---

## Step 3: Configure Google Cloud Console

### 3.1 Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Select your existing project (or create a new one)

### 3.2 Navigate to Credentials

1. In the left sidebar, click **"APIs & Services"**
2. Click **"Credentials"**

### 3.3 Create a New OAuth 2.0 Client ID

1. Click **"+ CREATE CREDENTIALS"** at the top
2. Select **"OAuth client ID"**

### 3.4 Configure the OAuth Client

1. **Application type**: Select **"Web application"**

   > ⚠️ **Critical**: Do NOT select "Chrome App" - that only works in Chrome!

2. **Name**: Enter a descriptive name, e.g., `WhatsApp CRM - Opera`

3. **Authorized JavaScript origins**: Leave empty (not required)

4. **Authorized redirect URIs**: Click **"+ ADD URI"** and enter:

   ```
   https://YOUR-OPERA-EXTENSION-ID.chromiumapp.org/
   ```

   Replace `YOUR-OPERA-EXTENSION-ID` with the actual extension ID you copied in Step 2.

   **Example**:

   ```
   https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/
   ```

   > ⚠️ **Important**:
   >
   > - Include the trailing slash `/` at the end
   > - Use `chromiumapp.org` (NOT `chrome.com` or `opera.com`)

5. Click **"CREATE"**

### 3.5 Copy the Client ID

After creation, a popup will display:

- **Client ID**: Copy this value (looks like `123456789-abcdefg.apps.googleusercontent.com`)
- **Client Secret**: Not needed for this flow, but save it securely anyway

---

## Step 4: Update Extension Configuration

### 4.1 Edit config.js

1. Open the file `config.js` in your extension folder

2. Find the `OAUTH_CLIENT_ID` line:

   ```javascript
   OAUTH_CLIENT_ID: '851591119047-tdtp5jna1nmc7b26fh1rpuag45led0f9.apps.googleusercontent.com',
   ```

3. Replace it with your new Web Application Client ID:

   ```javascript
   OAUTH_CLIENT_ID: 'YOUR-NEW-WEB-APP-CLIENT-ID.apps.googleusercontent.com',
   ```

4. Save the file

### 4.2 Verify the Spreadsheet Configuration

While you're in `config.js`, verify these settings are correct:

```javascript
SPREADSHEET_ID: 'your-spreadsheet-id-here',
SHEET_NAME: 'Your Sheet Name',
FOLLOWUP_SHEET_NAME: 'Delivery_Followups',
```

---

## Step 5: Reload and Test

### 5.1 Reload the Extension

1. Go to `opera://extensions`
2. Find your extension
3. Click the **refresh/reload icon** (circular arrow)
4. Or toggle the extension OFF and then ON

### 5.2 Test the Extension

1. Open [WhatsApp Web](https://web.whatsapp.com/) in Opera
2. Wait for WhatsApp to fully load
3. Look for the **strawberry/CRM icon** (floating button)
4. Click the icon to open the CRM panel
5. Enter a phone number and click **Search**

### 5.3 First-Time Authentication

On the first search (or any API call):

1. A **Google sign-in popup** will appear
2. Sign in with your Google account
3. Review the permissions requested:
   - Google Sheets access
   - Google Contacts access
4. Click **"Allow"**
5. The popup will close automatically
6. The extension will continue with the API request

> 📝 **Note**: After the first successful authentication, the token is cached for approximately 1 hour. You won't need to sign in again until the token expires.

---

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause**: The redirect URI in Google Cloud Console doesn't match the extension's actual redirect URI.

**Solution**:

1. Open the browser console (F12 → Console tab)
2. Look for: `[Auth] Redirect URI: https://xxxxx.chromiumapp.org/`
3. Copy this exact URI
4. Add it to your OAuth client's Authorized redirect URIs in Google Cloud Console
5. Wait 5 minutes for changes to propagate
6. Reload the extension and try again

### Error: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen not configured or app not verified.

**Solution**:

1. Go to Google Cloud Console → APIs & Services → OAuth consent screen
2. Ensure the consent screen is configured
3. Add your email as a test user if the app is in "Testing" mode
4. For production, submit the app for verification

### Error: "The user closed the auth popup"

**Cause**: The authentication popup was closed before completing sign-in.

**Solution**:

- Try again and complete the sign-in process
- Ensure popup blockers are disabled for the auth popup

### Extension Icon Not Appearing

**Cause**: WhatsApp Web hasn't fully loaded, or there's a JavaScript error.

**Solution**:

1. Refresh WhatsApp Web (F5)
2. Check the browser console for errors (F12 → Console)
3. Verify the extension is enabled in `opera://extensions`

### "Token expired" or Frequent Re-authentication

**Cause**: The cached token has expired.

**Solution**: This is normal behavior. The extension will automatically prompt for re-authentication when the token expires (every ~1 hour).

---

## How the Cross-Browser Authentication Works

The extension now uses a dual-authentication strategy:

```
┌─────────────────────────────────────────────────────────────┐
│                   getAuthToken() called                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Check for cached valid token  │
              └───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               Token Found         No Valid Token
               (< 1 hour old)           │
                    │                   ▼
                    │       ┌───────────────────────────┐
                    │       │ Try Chrome's native       │
                    │       │ getAuthToken()            │
                    │       │ (Only works in Chrome     │
                    │       │  with signed-in Google)   │
                    │       └───────────────────────────┘
                    │                   │
                    │         ┌─────────┴─────────┐
                    │         │                   │
                    │    ✅ Success          ❌ Failed
                    │    (Chrome)           (Opera/Edge/etc)
                    │         │                   │
                    │         ▼                   ▼
                    │   Return token    ┌───────────────────────┐
                    │                   │ Fallback to           │
                    │                   │ launchWebAuthFlow()   │
                    │                   │                       │
                    │                   │ Opens popup for       │
                    │                   │ Google OAuth sign-in  │
                    │                   └───────────────────────┘
                    │                             │
                    │                             ▼
                    │                   ┌───────────────────────┐
                    │                   │ Extract access_token  │
                    │                   │ from redirect URL     │
                    │                   └───────────────────────┘
                    │                             │
                    ▼                             ▼
              ┌─────────────────────────────────────────┐
              │          Return access token            │
              │          (Cache for 1 hour)             │
              └─────────────────────────────────────────┘
```

### Key Points:

1. **Chrome Users**: Continue using the seamless `getAuthToken()` experience
2. **Opera/Edge Users**: Automatically use `launchWebAuthFlow()` popup
3. **Token Caching**: Both methods cache tokens to minimize re-authentication
4. **Same Extension Code**: No need for separate browser-specific versions

---

## Additional Notes

### Using the Same Extension in Multiple Browsers

If you want to use this extension in both Chrome and Opera:

1. **Chrome**: Use the original Chrome App OAuth client (already configured in manifest.json)
2. **Opera**: Create a separate Web Application OAuth client with Opera's extension ID

The extension automatically detects which authentication method to use.

### Security Considerations

- The OAuth client secret is NOT required for this flow (implicit grant)
- Tokens are stored in memory only and cleared when the browser closes
- Each browser session requires fresh authentication
- Never commit your OAuth client ID to public repositories

---

## Support

If you encounter issues not covered in this guide:

1. Check the browser console for detailed error messages (F12 → Console)
2. Verify all redirect URIs are correctly configured
3. Ensure the Google Sheets API and People API are enabled in your project
4. Test with a fresh browser profile to rule out caching issues

---

_Last updated: January 2026_
