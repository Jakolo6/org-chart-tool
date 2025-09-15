/**
 * @file Node Statistics component for displaying detailed statistics about selected nodes
 */

console.log('[OrgChart] nodeStatistics loaded');

// Keep track of the selected node and its statistics
let selectedNode = null;
let previousManagerMap = new Map();
let directReportsMap = new Map();
let totalReportsMap = new Map();
let statsTooltip = null;

/**
 * Initialize the node statistics component
 */
function initNodeStatistics() {
    console.log('[OrgChart] Initializing node statistics component');
    
    // Create tooltip element for employee lists
    statsTooltip = document.createElement('div');
    statsTooltip.className = 'stats-tooltip';
    document.body.appendChild(statsTooltip);
    
    // Add event listener for close button
    const closeBtn = document.getElementById('closeNodeStats');
    if (closeBtn) {
        closeBtn.addEventListener('click', hideNodeStatistics);
    }
    
    // Add event listeners for tooltip triggers
    setupTooltipTriggers();
    
    console.log('[OrgChart] Node statistics component initialized');
}

/**
 * Set up tooltip triggers for employee changes
 */
function setupTooltipTriggers() {
    // Direct reports added tooltip
    const directReportsAdded = document.getElementById('directReportsAdded');
    if (directReportsAdded) {
        directReportsAdded.addEventListener('mouseenter', showEmployeeTooltip);
        directReportsAdded.addEventListener('mouseleave', hideEmployeeTooltip);
    }
    
    // Direct reports removed tooltip
    const directReportsRemoved = document.getElementById('directReportsRemoved');
    if (directReportsRemoved) {
        directReportsRemoved.addEventListener('mouseenter', showEmployeeTooltip);
        directReportsRemoved.addEventListener('mouseleave', hideEmployeeTooltip);
    }
}

/**
 * Show employee tooltip with list of employees
 * @param {Event} event - The mouse event
 */
function showEmployeeTooltip(event) {
    const target = event.currentTarget;
    const tooltipContent = target.getAttribute('data-tooltip');
    
    if (!tooltipContent || tooltipContent === '') return;
    
    const rect = target.getBoundingClientRect();
    
    // Parse the tooltip content (JSON string of employee names)
    let employees = [];
    try {
        employees = JSON.parse(tooltipContent);
    } catch (e) {
        console.error('Error parsing tooltip content:', e);
        return;
    }
    
    // Create tooltip content
    const isAdded = target.id === 'directReportsAdded';
    const title = isAdded ? 'Added Team Members' : 'Removed Team Members';
    
    let html = `<div class="stats-tooltip-title">${title}</div>`;
    html += '<ul class="stats-tooltip-list">';
    
    employees.forEach(emp => {
        html += `<li>${emp}</li>`;
    });
    
    html += '</ul>';
    
    // Position and show tooltip
    statsTooltip.innerHTML = html;
    statsTooltip.style.left = `${rect.left + window.scrollX}px`;
    statsTooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    statsTooltip.classList.add('visible');
}

/**
 * Hide employee tooltip
 */
function hideEmployeeTooltip() {
    statsTooltip.classList.remove('visible');
}

/**
 * Update statistics when a node is selected
 * @param {Object} node - The selected node
 */
function updateNodeStatistics(node) {
    if (!node) {
        console.warn('Node is undefined in updateNodeStatistics');
        hideNodeStatistics();
        return;
    }
    
    // Check if node has the expected structure
    if (typeof node !== 'object') {
        console.warn('Node is not an object in updateNodeStatistics');
        hideNodeStatistics();
        return;
    }
    
    // Ensure node.data exists to prevent errors
    if (!node.data) {
        console.warn('Node data is missing, creating empty object');
        node.data = {};
    }
    
    selectedNode = node;
    
    try {
        // Calculate statistics
        const stats = calculateNodeStatistics(node);
        
        // Update UI with statistics
        renderNodeStatistics(stats);
        
        // Show the statistics panel
        showNodeStatistics();
    } catch (error) {
        console.error('Error updating node statistics:', error);
        hideNodeStatistics();
    }
}

/**
 * Calculate statistics for the selected node
 * @param {Object} node - The selected node
 * @returns {Object} The calculated statistics
 */
