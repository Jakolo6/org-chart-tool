/**
 * @file Manages all UI interactions, including modals, panels, search, tooltips, and event listeners.
 */

import { 
    state,
    setChangelogOpen, setSidebarMinimized,
    CONFIG
} from '../main.js';
import { handleFileUpload } from './fileHandler.js';
import { buildHierarchy, renderChart, calculateLayout } from './chartRenderer.js';

console.log('[OrgChart] uiManager loaded');

/* ===========================================
   EVENT LISTENERS SETUP
=========================================== */

/**
 * Sets up all primary event listeners for the application.
 * This includes file inputs, search, and global resize handlers.
 */
export function setupEventListeners() {
    // File input handlers
    document.getElementById('baselineFile').addEventListener('change', handleFileUpload);
    document.getElementById('updateFile').addEventListener('change', handleFileUpload);
    
    // Initialize the Status Quo upload screen handlers
    setupStatusQuoUploadHandlers();
    
    // Initialize the Target upload screen handlers
    setupTargetUploadHandlers();
    
    // Set up action buttons handlers
    setupActionButtonsHandlers();

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (searchInput && searchResults) {
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }
            const results = searchEmployees(query);
            showSearchResults(results);
        });

        searchInput.addEventListener('blur', function() {
            // Delay hiding results to allow click events
            setTimeout(() => {
                searchResults.style.display = 'none';
            }, 200);
        });
    }

    // Debounced resize handler
    let resizeTimeout;
    window.addEventListener('resize', function() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 200);
    });
}

/* ===========================================
   UPLOAD FLOW CONTROL
=========================================== */
// Proceed from upload screen: build and show chart
/**
 * Handles the click event for the 'Continue' button on the upload screen.
 * It builds the initial chart from the baseline data and transitions the UI to the main chart view.
 */
export function proceedFromUpload() {
    const btn = document.getElementById('continueBtn');
    if (btn && btn.classList.contains('disabled')) {
        console.warn('[Upload] Continue clicked while disabled; ignoring');
        return;
    }
    // Only log once when actually proceeding
    console.log('[Upload] Building hierarchy and rendering chart');
    
    // Basic preconditions: baseline must be loaded
    try {
        const baselineStatus = document.getElementById('baselineStatus')?.textContent || '';
        if (!baselineStatus.includes('✓')) {
            alert('Please upload and confirm the Baseline file first.');
            return;
        }
    } catch (e) { /* no-op */ }
    buildHierarchy();
    renderChart();
    updateSearchVisibility();

    // Normalize UI to Baseline View appearance after leaving upload screen
    // - Set mode indicator to Baseline View
    // - Hide legend and summary button
    // - Clear header status texts for a cleaner baseline look
    document.querySelectorAll('.mode-indicator').forEach(el => {
        el.textContent = 'Baseline View';
        el.className = 'mode-indicator baseline';
    });
    const legendEl = document.getElementById('legendContainer');
    if (legendEl) legendEl.style.display = 'none';
    const summaryBtn = document.getElementById('summaryStatsBtn');
    if (summaryBtn) summaryBtn.style.display = 'none';
    const baselineStatusEl = document.getElementById('baselineStatus');
    if (baselineStatusEl) baselineStatusEl.textContent = '';
    const updateStatusEl = document.getElementById('updateStatus');
    if (updateStatusEl) updateStatusEl.textContent = '';

    hideStatusQuoUploadScreen();
}

/* ===========================================
   SEARCH FUNCTIONALITY
=========================================== */

/**
 * Filters the current dataset to find employees matching a search query.
 * @param {string} query - The search term.
 * @returns {Array<Object>} An array of matching employees, limited to 10 results.
 */
export function searchEmployees(query) {
    if (!state.currentData || state.currentData.length === 0) return [];
    
    const queryLower = query.toLowerCase();
    return state.currentData.filter(emp => 
        (emp.name && emp.name.toLowerCase().includes(queryLower)) ||
        (emp.title && emp.title.toLowerCase().includes(queryLower)) ||
        (emp.id && emp.id.toString().toLowerCase().includes(queryLower))
    ).slice(0, 10); // Limit to 10 results
}

/**
 * Renders the search results dropdown panel.
 * @param {Array<Object>} results - An array of employee objects to display.
 */
