/**
 * @file Handles all aspects of file processing: uploading, parsing Excel data,
 * managing the column mapping flow, and kicking off data validation.
 */

import { 
    state, 
    setBaselineData, setUpdateData, setCurrentData, setColumnMapping, 
    setValidationErrors, setCurrentValidationData, setCurrentFileData, 
    setCurrentFileHeaders, setCurrentFileType 
} from '../main.js';
import { buildHierarchy, renderChart } from './chartRenderer.js';
import { updateSearchVisibility } from './uiManager.js';
import { validateRelations } from './validation.js';
import { isBlankOrEmpty } from '../utils/helpers.js';

console.log('[OrgChart] fileHandler loaded');

/* ===========================================
   FILE UPLOAD HANDLING
=========================================== */

/**
 * Handles the 'change' event for file input elements.
 * Reads the selected Excel file, parses it into JSON, and initiates the column mapping dialog.
 * @param {Event} event - The file input change event.
 */
export function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    console.log('[FileHandler] Processing file:', file.name);
    const isBaseline = event.target.id === 'baselineFile';
    const statusEl = document.getElementById(isBaseline ? 'baselineStatus' : 'updateStatus');
    statusEl.textContent = `Reading ${file.name}...`;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""});
            
            const headers = jsonData[0];
            const rows = jsonData.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, i) => {
                    obj[header] = row[i];
                });
                return obj;
            });

            // Store file data in central state
            setCurrentFileData(rows);
            setCurrentFileHeaders(headers);
            setCurrentFileType(isBaseline ? 'baseline' : 'update');
            
            // Show column mapping dialog
            showColumnMappingDialog(headers);
            
        } catch (error) {
            console.error('Error processing file:', error);
            alert('There was an error processing the file. Please ensure it is a valid Excel file.');
            statusEl.textContent = 'Error processing file';
        }
    };
    reader.readAsArrayBuffer(file);
}

/* ===========================================
   COLUMN MAPPING DIALOG
=========================================== */

/**
 * Displays the column mapping modal and populates its dropdowns with headers from the uploaded file.
 * @param {Array<string>} headers - The column headers from the Excel file.
 */
export function showColumnMappingDialog(headers) {
    console.log('[FileHandler] Showing column mapping dialog');
    const modal = document.getElementById('columnMappingModal');
    
    // Populate dropdowns with headers
    const dropdowns = ['employeeNameMapping', 'managerMapping', 'jobTitleMapping', 'fteMapping', 'locationMapping', 'jobFamilyMapping', 'managementLevelMapping'];
    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        dropdown.innerHTML = '<option value="">Select column...</option>';
        headers.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            dropdown.appendChild(option);
        });
    });

    // Auto-detect mappings
    autoDetectMappings(headers);
    // Also auto-detect a stable employeeId (no dropdown exists yet)
    try {
        const idKeywords = ['id', 'employee id', 'worker', 'worker id', 'person id', 'employee number', 'emp id'];
        const headersLower = headers.map(h => (h || '').toString().toLowerCase());
        let bestIdHeader = null;
        let bestScore = 0;
        headers.forEach((header, i) => {
            const hl = headersLower[i];
            idKeywords.forEach(k => {
                if (hl.includes(k)) {
                    const s = k.length / Math.max(hl.length, 1);
                    if (s > bestScore) { bestScore = s; bestIdHeader = header; }
                }
            });
        });
        if (bestIdHeader) {
            setColumnMapping({ ...state.columnMapping, employeeId: bestIdHeader });
        }
    } catch(e) { console.warn('ID auto-detect failed', e); }
    
    // Show the modal
    modal.style.display = 'flex';
}

/**
 * Automatically detects and selects the most likely column mappings based on keyword matching.
 * @param {Array<string>} headers - The column headers from the Excel file.
 */
export function autoDetectMappings(headers) {
    const mappings = {
        employeeNameMapping: ['name', 'employee name', 'full name', 'worker name', 'employee', 'person', 'worker'],
        managerMapping: ['manager', 'manager name', 'supervisor', 'boss', 'reports to', 'manager id'],
        jobTitleMapping: ['title', 'job title', 'position', 'role', 'job', 'position title'],
        fteMapping: ['fte', 'full time equivalent', 'employment type', 'hours', 'workload'],
        locationMapping: ['location', 'office', 'site', 'city', 'country', 'workplace'],
        jobFamilyMapping: ['job family', 'department', 'function', 'team', 'division', 'group'],
        managementLevelMapping: ['level', 'management level', 'grade', 'band', 'tier', 'hierarchy level']
    };

    Object.keys(mappings).forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        const keywords = mappings[dropdownId];
        
        // Find best match
        let bestMatch = null;
        let bestScore = 0;
        
        headers.forEach(header => {
            const headerLower = header.toLowerCase();
            keywords.forEach(keyword => {
                if (headerLower.includes(keyword)) {
                    const score = keyword.length / headerLower.length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = header;
                    }
                }
            });
        });
        
        if (bestMatch) {
            dropdown.value = bestMatch;
            // Show detected info
            const detectedInfo = dropdown.parentElement.querySelector('.detected-info');
            if (detectedInfo) {
                detectedInfo.textContent = `Auto-detected: ${bestMatch}`;
            }
        }
    });
}

