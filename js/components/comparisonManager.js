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
    
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', toggleComparisonMode);
        toggleViewBtn.style.display = 'none'; // Hide by default
    }
    
    // Function to ensure legend is hidden and in the correct position
    const hideAllLegends = () => {
        // Get all legend containers
        const allLegendContainers = document.querySelectorAll('.legend-container');
        console.log(`[Init] Found ${allLegendContainers.length} legend containers to process`);
        
        allLegendContainers.forEach(container => {
            console.log('[Init] Processing legend container:', container);
            
            // Force hide the container
            container.style.display = 'none';
            container.removeAttribute('style');
            
            // Clear any existing content to prevent duplicates
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            
            // Ensure it's in the correct position in the DOM
            const headerLeft = document.querySelector('.page-header-left');
            if (headerLeft) {
                // Remove any existing legends first to avoid duplicates
                const existingLegends = headerLeft.querySelectorAll('.legend-container');
                existingLegends.forEach(legend => {
                    if (legend !== container) {
                        legend.remove();
                    }
                });
                
                // Move to header if not already there
                if (!headerLeft.contains(container)) {
                    console.log('[Init] Moving legend container to header');
                    headerLeft.appendChild(container);
                }
            }
        });
        
        // Also ensure the header doesn't have any lingering legends
        const headerLeft = document.querySelector('.page-header-left');
        if (headerLeft) {
            const headerLegends = headerLeft.querySelectorAll('.legend-container');
            headerLegends.forEach(legend => {
                legend.style.display = 'none';
                legend.removeAttribute('style');
            });
        }
    };
    
    // Run initially
    hideAllLegends();
    
    // Run again after a short delay to catch any dynamically added elements
    setTimeout(hideAllLegends, 100);
    
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
    
    // Get all legend containers in case there are multiple
    const allLegendContainers = document.querySelectorAll('.legend-container');
    
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
            // First, remove all existing legend items to prevent duplicates
            while (legendContainer.firstChild) {
                legendContainer.removeChild(legendContainer.firstChild);
            }
            
            // Create new legend items
            const legendItems = [
                { className: 'new', label: 'New' },
                { className: 'moved', label: 'Moved' },
                { className: 'exit', label: 'Exit' }
            ];
            
            legendItems.forEach(item => {
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                
                const colorBox = document.createElement('div');
                colorBox.className = `legend-color ${item.className}`;
                
                const label = document.createElement('span');
                label.className = 'legend-label';
                label.textContent = item.label;
                
                legendItem.appendChild(colorBox);
                legendItem.appendChild(label);
                legendContainer.appendChild(legendItem);
            });
            
            // Show the legend container
            legendContainer.style.display = 'flex';
            
            // Ensure legend is in the correct position
            const headerLeft = document.querySelector('.page-header-left');
            if (headerLeft) {
                // Remove any other legend containers
                const existingLegends = headerLeft.querySelectorAll('.legend-container');
                existingLegends.forEach(legend => {
                    if (legend !== legendContainer) {
                        legend.remove();
                    }
                });
                
                // Move to header if not already there
                if (!headerLeft.contains(legendContainer)) {
                    headerLeft.appendChild(legendContainer);
                }
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
        
        // Hide comparison controls
        console.log('Hiding comparison controls and legend');
        if (comparisonControls) {
            console.log('Hiding comparison controls');
            comparisonControls.style.display = 'none';
        } else {
            console.warn('comparisonControls element not found');
        }
        
        // Hide all legend containers using a more aggressive approach
        const hideLegendContainers = () => {
            // First, handle the main legend container
            if (legendContainer) {
                console.log('Hiding main legend container');
                legendContainer.style.display = 'none';
                
                // Also clear any inline styles that might be forcing visibility
                legendContainer.removeAttribute('style');
                
                // Ensure it's in the correct position in the DOM
                const headerLeft = document.querySelector('.page-header-left');
                if (headerLeft && !headerLeft.contains(legendContainer)) {
                    headerLeft.appendChild(legendContainer);
                }
            }
            
            // Handle any other legend containers that might exist
            const allLegendContainers = document.querySelectorAll('.legend-container');
            console.log(`Found ${allLegendContainers.length} legend containers to process`);
            
            allLegendContainers.forEach(container => {
                if (container !== legendContainer) {  // Skip if it's the main container we already processed
                    console.log('Hiding additional legend container:', container);
                    container.style.display = 'none';
                    container.removeAttribute('style');
                    
                    // Ensure it's in the correct position in the DOM
                    const headerLeft = document.querySelector('.page-header-left');
                    if (headerLeft && !headerLeft.contains(container)) {
                        headerLeft.appendChild(container);
                    }
                }
            });
        };
        
        // Execute the hiding function
        hideLegendContainers();
        
        // Add a small delay and check again to catch any dynamically added elements
        setTimeout(hideLegendContainers, 100);
        
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