export function showSearchResults(results) {
    const searchResults = document.getElementById('searchResults');
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result">No employees found</div>';
    } else {
        searchResults.innerHTML = results.map(emp => `
            <div class="search-result" onclick="selectEmployee('${emp.id}')">
                <div class="search-result-name">${emp.name}</div>
                <div class="search-result-title">${emp.title}</div>
            </div>
        `).join('');
    }
    
    searchResults.style.display = 'block';
}

/**
 * Handles the selection of an employee from the search results.
 * It hides the results, updates the input field, and calls `focusOnEmployee`.
 * @param {string} employeeId - The ID of the selected employee.
 */
export function selectEmployee(employeeId) {
    const employee = state.currentData.find(emp => emp.id.toString() === employeeId.toString());
    if (!employee) return;

    // Hide search results
    document.getElementById('searchResults').style.display = 'none';
    document.getElementById('searchInput').value = employee.name;

    // Focus on employee (same as change log click)
    focusOnEmployee(employeeId);
}

/**
 * Shows or hides the search container based on whether data has been loaded.
 */
export function updateSearchVisibility() {
    const searchContainer = document.getElementById('searchContainer');
    if (state.currentData && state.currentData.length > 0) {
        searchContainer.classList.remove('no-data');
        searchContainer.classList.add('has-data');
    } else {
        searchContainer.classList.remove('has-data');
        searchContainer.classList.add('no-data');
    }
}

/* ===========================================
   SIDEBAR MANAGEMENT
=========================================== */

/**
 * Minimizes the main statistics sidebar.
 * (Note: This feature is not currently used in the main UI but is kept for potential future use).
 */
export function minimizeSidebar() {
    setSidebarMinimized(true);
    document.getElementById('sidebar').classList.add('sidebar-minimized');
    document.getElementById('restoreSidebar').style.display = 'block';
    updateRestoreButtonPositions();
    updateLayoutClasses();
}

/**
 * Restores the minimized sidebar to its full size.
 */
export function restoreSidebar() {
    setSidebarMinimized(false);
    document.getElementById('sidebar').classList.remove('sidebar-minimized');
    document.getElementById('restoreSidebar').style.display = 'none';
    updateRestoreButtonPositions();
    updateLayoutClasses();
}

/**
 * Adds or removes the '.changelog-open' class from various UI elements.
 * This allows CSS to handle the responsive layout shifts when the changelog is open.
 */
export function updateLayoutClasses() {
    const chartArea = document.querySelector('.chart-area');
    const overallStats = document.querySelector('.overall-stats-display');
    const selectedStats = document.querySelector('.selected-stats-display');
    const searchContainer = document.querySelector('.search-container');
    
    // Update changelog state classes
    if (state.changelogOpen) {
        if (chartArea) chartArea.classList.add('changelog-open');
        if (overallStats) overallStats.classList.add('changelog-open');
        if (selectedStats) selectedStats.classList.add('changelog-open');
        if (searchContainer) searchContainer.classList.add('changelog-open');
    } else {
        if (chartArea) chartArea.classList.remove('changelog-open');
        if (overallStats) overallStats.classList.remove('changelog-open');
        if (selectedStats) selectedStats.classList.remove('changelog-open');
        if (searchContainer) searchContainer.classList.remove('changelog-open');
    }
}

export function updateRestoreButtonPositions() {
    // Update positions based on sidebar state
    // This would be implemented based on your specific UI requirements
}

/* ===========================================
   CHANGELOG PANEL
=========================================== */

/**
 * Opens the changelog panel and updates the layout.
 */
export function openChangelogPanel() {
    setChangelogOpen(true);
    document.getElementById('changelogPanel').classList.add('open');
    updateLayoutClasses();
}

/**
 * Closes the changelog panel and updates the layout.
 */
export function closeChangelogPanel() {
    setChangelogOpen(false);
    document.getElementById('changelogPanel').classList.remove('open');
    updateLayoutClasses();
}

/**
 * Toggles the visibility of a section (Added, Moved, Exit) within the changelog panel.
 * @param {string} type - The type of section to toggle ('added', 'moved', or 'exit').
 */