/**
 * Confirms the user's column mapping selections, validates the data,
 * and processes it into the application's data structures.
 */
export function confirmColumnMapping() {
    // Get mappings from dropdowns
    const mappings = {
        employeeName: document.getElementById('employeeNameMapping').value,
        manager: document.getElementById('managerMapping').value,
        jobTitle: document.getElementById('jobTitleMapping').value,
        fte: document.getElementById('fteMapping').value,
        location: document.getElementById('locationMapping').value,
        jobFamily: document.getElementById('jobFamilyMapping').value,
        managementLevel: document.getElementById('managementLevelMapping').value
    };
    
    // Prefer a detected stable employeeId if available
    if (state.columnMapping?.employeeId) {
        mappings.employeeId = state.columnMapping.employeeId;
    }

    // Validate required fields
    if (!mappings.employeeName || !mappings.manager) {
        alert('Employee Name and Manager are required fields.');
        return;
    }

    // Store mappings in central state
    setColumnMapping(mappings);
    
    // Validate data relationships
    const errors = validateRelations(state.currentFileData, mappings.employeeName, mappings.manager);
    
    if (errors.length > 0) {
        setValidationErrors(errors);
        setCurrentValidationData(state.currentFileData);
        showValidationErrors(errors);
        return;
    }

    // Process the data
    const transformedData = transformDataToOrgStructure(state.currentFileData);
    if (!transformedData?.length) {
        console.warn('[FileHandler] Transformed data is empty. Check column mapping (employeeId/employeeName).');
        alert('No rows could be read from this file with the selected columns. Please review the column mapping.');
        return;
    }
    
    if (state.currentFileType === 'baseline') {
        processBaselineData(transformedData);
    } else {
        processUpdateData(transformedData);
    }
    
    // Close modal
    document.getElementById('columnMappingModal').style.display = 'none';
}

/**
 * Handles the cancellation of the column mapping process.
 * Closes the modal and resets the file input fields.
 */
export function cancelColumnMapping() {
    document.getElementById('columnMappingModal').style.display = 'none';
    
    // Reset file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.value = '';
        const statusEl = document.getElementById(input.id.replace('File', 'Status'));
        if (statusEl) statusEl.textContent = '';
    });
}

/* ===========================================
   DATA VALIDATION
   Delegated to validation.js for clarity and reuse
=========================================== */

/**
 * Displays the validation error modal with a list of all detected errors.
 * @param {Array<Object>} errors - An array of error objects from `validateRelations`.
 */
export function showValidationErrors(errors) {
    const modal = document.getElementById('validationModal');
    const errorList = document.getElementById('errorList');
    const errorCount = document.getElementById('errorCount');
    
    if (!modal || !errorList || !errorCount) {
        console.error('Validation modal elements not found');
        return;
    }
    
    errorCount.textContent = errors.length;
    
    errorList.innerHTML = errors.map(error => `
        <li class="error-item">
            <div class="error-type">${escapeHtml(error.type)}</div>
            <div class="error-message">${escapeHtml(error.message)}</div>
            <div class="error-details">${escapeHtml(error.details)}</div>
        </li>
    `).join('');
    
    modal.style.display = 'flex';
}

/**
 * Helper function to escape HTML special characters
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ===========================================
   DATA TRANSFORMATION
=========================================== */

/**
 * Transforms the raw, row-based JSON data from the Excel file into the
 * structured format required by the rest of the application.
 * @param {Array<Object>} data - The raw data array from the parsed Excel file.
 * @returns {Array<Object>} The transformed data array.
 */
export function transformDataToOrgStructure(data) {
    if (!data?.length) return [];
    
    const cm = state.columnMapping || {};
    return data
        .map(row => {
            if (!row) return null;
            
            const idVal = row[cm.employeeId] ?? row[cm.employeeName];
            const nameVal = row[cm.employeeName] ?? idVal;
            
            // Skip if we don't have a valid identifier
            if (!idVal && !nameVal) return null;
            
            return {
                id: String(idVal || '').trim(),
                name: String(nameVal || '').trim(),
                managerId: String(row[cm.manager] ?? '').trim(),
                title: String(row[cm.jobTitle] ?? '').trim(),
                fte: String(row[cm.fte] ?? '').trim(),
                location: String(row[cm.location] ?? '').trim(),
                jobFamily: String(row[cm.jobFamily] ?? '').trim(),
                managementLevel: String(row[cm.managementLevel] ?? '').trim()
            };
        })
        .filter(Boolean) // Remove any null entries
        .filter(emp => emp.id || emp.name); // Ensure we have at least an ID or name
}

