/**
 * @file Manages all statistical calculations, change analysis, and the rendering of stats-based UI components
 * like the overall stats overlay, the selected node panel, and the changelog.
 */

console.log('[OrgChart] statsManager loaded');

/* ===========================================
   COMPARISON MODE MANAGEMENT
=========================================== */

let __toggleInProgress = false;

/**
 * Toggles between baseline and comparison mode.
 * In comparison mode, the chart shows changes between baseline and update data.
 */
function toggleComparisonMode() {
    if (__toggleInProgress) return;
    __toggleInProgress = true;
    
    try {
        // Get state from window object
        const state = window.state || {};
        
        // Check if we have both baseline and update data
        if (!state.baselineData || state.baselineData.length === 0 || 
            !state.updateData || state.updateData.length === 0) {
            alert('Both baseline and update data must be loaded to enable comparison mode.');
            return;
        }
        
        // Toggle mode
        const newMode = !state.isComparisonMode;
        
        // Update button text
        const compareBtn = document.getElementById('compareBtn');
        if (compareBtn) {
            compareBtn.textContent = newMode ? '⟵ Baseline' : '⇄ Compare';
        }
        
        // Update mode indicator
        const modeIndicator = document.getElementById('modeIndicator');
        if (modeIndicator) {
            modeIndicator.textContent = newMode ? '🔄 Comparison View' : '📊 Baseline View';
            modeIndicator.className = `mode-indicator ${newMode ? 'comparison' : 'baseline'}`;
        }
        
        // Set the data to use based on mode
        const dataToUse = newMode ? performChangeAnalysis() : state.baselineData;
        
        // Update state
        if (window.setComparisonMode) window.setComparisonMode(newMode);
        if (window.setCurrentData) window.setCurrentData(dataToUse);
        
        // Build hierarchy and render chart
        const rootNode = window.buildHierarchy ? window.buildHierarchy(dataToUse) : null;
        if (window.setRootNode) window.setRootNode(rootNode);
        if (window.renderChart) window.renderChart(rootNode);
        
        // Update UI
        if (window.updateLayoutClasses) window.updateLayoutClasses();
        
        // Show overall stats in comparison mode
        const overallStatsDisplay = document.getElementById('overallStatsDisplay');
        if (overallStatsDisplay) {
            if (newMode) {
                updateOverallStatistics();
                overallStatsDisplay.classList.add('visible');
                overallStatsDisplay.style.display = 'block';
            } else {
                overallStatsDisplay.classList.remove('visible');
                setTimeout(() => {
                    if (!state.isComparisonMode) {
                        overallStatsDisplay.style.display = 'none';
                    }
                }, 300);
            }
        }
    } catch (error) {
        console.error('Error toggling comparison mode:', error);
        alert('An error occurred while toggling comparison mode.');
    } finally {
        __toggleInProgress = false;
    }
}

/**
 * Performs change analysis between baseline and update data.
 * @returns {Array} The processed data with change indicators.
 */
function performChangeAnalysis() {
    const state = window.state || {};
    const baselineData = state.baselineData || [];
    const updateData = state.updateData || [];
    
    // Create maps for quick lookup
    const baselineMap = new Map();
    const updateMap = new Map();
    
    baselineData.forEach(emp => {
        baselineMap.set(window.normalizeId ? window.normalizeId(emp.id) : emp.id.toLowerCase(), emp);
    });
    
    updateData.forEach(emp => {
        updateMap.set(window.normalizeId ? window.normalizeId(emp.id) : emp.id.toLowerCase(), emp);
    });
    
    // Identify changes
    const changes = {
        added: [],
        removed: [],
        changed: [],
        unchanged: []
    };
    
    // Find removed and changed employees
    baselineData.forEach(baseEmp => {
        const baseId = window.normalizeId ? window.normalizeId(baseEmp.id) : baseEmp.id.toLowerCase();
        if (!updateMap.has(baseId)) {
            changes.removed.push({
                ...baseEmp,
                changeType: 'exit'
            });
        } else {
            const updateEmp = updateMap.get(baseId);
            const baseManagerId = window.normalizeId ? window.normalizeId(baseEmp.manager) : (baseEmp.manager || '').toLowerCase();
            const updateManagerId = window.normalizeId ? window.normalizeId(updateEmp.manager) : (updateEmp.manager || '').toLowerCase();
            
            if (baseManagerId !== updateManagerId) {
                changes.changed.push({
                    ...updateEmp,
                    changeType: 'moved',
                    previousManager: baseEmp.manager
                });
            } else {
                changes.unchanged.push({
                    ...updateEmp,
                    changeType: null
                });
            }
        }
    });
    
    // Find new employees
    updateData.forEach(updateEmp => {
        const updateId = window.normalizeId ? window.normalizeId(updateEmp.id) : updateEmp.id.toLowerCase();
        if (!baselineMap.has(updateId)) {
            changes.added.push({
                ...updateEmp,
                changeType: 'new'
            });
        }
    });
    
    // Combine all changes into one dataset
    const combinedData = [
        ...changes.unchanged,
        ...changes.changed,
        ...changes.added,
        ...changes.removed
    ];
    
    // Store change analysis in state
    if (window.setChangeAnalysis) {
        window.setChangeAnalysis(changes);
    }
    
    return combinedData;
}