export function toggleChangeSection(type) {
    const section = document.querySelector(`[data-change-type="${type}"]`);
    const list = section.querySelector('.change-list');
    const chevron = section.querySelector('.chevron');
    
    if (list.classList.contains('expanded')) {
        list.classList.remove('expanded');
        chevron.classList.remove('expanded');
        section.querySelector('.change-header').classList.remove('expanded');
    } else {
        list.classList.add('expanded');
        chevron.classList.add('expanded');
        section.querySelector('.change-header').classList.add('expanded');
    }
}

/* ===========================================
   EMPLOYEE FOCUS & NAVIGATION
=========================================== */

/**
 * A high-level function to focus the chart on a specific employee.
 * It expands the path to the employee and then centers the view on them.
 * @param {string} employeeId - The ID of the employee to focus on.
 */
export function focusOnEmployee(employeeId) {
    const employee = state.currentData.find(emp => emp.id.toString() === employeeId.toString());
    if (!employee) return;

    // Expand path to employee
    expandPathToEmployee(employee);
    
    // Set the callback to run after the chart finishes rendering.
    // This is more reliable than a fixed timeout.
    window.__onChartRenderComplete = () => {
        centerOnEmployee(employee);
    };
}

/**
 * Ensures all ancestors of a given employee are marked as 'expanded' so that the employee is visible in the chart.
 * @param {Object} employee - The employee node to expand to.
 */
export function expandPathToEmployee(employee) {
    try {
        console.log('Expanding path to employee:', employee.name);
        // Build quick maps from current hierarchical data
        const nodeMap = new Map();
        const parentMap = new Map();
        (state.currentData || []).forEach(n => {
            nodeMap.set(n.id, n);
            if (n.children && n.children.length) {
                n.children.forEach(c => parentMap.set(c.id, n.id));
            }
        });
        // Walk up to root and mark expanded
        let cur = employee;
        const visited = new Set();
        while (cur && !visited.has(cur.id)) {
            visited.add(cur.id);
            if (cur.children && cur.children.length > 0) cur.expanded = true;
            const pid = parentMap.get(cur.id);
            cur = pid ? nodeMap.get(pid) : null;
        }
        // Recalculate layout and render so coordinates are up to date
        try { calculateLayout(state.rootNode, 0, 0); } catch(_) {}
        try { renderChart(); } catch(_) {}
    } catch (e) {
        console.warn('expandPathToEmployee failed', e);
    }
}

/**
 * Calculates the appropriate zoom transform to frame a selected employee and their direct reports
 * within the current viewport, then applies it with a smooth transition.
 * @param {Object} employee - The employee node to center on.
 */
export function centerOnEmployee(employee) {
    try {
        const svgEl = d3.select('#chartSvg');
        const zoomBehavior = state.zoom;
        const w = state.width;
        const h = state.height;
        // Compute bounding box covering the employee and direct reports
        const nodes = [employee].concat((employee.children || []));
        const nw = (CONFIG && CONFIG.nodeWidth) || 160;
        const nh = (CONFIG && CONFIG.nodeHeight) || 80;
        const vgap = (CONFIG && CONFIG.verticalGap) || 100;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const nx = n.x || 0;
            const ny = n.y || 0;
            // d.x/d.y are node centers in our renderer
            const left = nx - nw / 2;
            const right = nx + nw / 2;
            const top = ny - nh / 2;
            const bottom = ny + nh / 2;
            if (left < minX) minX = left;
            if (top < minY) minY = top;
            if (right > maxX) maxX = right;
            if (bottom > maxY) maxY = bottom;
        });
        // If there are direct reports, expand bbox downward slightly toward next row
        if (employee.children && employee.children.length) {
            maxY += Math.min(vgap * 0.6, 120);
        }
        // Add padding around the bbox
        const padX = 80;
        const padY = 100;
        const bboxWidth = Math.max(1, (maxX - minX) + padX * 2);
        const bboxHeight = Math.max(1, (maxY - minY) + padY * 2);
        const maxScale = zoomBehavior && zoomBehavior.scaleExtent ? zoomBehavior.scaleExtent()[1] : 2;
        const scale = Math.min(maxScale, Math.min(w / bboxWidth, h / bboxHeight));
        // Target center of bbox in screen center
        const bboxCenterX = minX + (maxX - minX) / 2;
        const bboxCenterY = minY + (maxY - minY) / 2;
        const tx = w / 2 - bboxCenterX * scale;
        const ty = h / 2 - bboxCenterY * scale;
        const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
        if (zoomBehavior) {
            svgEl.transition().duration(750).call(zoomBehavior.transform, t);
        } else {
            // Fallback: set transform on group if available
            const g = d3.select('#chartSvg g.main-group');
            g.transition().duration(750).attr('transform', `translate(${tx},${ty}) scale(${scale})`);
        }
    } catch (e) {
        console.warn('centerOnEmployee failed, falling back to no-op', e);
    }
}