/**
 * Processes the transformed data as the baseline dataset.
 * @param {Array<Object>} data - The transformed baseline data.
 */
export function processBaselineData(data) {
    if (!data?.length) {
        console.warn('[FileHandler] No valid baseline data to process');
        return;
    }
    
    console.log('[FileHandler] Processing baseline data:', data.length, 'employees');
    
    // Update state
    setBaselineData([...data]);
    setCurrentData([...data]);
    
    // Update UI
    const statusEl = document.getElementById('baselineStatus');
    if (statusEl) {
        statusEl.textContent = `✓ ${data.length} employees loaded`;
        statusEl.classList.add('loaded');
    }
    
    // Enable continue button if it exists
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        continueBtn.classList.remove('disabled');
    }
}

/**
 * Processes the transformed data as the update dataset.
 * @param {Array<Object>} data - The transformed update data.
 */
export function processUpdateData(data) {
    if (!data?.length) {
        console.warn('[FileHandler] No valid update data to process');
        return;
    }
    
    console.log('[FileHandler] Processing update data:', data.length, 'employees');
    
    // Update state
    setUpdateData([...data]);
    
    // Update UI
    const statusEl = document.getElementById('updateStatus');
    if (statusEl) {
        statusEl.textContent = `✓ ${data.length} employees loaded`;
        statusEl.classList.add('loaded');
    }
    
    // Enable compare button if it exists
    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) {
        compareBtn.style.display = 'inline-block';
        compareBtn.removeAttribute('disabled');
    }
    
    // Enable continue button if it exists
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        continueBtn.classList.remove('disabled');
    }
}

/* ===========================================
   UTILITY FUNCTIONS
=========================================== */

/**
 * Displays a short-lived toast notification at the bottom of the screen.
 * @param {string} message - The message to display in the toast.
 */
export function showToast(message) {
    if (!message) return;
    
    // Remove any existing toasts
    document.querySelectorAll('.toast').forEach(el => el.remove());
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Trigger show animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    });
    
    // Auto-remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * Closes the validation error modal.
 */
export function closeValidationModal() {
    const modal = document.getElementById('validationModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Clear validation errors
    setValidationErrors([]);
    setCurrentValidationData(null);
    
    // Reset file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.value = '';
        const statusEl = document.getElementById(input.id.replace('File', 'Status'));
        if (statusEl) {
            statusEl.textContent = '';
            statusEl.className = 'file-status';
        }
    });
}

/**
 * Triggers a CSV download of the current validation errors.
 */
export function downloadValidationErrors() {
    if (!state.validationErrors?.length) {
        showToast('No validation errors to download');
        return;
    }
    
    try {
        const headers = ['Type', 'Message', 'Details'];
        const csvRows = [
            headers.join(','),
            ...state.validationErrors.map(err => 
                [
                    `"${(err.type || '').replace(/"/g, '""')}"`,
                    `"${(err.message || '').replace(/"/g, '""')}"`,
                    `"${(err.details || '').replace(/"/g, '""')}"`
                ].join(',')
            )
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `validation-errors-${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
    } catch (error) {
        console.error('Error downloading validation errors:', error);
        showToast('Error downloading validation errors');
    }
}

/* ===========================================
   MODULE INITIALIZATION
=========================================== */

/**
 * Initializes the file handler module.
 * Sets up event listeners for all file inputs and modal buttons.
 */
export function initFileHandler() {
    console.log('[FileHandler] Initializing file handler');
    
    // Set up file input event listeners
    const setupFileInput = (id) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', handleFileUpload);
        } else {
            console.warn(`[FileHandler] Could not find file input: ${id}`);
        }
    };
    
    setupFileInput('baselineFile');
    setupFileInput('updateFile');
    
    // Set up modal button handlers
    const setupButton = (id, handler) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', handler);
        } else {
            console.warn(`[FileHandler] Could not find button: ${id}`);
        }
    };
    
    setupButton('confirmMappingBtn', confirmColumnMapping);
    setupButton('cancelMappingBtn', cancelColumnMapping);
    setupButton('closeValidationBtn', closeValidationModal);
    setupButton('downloadErrorsBtn', downloadValidationErrors);
    
    // Make functions globally available for HTML onclick handlers
    window.confirmColumnMapping = confirmColumnMapping;
    window.cancelColumnMapping = cancelColumnMapping;
    window.closeValidationModal = closeValidationModal;
    window.downloadValidationErrors = downloadValidationErrors;
    
    console.log('[FileHandler] File handler initialized');
}
