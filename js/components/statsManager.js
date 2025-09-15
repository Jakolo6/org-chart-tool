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
function calculateOverallStatistics() {
    const state = window.state || {};
    const currentData = state.currentData || [];
    const baselineData = state.baselineData || [];
    
    const totalEmployees = currentData.length;
    const maxTreeDepth = state.rootNode ? calculateMaxDepth(state.rootNode) : 0;
    const uniqueTitles = new Set(currentData.map(emp => emp.title)).size;
    const totalFTE = currentData.reduce((sum, emp) => sum + (emp.fte || 1.0), 0);
    
    let deltas = null;
    if (state.isComparisonMode && baselineData.length > 0) {
        const baselineStats = calculateStatsForData(baselineData);
        deltas = {
            totalEmployees: totalEmployees - baselineStats.totalEmployees,
            maxTreeDepth: maxTreeDepth - baselineStats.maxTreeDepth,
            uniqueTitles: uniqueTitles - baselineStats.uniqueTitles,
            totalFTE: totalFTE - baselineStats.totalFTE
        };
    }
    
    return { totalEmployees, maxTreeDepth, uniqueTitles, totalFTE, deltas };
}

function calculateStatsForData(data) {
    const tempRoot = buildTempHierarchy(data);
    return {
        totalEmployees: data.length,
        maxTreeDepth: tempRoot ? calculateMaxDepth(tempRoot) : 0,
        uniqueTitles: new Set(data.map(emp => emp.title)).size,
        totalFTE: data.reduce((sum, emp) => sum + (emp.fte || 1.0), 0)
    };
}

function updateOverallStatistics() {
    const state = window.state || {};
    const changes = state.changeAnalysis;
    
    if (!changes) return;
    
    const statsContainer = document.getElementById('overallStatsContent');
    if (!statsContainer) return;
    
    // Get comprehensive statistics
    const stats = calculateOverallStatistics();
    const addedCount = changes.added ? changes.added.length : 0;
    const removedCount = changes.removed ? changes.removed.length : 0;
    const movedCount = changes.changed ? changes.changed.length : 0;
    
    // Render the statistics with change indicators
    statsContainer.innerHTML = `
        <div class="stats-overview">
            <div class="stat-item">
                <div class="stat-label">Total Employees</div>
                <div class="stat-value">${stats.totalEmployees}</div>
                ${stats.deltas ? `
                    <div class="stat-delta ${stats.deltas.totalEmployees > 0 ? 'positive' : (stats.deltas.totalEmployees < 0 ? 'negative' : '')}">
                        ${stats.deltas.totalEmployees > 0 ? '+' : ''}${stats.deltas.totalEmployees || ''}
                    </div>
                ` : ''}
            </div>
            <div class="stat-item">
                <div class="stat-label">Organization Depth</div>
                <div class="stat-value">${stats.maxTreeDepth}</div>
                ${stats.deltas ? `
                    <div class="stat-delta ${stats.deltas.maxTreeDepth > 0 ? 'positive' : (stats.deltas.maxTreeDepth < 0 ? 'negative' : '')}">
                        ${stats.deltas.maxTreeDepth > 0 ? '+' : ''}${stats.deltas.maxTreeDepth || ''}
                    </div>
                ` : ''}
            </div>
            <div class="stat-item">
                <div class="stat-label">Unique Job Titles</div>
                <div class="stat-value">${stats.uniqueTitles}</div>
                ${stats.deltas ? `
                    <div class="stat-delta ${stats.deltas.uniqueTitles > 0 ? 'positive' : (stats.deltas.uniqueTitles < 0 ? 'negative' : '')}">
                        ${stats.deltas.uniqueTitles > 0 ? '+' : ''}${stats.deltas.uniqueTitles || ''}
                    </div>
                ` : ''}
            </div>
            <div class="stat-item">
                <div class="stat-label">Total FTE</div>
                <div class="stat-value">${stats.totalFTE.toFixed(1)}</div>
                ${stats.deltas ? `
                    <div class="stat-delta ${stats.deltas.totalFTE > 0 ? 'positive' : (stats.deltas.totalFTE < 0 ? 'negative' : '')}">
                        ${stats.deltas.totalFTE > 0 ? '+' : ''}${stats.deltas.totalFTE ? stats.deltas.totalFTE.toFixed(1) : ''}
                    </div>
                ` : ''}
            </div>
        </div>
        <div class="change-summary">
            <div class="change-item added">
                <div class="change-count">${addedCount}</div>
                <div class="change-label">New Positions</div>
            </div>
            <div class="change-item removed">
                <div class="change-count">${removedCount}</div>
                <div class="change-label">Removed</div>
            </div>
            <div class="change-item moved">
                <div class="change-count">${movedCount}</div>
                <div class="change-label">Moved</div>
            </div>
        </div>
    `;
}

