/**
 * @file Comparison Manager component for handling baseline and target view toggling
 */

// LegendManager is loaded separately and exposed to window
console.log('[OrgChart] comparisonManager loaded');

/**
 * Initialize the comparison manager
 */
function initComparisonManager() {
    // Add toggle view button event listener
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', toggleComparisonMode);
        toggleViewBtn.style.display = 'none'; // Hide by default
    }
    
    // Initialize the legend manager
    if (window.legendManager) {
        window.legendManager.hide();
    } else {
        console.warn('LegendManager not found. Legend functionality may not work correctly.');
    }
    
    console.log('[OrgChart] Comparison manager initialized');
}

/**
 * Toggle between baseline and target views
 */
function toggleComparisonMode() {
    const state = window.state || {};
    
    console.log('Toggle comparison mode called. Current state:', { 
        isComparisonMode: state.isComparisonMode,
        hasTargetData: !!state.targetData,
        hasBaselineData: !!state.baselineData
    });
    
    // Toggle the comparison mode state
    state.isComparisonMode = !state.isComparisonMode;
    window.state = state;
    
    // Get UI elements
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const chartContainer = document.getElementById('org-chart');
    
    if (state.isComparisonMode) {
        console.log('Entering comparison mode');
        
        // Show the legend using LegendManager
        if (window.legendManager) {
            console.log('Showing legend via LegendManager');
            window.legendManager.show();
        } else {
            console.warn('LegendManager not available');
        }
        
        // Update button text and icon
        if (toggleViewBtn) {
            toggleViewBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Switch to Baseline';
            toggleViewBtn.style.display = 'inline-flex';
        }
        
        // Update mode indicator
        const modeIndicator = document.getElementById('modeIndicator');
        if (modeIndicator) {
            modeIndicator.textContent = 'Target View';
            modeIndicator.className = 'mode-indicator target';
        }
        
        // Show comparison controls and legend
        const comparisonControls = document.querySelector('.comparison-controls');
        if (comparisonControls) comparisonControls.style.display = 'block';
        
        // Analyze changes between baseline and target
        analyzeChanges();
        
        // Rebuild hierarchy with target data
        const rootNode = buildHierarchy(state.currentData);
        
        // Apply change types to nodes in the hierarchy
        applyChangeTypesToNodes(rootNode);
        
        // Update state with new root node
        state.rootNode = rootNode;
        window.setRootNode(rootNode);
        
        // Build comparison maps for node statistics
        if (window.buildComparisonMaps) {
            window.buildComparisonMaps();
        }
        
        console.log('Switched to target view. Root node:', rootNode);
        console.log('Change analysis:', state.changeAnalysis);
    } else {
        // Switch to baseline view
        console.log('Switching to baseline view');
        
        // Update button text and icon
        if (toggleViewBtn) {
            toggleViewBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Switch to Target';
            toggleViewBtn.style.display = 'none';
        }
        
        // Update mode indicator
        if (modeIndicator) {
            modeIndicator.textContent = 'Baseline View';
            modeIndicator.className = 'mode-indicator baseline';
        }
        
        // Hide comparison controls
        console.log('Hiding comparison controls');
        if (comparisonControls) {
            comparisonControls.style.display = 'none';
        } else {
            console.warn('comparisonControls element not found');
        }
        
        // Hide the legend using LegendManager
        if (window.legendManager) {
            console.log('Hiding legend via LegendManager');
            window.legendManager.hide();
        } else {
            console.warn('LegendManager not available');
        }
        
        // Set current data to baseline data
        state.currentData = state.baselineData;
        if (window.setCurrentData) {
            window.setCurrentData(state.baselineData);
        }
        
        // Reset change analysis
        state.changeAnalysis = null;
        window.setChangeAnalysis(null);
        
        // Rebuild hierarchy with baseline data
        const rootNode = buildHierarchy(state.currentData);
        
        // Store baseline hierarchy for comparison purposes
        state.baselineHierarchy = rootNode;
        
        // Update state with new root node
        state.rootNode = rootNode;
        window.setRootNode(rootNode);
        
        console.log('Switched to baseline view. Root node:', rootNode);
    }
    
    // Re-render the chart with the new data
    if (window.renderChart) {
        console.log('Rendering chart with new data...');
        window.renderChart(state.rootNode, '#chart-area');
    } else {
        console.error('window.renderChart function not found!');
    }
}

/**
 * Analyze changes between baseline and target data
 */