/* ===========================================
   UPLOAD SCREEN HANDLERS
=========================================== */

/**
 * Sets up drag-and-drop event listeners for the file upload areas.
 */
export function setupStatusQuoUploadHandlers() {
    // Set up handlers for the status quo upload screen
    const uploadScreen = document.getElementById('uploadScreen');
    const uploadAreas = document.querySelectorAll('.upload-area');
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    // Drag and drop handlers
    uploadAreas.forEach(area => {
        area.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('dragover');
        });
        
        area.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
        });
        
        area.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const fileInput = this.querySelector('input[type="file"]');
                if (fileInput) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change'));
                }
            }
        });
    });
}

export function setupTargetUploadHandlers() {
    // Set up handlers for target/update file upload
    console.log('Target upload handlers set up');
}

export function setupActionButtonsHandlers() {
    // Set up handlers for action buttons
    const compareBtn = document.getElementById('compareBtn');
    // Compare button is wired via inline onclick in index.html and routed to statsManager through main.js.
    // Do not add another event listener here to prevent double toggles.
    if (compareBtn) {
        console.log('Compare button present (listener managed via inline onclick).');
    }
    
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetApplication);
    }

    // Continue button on upload screen - use a single event handler approach
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        console.log('[Upload] Continue button found; binding click handler');
        continueBtn.addEventListener('click', proceedFromUpload);
    } else {
        // Only add delegated handler if direct binding fails
        console.log('[Upload] Continue button not found; adding delegated handler');
        document.addEventListener('click', function(e) {
            const btn = e.target && (e.target.id === 'continueBtn' ? e.target : e.target.closest && e.target.closest('#continueBtn'));
            if (btn) {
                proceedFromUpload();
            }
        });
    }

    // Back button on upload screen
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            const hasSeenWelcome = localStorage.getItem('hideWelcomeModal');
            if (hasSeenWelcome === 'true') {
                // If user opted out, don't show modal again. Just clear statuses.
                document.getElementById('baselineStatus').textContent = '';
                document.getElementById('updateStatus').textContent = '';
            } else {
                showWelcomeModal();
            }
        });
    }
}

/* ===========================================
   MODAL MANAGEMENT
=========================================== */

/**
 * Displays the welcome modal.
 */
export function showWelcomeModal() {
    // Show welcome modal for first-time users
    console.log('Showing welcome modal');
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        welcomeModal.style.display = 'flex';
    }
}

/**
 * Closes the welcome modal, persists the 'don't show again' preference if checked,
 * and displays the main upload screen.
 */
export function closeWelcomeModal() {
    // Close welcome modal and show upload screen
    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        // Immediately disable interactions and hide
        welcomeModal.style.pointerEvents = 'none';
        welcomeModal.style.opacity = '0';
        welcomeModal.style.transition = 'opacity 150ms ease-out';
        // Fully remove after transition to avoid future blocking
        setTimeout(() => {
            if (welcomeModal && welcomeModal.parentNode) {
                welcomeModal.parentNode.removeChild(welcomeModal);
            }
        }, 180);
    }
    
    // Check if "don't show again" is checked
    const dontShowAgain = document.getElementById('dontShowAgain');
    if (dontShowAgain && dontShowAgain.checked) {
        localStorage.setItem('hideWelcomeModal', 'true');
    }
    
    // Show upload screen
    showStatusQuoUploadScreen();
}

/**
 * Makes the main upload screen visible.
 */
export function showStatusQuoUploadScreen() {
    const uploadScreen = document.getElementById('uploadScreen');
    if (uploadScreen) {
        uploadScreen.classList.add('visible');
    }
}

/**
 * Hides the main upload screen.
 */
export function hideStatusQuoUploadScreen() {
    const uploadScreen = document.getElementById('uploadScreen');
    if (uploadScreen) {
        uploadScreen.classList.remove('visible');
    }
}

/* ===========================================
   COMPARISON MODE
=========================================== */

