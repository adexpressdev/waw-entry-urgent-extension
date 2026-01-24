// --- phone_extractor.js ---
// Phone number extraction utilities for WhatsApp Web

// === HELPER FUNCTIONS ===
const _sleep = (ms) => new Promise(r => setTimeout(r, ms));
const _onlyDigits = (s) => (s || '').replace(/[^\d]/g, '');
const _hasMinLen = (s, len = 8) => _onlyDigits(s).length >= len;

// Element must be in the current layout and not hidden
const _isVisible = (el) => {
    if (!el) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
};

// === EXTRACTION STRATEGIES ===

/**
 * 1) Attribute sweep: works across old/new DOMs and locales
 */
function _extractFromDataAttrs() {
    console.log('[CRM] Step: Trying _extractFromDataAttrs');
    const root = document.querySelector('#main');
    if (!root || !_isVisible(root)) {
        console.log('[CRM] Step: No visible #main root found');
        return null;
    }
    const selectors = [
        '[data-id]',
        '[data-jid]',
        '[data-chatid]',
        '[data-conversation-id]'
    ].join(',');
    const nodes = Array.from(root.querySelectorAll(selectors)).filter(_isVisible);
    for (const el of nodes) {
        for (const attr of ['data-id', 'data-jid', 'data-chatid', 'data-conversation-id']) {
            const raw = el.getAttribute?.(attr);
            if (!raw) continue;
            if (/@lid_/i.test(raw)) continue; // LID is not a phone
            const m = raw.match(/(?:^|_)(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/);
            if (m && _hasMinLen(m[1])) {
                console.log(`[CRM] Step: Found in ${attr}: ${m[1]}`);
                return m[1];
            }
        }
    }
    console.log('[CRM] Step: No phone found in data attrs');
    return null;
}

/**
 * Check if current chat is a LID (business) context
 */
function _hasLidContext() {
    console.log('[CRM] Step: Checking for LID context');
    const hasLid = !!document.querySelector([
        '#main [data-id*="@lid_"]',
        '#main [data-jid*="@lid_"]',
        '[aria-selected="true"] [data-id*="@lid_"]',
        '[aria-selected="true"] [data-jid*="@lid_"]'
    ].join(','));
    console.log(`[CRM] Step: LID context: ${hasLid}`);
    return hasLid;
}

/**
 * 2) Direct tel: link in header (some layouts expose it)
 */
function _extractFromHeaderTel() {
    console.log('[CRM] Step: Trying _extractFromHeaderTel');
    const header = document.querySelector(
        '#main header, [data-testid="conversation-header"], [data-testid="conversation-info-header"], [role="banner"]'
    );
    if (!header) {
        console.log('[CRM] Step: No header found');
        return null;
    }
    const tel = header.querySelector('a[href^="tel:"]');
    if (tel) {
        const n = _onlyDigits(tel.getAttribute('href'));
        if (_hasMinLen(n)) {
            console.log(`[CRM] Step: Found in tel link: ${n}`);
            return n;
        }
    }
    console.log('[CRM] Step: No tel link or invalid number');
    return null;
}

/**
 * 3) Header text fallback (unsaved numbers often show as plain text)
 */
function _extractFromHeaderText() {
    console.log('[CRM] Step: Trying _extractFromHeaderText');
    const header =
        document.querySelector('#main header') ||
        document.querySelector('[data-testid="conversation-header"]') ||
        document.querySelector('[data-testid="conversation-info-header"]') ||
        document.querySelector('[role="banner"]');
    if (!header) {
        console.log('[CRM] Step: No header found');
        return null;
    }
    const txt = (header.innerText || '').trim();
    const rx = /(\+?\d[\d\s\-().]{6,})/g;
    let best = null, m;
    while ((m = rx.exec(txt))) {
        const d = _onlyDigits(m[1]);
        if (_hasMinLen(d) && (!best || d.length > best.length)) best = d;
    }
    if (best) {
        console.log(`[CRM] Step: Found in header text: ${best}`);
    } else {
        console.log('[CRM] Step: No number found in header text');
    }
    return best;
}

/**
 * 4) Some builds store the phone in an aria-label on the header button
 */
function _extractFromHeaderAria() {
    console.log('[CRM] Step: Trying _extractFromHeaderAria');
    const targets = [
        '#main header [role="button"][aria-label]',
        '#main header [aria-label]',
        '[data-testid="conversation-header"] [aria-label]',
        '[data-testid="conversation-info-header"] [aria-label]'
    ];
    for (const sel of targets) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const label = el.getAttribute('aria-label') || '';
        const n = _onlyDigits(label);
        if (_hasMinLen(n)) {
            console.log(`[CRM] Step: Found in aria-label: ${n}`);
            return n;
        }
    }
    console.log('[CRM] Step: No number found in header aria');
    return null;
}