function calculateNodeStatistics(node) {
    if (!node) {
        console.error('Node is undefined in calculateNodeStatistics');
        return {};
    }
    
    // Ensure node.data exists
    if (!node.data) {
        console.warn('Node data is undefined in calculateNodeStatistics, creating empty object');
        node.data = {};
    }
    
    // Double-check that node.data is an object
    if (typeof node.data !== 'object') {
        console.error('Node data is not an object in calculateNodeStatistics');
        node.data = {};
    }
    
    const state = window.state || {};
    const isComparisonMode = state.isComparisonMode || false;
    
    // Basic statistics
    const stats = {
        id: node.data.id || 'unknown',
        name: node.data.name || 'Unknown',
        title: node.data.title || '',
        fte: node.data.fte || 1,
        directReports: node.children ? node.children.length : 0,
        totalReports: countTotalDescendants(node),
        totalFte: calculateTotalFte(node),
        location: node.data.location || '',
        jobFamily: node.data.jobFamily || '',
        managementLevel: node.data.managementLevel || '',
        changeType: node.data.changeType || null,
        previousManager: null,
        directReportsAdded: [],
        directReportsRemoved: [],
        directReportsNetChange: 0,
        totalReportsNetChange: 0
    };
    
    // Additional statistics for comparison mode
    if (isComparisonMode) {
        // Previous manager info
        if (node.data.previousManagerId && previousManagerMap.has(node.data.previousManagerId)) {
            stats.previousManager = previousManagerMap.get(node.data.previousManagerId);
        }
        
        // Direct reports changes
        if (directReportsMap.has(node.data.id)) {
            const baselineDirectReports = directReportsMap.get(node.data.id);
            const currentDirectReports = node.children ? node.children.map(child => child.data.id) : [];
            
            // Find added direct reports
            stats.directReportsAdded = currentDirectReports
                .filter(id => !baselineDirectReports.includes(id))
                .map(id => {
                    const employee = findEmployeeById(id, state.currentData);
                    return employee ? employee.name : id;
                });
            
            // Find removed direct reports
            stats.directReportsRemoved = baselineDirectReports
                .filter(id => !currentDirectReports.includes(id))
                .map(id => {
                    const employee = findEmployeeById(id, state.baselineData);
                    return employee ? employee.name : id;
                });
            
            // Calculate net change
            stats.directReportsNetChange = stats.directReportsAdded.length - stats.directReportsRemoved.length;
        }
        
        // Total reports change
        if (totalReportsMap.has(node.data.id)) {
            const baselineTotalReports = totalReportsMap.get(node.data.id);
            stats.totalReportsNetChange = stats.totalReports - baselineTotalReports;
        }
    }
    
    return stats;
}

/**
 * Find an employee by ID in the data array
 * @param {string} id - The employee ID to find
 * @param {Array} data - The data array to search
 * @returns {Object|null} The found employee or null
 */
function findEmployeeById(id, data) {
    if (!data || !Array.isArray(data)) return null;
    return data.find(emp => emp.id === id) || null;
}

/**
 * Count the total number of descendants for a node
 * @param {Object} node - The node to count descendants for
 * @returns {number} The total number of descendants
 */
function countTotalDescendants(node) {
    if (!node || !node.children || node.children.length === 0) {
        return 0;
    }
    
    let count = node.children.length;
    
    for (const child of node.children) {
        count += countTotalDescendants(child);
    }
    
    return count;
}

/**
 * Calculate the total FTE for a node and its descendants
 * @param {Object} node - The node to calculate FTE for
 * @returns {number} The total FTE
 */
function calculateTotalFte(node) {
    if (!node) {
        return 0;
    }
    
    const nodeFte = node.data && node.data.fte ? parseFloat(node.data.fte) : 1;
    
    if (!node.children || node.children.length === 0) {
        return nodeFte;
    }
    
    let totalFte = nodeFte;
    
    for (const child of node.children) {
        totalFte += calculateTotalFte(child);
    }
    
    return parseFloat(totalFte.toFixed(2));
}

/**
 * Render the node statistics in the UI
 * @param {Object} stats - The statistics to render
 */