/**
 * Updates the overall statistics display with change analysis data.
 */
function updateOverallStatistics() {
    const state = window.state || {};
    const changes = state.changeAnalysis;
    
    if (!changes) return;
    
    const statsContainer = document.getElementById('overallStatsContent');
    if (!statsContainer) return;
    
    const baselineCount = state.baselineData ? state.baselineData.length : 0;
    const updateCount = state.updateData ? state.updateData.length : 0;
    const addedCount = changes.added ? changes.added.length : 0;
    const removedCount = changes.removed ? changes.removed.length : 0;
    const movedCount = changes.changed ? changes.changed.length : 0;
    const unchangedCount = changes.unchanged ? changes.unchanged.length : 0;
    
    const netChange = updateCount - baselineCount;
    const netChangeClass = netChange > 0 ? 'positive' : (netChange < 0 ? 'negative' : 'neutral');
    const netChangePrefix = netChange > 0 ? '+' : '';
    
    statsContainer.innerHTML = `
        <div class="stats-row">
            <div class="stat-box">
                <div class="stat-label">Baseline Employees</div>
                <div class="stat-value">${baselineCount}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Target Employees</div>
                <div class="stat-value">${updateCount}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Net Change</div>
                <div class="stat-value ${netChangeClass}">${netChangePrefix}${netChange}</div>
            </div>
        </div>
        <div class="stats-row">
            <div class="stat-box">
                <div class="stat-label">New Positions</div>
                <div class="stat-value positive">${addedCount}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Removed Positions</div>
                <div class="stat-value negative">${removedCount}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Moved Employees</div>
                <div class="stat-value highlight">${movedCount}</div>
            </div>
        </div>
    `;
}

/**
 * Updates the selected node statistics panel with details about the currently selected node.
 */
function updateSelectedNodeStats() {
    const state = window.state || {};
    const selectedNode = state.selectedNode;
    
    if (!selectedNode) return;
    
    const statsContainer = document.getElementById('selectedStatsContainer');
    if (!statsContainer) return;
    
    // Create stats HTML
    let statsHtml = `
        <div class="stats-panel">
            <h3>${selectedNode.name}</h3>
            <div class="stats-grid">
                ${selectedNode.title ? `
                    <div class="stat-item">
                        <div class="stat-label">Title</div>
                        <div class="stat-value">${selectedNode.title}</div>
                    </div>
                ` : ''}
                ${selectedNode.fte ? `
                    <div class="stat-item">
                        <div class="stat-label">FTE</div>
                        <div class="stat-value">${selectedNode.fte}</div>
                    </div>
                ` : ''}
                ${selectedNode.location ? `
                    <div class="stat-item">
                        <div class="stat-label">Location</div>
                        <div class="stat-value">${selectedNode.location}</div>
                    </div>
                ` : ''}
                ${selectedNode.jobFamily ? `
                    <div class="stat-item">
                        <div class="stat-label">Job Family</div>
                        <div class="stat-value">${selectedNode.jobFamily}</div>
                    </div>
                ` : ''}
                ${selectedNode.managementLevel ? `
                    <div class="stat-item">
                        <div class="stat-label">Management Level</div>
                        <div class="stat-value">${selectedNode.managementLevel}</div>
                    </div>
                ` : ''}
                <div class="stat-item">
                    <div class="stat-label">Direct Reports</div>
                    <div class="stat-value">${selectedNode.children ? selectedNode.children.length : 0}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Total Team Size</div>
                    <div class="stat-value">${countTotalDescendants(selectedNode)}</div>
                </div>
            </div>
        </div>
    `;
    
    statsContainer.innerHTML = statsHtml;
}

/**
 * Counts the total number of descendants for a node.
 * @param {Object} node The node to count descendants for.
 * @returns {number} The total number of descendants.
 */
function countTotalDescendants(node) {
    if (!node.children || !node.children.length) return 0;
    
    let count = node.children.length;
    for (const child of node.children) {
        count += countTotalDescendants(child);
    }
    
    return count;
}

/**
 * Toggles the visibility of the summary statistics panel.
 */
function toggleSummaryStatistics() {
    const statsPanel = document.getElementById('overallStatsDisplay');
    if (!statsPanel) return;
    
    const isVisible = statsPanel.classList.contains('visible');
    
    if (isVisible) {
        statsPanel.classList.remove('visible');
        setTimeout(() => {
            statsPanel.style.display = 'none';
        }, 300);
    } else {
        updateOverallStatistics();
        statsPanel.style.display = 'block';
        setTimeout(() => {
            statsPanel.classList.add('visible');
        }, 10);
    }
}

/**
 * Initializes the stats manager module.
 */
function initStatsManager() {
    console.log('[OrgChart] Stats manager initialized');
}

// Expose functions to global window object
window.toggleComparisonMode = toggleComparisonMode;
window.updateOverallStatistics = updateOverallStatistics;
window.updateSelectedNodeStats = updateSelectedNodeStats;
window.toggleSummaryStatistics = toggleSummaryStatistics;
window.initStatsManager = initStatsManager;