/**
 * 5) URL/hash fallback: wa.me, ?phone=, ?chat=, #/t/123..., etc.
 */
function _extractFromUrl() {
    console.log('[CRM] Step: Trying _extractFromUrl');
    try {
        const u = new URL(String(location.href));
        // Common query params
        for (const p of ['phone', 'chat', 'jid', 'id', 'number']) {
            const v = u.searchParams.get(p);
            if (v) {
                const mx = v.match(/(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/);
                const n = mx ? mx[1] : _onlyDigits(v);
                if (_hasMinLen(n)) {
                    console.log(`[CRM] Step: Found in URL param ${p}: ${n}`);
                    return n;
                }
            }
        }
        // Hash patterns: #/t/123..., #/c/123..., #...&chat=123...
        const h = u.hash || '';
        let hm =
            h.match(/(?:^|[/?&])(t|c|chat|jid)=?(\d{6,})/i) ||
            h.match(/\/(t|c)\/(\d{6,})/i);
        if (hm && _hasMinLen(hm[2])) {
            console.log(`[CRM] Step: Found in hash: ${hm[2]}`);
            return hm[2];
        }
        // Path digits: /1234567890 or /1234567890@s.whatsapp.net
        const pm = (u.pathname || '').match(/(\d{6,})(?=@|$)/);
        if (pm && _hasMinLen(pm[1])) {
            console.log(`[CRM] Step: Found in pathname: ${pm[1]}`);
            return pm[1];
        }
    } catch (e) {
        console.log('[CRM] Step: Error in URL extraction:', e);
    }
    console.log('[CRM] Step: No number found in URL');
    return null;
}

/**
 * 6) Fallback: read from the selected row in the left chat list
 */
function _extractFromLeftPaneSelected() {
    console.log('[CRM] Step: Trying _extractFromLeftPaneSelected');
    const cands = Array.from(document.querySelectorAll(
        '[data-testid="cell-frame-container"][aria-selected="true"], [role="grid"] [aria-selected="true"], [aria-selected="true"]'
    )).filter(_isVisible);
    if (!cands.length) {
        console.log('[CRM] Step: No selected candidates in left pane');
        return null;
    }
    // prefer the one most visible on screen (largest visible area)
    const best = cands
        .map(el => {
            const r = el.getBoundingClientRect();
            const w = Math.max(0, Math.min(window.innerWidth, r.right) - Math.max(0, r.left));
            const h = Math.max(0, Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top));
            return { el, area: w * h };
        })
        .sort((a, b) => b.area - a.area)[0]?.el;
    const selected = best || cands[0];
    // data-* first (skip LID)
    for (const attr of ['data-id', 'data-jid', 'data-chatid', 'data-conversation-id']) {
        const raw = selected.getAttribute?.(attr);
        if (!raw) continue;
        if (/@lid_/i.test(raw)) continue;
        const m = raw.match(/(?:^|_)(\d{6,})(?=@(?:c\.us|s\.whatsapp\.net)|$)/);
        if (m && _hasMinLen(m[1])) {
            console.log(`[CRM] Step: Found in left pane ${attr}: ${m[1]}`);
            return m[1];
        }
    }
    // then visible text/title
    const titleEl =
        selected.querySelector('[data-testid="cell-frame-title"] [title]') ||
        selected.querySelector('[title]');
    const txt = (titleEl?.getAttribute?.('title') || titleEl?.innerText || selected.innerText || '').trim();
    const rx = /(\+?\d[\d\s\-().]{6,})/g;
    let bestDigits = null, m;
    while ((m = rx.exec(txt))) {
        const d = _onlyDigits(m[1]);
        if (_hasMinLen(d) && (!bestDigits || d.length > bestDigits.length)) bestDigits = d;
    }
    if (bestDigits) {
        console.log(`[CRM] Step: Found in left pane text: ${bestDigits}`);
    } else {
        console.log('[CRM] Step: No number found in left pane text');
    }
    return bestDigits;
}

