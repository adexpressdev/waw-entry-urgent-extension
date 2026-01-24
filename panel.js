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

    // --- FUNCTIONS ---
    function getFormattedTimestamp() {
        const now = new Date();
        const pad = (num) => num.toString().padStart(2, '0');
        const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
        const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        return `${date} ${time}`;
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
            }
        });
        detailsHTML += '</div>';
        dataContainer.innerHTML = detailsHTML;
        attachValidationListeners();
        footerContainer.style.display = 'block';
    }

    function showExistingRecordsViewer(data) {
        const recordsViewer = document.getElementById('records-viewer');
        const viewerContent = document.getElementById('viewer-content');
        
        let viewerHTML = '<div class="viewer-details">';
        sheetHeaders.forEach((header, index) => {
            if (data[index] && index !== 18 && index !== 19) { // Skip urgency columns
                viewerHTML += `<div class="viewer-item"><strong>${header}:</strong><span>${data[index]}</span></div>`;
            }
        });
        viewerHTML += '</div>';
        
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
        // --- NEW: Loop through all mandatory fields to validate them ---
        for (const index of mandatoryColumnIndices) {
            const input = document.getElementById(`field-${index}`);
            if (input && input.value.trim() === '') {
                const headerName = sheetHeaders[index] || 'a required field';
                alert(`Please fill out the "${headerName}" field.`);
                input.style.borderColor = 'tomato';
                input.focus();
                return; // Stop submission if a mandatory field is empty
            }
        }

        // Reset border colors for any mandatory fields that might have been highlighted
        mandatoryColumnIndices.forEach(index => {
            const input = document.getElementById(`field-${index}`);
            if (input) input.style.borderColor = '#3a3f42';
        });

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        if (document.querySelectorAll('.validation-wrapper[data-validated="false"]').length > 0) {
            alert('Please correct the entries that did not match.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit New Entry';
            return;
        }
        const newRowData = Array(sheetHeaders.length).fill('');
        sheetHeaders.forEach((_, index) => {
            if (CONFIG.VALIDATION_COLUMNS.includes(index)) {
                newRowData[index] = document.getElementById(`field-${index}-a`).value;
            } else {
                const input = document.getElementById(`field-${index}`);
                if (input) newRowData[index] = input.value;
                else if (currentData && currentData[index]) newRowData[index] = currentData[index];
            }
        });
        newRowData[CONFIG.AUTO_COLUMNS.STATUS] = '';
        newRowData[CONFIG.AUTO_COLUMNS.TIMESTAMP] = getFormattedTimestamp();
        const contactName = document.getElementById('field-3').value; // Get the name from Column D (index 3)
        newRowData[CONFIG.AUTO_COLUMNS.CONTACT_INFO] = `${contactName} ${currentPhoneNumber}`;
        newRowData[CONFIG.AUTO_COLUMNS.PHONE] = currentPhoneNumber; // Auto-populate phone column
        // If the urgency button was clicked, add the urgency data.
        if (isUrgent) {
            newRowData[CONFIG.AUTO_COLUMNS.URGENCY_FLAG] = "urgent";
            newRowData[CONFIG.AUTO_COLUMNS.URGENCY_NOTE] = document.getElementById('urgency-note').value;
        }
        // Replace the old try...catch block with this one
        try {
            // OLD: const action = currentRowIndex ? 'updateExistingEntry' : 'saveNewEntry';
            // NEW: Force the action to always save a new entry
            const action = 'saveNewEntry';

            const response = await chrome.runtime.sendMessage({ action: action, data: newRowData, rowIndex: currentRowIndex });
            if (response && response.success) {
                submitBtn.textContent = 'Success!';
                // --- NEW: Send data to create a Google Contact ---
                const contactName = document.getElementById('field-3').value; // Get name from Column D (index 3)
                const contactNumber = currentPhoneNumber; // This already holds the full number

                // Only proceed if a name was entered
                if (contactName.trim() && contactNumber) {
                    chrome.runtime.sendMessage({
                        action: 'createGoogleContact',
                        contact: {
                            name: contactName,
                            phone: contactNumber
                        }
                    });
                    // This is a "fire-and-forget" request, we don't need to wait for a response.
                }

                setTimeout(() => {
                    window.parent.postMessage({ action: 'hidePanel' }, '*');
                }, 1000);
            } else {
                throw new Error(response.message || 'Failed to save data.');
            }
        } catch (error) {
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
                if (response.exists) {
                    // Found existing records - show in viewer
                    currentData = response.data;
                    currentRowIndex = response.rowIndex;
                    statusDiv.textContent = `✔️ Found ${response.data.length > 0 ? 'existing' : ''} records for this contact.`;
                    statusDiv.classList.add('notification-success');
                    showExistingRecordsViewer(response.data);
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
    statusDiv.textContent = 'Enter a phone number and click Search.';
    statusDiv.style.display = 'block';
    dataContainer.style.display = 'none';
    footerContainer.style.display = 'none';

    // Auto-focus the phone search input
    phoneSearchInput.focus();

});