function analyzeChanges() {
    const state = window.state || {};
    if (!state.baselineData || !state.updateData) return;
    
    const baselineMap = new Map(state.baselineData.map(emp => [normalizeId(emp.id), emp]));
    const updateMap = new Map(state.updateData.map(emp => [normalizeId(emp.id), emp]));
    
    const added = Array.from(updateMap.values())
        .filter(emp => !baselineMap.has(normalizeId(emp.id)))
        .map(emp => ({...emp, changeType: 'added'}));
        
    const removed = Array.from(baselineMap.values())
        .filter(emp => !updateMap.has(normalizeId(emp.id)))
        .map(emp => ({...emp, changeType: 'exit'}));
        
    const moved = [];
    
    updateMap.forEach(emp => {
        const baselineEmp = baselineMap.get(normalizeId(emp.id));
        if (baselineEmp && normalizeId(baselineEmp.manager) !== normalizeId(emp.manager)) {
            moved.push({
                ...emp, 
                changeType: 'moved', 
                previousManager: baselineEmp.manager,
                previousManagerName: baselineMap.get(normalizeId(baselineEmp.manager))?.name || 'Unknown'
            });
        }
    });
    
    const changeAnalysis = {
        added,
        removed,
        moved,
        totalDirectChanges: added.length + removed.length + moved.length
    };
    
    // Store change analysis in state
    state.changeAnalysis = changeAnalysis;
    
    console.log('Change analysis:', changeAnalysis);
}

/**
 * Sort children by change status to show changes on the left side
 * @param {Array} children - The array of child nodes to sort
 * @returns {Array} The sorted array of child nodes
 */
function sortChildrenByChangeStatus(children) {
    if (!children || !children.length) return children;
    
    // Sort children so that new/moved employees appear on the left,
    // existing employees appear after them
    return children.slice().sort((a, b) => {
        const aIsChanged = a.changeType === 'added' || a.changeType === 'moved';
        const bIsChanged = b.changeType === 'added' || b.changeType === 'moved';
        
        if (aIsChanged && !bIsChanged) return -1; // a comes first (left)
        if (!aIsChanged && bIsChanged) return 1;  // b comes first (left)
        return 0; // maintain relative order within same category
    });
}

/**
 * Apply change types to nodes in the hierarchy
 * @param {Object} node - The root node of the hierarchy
 */
function applyChangeTypesToNodes(node) {
    const state = window.state || {};
    if (!node || !state.changeAnalysis) return;
    
    // Create maps for quick lookup
    const addedMap = new Map();
    const movedMap = new Map();
    
    if (state.changeAnalysis.added) {
        state.changeAnalysis.added.forEach(emp => addedMap.set(normalizeId(emp.id), true));
    }
    
    if (state.changeAnalysis.moved) {
        state.changeAnalysis.moved.forEach(emp => movedMap.set(normalizeId(emp.id), true));
    }
    
    // Recursively apply change types to the hierarchy
    function markNode(node) {
        if (!node) return;
        
        const nodeId = normalizeId(node.id);
        
        if (addedMap.has(nodeId)) {
            node.changeType = 'added';
        } else if (movedMap.has(nodeId)) {
            node.changeType = 'moved';
            
            // Find the corresponding moved node for additional details
            if (state.changeAnalysis.moved) {
                const movedNodeDetails = state.changeAnalysis.moved.find(n => normalizeId(n.id) === nodeId);
                if (movedNodeDetails) {
                    node.previousManager = movedNodeDetails.previousManager;
                    node.previousManagerName = movedNodeDetails.previousManagerName;
                }
            }
        }
        
        // Sort children by change status (changed nodes on the left)
        if (node.children && node.children.length > 0) {
            // Sort children before recursively processing them
            node.children = sortChildrenByChangeStatus(node.children);
            
            // Recursively process all children
            node.children.forEach(markNode);
        }
    }
    
    // Start the recursive marking process from the root
    markNode(node);
    
    console.log('Applied change types to hierarchy nodes');
}

/**
 * Normalize ID values for consistent comparison
 * @param {*} id - The ID to normalize
 * @returns {string} - Normalized ID string
 */
function normalizeId(id) {
    if (id === null || id === undefined) return '';
    return id.toString().trim();
}

// Export functions to global window object
const comparisonManager = {
    init: initComparisonManager,
    toggleComparisonMode,
    analyzeChanges,
    sortChildrenByChangeStatus,
    applyChangeTypesToNodes,
    normalizeId
};

// For backward compatibility
window.initComparisonManager = initComparisonManager;
window.toggleComparisonMode = toggleComparisonMode;
window.analyzeChanges = analyzeChanges;
window.sortChildrenByChangeStatus = sortChildrenByChangeStatus;
window.applyChangeTypesToNodes = applyChangeTypesToNodes;
window.normalizeId = normalizeId;

export default comparisonManager;