/**
 * 7) Last resort: briefly open Contact Info drawer, read number, close
 */
async function _extractFromInfoDrawer({ aggressive = false } = {}) {
    console.log(`[CRM] Step: Trying _extractFromInfoDrawer (aggressive: ${aggressive})`);
    let drawer =
        document.querySelector('[data-testid="conversation-info-drawer"]') ||
        document.querySelector('[data-testid="contact-info"]') ||
        document.querySelector('div[role="dialog"][data-animate-modal="true"]') ||
        document.querySelector('aside[aria-label], [role="region"][aria-label]');
    let openedHere = false;
    if (!drawer) {
        console.log('[CRM] Step: No drawer found, attempting to open');
        const headerClickable =
            document.querySelector('#main header [role="button"]') ||
            document.querySelector('#main header') ||
            document.querySelector('[data-testid="conversation-header"]');
        if (!headerClickable) {
            console.log('[CRM] Step: No header clickable to open drawer');
            return null;
        }
        headerClickable.click();
        openedHere = true;
        const spins = aggressive ? 40 : 20;
        for (let i = 0; i < spins; i++) {
            await _sleep(75);
            drawer =
                document.querySelector('[data-testid="conversation-info-drawer"]') ||
                document.querySelector('[data-testid="contact-info"]') ||
                document.querySelector('div[role="dialog"][data-animate-modal="true"]') ||
                document.querySelector('aside[aria-label], [role="region"][aria-label]');
            if (drawer && _isVisible(drawer)) {
                console.log('[CRM] Step: Drawer opened and visible');
                break;
            }
        }
    }
    if (!drawer || !_isVisible(drawer)) {
        console.log('[CRM] Step: Drawer not visible after attempts');
        return null;
    }
    // quick tel: path
    const telDeadline = Date.now() + (aggressive ? 6000 : 2000);
    while (Date.now() < telDeadline) {
        const tel = drawer.querySelector('a[href^="tel:"]');
        if (tel) {
            const n = _onlyDigits(tel.getAttribute('href'));
            if (_hasMinLen(n)) {
                console.log(`[CRM] Step: Found in drawer tel link: ${n}`);
                if (openedHere) {
                    console.log('[CRM] Step: Closing drawer (opened here)');
                    (document.querySelector('button[aria-label="Close"]') ||
                        document.querySelector('[data-testid="x-view"]') ||
                        document.querySelector('button[aria-label="Back"]'))?.click();
                }
                return n;
            }
        }
        await _sleep(150);
    }
    console.log('[CRM] Step: No tel link found in drawer');
    // Enhanced: Target specifically the "About and phone number" section as per provided HTML
    const aboutSection = drawer.querySelector('.x13mwh8y.x1q3qbx4.x1wg5k15.x3psx0u.xat24cr.x1280gxy.x106a9eq.x1xnnf8n.x889kno.x18d9i69');
    if (aboutSection) {
        console.log('[CRM] Step: Found "About and phone number" section');
        // Look for the phone in the ._ajxt div's copyable-text
        const phoneEl = aboutSection.querySelector('._ajxt .copyable-text');
        if (phoneEl) {
            const txt = (phoneEl.innerText || phoneEl.textContent || '').trim();
            const rx = /(\+?\d[\d\s\-().]{6,})/g;
            let m, best = null;
            while ((m = rx.exec(txt))) {
                const d = _onlyDigits(m[1]);
                if (_hasMinLen(d) && (!best || d.length > best.length)) best = d;
            }
            if (best) {
                console.log(`[CRM] Step: Found targeted phone in about section: ${best}`);
                if (openedHere) {
                    console.log('[CRM] Step: Closing drawer (opened here)');
                    (document.querySelector('button[aria-label="Close"]') ||
                        document.querySelector('[data-testid="x-view"]') ||
                        document.querySelector('button[aria-label="Back"]'))?.click();
                }
                return best;
            }
        }
        console.log('[CRM] Step: No copyable-text phone in about section');
    } else {
        console.log('[CRM] Step: No "About and phone number" section found');
    }
    // Fallback anchor on the visible "About and phone number" block
    const anchor = Array.from(drawer.querySelectorAll('span, div, h2, h3, [title]'))
        .filter(_isVisible)
        .find(el => /about.*phone/i.test((el.innerText || el.textContent || '').toLowerCase()) ||
            /phone number/i.test((el.innerText || el.textContent || '').toLowerCase()));
    const scope =
        (anchor && _isVisible(anchor) && anchor.closest('[tabindex], [role="region"], section, div')) || drawer;
    console.log('[CRM] Step: Using fallback scope for text scan');
    // text scan in scope
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const rx = /(\+?880[\s\-()]*\d[\d\s\-()]{7,}|(?:\+?0?1[\d\s\-()]{8,})|(\+?\d[\d\s\-().]{8,}))/g;
    let node, best = null;
    while ((node = walker.nextNode())) {
        if (!node.parentElement || !_isVisible(node.parentElement)) continue;
        const t = node.nodeValue?.trim();
        if (!t) continue;
        let m;
        while ((m = rx.exec(t))) {
            const d = _onlyDigits(m[0]);
            if (_hasMinLen(d)) {
                const score =
                    (d.startsWith('880') ? 3 : 0) +
                    (d.startsWith('01') ? 2 : 0) +
                    Math.min(d.length, 16) / 16;
                if (!best || score > best.score) best = { val: d, score };
            }
        }
    }
    if (openedHere) {
        console.log('[CRM] Step: Closing drawer (opened here)');
        (document.querySelector('button[aria-label="Close"]') ||
            document.querySelector('[data-testid="x-view"]') ||
            document.querySelector('button[aria-label="Back"]'))?.click();
    }
    if (best?.val) {
        console.log(`[CRM] Step: Found in drawer text scan: ${best.val}`);
        return best.val;
    } else {
        console.log('[CRM] Step: No number found in drawer text scan');
        return null;
    }
}

