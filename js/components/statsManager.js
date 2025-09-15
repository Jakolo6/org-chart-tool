/**
 * @file Manages all statistical calculations, change analysis, and the rendering of stats-based UI components
 * like the overall stats overlay, the selected node panel, and the changelog.
 */

console.log('[OrgChart] statsManager loaded');

/* ===========================================
   STATISTICS MANAGEMENT
=========================================== */

// Note: The toggleComparisonMode function is now imported from comparisonManager.js
// to avoid duplicate implementations

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
    
    // Calculate FTE statistics
    const currentFTE = getCurrentFTE(selectedNode);
    const totalTeamFTE = calculateTotalFTE(selectedNode);
    
    // Calculate reporting changes if in comparison mode
    let reportingChanges = null;
    let totalReportsChanges = null;
    
    if (state.isComparisonMode && state.baselineData && state.baselineData.length > 0) {
        reportingChanges = calculateReportingChanges(selectedNode.id);
        totalReportsChanges = calculateTotalReportsChanges(selectedNode.id);
    }
    
    // Prepare change indicator if in comparison mode
    const changeIndicator = selectedNode.changeType ? 
        `<div class="change-type-indicator ${selectedNode.changeType}">
            ${selectedNode.changeType === 'added' ? '➕ Added' : 
              selectedNode.changeType === 'moved' ? '↔ Moved' : 
              selectedNode.changeType === 'exit' ? '➖ Exit' : ''}
        </div>` : '';
    
    // Prepare previous manager info for moved nodes
    const previousManagerInfo = (selectedNode.changeType === 'moved' && selectedNode.previousManagerName) ? 
        `<div class="previous-manager">Previous Manager: <span>${selectedNode.previousManagerName}</span></div>` : '';
    
    // Helper function to render stat with breakdown
    const renderStatWithBreakdown = (label, value, changes, showBreakdown = true) => {
        const safeValue = value !== undefined && value !== null ? value : 0;
        
        if (!state.isComparisonMode || !changes || !showBreakdown) {
            return `<div class="stat-item">
                <div class="stat-label">${label}</div>
                <div class="stat-value">${safeValue}</div>
            </div>`;
        }
        
        let breakdownHtml = '';
        const hasChanges = changes.added > 0 || changes.removed > 0;
        
        if (hasChanges) {
            const netClass = changes.netChange > 0 ? 'positive' : (changes.netChange < 0 ? 'negative' : 'neutral');
            const netValue = `${changes.netChange >= 0 ? '+' : ''}${changes.netChange}`;
            
            // Create tooltips for direct reports only (when we have names)
            const isDirectReports = label === 'Direct Reports';
            const addedTooltip = isDirectReports && changes.addedNames && changes.addedNames.length > 0 
                ? `data-tooltip="Joined: ${changes.addedNames.join(', ')}"` : '';
            const removedTooltip = isDirectReports && changes.removedNames && changes.removedNames.length > 0 
                ? `data-tooltip="Left: ${changes.removedNames.join(', ')}"` : '';
            
            // Only show calculation if there are both additions AND removals
            if (changes.added > 0 && changes.removed > 0) {
                let changeItems = [];
                changeItems.push(`<div class="stat-change-item added" ${addedTooltip}>+${changes.added}</div>`);
                changeItems.push(`<div class="stat-change-item removed" ${removedTooltip}>-${changes.removed}</div>`);
                
                breakdownHtml = `<div class="stat-breakdown">
                    ${changeItems.join('')}
                    <span class="stat-change-equals">=</span>
                    <div class="stat-change-net ${netClass}">${netValue}</div>
                </div>`;
            } else {
                // Only one type of change - just show the net value without calculation
                const singleTooltip = isDirectReports ? (changes.added > 0 ? addedTooltip : removedTooltip) : '';
                breakdownHtml = `<div class="stat-simple-change ${netClass}" ${singleTooltip}>${netValue}</div>`;
            }
        }
        
        return `<div class="stat-item">
            <div class="stat-label">${label}</div>
            <div class="stat-value">${safeValue}</div>
            ${breakdownHtml}
        </div>`;
    };
    
    // Create stats HTML with enhanced FTE information and reporting changes
    let statsHtml = `
        <div class="stats-panel">
            <div class="stat-item">
                <div class="stat-label">Selected Employee</div>
                <div class="stat-name">${selectedNode.name || 'N/A'}</div>
                <div class="stat-title">${selectedNode.title || 'N/A'}</div>
                ${changeIndicator}
                ${previousManagerInfo}
            </div>
            <div class="stat-item">
                <div class="stat-label">Current FTE</div>
                <div class="stat-value">${currentFTE.toFixed(1)}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Total FTE in Team</div>
                <div class="stat-value">${totalTeamFTE.toFixed(1)}</div>
            </div>
            ${renderStatWithBreakdown('Direct Reports', selectedNode.children ? selectedNode.children.length : 0, reportingChanges)}
            ${renderStatWithBreakdown('Total Team Size', countTotalDescendants(selectedNode), totalReportsChanges)}
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
 * Calculates the total FTE for a node and all its descendants.
 * @param {Object} node The node to calculate FTE for.
 * @returns {number} The total FTE.
 */
function calculateTotalFTE(node) {
    if (!node) return 0;
    
    // Start with the node's own FTE
    let totalFTE = getCurrentFTE(node);
    
    // Add FTE from all direct and indirect reports
    if (node.children && node.children.length > 0) {
        totalFTE += node.children.reduce((sum, child) => {
            return sum + calculateTotalFTE(child);
        }, 0);
    }
    
    return totalFTE;
}

/**
 * Gets the current FTE for a node.
 * @param {Object} node The node to get FTE for.
 * @returns {number} The node's FTE.
 */
function getCurrentFTE(node) {
    return node ? (node.fte || 1.0) : 1.0;
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

/**
 * Calculates reporting changes for a node between baseline and current data.
 * @param {string} nodeId The ID of the node to calculate changes for.
 * @returns {Object} The reporting changes.
 */
function calculateReportingChanges(nodeId) {
    const state = window.state || {};
    if (!state.baselineData || !state.currentData || !state.isComparisonMode) return null;
    
    const normalizeId = window.normalizeId || (id => id?.toString().trim());
    const normalizedNodeId = normalizeId(nodeId);
    
    // Find baseline direct reports
    const baselineDirectReports = state.baselineData.filter(emp => 
        normalizeId(emp.manager) === normalizedNodeId);
    const baselineReportIds = new Set(baselineDirectReports.map(emp => normalizeId(emp.id)));
    
    // Find current direct reports
    const currentDirectReports = state.currentData.filter(emp => 
        normalizeId(emp.manager) === normalizedNodeId);
    const currentReportIds = new Set(currentDirectReports.map(emp => normalizeId(emp.id)));
    
    // Calculate added and removed with names
    const addedReports = Array.from(currentReportIds).filter(id => !baselineReportIds.has(id));
    const removedReports = Array.from(baselineReportIds).filter(id => !currentReportIds.has(id));
    
    // Get names for added/removed people
    const addedNames = addedReports.map(id => {
        const person = currentDirectReports.find(emp => normalizeId(emp.id) === id);
        return person ? person.name : id;
    });
    
    const removedNames = removedReports.map(id => {
        const person = baselineDirectReports.find(emp => normalizeId(emp.id) === id);
        return person ? person.name : id;
    });
    
    const addedCount = addedReports.length;
    const removedCount = removedReports.length;
    const netChange = addedCount - removedCount;
    
    return {
        added: addedCount,
        removed: removedCount,
        netChange: netChange,
        addedNames: addedNames,
        removedNames: removedNames
    };
}

/**
 * Calculates total reports changes for a node between baseline and current data.
 * @param {string} nodeId The ID of the node to calculate changes for.
 * @returns {Object} The total reports changes.
 */
function calculateTotalReportsChanges(nodeId) {
    const state = window.state || {};
    if (!state.baselineData || !state.currentData || !state.isComparisonMode) return null;
    
    const normalizeId = window.normalizeId || (id => id?.toString().trim());
    const normalizedNodeId = normalizeId(nodeId);
    
    // Find all descendants in baseline
    const baselineDescendants = findAllSubordinates(normalizedNodeId, state.baselineData);
    const baselineDescendantIds = new Set(baselineDescendants.map(emp => normalizeId(emp.id)));
    
    // Find all descendants in current data
    const currentDescendants = findAllSubordinates(normalizedNodeId, state.currentData);
    const currentDescendantIds = new Set(currentDescendants.map(emp => normalizeId(emp.id)));
    
    // Calculate added and removed
    const addedDescendants = Array.from(currentDescendantIds).filter(id => !baselineDescendantIds.has(id));
    const removedDescendants = Array.from(baselineDescendantIds).filter(id => !currentDescendantIds.has(id));
    
    const addedCount = addedDescendants.length;
    const removedCount = removedDescendants.length;
    const netChange = addedCount - removedCount;
    
    return {
        added: addedCount,
        removed: removedCount,
        netChange: netChange
    };
}

/**
 * Finds all subordinates of a node in the given data.
 * @param {string} nodeId The ID of the node to find subordinates for.
 * @param {Array} data The data to search in.
 * @returns {Array} The subordinates.
 */
function findAllSubordinates(nodeId, data) {
    const normalizeId = window.normalizeId || (id => id?.toString().trim());
    const normalizedNodeId = normalizeId(nodeId);
    
    // Create a map of manager ID to employees
    const managerMap = new Map();
    data.forEach(emp => {
        const managerId = normalizeId(emp.manager);
        if (!managerMap.has(managerId)) {
            managerMap.set(managerId, []);
        }
        managerMap.get(managerId).push(emp);
    });
    
    // Recursively find all subordinates
    const result = [];
    
    function findSubordinates(id) {
        const directReports = managerMap.get(id) || [];
        directReports.forEach(emp => {
            result.push(emp);
            findSubordinates(normalizeId(emp.id));
        });
    }
    
    findSubordinates(normalizedNodeId);
    return result;
}

// Expose functions to global window object
window.updateOverallStatistics = updateOverallStatistics;
window.updateSelectedNodeStats = updateSelectedNodeStats;
window.toggleSummaryStatistics = toggleSummaryStatistics;
window.initStatsManager = initStatsManager;
window.calculateTotalFTE = calculateTotalFTE;
window.getCurrentFTE = getCurrentFTE;
window.countTotalDescendants = countTotalDescendants;
window.calculateReportingChanges = calculateReportingChanges;
window.calculateTotalReportsChanges = calculateTotalReportsChanges;
window.findAllSubordinates = findAllSubordinates;
