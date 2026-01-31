// --- formatters.js ---
// Reusable formatting functions for the WhatsApp CRM Extension

const FORMATTERS = {
    // English month names
    MONTHS: [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ],

    /**
     * Format timestamp from "DD/MM/YYYY HH:MM:SS" to "DD Month YYYY, HH:MM AM/PM"
     * @param {string} dateStr - Date string in format "22/11/2025 19:56:41"
     * @returns {string} Formatted date like "22 November 2025, 07:56 PM"
     */
    formatDateTime: function(dateStr) {
        if (!dateStr) return '';
        try {
            // Parse "DD/MM/YYYY HH:MM:SS" format
            const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (!parts) return dateStr; // Return original if parsing fails
            
            const day = parseInt(parts[1]);
            const month = parseInt(parts[2]) - 1; // 0-indexed
            const year = parseInt(parts[3]);
            let hour = parseInt(parts[4]);
            const minute = parts[5];
            
            // Convert to 12-hour format
            const ampm = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12 || 12;
            
            const monthName = this.MONTHS[month] || '';
            return `${day} ${monthName} ${year}, ${hour.toString().padStart(2, '0')}:${minute} ${ampm}`;
        } catch (e) {
            return dateStr; // Return original on error
        }
    },

    /**
     * Format date from "DD-MM-YYYY" or "DD/MM/YYYY" to "DD Month YYYY"
     * @param {string} dateStr - Date string in format "19-1-2026" or "19/1/2026"
     * @returns {string} Formatted date like "19 January 2026"
     */
    formatDate: function(dateStr) {
        if (!dateStr) return '';
        try {
            // Parse "DD-MM-YYYY" or "DD/MM/YYYY" format (with or without time)
            const parts = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
            if (!parts) return dateStr; // Return original if parsing fails
            
            const day = parseInt(parts[1]);
            const month = parseInt(parts[2]) - 1; // 0-indexed
            const year = parseInt(parts[3]);
            
            const monthName = this.MONTHS[month] || '';
            return `${day} ${monthName} ${year}`;
        } catch (e) {
            return dateStr; // Return original on error
        }
    },

    /**
     * Format money value with Bengali taka suffix
     * @param {string|number} value - The money value
     * @returns {string} Formatted value like "500 টাকা"
     */
    formatMoney: function(value) {
        if (!value) return '';
        return `${value} টাকা`;
    },

    /**
     * Normalize phone number to digits only
     * @param {string} phone - Phone number with possible formatting
     * @returns {string} Digits only
     */
    normalizePhone: function(phone) {
        if (!phone) return '';
        return phone.replace(/\D/g, '');
    },

    /**
     * Format phone number for display (add spaces for readability)
     * @param {string} phone - Phone number
     * @returns {string} Formatted phone like "01712 345678"
     */
    formatPhone: function(phone) {
        const digits = this.normalizePhone(phone);
        if (digits.length === 11 && digits.startsWith('0')) {
            return `${digits.slice(0, 5)} ${digits.slice(5)}`;
        }
        if (digits.length === 13 && digits.startsWith('880')) {
            return `+${digits.slice(0, 3)} ${digits.slice(3, 8)} ${digits.slice(8)}`;
        }
        return phone;
    },

    /**
     * Get current timestamp in DD/MM/YYYY HH:MM:SS format
     * @returns {string} Current timestamp
     */
    getCurrentTimestamp: function() {
        const now = new Date();
        const pad = (num) => num.toString().padStart(2, '0');
        const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        return `${date} ${time}`;
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.FORMATTERS = FORMATTERS;
}