/**
 * 8) Direct scan of drawer rows where WhatsApp renders copyable phone text
 */
function _extractFromDrawerCopyableSpan() {
    console.log('[CRM] Step: Trying _extractFromDrawerCopyableSpan');
    // Prefer a drawer root; fall back to document (still filtered by visibility)
    const roots = [
        document.querySelector('[data-testid="conversation-info-drawer"]'),
        document.querySelector('[data-testid="contact-info"]'),
        document.querySelector('div[role="dialog"][data-animate-modal="true"]'),
        document.querySelector('aside[aria-label], [role="region"][aria-label]')
    ].filter(Boolean);
    const drawer = roots.find(_isVisible) || document;
    // Enhanced: Target specifically under "About and phone number" section first
    const aboutSection = drawer.querySelector('.x13mwh8y.x1q3qbx4.x1wg5k15.x3psx0u.xat24cr.x1280gxy.x106a9eq.x1xnnf8n.x889kno.x18d9i69');
    let candidates = [];
    if (aboutSection) {
        console.log('[CRM] Step: Found "About and phone number" section for copyable scan');
        candidates = Array.from(aboutSection.querySelectorAll(
            '._ajxu .copyable-text, ._ajxt .copyable-text, .copyable-text.selectable-text'
        )).filter(_isVisible);
    }
    if (!candidates.length) {
        console.log('[CRM] Step: Falling back to general copyable-text scan');
        candidates = Array.from(drawer.querySelectorAll(
            '._ajxu .copyable-text, ._ajxt .copyable-text, .copyable-text.selectable-text'
        )).filter(_isVisible);
    }
    // Prefer BD/E.164-like: +880..., 880..., 01...
    const rx = /(\+?880[\s\-()]*\d[\d\s\-()]{7,}|(?:\+?0?1[\d\s\-()]{8,})|(\+?\d[\d\s\-().]{8,}))/;
    for (const el of candidates) {
        const t = (el.innerText || el.textContent || '').trim();
        if (!t) continue;
        const m = t.match(rx);
        if (m) {
            const d = _onlyDigits(m[0]);
            if (_hasMinLen(d)) {
                console.log(`[CRM] Step: Found in copyable span: ${d}`);
                return d;
            }
        }
    }
    console.log('[CRM] Step: No number found in copyable spans');
    return null;
}

