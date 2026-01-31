// ---panel.js (Manual Search Version)---

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const phoneSearchInput = document.getElementById('phone-search');
    const searchBtn = document.getElementById('search-btn');
    const statusDiv = document.getElementById('status');
    const dataContainer = document.getElementById('data-container');
    const footerContainer = document.getElementById('footer-container');
    const submitBtn = document.getElementById('submit-btn');
    const urgencyContainer = document.getElementById('urgency-container');

    // Use configuration from config.js
    const mandatoryColumnIndices = CONFIG.MANDATORY_COLUMN_INDICES;
    const defaultDropdownValues = CONFIG.DEFAULT_DROPDOWN_VALUES;
    const excludedColumns = CONFIG.EXCLUDED_COLUMNS;
    const dropdownOptions = CONFIG.DROPDOWN_OPTIONS;

    // --- DATA & STATE ---
    let sheetHeaders = [], currentPhoneNumber = null, currentData = null, currentRowIndex = null;
    let isUrgent = false;
    let headersLoaded = false;

    // Column indices for special formatting (0-indexed)
    const TIMESTAMP_COLUMNS = [1];    // Column B (Timestamp with time)
    const DATE_COLUMNS = [15];         // Column P (Last Modified - date only)
    const MONEY_COLUMNS = [7, 9];     // Column H (এডভান্স), Column J (টোটাল বাজেট)
    const FOUR_DIGIT_COLUMN = 16;     // Column Q (Last 4 digit / trans id)

    // --- TOAST NOTIFICATION ---
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // --- ENTER KEY NAVIGATION ---
    function attachEnterKeyNavigation() {
        const inputs = dataContainer.querySelectorAll('input, select');
        inputs.forEach((input, index) => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextInput = inputs[index + 1];
                    if (nextInput) {
                        nextInput.focus();
                        // If next field is a dropdown, open it
                        if (nextInput.tagName === 'SELECT') {
                            // Simulate click to open dropdown
                            nextInput.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                            // Alternative: use showPicker() if available (modern browsers)
                            if (typeof nextInput.showPicker === 'function') {
                                try { nextInput.showPicker(); } catch (e) { /* ignore */ }
                            }
                        }
                    } else {
                        // Last field - focus submit button
                        submitBtn.focus();
                    }
                }
            });
        });
    }

    // --- TRANSACTION ID FIELD (no restrictions) ---
    function attachTransactionIdField() {
        // Column Q accepts any value (4 digits, phone number, hex transaction ID, etc.)
        // No validation needed
    }

    function renderForm(data = []) {
        // Always show empty form for new entries
        statusDiv.textContent = 'Ready to submit new entry.';
        statusDiv.classList.remove('notification-success');
        statusDiv.style.display = 'block';
        statusDiv.style.color = '#aebac1';
        statusDiv.style.fontSize = '14px';
        urgencyContainer.style.display = 'none';
        
        dataContainer.style.display = 'block';
        let detailsHTML = `<div class="details-view">`;
        sheetHeaders.forEach((header, index) => {
            // Skip status column and excluded columns
            if (index >= 3 && !excludedColumns.includes(index)) {
                let itemHTML = '';
                if (CONFIG.VALIDATION_COLUMNS.includes(index)) {
                    itemHTML = `<div class="validation-wrapper"><input type="text" class="validate-a" id="field-${index}-a" placeholder="Enter ${header}"><input type="text" class="validate-b" id="field-${index}-b" placeholder="Enter again to confirm" style="display: none;"><span id="icon-${index}" class="validation-icon"></span></div>`;
                    // Replace the old block with this new one
                } else if (dropdownOptions.hasOwnProperty(index)) {
                    let selectHTML = `<select id="field-${index}">`;
                    const defaultValue = defaultDropdownValues[index]; // Get the default for this column, if any

                    // If no default is defined for this dropdown, add a disabled placeholder
                    if (!defaultValue) {
                        selectHTML += `<option value="" disabled selected>Select an option</option>`;
                    }

                    // Create an <option> for each choice
                    dropdownOptions[index].forEach(option => {
                        // Check if the current option should be selected by default
                        const isSelected = defaultValue === option;
                        selectHTML += `<option value="${option}" ${isSelected ? 'selected' : ''}>${option}</option>`;
                    });

                    itemHTML = selectHTML + `</select>`;
                } else {
                    itemHTML = `<input type="text" id="field-${index}" placeholder="Enter ${header}...">`;
                }
                // Find the line from step 2 and replace it with this block
                let headerHTML = `<strong>${header}</strong>`;
                // Check if the current index is in our mandatory list
                if (mandatoryColumnIndices.includes(index)) {
                    headerHTML += ' <small class="mandatory-indicator">Mandatory</small>';
                }
                detailsHTML += `<div class="detail-item" data-column-index="${index}">${headerHTML}${itemHTML}</div>`;
                
                // Add custom phone number field after শর্ট নাম (index 3)
                if (index === 3) {
                    detailsHTML += `<div class="detail-item" data-column-index="phone-number">`;
                    detailsHTML += `<strong>ফোন নাম্বার</strong> <small class="mandatory-indicator">Mandatory</small>`;
                    detailsHTML += `<input type="text" id="${CONFIG.PHONE_NUMBER_FIELD_ID}" placeholder="Enter phone number...">`;
                    detailsHTML += `</div>`;
                }
            }
        });
        detailsHTML += '</div>';
        dataContainer.innerHTML = detailsHTML;
        attachValidationListeners();
        attachEnterKeyNavigation();
        attachTransactionIdField();
        footerContainer.style.display = 'block';
    }

    function showExistingRecordsViewer(records, searchedPhone) {
        const recordsViewer = document.getElementById('records-viewer');
        const viewerContent = document.getElementById('viewer-content');
        
        console.log('[Panel] Displaying', records.length, 'records in viewer');
        
        let viewerHTML = '';
        records.forEach((record, recordIndex) => {
            const data = record.data;
            const rowIndex = record.rowIndex;
            
            console.log(`[Panel] Record ${recordIndex + 1} (Row ${rowIndex}):`, data);
            
            viewerHTML += `<div class="record-card">`;
            viewerHTML += `<div class="record-header">📋 Record ${recordIndex + 1} <small>(Row ${rowIndex})</small></div>`;
            viewerHTML += '<div class="viewer-details">';
            sheetHeaders.forEach((header, index) => {
                if (data[index] && index !== 18 && index !== 19) { // Skip urgency columns
                    let displayValue = data[index];
                    
                    // Format timestamp columns (with time)
                    if (TIMESTAMP_COLUMNS.includes(index)) {
                        displayValue = FORMATTERS.formatDateTime(displayValue);
                    }
                    // Format date columns (date only, no time)
                    else if (DATE_COLUMNS.includes(index)) {
                        displayValue = FORMATTERS.formatDate(displayValue);
                    }
                    // Format money columns with Bengali taka
                    else if (MONEY_COLUMNS.includes(index)) {
                        displayValue = FORMATTERS.formatMoney(displayValue);
                    }
                    
                    viewerHTML += `<div class="viewer-item"><strong>${header}:</strong><span>${displayValue}</span></div>`;
                }
            });
            viewerHTML += '</div></div>';
        });
        
        viewerContent.innerHTML = viewerHTML;
        recordsViewer.style.display = 'block';
        dataContainer.style.display = 'none';
        footerContainer.style.display = 'none';
    }

    function attachValidationListeners() {
        document.querySelectorAll('.validate-a').forEach(firstInput => {
            firstInput.addEventListener('blur', (e) => {
                if (!e.target.value) return;
                const wrapper = e.target.closest('.validation-wrapper');
                const secondInput = wrapper.querySelector('.validate-b');
                e.target.style.display = 'none';
                secondInput.style.display = 'block';
                secondInput.focus();
                wrapper.dataset.firstValue = e.target.value;
            });
        });
        document.querySelectorAll('.validate-b').forEach(secondInput => {
            secondInput.addEventListener('blur', (e) => {
                const wrapper = e.target.closest('.validation-wrapper');
                const firstInput = wrapper.querySelector('.validate-a');
                const icon = wrapper.querySelector('.validation-icon');
                if (e.target.value === wrapper.dataset.firstValue) {
                    icon.innerHTML = '✔️'; icon.style.color = 'lightgreen';
                    wrapper.dataset.validated = 'true'; e.target.style.borderColor = 'lightgreen';
                } else {
                    icon.innerHTML = '❌'; icon.style.color = 'tomato';
                    wrapper.dataset.validated = 'false';
                    firstInput.style.display = 'block'; e.target.style.display = 'none';
                    firstInput.value = ''; e.target.value = '';
                    alert('Entries did not match. Please try again.');
                    firstInput.focus();
                }
            });
        });
    }


    async function handleFollowUpSubmit() {
        // This function only runs if a match was found and a phone number is present.
        if (!currentRowIndex || !currentPhoneNumber) {
            alert("Cannot create a follow-up for a contact that doesn't exist yet.");
            return;
        }

        const followUpBtn = document.getElementById('urgency-btn'); // The button ID is still the same
        followUpBtn.disabled = true;
        followUpBtn.textContent = 'Adding...';

        const followUpNote = document.getElementById('urgency-note').value;

        try {
            // Send a new, specific action to the background script
            const response = await chrome.runtime.sendMessage({
                action: 'saveFollowUp',
                followUp: {
                    phone: currentPhoneNumber,
                    note: followUpNote
                }
            });

            if (response && response.success) {
                followUpBtn.textContent = 'Added!';
                followUpBtn.style.backgroundColor = '#5cb85c'; // Green for success

                setTimeout(() => {
                    window.parent.postMessage({ action: 'hidePanel' }, '*');
                }, 1000);

            } else {
                throw new Error(response.message || 'Failed to save follow-up.');
            }
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.classList.remove('notification-success');
            followUpBtn.disabled = false;
            followUpBtn.textContent = 'Add to Follow-up';
        }
    }


    async function handleSubmit() {
        // --- Validate mandatory fields ---
        for (const index of mandatoryColumnIndices) {
            const input = document.getElementById(`field-${index}`);
            if (input && input.value.trim() === '') {
                const headerName = sheetHeaders[index] || 'a required field';
                showToast(`Please fill out "${headerName}"`, 'error');
                input.style.borderColor = 'tomato';
                input.focus();
                return;
            }
        }
        
        // Validate custom phone number field
        const phoneNumberInput = document.getElementById(CONFIG.PHONE_NUMBER_FIELD_ID);
        if (!phoneNumberInput || phoneNumberInput.value.trim() === '') {
            showToast('Please fill out "ফোন নাম্বার"', 'error');
            if (phoneNumberInput) {
                phoneNumberInput.style.borderColor = 'tomato';
                phoneNumberInput.focus();
            }
            return;
        }

        // Reset border colors
        mandatoryColumnIndices.forEach(index => {
            const input = document.getElementById(`field-${index}`);
            if (input) input.style.borderColor = '#3a3f42';
        });
        if (phoneNumberInput) phoneNumberInput.style.borderColor = '#3a3f42';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        if (document.querySelectorAll('.validation-wrapper[data-validated="false"]').length > 0) {
            showToast('Please correct the entries that did not match', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit New Entry';
            return;
        }
        const newRowData = Array(sheetHeaders.length).fill('');
        console.log('[Panel] Building new row data. Headers count:', sheetHeaders.length);
        
        sheetHeaders.forEach((_, index) => {
            if (CONFIG.VALIDATION_COLUMNS.includes(index)) {
                const validationInput = document.getElementById(`field-${index}-a`);
                newRowData[index] = validationInput ? validationInput.value : '';
            } else {
                const input = document.getElementById(`field-${index}`);
                if (input) newRowData[index] = input.value;
                else if (currentData && currentData[index]) newRowData[index] = currentData[index];
            }
        });
        
        newRowData[CONFIG.AUTO_COLUMNS.STATUS] = '';
        newRowData[CONFIG.AUTO_COLUMNS.TIMESTAMP] = FORMATTERS.getCurrentTimestamp();
        const contactName = document.getElementById('field-3') ? document.getElementById('field-3').value : '';
        const phoneNumberFromField = phoneNumberInput.value.trim();
        newRowData[CONFIG.AUTO_COLUMNS.CONTACT_INFO] = `${contactName}   ${phoneNumberFromField}`;
        // Column N (PHONE) is left empty - handled by post API call
        
        console.log('[Panel] Auto-populated columns:');
        console.log('  - STATUS (col', CONFIG.AUTO_COLUMNS.STATUS, '):', newRowData[CONFIG.AUTO_COLUMNS.STATUS]);
        console.log('  - TIMESTAMP (col', CONFIG.AUTO_COLUMNS.TIMESTAMP, '):', newRowData[CONFIG.AUTO_COLUMNS.TIMESTAMP]);
        console.log('  - CONTACT_INFO (col', CONFIG.AUTO_COLUMNS.CONTACT_INFO, '):', newRowData[CONFIG.AUTO_COLUMNS.CONTACT_INFO]);
        
        // If the urgency button was clicked, add the urgency data.
        if (isUrgent) {
            newRowData[CONFIG.AUTO_COLUMNS.URGENCY_FLAG] = "urgent";
            newRowData[CONFIG.AUTO_COLUMNS.URGENCY_NOTE] = document.getElementById('urgency-note').value;
        }
        
        console.log('[Panel] Full row data to submit:', newRowData);
        console.log('[Panel] Row data length:', newRowData.length);
        
        // Replace the old try...catch block with this one
        try {
            // Force the action to always save a new entry
            const action = 'saveNewEntry';

            const response = await chrome.runtime.sendMessage({ action: action, data: newRowData, rowIndex: currentRowIndex });
            if (response && response.success) {
                submitBtn.textContent = 'Success!';
                submitBtn.style.backgroundColor = '#00a884';
                
                const rowInfo = response.insertedRow ? ` at row ${response.insertedRow}` : '';
                showToast(`✔️ Entry saved successfully${rowInfo}!`, 'success');
                
                // --- Send data to create a Google Contact ---
                const contactName = document.getElementById('field-3') ? document.getElementById('field-3').value : '';
                const contactNumber = currentPhoneNumber;

                if (contactName.trim() && contactNumber) {
                    chrome.runtime.sendMessage({
                        action: 'createGoogleContact',
                        contact: {
                            name: contactName,
                            phone: contactNumber
                        }
                    });
                }

                setTimeout(() => {
                    window.parent.postMessage({ action: 'hidePanel' }, '*');
                }, 1500);
            } else {
                throw new Error(response.message || 'Failed to save data.');
            }
        } catch (error) {
            showToast(`❌ Error: ${error.message}`, 'error');
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.classList.remove('notification-success');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit New Entry';
        }
    }


    // --- SEARCH FUNCTIONALITY ---
    function searchPhoneNumber() {
        const rawPhone = phoneSearchInput.value.trim();
        if (!rawPhone) {
            statusDiv.textContent = 'Please enter a phone number.';
            statusDiv.classList.remove('notification-success');
            statusDiv.style.display = 'block';
            return;
        }

        // Normalize: keep only digits
        const phone = rawPhone.replace(/\D/g, '');
        if (phone.length < 6) {
            statusDiv.textContent = 'Please enter a valid phone number (at least 6 digits).';
            statusDiv.classList.remove('notification-success');
            statusDiv.style.display = 'block';
            return;
        }

        currentPhoneNumber = phone;
        phoneSearchInput.value = phone; // Show normalized number

        // Reset state
        currentData = null;
        currentRowIndex = null;
        dataContainer.style.display = 'none';
        footerContainer.style.display = 'none';
        urgencyContainer.style.display = 'none';

        statusDiv.textContent = 'Searching...';
        statusDiv.classList.remove('notification-success');
        statusDiv.style.display = 'block';
        searchBtn.disabled = true;
        searchBtn.textContent = '⏳ Searching...';

        if (!headersLoaded) {
            // Load headers first, then search
            chrome.runtime.sendMessage({ action: 'getHeadersRequest' }, (headerResponse) => {
                if (headerResponse && headerResponse.success) {
                    sheetHeaders = headerResponse.data;
                    headersLoaded = true;
                    performSearch(phone);
                } else {
                    statusDiv.textContent = `Error loading headers: ${headerResponse.message || 'Unknown error'}`;
                    searchBtn.disabled = false;
                    searchBtn.textContent = '🔍 Search';
                }
            });
        } else {
            performSearch(phone);
        }
    }

    function performSearch(phone) {
        console.log("[Panel] Searching for phone:", phone);
        chrome.runtime.sendMessage({ action: 'fetchContactData', phone: phone }, (response) => {
            console.log("[Panel] Search response:", response);
            searchBtn.disabled = false;
            searchBtn.textContent = '🔍 Search';

            if (response && response.success) {
                if (response.exists && response.records && response.records.length > 0) {
                    // Found existing records - show in viewer
                    console.log(`[Panel] Found ${response.count} matching record(s)`);
                    
                    // Store first record as current (for follow-up functionality)
                    currentData = response.records[0].data;
                    currentRowIndex = response.records[0].rowIndex;
                    
                    const recordWord = response.count === 1 ? 'record' : 'records';
                    statusDiv.textContent = `✔️ Found ${response.count} existing ${recordWord} for ${phone}.`;
                    statusDiv.classList.add('notification-success');
                    showExistingRecordsViewer(response.records, phone);
                    urgencyContainer.style.display = 'flex'; // Show urgent button for existing records
                } else {
                    // No existing records - show empty form
                    currentData = null;
                    currentRowIndex = null;
                    statusDiv.textContent = 'No previous entry found. Ready to submit new.';
                    statusDiv.classList.remove('notification-success');
                    renderForm();
                }
            } else {
                statusDiv.textContent = `Error: ${response.message || 'Failed to search'}`;
            }
        });
    }

    // --- EVENT LISTENERS ---
    searchBtn.addEventListener('click', searchPhoneNumber);

    // Allow Enter key to trigger search
    phoneSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchPhoneNumber();
        }
    });

    submitBtn.addEventListener('click', handleSubmit);

    const urgencyBtn = document.getElementById('urgency-btn');
    if (urgencyBtn) {
        urgencyBtn.addEventListener('click', handleFollowUpSubmit);
    }

    // Close viewer and show new entry form
    const closeViewerBtn = document.getElementById('close-viewer-btn');
    if (closeViewerBtn) {
        closeViewerBtn.addEventListener('click', () => {
            document.getElementById('records-viewer').style.display = 'none';
            urgencyContainer.style.display = 'none';
            statusDiv.textContent = 'Ready to submit new entry.';
            statusDiv.classList.remove('notification-success');
            renderForm();
        });
    }

    // --- INITIAL STATE ---
    statusDiv.textContent = 'Enter a phone number to search, or fill the form to create new entry.';
    statusDiv.style.display = 'block';

    // Load headers and show entry form on initial view
    chrome.runtime.sendMessage({ action: 'getHeadersRequest' }, (headerResponse) => {
        if (headerResponse && headerResponse.success) {
            sheetHeaders = headerResponse.data;
            headersLoaded = true;
            renderForm(); // Show the form on initial load
        } else {
            statusDiv.textContent = `Error loading headers: ${headerResponse.message || 'Unknown error'}`;
            dataContainer.style.display = 'none';
            footerContainer.style.display = 'none';
        }
    });

    // Auto-focus the phone search input
    phoneSearchInput.focus();

});