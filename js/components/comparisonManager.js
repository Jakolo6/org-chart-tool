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
    }
    
    console.log('[OrgChart] Comparison manager initialized');
}

/**
 * Toggle between baseline and target views
 */
function toggleComparisonMode() {
    const state = window.state || {};
    
    // Check if we have both baseline and target data
    if (!state.baselineData || !state.baselineData.length || !state.updateData || !state.updateData.length) {
        alert('Both baseline and target data must be loaded to use comparison mode.');
        return;
    }
    
    // Toggle comparison mode state
    state.isComparisonMode = !state.isComparisonMode;
    
    // Update UI elements
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const modeIndicator = document.getElementById('modeIndicator');
    const legendContainer = document.getElementById('legendContainer');
    
    if (state.isComparisonMode) {
        // Switch to target view
        if (toggleViewBtn) toggleViewBtn.innerHTML = '📊 Switch to Baseline';
        if (modeIndicator) {
            modeIndicator.textContent = '⚖️ Target View';
            modeIndicator.className = 'mode-indicator target';
        }
        
        // Show legend for changes
        if (legendContainer) legendContainer.style.display = 'block';
        
        // Set current data to target data
        state.currentData = state.updateData;
        
        // Analyze changes between baseline and target
        analyzeChanges();
        
        // Rebuild hierarchy with target data
        const rootNode = buildHierarchy(state.currentData);
        
        // Apply change types to nodes in the hierarchy
        applyChangeTypesToNodes(rootNode);
        
        // Update state with new root node
        state.rootNode = rootNode;
        
        console.log('Switched to target view. Root node:', rootNode);
    } else {
        // Switch to baseline view
        if (toggleViewBtn) toggleViewBtn.innerHTML = '⚖️ Switch to Target';
        if (modeIndicator) {
            modeIndicator.textContent = '📊 Baseline View';
            modeIndicator.className = 'mode-indicator baseline';
        }
        
        // Hide legend
        if (legendContainer) legendContainer.style.display = 'none';
        
        // Set current data to baseline data
        state.currentData = state.baselineData;
        
        // Reset change analysis
        state.changeAnalysis = null;
        
        // Rebuild hierarchy with baseline data
        const rootNode = buildHierarchy(state.currentData);
        
        // Update state with new root node
        state.rootNode = rootNode;
        
        console.log('Switched to baseline view. Root node:', rootNode);
    }
    
    // Re-render the chart with the new data
    if (window.renderChart) {
        window.renderChart(state.rootNode, '#chart-area');
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
        .map(emp => ({...emp, changeType: 'new'}));
        
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
    
    // Update change summary in UI if element exists
    updateChangeSummary(changeAnalysis);
}

/**
 * Update the change summary in the UI
 * @param {Object} analysis - The change analysis object
 */
function updateChangeSummary(analysis) {
    const summaryEl = document.getElementById('changeSummary');
    if (!summaryEl) return;
    
    summaryEl.innerHTML = `
        <div class="summary-item added">
            <span class="count">${analysis.added.length}</span>
            <span class="label">New</span>
        </div>
        <div class="summary-item moved">
            <span class="count">${analysis.moved.length}</span>
            <span class="label">Moved</span>
        </div>
        <div class="summary-item removed">
            <span class="count">${analysis.removed.length}</span>
            <span class="label">Removed</span>
        </div>
        <div class="summary-item total">
            <span class="count">${analysis.totalDirectChanges}</span>
            <span class="label">Total Changes</span>
        </div>
    `;
    
    summaryEl.style.display = 'flex';
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
            node.changeType = 'new';
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
        
        // Recursively process all children
        if (node.children && node.children.length > 0) {
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