// === MAIN EXTRACTION AGGREGATOR ===

const DBG = true; // set to true to log paths

/**
 * Main phone number extractor - aggregates all strategies with smart fallbacks
 * @returns {Promise<string|null>} Extracted phone number (digits only) or null
 */
async function extractPhoneNumber() {
    console.log('[CRM] Starting phone extraction');
    // Prioritize left pane and non-drawer sources first
    let n =
        _extractFromLeftPaneSelected() ||
        _extractFromDataAttrs() ||
        _extractFromHeaderTel() ||
        _extractFromHeaderAria() ||
        _extractFromUrl();
    if (_hasMinLen(n)) {
        console.log(`[CRM] Extraction complete (non-drawer): ${n}`);
        return _onlyDigits(n);
    }
    // If no contact found in left pane or quick sources, fall back to drawer/sidebar
    console.log('[CRM] No quick/left pane number found, falling back to drawer');
    // If this is a LID (business) chat, don't trust data-* numbers — open the drawer early.
    if (_hasLidContext()) {
        // Quick wins first (sometimes header shows the phone)
        n =
            _extractFromHeaderTel() ||
            _extractFromHeaderAria() ||
            _extractFromUrl() ||
            _extractFromLeftPaneSelected();
        if (DBG) console.debug('[CRM] extracted via <PATH>', n);
        if (_hasMinLen(n)) {
            console.log(`[CRM] Extraction complete (LID quick): ${n}`);
            return _onlyDigits(n);
        }
        // Aggressive info-drawer scrape (longer waits for business profile)
        n = await _extractFromInfoDrawer({ aggressive: true });
        if (DBG) console.debug('[CRM] extracted via <PATH>', n);
        // Some builds only render the phone as plain text copyable row
        if (!_hasMinLen(n)) {
            n = _extractFromDrawerCopyableSpan();
        }
        if (_hasMinLen(n)) {
            console.log(`[CRM] Extraction complete (LID drawer): ${n}`);
            return _onlyDigits(n);
        }
        // As a last resort, try URL/left pane again
        n = _extractFromUrl() || _extractFromLeftPaneSelected();
        if (_hasMinLen(n)) {
            console.log(`[CRM] Extraction complete (LID last resort): ${n}`);
            return _onlyDigits(n);
        }
        console.log('[CRM] Extraction failed (LID)');
        return null;
    }
    // Non-LID path (regular personal accounts)
    n =
        _extractFromDataAttrs() ||
        _extractFromHeaderTel() ||
        _extractFromHeaderAria() ||
        _extractFromUrl() ||
        _extractFromLeftPaneSelected();
    if (_hasMinLen(n)) {
        console.log(`[CRM] Extraction complete (non-LID quick): ${n}`);
        return _onlyDigits(n);
    }
    // Let DOM settle a bit more
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        n =
            _extractFromDataAttrs() ||
            _extractFromHeaderTel() ||
            _extractFromHeaderAria() ||
            _extractFromUrl() ||
            _extractFromLeftPaneSelected();
        if (_hasMinLen(n)) {
            console.log(`[CRM] Extraction complete (settle loop): ${n}`);
            return _onlyDigits(n);
        }
        await _sleep(150);
    }
    // Final fallback to drawer, avoiding header text to prevent conversation number pickup
    console.log('[CRM] Settle failed, using final drawer fallback');
    n = await _extractFromInfoDrawer();
    if (!_hasMinLen(n)) {
        n = _extractFromDrawerCopyableSpan();
    }
    if (_hasMinLen(n)) {
        console.log(`[CRM] Extraction complete (final drawer): ${n}`);
        return _onlyDigits(n);
    }
    console.log('[CRM] Extraction failed completely');
    return null;
}
