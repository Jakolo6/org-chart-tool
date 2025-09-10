/**
 * @file Manages all statistical calculations, change analysis, and the rendering of stats-based UI components
 * like the overall stats overlay, the selected node panel, and the changelog.
 */

import { 
    state,
    setCurrentData, setComparisonMode, setChangeAnalysis, setRootNode
} from '../main.js';
import { buildHierarchy, renderChart } from './chartRenderer.js';
import { updateLayoutClasses } from './uiManager.js';
import { normalizeId } from '../utils/helpers.js';

console.log('[OrgChart] statsManager loaded');

/* ===========================================
   COMPARISON MODE MANAGEMENT
=========================================== */

let __toggleInProgress = false;
/**
 * Toggles the application between 'Baseline' and 'Comparison' mode.
 * This is the primary function for initiating a comparison, which triggers
 * change analysis and updates the entire UI to reflect the comparison state.
 */
export function toggleComparison() {
    if (__toggleInProgress) {
        console.warn('[Compare] toggleComparison ignored: already in progress');
        return;
    }
    __toggleInProgress = true;
    console.log('[Compare] toggleComparison start', {
        baselineCount: state.baselineData && state.baselineData.length,
        updateCount: state.updateData && state.updateData.length,
        currentMode: state.isComparisonMode
    });
    if (!state.baselineData || state.baselineData.length === 0) {
        alert('Please load baseline data first.');
        return;
    }
    if (!state.updateData || state.updateData.length === 0) {
        alert('Please load and confirm mapping for the Update file first.');
        return;
    }

    if (state.isComparisonMode) {
        // Switch back to baseline mode
        setComparisonMode(false);
        setCurrentData(state.baselineData);
        clearChangeTypes();
        
        // Update UI
        // Update all mode indicators
        document.querySelectorAll('.mode-indicator').forEach(el => {
            el.textContent = 'Baseline View';
            el.className = 'mode-indicator baseline';
        });
        const compareBtnEl = document.getElementById('compareBtn');
        if (compareBtnEl) compareBtnEl.textContent = '⇄ Switch to Comparison Mode';
        const legendEl = document.getElementById('legendContainer');
        if (legendEl) legendEl.style.display = 'none';
        const summaryBtn = document.getElementById('summaryStatsBtn');
        if (summaryBtn) summaryBtn.style.display = 'none';
        
    } else {
        // Switch to comparison mode
        setComparisonMode(true);
        
        // Analyze changes
        const analysis = analyzeChanges();
        setChangeAnalysis(analysis);
        
        // Apply change types to current data
        setCurrentData(state.updateData);
        applyChangeTypes();
        
        // Update UI
        // Update all mode indicators
        document.querySelectorAll('.mode-indicator').forEach(el => {
            el.textContent = 'Comparison View';
            el.className = 'mode-indicator comparison';
        });
        const compareBtnEl2 = document.getElementById('compareBtn');
        if (compareBtnEl2) compareBtnEl2.textContent = 'Back to Baseline';
        const legendEl2 = document.getElementById('legendContainer');
        if (legendEl2) legendEl2.style.display = 'block';
        const summaryBtn2 = document.getElementById('summaryStatsBtn');
        if (summaryBtn2) summaryBtn2.style.display = 'inline-block';
        
        // Update changelog panel
        updateChangelogPanel();
        
    }
    
    // Rebuild and render chart
    buildHierarchy();
    renderChart();
    // Always update overall statistics when mode changes
    try { updateOverallStatistics(); } catch (_) {}
    // Refresh selected node stats if a node is selected
    try { updateSelectedNodeStats(); } catch (e) { /* no-op */ }
    
    // Update layout classes
    updateLayoutClasses();
    window.__orgMode = { isComparisonMode: state.isComparisonMode };
    console.log('[Compare] toggleComparison end', { isComparisonMode });
    __toggleInProgress = false;
}

/* ===========================================
   CHANGE ANALYSIS
=========================================== */