/**
 * Updates the selected node statistics panel with details about the currently selected node.
 */
function calculateSelectedNodeStatistics(node) {
    const state = window.state || {};
    const directReports = node.children ? node.children.length : 0;
    const totalReports = countAllDescendants(node);
    const subtreeDepth = calculateMaxDepth(node);
    let deltas = null;
    let previousManagerName = null;
    let reportingChanges = null;
    let totalReportsChanges = null;

    if (state.isComparisonMode && state.baselineData && state.baselineData.length > 0) {
        const baselineNodeStats = calculateBaselineNodeStats(node.id);
        deltas = {
            directReports: directReports - baselineNodeStats.directReports,
            totalReports: totalReports - baselineNodeStats.totalReports,
            subtreeDepth: subtreeDepth - baselineNodeStats.subtreeDepth
        };
        
        // Calculate reporting changes breakdown
        reportingChanges = calculateReportingChanges(node.id);
        
        // Calculate total reports changes breakdown
        totalReportsChanges = calculateTotalReportsChanges(node.id);
        
        if (node.changeType === 'moved' && state.changeAnalysis) {
            const movedInfo = state.changeAnalysis.changed.find(m => 
                normalizeId(m.id) === normalizeId(node.id));
            if (movedInfo) {
                previousManagerName = movedInfo.previousManagerName;
            }
        }
    }
    
    return { 
        directReports, 
        totalReports, 
        subtreeDepth, 
        nodeName: node.name, 
        nodeTitle: node.title, 
        changeType: node.changeType, 
        deltas, 
        previousManagerName, 
        reportingChanges, 
        totalReportsChanges,
        node: node
    };
}

function renderStatWithBreakdown(label, value, changes, showBreakdown = true) {
    const safeValue = value !== undefined && value !== null ? value : 0;
    
    if (!window.state.isComparisonMode || !changes || !showBreakdown) {
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
    } else if (changes.netChange !== 0) {
        const netClass = changes.netChange > 0 ? 'positive' : (changes.netChange < 0 ? 'negative' : 'neutral');
        const netValue = `${changes.netChange >= 0 ? '+' : ''}${changes.netChange}`;
        breakdownHtml = `<div class="stat-simple-change ${netClass}">${netValue}</div>`;
    }
    
    return `<div class="stat-item">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${safeValue}</div>
        ${breakdownHtml}
    </div>`;
}

function renderSimpleStat(label, value, delta) {
    const safeValue = value !== undefined && value !== null ? value : 0;
    
    if (!window.state.isComparisonMode || delta === null || delta === undefined || delta === 0) {
        return `<div class="stat-item">
            <div class="stat-label">${label}</div>
            <div class="stat-value">${safeValue}</div>
        </div>`;
    }
    
    const deltaClass = delta > 0 ? 'positive' : (delta < 0 ? 'negative' : 'neutral');
    const deltaValue = `${delta >= 0 ? '+' : ''}${delta}`;
    const deltaHtml = `<div class="stat-simple-change ${deltaClass}">${deltaValue}</div>`;
    
    return `<div class="stat-item">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${safeValue}</div>
        ${deltaHtml}
    </div>`;
}