function renderNodeStatistics(stats) {
    const state = window.state || {};
    const isComparisonMode = state.isComparisonMode || false;
    
    // Employee info
    document.getElementById('employeeName').textContent = stats.name;
    document.getElementById('employeeTitle').textContent = stats.title || 'No Title';
    
    // Change type badge
    const changeTypeBadge = document.getElementById('employeeChangeType');
    if (stats.changeType && isComparisonMode) {
        changeTypeBadge.style.display = 'flex';
        
        if (stats.changeType === 'added') {
            changeTypeBadge.textContent = '➕ Added';
            changeTypeBadge.className = 'change-badge added';
        } else if (stats.changeType === 'moved') {
            changeTypeBadge.textContent = '↔ Moved';
            changeTypeBadge.className = 'change-badge moved';
        } else {
            changeTypeBadge.style.display = 'none';
        }
    } else {
        changeTypeBadge.style.display = 'none';
    }
    
    // Previous manager
    const previousManagerCard = document.getElementById('previousManagerCard');
    if (stats.previousManager && isComparisonMode) {
        document.getElementById('previousManagerName').textContent = stats.previousManager;
        previousManagerCard.style.display = 'block';
    } else {
        previousManagerCard.style.display = 'none';
    }
    
    // FTE stats
    document.getElementById('currentFte').textContent = stats.fte;
    document.getElementById('totalFte').textContent = stats.totalFte;
    
    // Team stats
    document.getElementById('directReports').textContent = stats.directReports;
    document.getElementById('totalReports').textContent = stats.totalReports;
    
    // Direct reports change
    const directReportsChange = document.getElementById('directReportsChange');
    if (isComparisonMode) {
        directReportsChange.style.display = 'block';
        
        // Added direct reports
        const directReportsAdded = document.getElementById('directReportsAdded');
        directReportsAdded.textContent = `+${stats.directReportsAdded.length}`;
        directReportsAdded.setAttribute('data-tooltip', JSON.stringify(stats.directReportsAdded));
        
        // Removed direct reports
        const directReportsRemoved = document.getElementById('directReportsRemoved');
        directReportsRemoved.textContent = `-${stats.directReportsRemoved.length}`;
        directReportsRemoved.setAttribute('data-tooltip', JSON.stringify(stats.directReportsRemoved));
        
        // Net change
        const netChange = stats.directReportsNetChange;
        const directReportsNet = document.getElementById('directReportsNet');
        directReportsNet.textContent = netChange > 0 ? `+${netChange}` : netChange;
        
        if (netChange > 0) {
            directReportsNet.style.color = '#059669';
        } else if (netChange < 0) {
            directReportsNet.style.color = '#dc2626';
        } else {
            directReportsNet.style.color = '';
        }
    } else {
        directReportsChange.style.display = 'none';
    }
    
    // Total reports change
    const totalReportsChange = document.getElementById('totalReportsChange');
    if (isComparisonMode) {
        totalReportsChange.style.display = 'block';
        
        // Net change
        const netChange = stats.totalReportsNetChange;
        const totalReportsNet = document.getElementById('totalReportsNet');
        totalReportsNet.textContent = netChange > 0 ? `+${netChange}` : netChange;
        
        if (netChange > 0) {
            totalReportsNet.style.color = '#059669';
        } else if (netChange < 0) {
            totalReportsNet.style.color = '#dc2626';
        } else {
            totalReportsNet.style.color = '';
        }
    } else {
        totalReportsChange.style.display = 'none';
    }
    
    // Optional fields
    const locationField = document.getElementById('locationField');
    const jobFamilyField = document.getElementById('jobFamilyField');
    const managementLevelField = document.getElementById('managementLevelField');
    
    // Location
    if (stats.location) {
        document.getElementById('locationValue').textContent = stats.location;
        locationField.style.display = 'flex';
    } else {
        locationField.style.display = 'none';
    }
    
    // Job family
    if (stats.jobFamily) {
        document.getElementById('jobFamilyValue').textContent = stats.jobFamily;
        jobFamilyField.style.display = 'flex';
    } else {
        jobFamilyField.style.display = 'none';
    }
    
    // Management level
    if (stats.managementLevel) {
        document.getElementById('managementLevelValue').textContent = stats.managementLevel;
        managementLevelField.style.display = 'flex';
    } else {
        managementLevelField.style.display = 'none';
    }
}

/**
 * Show the node statistics panel
 */
function showNodeStatistics() {
    const statsPanel = document.getElementById('selectedNodeStats');
    if (statsPanel) {
        statsPanel.style.display = 'flex';
    }
}

/**
 * Hide the node statistics panel
 */
function hideNodeStatistics() {
    const statsPanel = document.getElementById('selectedNodeStats');
    if (statsPanel) {
        statsPanel.style.display = 'none';
    }
    selectedNode = null;
}

/**
 * Build maps for comparison mode
 * This should be called when comparison mode is initialized
 */
function buildComparisonMaps() {
    const state = window.state || {};
    
    // Reset maps
    previousManagerMap.clear();
    directReportsMap.clear();
    totalReportsMap.clear();
    
    if (!state.baselineData || !Array.isArray(state.baselineData)) {
        console.warn('No baseline data available for comparison maps');
        return;
    }
    
    // Build previous manager map
    state.baselineData.forEach(emp => {
        if (emp.manager) {
            const manager = state.baselineData.find(m => m.id === emp.manager);
            if (manager) {
                previousManagerMap.set(emp.id, manager.name);
            }
        }
    });
    
    // Build direct reports map
    state.baselineData.forEach(emp => {
        const directReports = state.baselineData
            .filter(e => e.manager === emp.id)
            .map(e => e.id);
        
        directReportsMap.set(emp.id, directReports);
    });
    
    // Build total reports map using the hierarchy
    if (state.baselineHierarchy) {
        buildTotalReportsMap(state.baselineHierarchy);
    }
    
    console.log('[OrgChart] Comparison maps built');
}

/**
 * Recursively build the total reports map
 * @param {Object} node - The current node
 */
function buildTotalReportsMap(node) {
    if (!node) return;
    
    const totalReports = countTotalDescendants(node);
    totalReportsMap.set(node.data.id, totalReports);
    
    if (node.children) {
        node.children.forEach(child => {
            buildTotalReportsMap(child);
        });
    }
}

// Export functions to global window object
window.initNodeStatistics = initNodeStatistics;
window.updateNodeStatistics = updateNodeStatistics;
window.hideNodeStatistics = hideNodeStatistics;
window.buildComparisonMaps = buildComparisonMaps;