/**
 * Compares the baseline and update datasets to identify all changes.
 * @returns {Object} An object containing arrays of new, moved, and exited employees,
 * plus cascade effects and a summary count.
 */
export function analyzeChanges() {
    if (!state.baselineData || !state.updateData) return null;
    
    // Build normalized lookup maps for robust matching
    const baselineMap = new Map();
    state.baselineData.forEach(emp => {
        baselineMap.set(normalizeId(emp.id), emp);
    });
    
    const updateMap = new Map();
    state.updateData.forEach(emp => {
        updateMap.set(normalizeId(emp.id), emp);
    });
    
    const changes = {
        new: [],
        moved: [],
        exit: [],
        unchanged: []
    };
    
    // Find new employees (in update but not in baseline)
    state.updateData.forEach(emp => {
        if (!baselineMap.has(normalizeId(emp.id))) {
            changes.new.push(emp);
        }
    });
    
    // Find exiting employees (in baseline but not in update)
    state.baselineData.forEach(emp => {
        if (!updateMap.has(normalizeId(emp.id))) {
            changes.exit.push(emp);
        }
    });
    
    // Find moved employees (manager changed)
    state.updateData.forEach(emp => {
        const baselineEmp = baselineMap.get(normalizeId(emp.id));
        if (baselineEmp) {
            const baseMgr = normalizeId(baselineEmp.managerId);
            const updMgr = normalizeId(emp.managerId);
            if (baseMgr !== updMgr) {
                // include previous manager name if available
                let previousManagerName = null;
                if (baselineEmp.managerId) {
                    const prevMgr = baselineMap.get(baseMgr);
                    previousManagerName = prevMgr ? prevMgr.name : baselineEmp.managerId;
                }
                changes.moved.push({
                    ...emp,
                    previousManager: baselineEmp.managerId,
                    previousManagerName
                });
            } else {
                changes.unchanged.push(emp);
            }
        }
    });
    
    // Calculate cascade effects
    const cascadeEffects = calculateCascadeEffects(changes.moved);
    
    return {
        ...changes,
        cascadeEffects,
        summary: {
            totalNew: changes.new.length,
            totalMoved: changes.moved.length,
            totalExit: changes.exit.length,
            totalUnchanged: changes.unchanged.length,
            totalCascade: cascadeEffects.length
        }
    };
}

/**
 * Calculates the downstream impact of employees who have moved.
 * It groups all subordinates affected by each moved manager.
 * @param {Array<Object>} movedEmployees - An array of employees who have changed managers.
 * @returns {{details: Array, totalAffected: number}} An object with the detailed breakdown and total count.
 */
export function calculateCascadeEffects(movedEmployees) {
    const cascadeDetails = new Map();
    let totalAffected = 0;

    movedEmployees.forEach(movedEmp => {
        const subordinates = findAllSubordinates(movedEmp.id, state.updateData);
        if (subordinates.length > 0) {
            cascadeDetails.set(movedEmp.id, {
                movedEmployee: movedEmp,
                affectedSubordinates: subordinates,
                count: subordinates.length
            });
            totalAffected += subordinates.length;
        }
    });

    return {
        details: Array.from(cascadeDetails.values()),
        totalAffected
    };
}

/**
 * Recursively finds all direct and indirect subordinates for a given manager ID.
 * @param {string} managerId - The ID of the manager to start the search from.
 * @param {Array<Object>} orgData - The flat array of organization data to search within.
 * @returns {Array<Object>} A flat array of all subordinate employees.
 */
export function findAllSubordinates(managerId, orgData) {
    const subordinates = [];
    
    function findDirectReports(id) {
        orgData.forEach(emp => {
            if (emp.managerId === id) {
                subordinates.push(emp);
                findDirectReports(emp.id); // Recursive for all levels
            }
        });
    }
    
    findDirectReports(managerId);
    return subordinates;
}

/* ===========================================
   CHANGE TYPE APPLICATION
=========================================== */

/**
 * Iterates through the current dataset and applies the `changeType` property
 * ('new', 'moved', 'cascade') to each employee based on the change analysis.
 * This is used for visual styling of the nodes and links.
 */