function updateSelectedNodeStats() {
    const state = window.state || {};
    const selectedNode = state.selectedNode;
    
    if (!selectedNode) return;
    
    const statsContainer = document.getElementById('selectedStatsContainer');
    if (!statsContainer) return;
    
    // Calculate comprehensive statistics
    const stats = calculateSelectedNodeStatistics(selectedNode);
    
    // Prepare change indicator
    const changeIndicator = stats.changeType ? 
        `<div class="change-type-indicator ${stats.changeType}">
            ${stats.changeType === 'added' ? '➕ Added' : 
              stats.changeType === 'moved' ? '↔ Moved' : 
              stats.changeType === 'exit' ? '➖ Exit' : ''}
        </div>` : '';
    
    // Prepare previous manager info for moved nodes
    const previousManagerInfo = stats.previousManagerName ? 
        `<div class="previous-manager">Previous Manager: <span>${stats.previousManagerName}</span></div>` : '';
    
    // Calculate FTE statistics
    const currentFTE = getCurrentFTE(selectedNode);
    const totalTeamFTE = calculateTotalFTE(selectedNode);
    
    // Prepare optional additional fields
    const additionalFields = [];
    if (selectedNode.location) {
        additionalFields.push(`<div class="additional-field"><strong>Location:</strong> ${selectedNode.location}</div>`);
    }
    if (selectedNode.jobFamily) {
        additionalFields.push(`<div class="additional-field"><strong>Job Family:</strong> ${selectedNode.jobFamily}</div>`);
    }
    if (selectedNode.managementLevel) {
        additionalFields.push(`<div class="additional-field"><strong>Management Level:</strong> ${selectedNode.managementLevel}</div>`);
    }
    
    const additionalFieldsHtml = additionalFields.length > 0 ? 
        `<div class="additional-fields">${additionalFields.join('')}</div>` : '';
    
    // Render the statistics panel
    statsContainer.innerHTML = `
        <div class="selected-node-header">
            <div class="node-name">${stats.nodeName || 'N/A'}</div>
            <div class="node-title">${stats.nodeTitle || 'N/A'}</div>
            ${changeIndicator}
            ${previousManagerInfo}
        </div>
        
        <div class="stats-section">
            <div class="stat-item">
                <div class="stat-label">Current FTE</div>
                <div class="stat-value">${currentFTE.toFixed(1)}</div>
            </div>
            
            <div class="stat-item">
                <div class="stat-label">Total Team FTE</div>
                <div class="stat-value">${totalTeamFTE.toFixed(1)}</div>
            </div>
            
            ${renderStatWithBreakdown('Direct Reports', stats.directReports, stats.reportingChanges)}
            ${renderStatWithBreakdown('Total Reports', stats.totalReports, stats.totalReportsChanges)}
            ${renderSimpleStat('Team Depth', stats.subtreeDepth, stats.deltas ? stats.deltas.subtreeDepth : null)}
            
            ${additionalFieldsHtml}
        </div>
    `;
    
    // Initialize tooltips if any
    initTooltips();
}

/**
 * Initializes tooltips for elements with data-tooltip attribute
 */
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(el => {
        el.addEventListener('mouseenter', showTooltip);
        el.addEventListener('mouseleave', hideTooltip);
    });
}

/**
 * Shows a tooltip for the hovered element
 */
function showTooltip(event) {
    const tooltipText = this.getAttribute('data-tooltip');
    if (!tooltipText) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    
    document.body.appendChild(tooltip);
    
    // Position the tooltip near the cursor
    const rect = this.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    
    // Store reference to remove later
    this._tooltip = tooltip;
}

/**
 * Hides the tooltip
 */
function hideTooltip() {
    if (this._tooltip) {
        document.body.removeChild(this._tooltip);
        this._tooltip = null;
    }
}

/**
 * Helper function to create a temporary hierarchy for calculations
 */
function buildTempHierarchy(data) {
    if (!data || !data.length) return null;
    
    // Create a map of all nodes by ID
    const nodeMap = new Map();
    const rootNodes = [];
    
    // First pass: create all nodes
    data.forEach(d => {
        const node = { ...d, children: [] };
        nodeMap.set(d.id, node);
    });
    
    // Second pass: build the hierarchy
    data.forEach(d => {
        const node = nodeMap.get(d.id);
        if (d.managerId && nodeMap.has(d.managerId)) {
            const parent = nodeMap.get(d.managerId);
            parent.children.push(node);
        } else {
            rootNodes.push(node);
        }
    });
    
    // For simplicity, just return the first root node
    return rootNodes.length > 0 ? rootNodes[0] : null;
}

/**
 * Calculates the maximum depth of a node hierarchy
 */
function calculateMaxDepth(node) {
    if (!node || !node.children || node.children.length === 0) return 1;
    
    let maxChildDepth = 0;
    for (const child of node.children) {
        const childDepth = calculateMaxDepth(child);
        if (childDepth > maxChildDepth) {
            maxChildDepth = childDepth;
        }
    }
    
    return 1 + maxChildDepth;
}