/**
 * Toggles the comparison mode between baseline and update datasets.
 * This is a wrapper around the statsManager's toggleComparisonMode function.
 */
export function toggleComparison() {
    if (window.toggleComparisonMode) {
        window.toggleComparisonMode();
    } else {
        console.warn('toggleComparisonMode not found on window object');
    }
}

/**
 * Resets the entire application by reloading the page after a confirmation prompt.
 */
export function resetApplication() {
    // Reset the entire application state
    if (confirm('Are you sure you want to reset the application? This will clear all loaded data.')) {
        location.reload();
    }
}

/* ===========================================
   UTILITY FUNCTIONS
=========================================== */

export function handleResize() {
    // Handle window resize events
    if (window.handleChartResize) {
        window.handleChartResize();
    }
}

/* ===========================================
   TOOLTIP SYSTEM
=========================================== */

/**
 * Initializes the custom tooltip system by creating a tooltip element and attaching
 * global mouse event listeners to show/hide/move it based on `data-tooltip` attributes.
 */
export function initTooltipSystem() {
    // Initialize custom tooltip system
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    document.body.appendChild(tooltip);
    
    // Set up tooltip event listeners
    document.addEventListener('mouseover', function(e) {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            // Ensure no native title tooltip shows
            if (target.hasAttribute('title')) {
                target.removeAttribute('title');
            }
            const tooltipText = target.getAttribute('data-tooltip');
            showTooltip(tooltipText, e.pageX, e.pageY);
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            hideTooltip();
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        const target = e.target.closest('[data-tooltip]');
        if (target) {
            updateTooltipPosition(e.pageX, e.pageY);
        }
    });
}

export function showTooltip(text, x, y) {
    const tooltip = document.querySelector('.custom-tooltip');
    if (tooltip) {
        tooltip.innerHTML = text;
        tooltip.style.display = 'block';
        updateTooltipPosition(x, y);
    }
}

export function hideTooltip() {
    const tooltip = document.querySelector('.custom-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

export function updateTooltipPosition(x, y) {
    const tooltip = document.querySelector('.custom-tooltip');
    if (tooltip) {
        tooltip.style.left = (x + 10) + 'px';
        tooltip.style.top = (y + 10) + 'px';
    }
}

/* ===========================================
   MODULE INITIALIZATION
=========================================== */

/**
 * Initializes the UI manager module.
 * It sets up the main event listeners and makes key functions globally available
 * for inline `onclick` handlers.
 */
export function initUIManager() {
    console.log('[OrgChart] UI manager initialized');
    
    // Initialize tooltip system
    initTooltipSystem();
    
    // Make functions globally available for HTML onclick handlers
    window.selectEmployee = selectEmployee;
    window.focusOnEmployee = focusOnEmployee;
    window.toggleChangeSection = toggleChangeSection;
    window.minimizeSidebar = minimizeSidebar;
    window.restoreSidebar = restoreSidebar;
    window.openChangelogPanel = openChangelogPanel;
    window.closeChangelogPanel = closeChangelogPanel;
    window.showStatusQuoUploadScreen = showStatusQuoUploadScreen;
    window.hideStatusQuoUploadScreen = hideStatusQuoUploadScreen;
    window.showWelcomeModal = showWelcomeModal;
    window.closeWelcomeModal = closeWelcomeModal;
    window.updateSearchVisibility = updateSearchVisibility;
    window.proceedFromUpload = proceedFromUpload;

    // Ensure Welcome modal buttons are wired even if inline onclick fails
    try {
        const startBtn = document.querySelector('.welcome-start-btn');
        if (startBtn && !startBtn.__bound) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeWelcomeModal();
            });
            startBtn.__bound = true;
        }
        const closeBtn = document.querySelector('.welcome-close');
        if (closeBtn && !closeBtn.__bound) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeWelcomeModal();
            });
            closeBtn.__bound = true;
        }
    } catch (_) { /* no-op */ }

    // Delegated handlers as a final safety net (works even if elements are re-created)
    document.addEventListener('click', function(e) {
        const startBtn = e.target.closest('.welcome-start-btn');
        if (startBtn) {
            e.preventDefault();
            closeWelcomeModal();
        }
        const closeBtn = e.target.closest('.welcome-close');
        if (closeBtn) {
            e.preventDefault();
            closeWelcomeModal();
        }
    }, true);
}