export function applyChangeTypes() {
    if (!state.changeAnalysis) return;
    
    // Mark new employees
    state.changeAnalysis.new.forEach(emp => {
        const employee = state.currentData.find(e => e.id === emp.id);
        if (employee) employee.changeType = 'new';
    });
    
    // Mark moved employees
    state.changeAnalysis.moved.forEach(emp => {
        const employee = state.currentData.find(e => e.id === emp.id);
        if (employee) {
            employee.changeType = 'moved';
            employee.previousManager = emp.previousManager;
        }
    });
    
    // Mark cascade effects
    state.changeAnalysis.cascadeEffects.forEach(effect => {
        const employee = state.currentData.find(e => e.id === effect.movedEmployee.id);
        if (employee && !employee.changeType) {
            employee.changeType = 'cascade';
        }
    });
}

/**
 * Removes all `changeType` and `previousManager` properties from the current dataset.
 * Used when switching back from comparison mode to baseline mode.
 */
export function clearChangeTypes() {
    if (state.currentData) {
        state.currentData.forEach(emp => {
            delete emp.changeType;
            delete emp.previousManager;
        });
    }
}

/* ===========================================
   STATISTICS DISPLAY
=========================================== */

/**
 * Toggles the visibility of the main Changelog panel.
 * This is triggered by the 'Summary Changes in Org' button.
 */
export function toggleSummaryStatistics() {
    console.log('[Stats] toggleSummaryStatistics clicked');
    const panel = document.getElementById('changelogPanel');
    const btn = document.getElementById('summaryStatsBtn');
    if (!panel) { console.warn('[Stats] changelogPanel not found'); return; }
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        // Close changelog panel
        try { window.closeChangelogPanel && window.closeChangelogPanel(); } catch (_) {}
        if (btn) btn.textContent = '📊 Summary Changes in Org';
    } else {
        // Open and populate changelog panel
        try { window.openChangelogPanel && window.openChangelogPanel(); } catch (_) {}
        try { updateChangelogPanel(); } catch (_) {}
        if (btn) btn.textContent = '✖ Close Summary';
    }
}

/**
 * Calculates and renders the small, always-visible overall statistics overlay.
 */
export function updateOverallStatistics() {
    const display = document.getElementById('overallStatsDisplay');
    if (!display) return;
    if (!state.rootNode) {
        display.classList.remove('visible');
        setTimeout(() => { display.style.display = 'none'; }, 400);
        return;
    }
    const stats = calculateOverallStatistics();
    renderOverallStatistics(stats);
}

/**
 * Performs the core calculation for the overall statistics overlay.
 * @returns {Object} An object with total employees, FTE, max depth, unique titles, and their deltas.
 */
function calculateOverallStatistics() {
    const totalEmployees = state.currentData.length;
    const maxTreeDepth = calculateMaxDepth(state.rootNode);
    const uniqueTitles = new Set(state.currentData.map(emp => emp.title)).size;
    const totalFTE = state.currentData.reduce((sum, emp) => sum + (parseFloat(emp.fte) || 1.0), 0);
    let deltas = null;
    if (state.isComparisonMode && state.baselineData.length > 0) {
        const baselineStats = calculateStatsForData(state.baselineData);
        deltas = {
            totalEmployees: totalEmployees - baselineStats.totalEmployees,
            maxTreeDepth: maxTreeDepth - baselineStats.maxTreeDepth,
            uniqueTitles: uniqueTitles - baselineStats.uniqueTitles,
            totalFTE: parseFloat((totalFTE - baselineStats.totalFTE).toFixed(1))
        };
    }
    return { totalEmployees, maxTreeDepth, uniqueTitles, totalFTE: parseFloat(totalFTE.toFixed(1)), deltas };
}

function calculateStatsForData(data) {
    const tempRoot = buildTempHierarchy(data);
    return {
        totalEmployees: data.length,
        maxTreeDepth: tempRoot ? calculateMaxDepth(tempRoot) : 0,
        uniqueTitles: new Set(data.map(emp => emp.title)).size,
        totalFTE: data.reduce((sum, emp) => sum + (parseFloat(emp.fte) || 1.0), 0)
    };
}

