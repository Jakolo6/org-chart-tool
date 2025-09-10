/**
 * @file Main application entry point. This module is responsible for:
 * - Defining the global application state and configuration.
 * - Importing all other modules.
 * - Initializing the application and wiring up event listeners.
 */

import { initializeChart, buildHierarchy, renderChart, resetView, initChartRenderer } from './components/chartRenderer.js';
import { handleFileUpload, showColumnMappingDialog, initFileHandler } from './components/fileHandler.js';
import { initUIManager, updateSearchVisibility, showWelcomeModal, showStatusQuoUploadScreen, closeWelcomeModal, setupEventListeners, proceedFromUpload } from './components/uiManager.js';
import { toggleComparisonMode } from './components/statsManager.js';
import { updateOverallStatistics, updateSelectedNodeStats, toggleSummaryStatistics, initStatsManager } from './components/statsManager.js';
import { initChartManager } from './components/chartManager.js';

console.log('[OrgChart] App loading...');

/* ===========================================
   GLOBAL VARIABLES & CONFIGURATION
=========================================== */

/**
 * Global configuration object for the chart's appearance and animations.
 * @const {Object}
 */
export const CONFIG = {
    nodeWidth: 160,
    nodeHeight: 80,
    horizontalGap: 25,
    verticalGap: 100,
    animationDuration: 300
};

// --- GLOBAL STATE ---
export const state = {
    baselineData: [],
    updateData: [],
    currentData: [],
    rootNode: null,
    selectedNode: null,
    svg: null,
    g: null,
    zoom: null,
    width: 1200,
    height: 800,
    isComparisonMode: false,
    changeAnalysis: null,
    changelogOpen: false,
    sidebarMinimized: false,
    currentFileData: null,
    currentFileType: null,
    currentFileHeaders: null,
    columnMapping: {
        employeeName: null,
        manager: null,
        jobTitle: null,
        fte: null,
        location: null,
        jobFamily: null,
        managementLevel: null
    },
    validationErrors: [],
    currentValidationData: null
};

// --- GLOBAL STATE SETTERS ---
function setBaselineData(data) { state.baselineData = data; }
function setUpdateData(data) { state.updateData = data; }
function setCurrentData(data) { state.currentData = data; }
function setRootNode(node) { state.rootNode = node; }
function setSelectedNode(node) { state.selectedNode = node; }
function setSvgElements(svgEl, gEl, zoomEl) { state.svg = svgEl; state.g = gEl; state.zoom = zoomEl; }
function setDimensions(w, h) { state.width = w; state.height = h; }
function setComparisonMode(mode) { state.isComparisonMode = mode; }
function setChangeAnalysis(analysis) { state.changeAnalysis = analysis; }
function setChangelogOpen(open) { state.changelogOpen = open; }
function setSidebarMinimized(minimized) { state.sidebarMinimized = minimized; }
function setColumnMapping(mapping) { state.columnMapping = { ...state.columnMapping, ...mapping }; }
function setCurrentFileData(data) { state.currentFileData = data; }
function setCurrentFileHeaders(headers) { state.currentFileHeaders = headers; }
function setCurrentFileType(fileType) { state.currentFileType = fileType; }
function setValidationErrors(errors) { state.validationErrors = errors; }
function setCurrentValidationData(data) { state.currentValidationData = data; }

/* ===========================================
   APPLICATION INITIALIZATION
=========================================== */

// Ensure header title is always just 'Organigram Analyzer'
function ensureHeaderTitle() {
    const headerTitle = document.querySelector('.header h1');
    if (headerTitle && headerTitle.textContent !== 'Organigram Analyzer') {
        headerTitle.textContent = 'Organigram Analyzer';
    }
}

// Call this function periodically to ensure the title stays correct
setInterval(ensureHeaderTitle, 500);

/**
 * Main function to initialize the application.
 * It sets up the chart, event listeners, and initializes all modules.
 * It also determines whether to show the welcome modal or the upload screen on startup.
 */
function initializeApplication() {
    initializeChart();
    setupEventListeners();
    ensureHeaderTitle(); // Set the correct title immediately
    
    // Initialize all modules
    initFileHandler();
    initChartRenderer();
    initStatsManager();
    initUIManager();
    initChartManager(); // Initialize chart manager for saving/loading

    // Wire Compare button (single source) now that inline onclick is removed
    const compareBtnEl = document.getElementById('compareBtn');
    if (compareBtnEl && !compareBtnEl.__orgBound) {
        compareBtnEl.addEventListener('click', () => {
            console.log('[OrgChart] toggleComparison clicked');
            try { toggleComparisonMode(); } catch (e) { console.error('toggleComparison failed:', e); }
        });
        compareBtnEl.__orgBound = true;
    }
    
    // Check if we need to skip directly to the upload screen (user has seen welcome before)
    const hasSeenWelcome = localStorage.getItem('hideWelcomeModal');
    
    if (hasSeenWelcome) {
        // If user has seen welcome before, show upload screen directly
        // But only if no baseline file has been loaded yet
        if (!state.baselineData || state.baselineData.length === 0) {
            showStatusQuoUploadScreen();
        }
    } else {
        // For new users, show welcome modal first
        // The upload screen will be shown after closing the welcome modal
        showWelcomeModal();
    }
}

// Initialize application when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeApplication();
});

// --- GLOBAL FUNCTIONS ---
// Expose key functions to the `window` object to make them accessible
// from inline `onclick` attributes in the HTML.
window.resetView = resetView;
// Wire compare toggle directly to statsManager for reliability
window.toggleComparison = function() {
    console.log('[OrgChart] toggleComparison clicked');
    try {
        toggleComparisonMode();
    } catch (e) {
        console.error('toggleComparison failed:', e);
        alert('Unable to toggle comparison mode. Please ensure both baseline and update files are loaded.');
    }
};
window.toggleSummaryStatistics = toggleSummaryStatistics;
window.closeWelcomeModal = closeWelcomeModal;
// Expose proceedFromUpload for inline onclick fallback
window.proceedFromUpload = function() {
    console.log('[Upload] Global proceedFromUpload invoked');
    try {
        proceedFromUpload();
    } catch (e) {
        console.error('proceedFromUpload failed:', e);
        alert('Unable to proceed to the chart. Please try again.');
    }
};

// Export for use by other modules
export { 
    initializeApplication, 
    ensureHeaderTitle,
    // State setters
    setBaselineData,
    setUpdateData,
    setCurrentData,
    setRootNode,
    setSelectedNode,
    setSvgElements,
    setDimensions,
    setComparisonMode,
    setChangeAnalysis,
    setChangelogOpen,
    setSidebarMinimized,
    setColumnMapping,
    setCurrentFileData,
    setCurrentFileHeaders,
    setCurrentFileType,
    setValidationErrors,
    setCurrentValidationData
};
