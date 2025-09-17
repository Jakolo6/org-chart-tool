/**
 * @file Comparison Manager component for handling baseline and target view toggling
 */

console.log('[OrgChart] comparisonManager loaded');

/**
 * Initialize the comparison manager
 */
function initComparisonManager() {
    // Add toggle view button event listener
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const legendContainer = document.getElementById('legendContainer');
    
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', toggleComparisonMode);
        toggleViewBtn.style.display = 'none'; // Hide by default
    }
    
    // Ensure legend is hidden by default
    if (legendContainer) {
        legendContainer.style.display = 'none';
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
        hasBaselineData: state.baselineData && state.baselineData.length > 0,
        hasUpdateData: state.updateData && state.updateData.length > 0
    });
    
    // Check if we have both baseline and target data
    if (!state.baselineData || !state.baselineData.length || !state.updateData || !state.updateData.length) {
        alert('Both baseline and target data must be loaded to use comparison mode.');
        return;
    }
    
    // Toggle comparison mode state
    state.isComparisonMode = !state.isComparisonMode;
    window.setComparisonMode(state.isComparisonMode);
    
    // Update UI elements
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const modeIndicator = document.getElementById('modeIndicator');
    const legendContainer = document.getElementById('legendContainer');
    const comparisonControls = document.querySelector('.comparison-controls');
    
    if (state.isComparisonMode) {
        // Switch to target view
        console.log('Switching to target view');
        
        // Update button text and icon
        if (toggleViewBtn) {
            toggleViewBtn.innerHTML = '<i class="fas fa-exchange-alt"></i> Switch to Baseline';
            toggleViewBtn.style.display = 'inline-flex';
        }
        
        // Update mode indicator
        if (modeIndicator) {
            modeIndicator.textContent = 'Target View';
            modeIndicator.className = 'mode-indicator target';
        }
        
        // Show comparison controls
        if (comparisonControls) comparisonControls.style.display = 'block';
        
        // Create and show legend only in comparison mode
        if (legendContainer) {
            legendContainer.style.display = 'flex';
            legendContainer.innerHTML = `
                <div class="legend-item">
                    <div class="legend-color new"></div>
                    <span class="legend-label">New</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color moved"></div>
                    <span class="legend-label">Moved</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color exit"></div>
                    <span class="legend-label">Exit</span>
                </div>
            `;
            
            // Ensure legend is in the correct position
            const headerLeft = document.querySelector('.page-header-left');
            if (headerLeft && !headerLeft.contains(legendContainer)) {
                headerLeft.appendChild(legendContainer);
            }
        }
        
        // Set current data to target data
        state.currentData = state.updateData;
        window.setCurrentData(state.updateData);
        
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
        
        // Hide comparison controls and legend
        console.log('Hiding comparison controls and legend');
        if (comparisonControls) {
            console.log('Hiding comparison controls');
            comparisonControls.style.display = 'none';
        } else {
            console.warn('comparisonControls element not found');
        }
        
        if (legendContainer) {
            console.log('Hiding legend container');
            legendContainer.style.display = 'none';
            // Ensure legend is in the correct position even when hidden
            const headerLeft = document.querySelector('.page-header-left');
            if (headerLeft) {
                if (!headerLeft.contains(legendContainer)) {
                    console.log('Moving legend container to header');
                    headerLeft.appendChild(legendContainer);
                }
            } else {
                console.warn('headerLeft element not found');
            }
        } else {
            console.warn('legendContainer element not found');
        }
        
        // Set current data to baseline data
        state.currentData = state.baselineData;
        window.setCurrentData(state.baselineData);
        
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
window.initComparisonManager = initComparisonManager;
window.toggleComparisonMode = toggleComparisonMode;
window.analyzeChanges = analyzeChanges;
window.applyChangeTypesToNodes = applyChangeTypesToNodes;
window.sortChildrenByChangeStatus = sortChildrenByChangeStatus;