function buildTempHierarchy(data) {
    const nodeMap = new Map();
    data.forEach(n => nodeMap.set(normalizeId(n.id), { ...n, children: [] }));
    let root = null;
    data.forEach(n => {
        const id = normalizeId(n.id);
        const mgr = normalizeId(n.managerId || n.manager);
        if (mgr && nodeMap.has(mgr)) {
            nodeMap.get(mgr).children.push(nodeMap.get(id));
        } else {
            root = nodeMap.get(id);
        }
    });
    return root;
}

function renderOverallStatistics(stats) {
    const display = document.getElementById('overallStatsDisplay');
    const container = document.getElementById('overallStatsItems');
    if (!display || !container) return;
    const renderStat = (label, value, delta) => {
        // ... rest of the code remains the same ...
    }
    // ... rest of the code remains the same ...
}

function calculateReportingChanges(nodeId) {
    // Compare baseline vs current direct reports for this manager
    const baseDirect = state.baselineData.filter(emp => normalizeId(emp.managerId || emp.manager) === normalizeId(nodeId));
    const curDirect = state.currentData.filter(emp => normalizeId(emp.managerId || emp.manager) === normalizeId(nodeId));
    const baseIds = new Set(baseDirect.map(emp => normalizeId(emp.id)));
    const curIds = new Set(curDirect.map(emp => normalizeId(emp.id)));
    const added = [...curIds].filter(id => !baseIds.has(id));
    const removed = [...baseIds].filter(id => !curIds.has(id));
    return {
        // ... rest of the code remains the same ...
        removed: removed.length,
        netChange: added.length - removed.length,
        addedNames: added.map(id => (curDirect.find(e => normalizeId(e.id) === id)?.name) || id),
        removedNames: removed.map(id => (baseDirect.find(e => normalizeId(e.id) === id)?.name) || id)
    };
}

function calculateTotalReportsChanges(nodeId) {
    // Compare baseline vs current descendant sets
    const baselineDesc = findAllSubordinates(nodeId, state.baselineData);
    const currentDesc = findAllSubordinates(nodeId, state.currentData);
    const baseIds = new Set(baselineDesc.map(emp => normalizeId(emp.id)));
    const curIds = new Set(currentDesc.map(emp => normalizeId(emp.id)));
    const added = [...curIds].filter(id => !baseIds.has(id));
    const removed = [...baseIds].filter(id => !curIds.has(id));
    return { added: added.length, removed: removed.length, netChange: added.length - removed.length };
}

export function updateSelectedNodeStats() {
    // ... rest of the code remains the same ...
}

function hideSelectedNodeStats() {
    const statsDisplay = document.querySelector('.selected-stats-display');
    if (statsDisplay) {
        statsDisplay.style.opacity = '0';
        statsDisplay.style.transform = 'translateY(-10px)';
    }
}

/* ===========================================
   CHANGELOG PANEL UPDATES
=========================================== */

/**
 * Populates the entire Changelog panel with data from the `changeAnalysis` object,
 * including the Added, Moved, Exit, and Cascade Effects sections.
 */
