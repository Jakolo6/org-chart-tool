/**
 * @file Main application entry point. This module is responsible for:
 * - Defining the global application state and configuration.
 * - Initializing the application and wiring up event listeners.
 */

console.log('[OrgChart] App loading...');

/* ===========================================
   GLOBAL VARIABLES & CONFIGURATION
=========================================== */

/**
 * Global configuration object for the chart's appearance and animations.
 * @const {Object}
 */
const CONFIG = {
    nodeWidth: 160,
    nodeHeight: 80,
    horizontalGap: 25,
    verticalGap: 100,
    animationDuration: 300
};

// --- GLOBAL STATE ---
const state = {
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
    if (window.initializeChart) window.initializeChart();
    if (window.setupEventListeners) window.setupEventListeners();
    ensureHeaderTitle(); // Set the correct title immediately
    
    // Initialize all modules
    if (window.initFileHandler) window.initFileHandler();
    if (window.initChartRenderer) window.initChartRenderer();
    if (window.initStatsManager) window.initStatsManager();
    if (window.initUIManager) window.initUIManager();
    if (window.initChartManager) window.initChartManager(); // Initialize chart manager for saving/loading

    // Wire Compare button (single source) now that inline onclick is removed
    const compareBtnEl = document.getElementById('compareBtn');
    if (compareBtnEl && !compareBtnEl.__orgBound) {
        compareBtnEl.addEventListener('click', () => {
            console.log('[OrgChart] toggleComparison clicked');
            try { 
                if (window.toggleComparisonMode) window.toggleComparisonMode(); 
            } catch (e) { 
                console.error('toggleComparison failed:', e); 
            }
        });
        compareBtnEl.__orgBound = true;
    }
    
    // Check if we need to skip directly to the upload screen (user has seen welcome before)
    const hasSeenWelcome = localStorage.getItem('hideWelcomeModal');
    
    if (hasSeenWelcome) {
        // If user has seen welcome before, show upload screen directly
        // But only if no baseline file has been loaded yet
        if (!state.baselineData || state.baselineData.length === 0) {
            if (window.showStatusQuoUploadScreen) window.showStatusQuoUploadScreen();
        }
    } else {
        // For new users, show welcome modal first
        // The upload screen will be shown after closing the welcome modal
        if (window.showWelcomeModal) window.showWelcomeModal();
    }
}

// Initialize application when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeApplication();
});

// Make state and CONFIG available globally
window.state = state;
window.CONFIG = CONFIG;

// Expose state setters
window.setBaselineData = setBaselineData;
window.setUpdateData = setUpdateData;
window.setCurrentData = setCurrentData;
window.setRootNode = setRootNode;
window.setSelectedNode = setSelectedNode;
window.setSvgElements = setSvgElements;
window.setDimensions = setDimensions;
window.setComparisonMode = setComparisonMode;
window.setChangeAnalysis = setChangeAnalysis;
window.setChangelogOpen = setChangelogOpen;
window.setSidebarMinimized = setSidebarMinimized;
window.setColumnMapping = setColumnMapping;
window.setCurrentFileData = setCurrentFileData;
window.setCurrentFileHeaders = setCurrentFileHeaders;
window.setCurrentFileType = setCurrentFileType;
window.setValidationErrors = setValidationErrors;
window.setCurrentValidationData = setCurrentValidationData;
window.initializeApplication = initializeApplication;
window.ensureHeaderTitle = ensureHeaderTitle;