/**
 * Counts all descendants of a node
 */
function countAllDescendants(node) {
    if (!node || !node.children || node.children.length === 0) return 0;
    
    let count = node.children.length;
    for (const child of node.children) {
        count += countAllDescendants(child);
    }
    
    return count;
}
        
/**
 * Helper function to calculate baseline node statistics for comparison
 */
function calculateBaselineNodeStats(nodeId) {
    const state = window.state || {};
    const baselineData = state.baselineData || [];
    
    if (!baselineData.length) {
        return { directReports: 0, totalReports: 0, subtreeDepth: 0 };
    }
    
    // Find the matching node in baseline data
    const baselineNode = baselineData.find(n => n.id === nodeId);
    if (!baselineNode) {
        return { directReports: 0, totalReports: 0, subtreeDepth: 0 };
    }
    
    // Build a temporary hierarchy for the baseline data
    const tempRoot = buildTempHierarchy(baselineData);
    if (!tempRoot) {
        return { directReports: 0, totalReports: 0, subtreeDepth: 0 };
    }
    
    // Find the node in the hierarchy
    const findNode = (node, targetId) => {
        if (node.id === targetId) return node;
        if (!node.children) return null;
        
        for (const child of node.children) {
            const found = findNode(child, targetId);
            if (found) return found;
        }
        return null;
    };
    
    const nodeInHierarchy = findNode(tempRoot, nodeId);
    if (!nodeInHierarchy) {
        return { directReports: 0, totalReports: 0, subtreeDepth: 0 };
    }
    
    // Calculate statistics for the node
    const directReports = nodeInHierarchy.children ? nodeInHierarchy.children.length : 0;
    const totalReports = countAllDescendants(nodeInHierarchy);
    const subtreeDepth = calculateMaxDepth(nodeInHierarchy);
    
    return { directReports, totalReports, subtreeDepth };
}

/**
 * Normalizes an ID for comparison (handles string/number differences)
 */
function normalizeId(id) {
    if (id === null || id === undefined) return '';
    return String(id).trim().toLowerCase();
}

// Export the public API
export {
    updateOverallStatistics,
    updateSelectedNodeStats,
    toggleSummaryStatistics,
    calculateOverallStatistics,
    calculateSelectedNodeStatistics,
    initStatsManager,
    calculateReportingChanges,
    calculateTotalReportsChanges,
    findAllSubordinates,
    countTotalDescendants,
    calculateTotalFTE,
    getCurrentFTE
};

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
 * This includes all descendants of the node in both baseline and current states.
 * @param {string} nodeId The ID of the node to calculate changes for.
 * @returns {Object} The total reports changes with added/removed counts and names.
 */
function calculateTotalReportsChanges(nodeId) {
    const state = window.state || {};
    if (!state.baselineData || !state.currentData || !state.isComparisonMode) return null;
    
    const normalizeId = window.normalizeId || (id => id?.toString().trim());
    const normalizedNodeId = normalizeId(nodeId);
    
    // Find all subordinates in baseline data
    const baselineSubordinates = findAllSubordinates(normalizedNodeId, state.baselineData);
    const baselineSubordinateIds = new Set(baselineSubordinates.map(emp => normalizeId(emp.id)));
    
    // Find all subordinates in current data
    const currentSubordinates = findAllSubordinates(normalizedNodeId, state.currentData);
    const currentSubordinateIds = new Set(currentSubordinates.map(emp => normalizeId(emp.id)));
    
    // Calculate added and removed with names
    const addedReports = Array.from(currentSubordinateIds).filter(id => !baselineSubordinateIds.has(id));
    const removedReports = Array.from(baselineSubordinateIds).filter(id => !currentSubordinateIds.has(id));
    
    // Get names for added/removed people
    const addedNames = addedReports.map(id => {
        const person = currentSubordinates.find(emp => normalizeId(emp.id) === id);
        return person ? person.name : id;
    });
    
    const removedNames = removedReports.map(id => {
        const person = baselineSubordinates.find(emp => normalizeId(emp.id) === id);
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
        removedNames: removedNames,
        total: currentSubordinates.length
    }
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

// Note: All functions are now properly exported via ES modules
// and can be imported where needed. Global window assignments
// have been removed in favor of ES module imports.