export function updateChangelogPanel() {
    if (!state.changeAnalysis) return;

    const changelogContent = document.getElementById('changelogContent');
    if (!changelogContent) return;

    let contentHTML = '';
    if (state.changeAnalysis.new.length > 0) {
        contentHTML += createChangeSection('new', 'New Hires', state.changeAnalysis.new);
    }
    if (state.changeAnalysis.moved.length > 0) {
        contentHTML += createChangeSection('moved', 'Moved Employees', state.changeAnalysis.moved);
    }
    if (state.changeAnalysis.exit.length > 0) {
        contentHTML += createChangeSection('exit', 'Exits', state.changeAnalysis.exit);
    }
    changelogContent.innerHTML = contentHTML;

    // Update cascade effects section
    const cascadeSection = document.getElementById('cascadeSection');
    if (state.changeAnalysis.cascadeEffects && state.changeAnalysis.cascadeEffects.totalAffected > 0) {
        cascadeSection.style.display = 'block';
        const totalDirect = state.changeAnalysis.new.length + state.changeAnalysis.moved.length + state.changeAnalysis.exit.length;
        document.getElementById('totalDirectChanges').textContent = totalDirect;
        document.getElementById('totalCascadeAffected').textContent = state.changeAnalysis.cascadeEffects.totalAffected;
        document.getElementById('totalWithCascade').textContent = totalDirect + state.changeAnalysis.cascadeEffects.totalAffected;
        updateCascadeDetails(state.changeAnalysis.cascadeEffects.details);
    } else {
        cascadeSection.style.display = 'none';
    }
}

function updateCascadeDetails(details) {
    const list = document.getElementById('cascadeDetailsList');
    list.innerHTML = '';
    details.forEach(detail => {
        const item = document.createElement('div');
        item.className = 'cascade-detail-item';
        const subordinatesList = detail.affectedSubordinates.map(sub => `<span class="subordinate-tag">${sub.name}</span>`).join('');
        item.innerHTML = `
            <div class="cascade-manager">🔗 ${detail.movedEmployee.name} (${detail.movedEmployee.title})</div>
            <div class="cascade-affected">📍 Affected ${detail.count} subordinate${detail.count > 1 ? 's' : ''}:</div>
            <div class="cascade-subordinates">${subordinatesList}</div>
        `;
        list.appendChild(item);
    });
}

function createChangeSection(type, title, changes) {
    const typeClass = type === 'new' ? 'added' : type === 'moved' ? 'moved' : 'exit';
    
    let sectionHTML = `
        <div class="change-section" data-change-type="${type}">
            <div class="change-header" onclick="toggleChangeSection('${type}')">
                <div class="change-type ${typeClass}">
                    ${title}
                    <span class="change-count ${typeClass}">${changes.length}</span>
                </div>
                <span class="chevron">▶</span>
            </div>
            <div class="change-list">
    `;
    
    changes.forEach(change => {
        let detail = change.title || 'No title';
        if (type === 'moved' && change.previousManager) {
            detail += ` (from ${change.previousManager})`;
        }
        
        sectionHTML += `
            <div class="change-item" onclick="focusOnEmployee('${change.id}')">
                <div class="change-item-name">${change.name}</div>
                <div class="change-item-detail">${detail}</div>
            </div>
        `;
    });
    
    sectionHTML += `
            </div>
        </div>
    `;
    
    return sectionHTML;
}

/* ===========================================
   MODULE INITIALIZATION
=========================================== */

/**
 * Initializes the statistics manager module and exposes key functions to the global scope
 * for `onclick` handlers and cross-module calls.
 */
export function initStatsManager() {
    console.log('[OrgChart] Stats manager initialized');
    
    // Make functions globally available
    window.toggleCascadeDetails = function() {
        const list = document.getElementById('cascadeDetailsList');
        const chevron = document.getElementById('cascadeChevron');
        if (list && chevron) {
            const isExpanded = list.style.display === 'block';
            list.style.display = isExpanded ? 'none' : 'block';
            chevron.classList.toggle('expanded', !isExpanded);
        }
    };
    window.toggleComparisonMode = toggleComparison;
    window.updateSelectedNodeStats = updateSelectedNodeStats;
    window.hideSelectedNodeStats = hideSelectedNodeStats;
}

// Export for use by other modules
export { 
    toggleComparison as toggleComparisonMode
    // updateOverallStatistics is already exported as a function declaration
    // updateSelectedNodeStats is already exported as a function declaration
    // toggleSummaryStatistics is already exported as a function declaration
    // initStatsManager is already exported as a function declaration
};

/**
 * @deprecated Use updateOverallStatistics instead
 */
export function updateOverallStats() {
    console.warn('updateOverallStats is deprecated. Use updateOverallStatistics instead.');
    return updateOverallStatistics();
}
