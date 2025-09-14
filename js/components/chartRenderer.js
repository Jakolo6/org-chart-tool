/**
 * @file Responsible for all D3.js rendering, including nodes, links, zoom/pan,
 * and layout calculations for the organization chart.
 */

import { 
    CONFIG, state,
    setSvgElements, setDimensions, setRootNode, setSelectedNode
} from '../main.js';
import { updateSelectedNodeStats } from './statsManager.js';
import { normalizeId, isBlankOrEmpty, wrapSVGText } from '../utils/helpers.js';

console.log('[OrgChart] chartRenderer loaded');

/* ===========================================
   CHART INITIALIZATION
=========================================== */

/**
 * Initializes the chart with the given selector.
 * @param {string} selector The CSS selector for the chart container.
 */
export function initChart(selector) {
    const container = d3.select(selector);
    if (container.empty()) {
        console.error(`Container not found: ${selector}`);
        return false;
    }

    // Clear any existing SVG
    container.selectAll('svg').remove();

    // Get container dimensions
    const containerNode = container.node();
    const width = containerNode.clientWidth;
    const height = containerNode.clientHeight || 500;

    // Create SVG element
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('class', 'org-chart-svg');

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // Create a group for the chart content
    const g = svg.append('g')
        .attr('class', 'chart-content');

    // Update state
    state.svg = svg;
    state.g = g;
    state.width = width;
    state.height = height;
    state.zoom = zoom;

    return true;
}

/**
 * Initializes the main SVG container and D3 zoom behavior.
 * This should be called once when the application loads.
 */
export function initializeChart() {
    // Get container dimensions
    const container = document.querySelector('.chart-area');
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    setDimensions(newWidth, newHeight);

    // Initialize SVG
    const svgElement = d3.select('#chartSvg')
        .attr('width', newWidth)
        .attr('height', newHeight);

    // Create main group for zoom/pan
    const gElement = svgElement.append('g').attr('class', 'main-group');

    // Setup zoom behavior
    const zoomBehavior = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', function(event) {
            gElement.attr('transform', event.transform);
        });

    svgElement.call(zoomBehavior);
    
    // Store references in global state
    setSvgElements(svgElement, gElement, zoomBehavior);
}

/* ===========================================
   HIERARCHY BUILDING
=========================================== */

/**
 * Constructs the hierarchical data structure from the flat `currentData` array.
 * It identifies the root node and builds parent-child relationships.
 * @returns {Object|null} The root node of the hierarchy, or null if data is empty.
 */
export function buildHierarchy() {
    if (!state.currentData || state.currentData.length === 0) {
        console.log('No data available for hierarchy building');
        return null;
    }

    // Create lookup map
    const employeeMap = new Map();
    state.currentData.forEach(emp => {
        const normalizedId = normalizeId(emp.id);
        employeeMap.set(normalizedId, {
            ...emp,
            id: normalizedId,
            children: [],
            _children: null
        });
    });

    let root = null;

    // Build parent-child relationships
    const potentialRoots = [];
    
    state.currentData.forEach(emp => {
        const normalizedId = normalizeId(emp.id);
        const employee = employeeMap.get(normalizedId);
        
        // Check if manager field is blank/empty (root node)
        if (isBlankOrEmpty(emp.managerId)) {
            potentialRoots.push(employee);
        } else {
            const normalizedManagerId = normalizeId(emp.managerId);
            const manager = employeeMap.get(normalizedManagerId);
            
            if (manager) {
                manager.children.push(employee);
                employee.parent = manager;
            } else {
                console.warn(`Manager "${emp.managerId}" not found for employee "${emp.name}", treating as potential root.`);
                potentialRoots.push(employee);
            }
        }
    });
    
    // Select the best root node using a more robust algorithm
    if (potentialRoots.length === 0) {
        console.error('No top-level employee (CEO) found. Please check your data for an employee with a blank manager field.');
        root = state.currentData.length > 0 ? state.currentData[0] : null; // Fallback
    } else {
        // First, try to find a node with an empty managerId
        const trueRoot = potentialRoots.find(r => isBlankOrEmpty(r.managerId));
        
        if (trueRoot) {
            // We found a node with empty managerId - this is the true root
            root = trueRoot;
            console.log(`Root node selected by empty manager: ${root.name}`);
        } else {
            // Otherwise, use the node with the most direct reports as the root
            root = potentialRoots.reduce((best, current) => 
                (current.children.length > best.children.length) ? current : best, potentialRoots[0]
            );
            console.log(`Root node selected by most reports: ${root.name} with ${root.children.length} direct reports`);
        }
        
        console.log('Potential roots found:', potentialRoots.map(r => `${r.name} (${r.children.length} children)`));
        
        if (potentialRoots.length > 1) {
            console.warn(`Multiple potential CEOs found (${potentialRoots.length}). Selected: ${root.name} as root.`);
        }
    }

    // Initialize all nodes as collapsed
    employeeMap.forEach(employee => {
        employee.expanded = false;
    });

    if (root) {
        // Set initial collapsed state: root expanded, all others collapsed
        root.expanded = true;
        setRootNode(root);
        // Calculate layout starting from center position
        calculateLayout(root, 0, 0);
    }

    return root;
}

/* ===========================================
   LAYOUT CALCULATION
=========================================== */

/**
 * Calculates the total width needed for a node and all its visible children.
 * This is used to properly space nodes in the layout.
 * @param {Object} node The node to calculate width for
 * @returns {number} The total width needed for this node and its subtree
 */
function calculateSubtreeWidth(node) {
    // Base case: node with no children or collapsed node
    if (!node.children || node.children.length === 0 || !node.expanded) {
        return CONFIG.nodeWidth;
    }
    
    // Calculate sum of children's subtree widths
    const childrenWidth = node.children.reduce((sum, child) => {
        return sum + calculateSubtreeWidth(child);
    }, 0);
    
    // Add horizontal gaps between children
    const gapsWidth = (node.children.length - 1) * CONFIG.horizontalGap;
    
    // Return the maximum of node's own width or the total width of its children
    return Math.max(CONFIG.nodeWidth, childrenWidth + gapsWidth);
}

/**
 * Recursively calculates the x and y coordinates for each node in the tree.
 * This uses a custom algorithm to position children centered beneath their parent.
 * @param {Object} node The current node to calculate the layout for.
 * @param {number} [x=0] The x-coordinate of the current node.
 * @param {number} [y=0] The y-coordinate of the current node.
 */
export function calculateLayout(node, x = 0, y = 0) {
    if (!node) return;

    node.x = x;
    node.y = y;
    
    console.log(`Setting coordinates for ${node.name}: x=${x}, y=${y}`);

    // Only calculate layout for expanded nodes with children
    if (node.expanded && node.children && node.children.length > 0) {
        // Compute subtree width for this node (used to center children block)
        node.subtreeWidth = calculateSubtreeWidth(node);

        // Sort children by change status if in comparison mode
        if (state.isComparisonMode) {
            sortChildrenByChangeStatus(node.children);
        }

        // Vertical spacing: move down by vertical gap (centers are separated by verticalGap)
        const childY = y + CONFIG.verticalGap;

        // Starting X so that total children block is centered under the parent
        let currentX = x - (node.subtreeWidth - CONFIG.nodeWidth) / 2;

        node.children.forEach((child, i) => {
            const childSubtreeWidth = calculateSubtreeWidth(child);
            const childCenterX = currentX + childSubtreeWidth / 2;
            
            calculateLayout(child, childCenterX, childY);
            
            // Advance currentX by this child's subtree width plus horizontal gap
            currentX += childSubtreeWidth + CONFIG.horizontalGap;
        });
    }
}

/* ===========================================
   EXPAND/COLLAPSE UTILITY FUNCTIONS
=========================================== */

/**
 * Recursively collapses all nodes in a subtree by setting `expanded` to false.
 * @param {Object} node The starting node of the subtree to collapse.
 */
export function collapseAllNodes(node) {
    node.expanded = false;
    if (node.children) {
        node.children.forEach(collapseAllNodes);
    }
}

/**
 * Resets the chart to its initial view: collapses all nodes except the root and re-renders.
 */
export function resetView() {
    if (!state.rootNode) return;
    collapseAllNodes(state.rootNode);
    state.rootNode.expanded = true;
    renderChart();
}

/* ===========================================
   VISIBILITY FUNCTIONS
=========================================== */

/**
 * Traverses the hierarchy and returns a flat array of all visible nodes.
 * A node is visible if it's the root or if its parent is expanded.
 * @param {Object} node The root node of the hierarchy to traverse.
 * @returns {Array<Object>} A flat array of visible nodes.
 */
export function getVisibleNodes(node) {
    let nodes = [node];
    if (node.expanded && node.children && node.children.length > 0) {
        node.children.forEach(child => {
            nodes = nodes.concat(getVisibleNodes(child));
        });
    }
    return nodes;
}

/**
 * Traverses the hierarchy and returns a flat array of all visible links.
 * A link is visible if it connects a parent to a child and the parent is expanded.
 * @param {Object} node The root node of the hierarchy to traverse.
 * @returns {Array<Object>} A flat array of visible link objects.
 */
export function getVisibleLinks(node) {
    let links = [];
    if (node.expanded && node.children && node.children.length > 0) {
        node.children.forEach(child => {
            links.push({ source: node, target: child, changeType: child.changeType });
            links = links.concat(getVisibleLinks(child));
        });
    }
    return links;
}

/* ===========================================
   TEXT WRAPPING AND INTERACTION HANDLERS
=========================================== */


/**
 * Handles click events on a chart node.
 * Sets the clicked node as the `selectedNode` and updates the stats panel.
 * @param {Event} event The D3 event object.
 * @param {Object} d The data object for the clicked node.
 */
function handleNodeClick(event, d) {
    event.stopPropagation();
    if (d.isStub) return;
    
    // Update global selected node state
    setSelectedNode(d);
    
    // Update visual selection styling
    state.g.selectAll('.node-card').classed('selected', node => node.id === d.id);
    
    // Update node statistics
    updateSelectedNodeStatistics(d);
}

/**
 * Updates the statistics panel with details about the selected node.
 * @param {Object} node The selected node.
 */
function updateSelectedNodeStatistics(node) {
    if (!node) return;
    
    const statsContainer = document.getElementById('selectedStatsContainer');
    if (!statsContainer) return;
    
    // Create stats HTML
    let statsHtml = `
        <div class="stats-panel">
            <h3>${node.name}</h3>
            <div class="stats-grid">
                ${node.title ? `
                    <div class="stat-item">
                        <div class="stat-label">Title</div>
                        <div class="stat-value">${node.title}</div>
                    </div>
                ` : ''}
                ${node.fte ? `
                    <div class="stat-item">
                        <div class="stat-label">FTE</div>
                        <div class="stat-value">${node.fte}</div>
                    </div>
                ` : ''}
                ${node.location ? `
                    <div class="stat-item">
                        <div class="stat-label">Location</div>
                        <div class="stat-value">${node.location}</div>
                    </div>
                ` : ''}
                ${node.jobFamily ? `
                    <div class="stat-item">
                        <div class="stat-label">Job Family</div>
                        <div class="stat-value">${node.jobFamily}</div>
                    </div>
                ` : ''}
                ${node.managementLevel ? `
                    <div class="stat-item">
                        <div class="stat-label">Management Level</div>
                        <div class="stat-value">${node.managementLevel}</div>
                    </div>
                ` : ''}
                <div class="stat-item">
                    <div class="stat-label">Direct Reports</div>
                    <div class="stat-value">${node.children ? node.children.length : 0}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Total Team Size</div>
                    <div class="stat-value">${countTotalDescendants(node)}</div>
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
 * Handles mouse hover events on a chart node.
 * Highlights the ancestor path of the hovered node.
 * @param {Event} event The D3 event object.
 * @param {Object} d The data object for the hovered node.
 */
function handleNodeHover(event, d) {
    if (d.isStub) return;
    
    // Find ancestors for highlighting
    const ancestors = findAncestors(d);
    state.g.selectAll('.node-card').classed('ancestor-highlight', node => ancestors.includes(node.id));
    
    // Show tooltip
    const tooltip = d3.select('#tooltip');
    tooltip.style('display', 'block')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY + 10) + 'px');
    
    // Populate tooltip content
    let tooltipContent = `
        <h4>${d.name}</h4>
        ${d.title ? `<p><span class="tooltip-label">Title:</span> ${d.title}</p>` : ''}
    `;
    
    // Add additional properties if available
    if (d.fte) tooltipContent += `<p><span class="tooltip-label">FTE:</span> ${d.fte}</p>`;
    if (d.location) tooltipContent += `<p><span class="tooltip-label">Location:</span> ${d.location}</p>`;
    if (d.jobFamily) tooltipContent += `<p><span class="tooltip-label">Job Family:</span> ${d.jobFamily}</p>`;
    if (d.managementLevel) tooltipContent += `<p><span class="tooltip-label">Level:</span> ${d.managementLevel}</p>`;
    
    tooltip.html(tooltipContent);
}

/**
 * Handle node unhover event.
 * @param {Event} event The mouse event.
 * @param {Object} d The node data object.
 */
function handleNodeUnhover(event, d) {
    // Remove ancestor highlighting
    state.g.selectAll('.node-card').classed('ancestor-highlight', false);
    
    // Hide tooltip
    d3.select('#tooltip').style('display', 'none');
}

/**
 * Find all ancestor node IDs for a given node.
 * @param {Object} node The node to find ancestors for.
 * @returns {Array<string>} Array of ancestor node IDs.
 */
function findAncestors(node) {
    const ancestors = [];
    const parentMap = new Map();
    
    // Build parent map
    function buildParentMap(node) {
        if (node.children) {
            node.children.forEach(child => {
                parentMap.set(child.id, node.id);
                buildParentMap(child);
            });
        }
    }
    
    if (state.rootNode) {
        buildParentMap(state.rootNode);
    }
    
    // Find ancestors
    let currentId = node.id;
    while (parentMap.has(currentId)) {
        const parentId = parentMap.get(currentId);
        ancestors.push(parentId);
        currentId = parentId;
    }
    
    return ancestors;
}

/**
 * Sets up the tooltip for node hover information.
 */
function setupTooltip() {
    // Make sure tooltip container exists
    let tooltip = d3.select('#tooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('id', 'tooltip')
            .attr('class', 'tooltip')
            .style('display', 'none');
    }
}

/**
 * Expands all nodes in the chart.
 */
export function expandAll() {
    if (!state.rootNode) return;
    expandAllNodes(state.rootNode);
    renderChart();
}

/**
 * Recursively expands all nodes.
 * @param {Object} node The node to expand.
 */
function expandAllNodes(node) {
    if (node.children && node.children.length > 0) {
        node.expanded = true;
        node.children.forEach(expandAllNodes);
    }
}

/**
 * Collapses all nodes except the root.
 */
export function collapseAll() {
    if (!state.rootNode) return;
    collapseAllNodes(state.rootNode);
    state.rootNode.expanded = true; // Keep root expanded
    renderChart();
}

/**
 * Recursively collapses all nodes.
 * @param {Object} node The node to collapse.
 */
function collapseAllNodes(node) {
    if (node.children && node.children.length > 0) {
        node.expanded = false;
        node.children.forEach(collapseAllNodes);
    }
}

/**
 * Resets the view to center on the root node.
 */
export function resetView() {
    if (!state.rootNode || !state.svg || !state.zoom) return;
    
    collapseAllNodes(state.rootNode);
    state.rootNode.expanded = true;
    state.selectedNode = state.rootNode;
    renderChart();
    updateSelectedNodeStatistics(state.rootNode);
    centerChart();
}

/* ===========================================
   CHART RENDERING
=========================================== */

/**
 * Main rendering function for the chart.
 * It clears the SVG, gets the visible nodes and links, and calls the respective
 * rendering functions for them.
 */
export function renderChart(rootNode, selector) {
    if (!rootNode) {
        console.log('No data to render');
        return;
    }
    
    // Initialize chart if selector is provided
    if (selector) {
        initChart(selector);
    }
    
    if (!state.g) {
        console.log('Chart not initialized');
        return;
    }
    
    // Set root node in state
    state.rootNode = rootNode;
    
    // Calculate layout
    calculateLayout(state.rootNode, state.width / 2, 100);
    
    // Get only visible nodes and links based on expanded state
    const nodes = getVisibleNodes(state.rootNode);
    const links = getVisibleLinks(state.rootNode);

    // Render connections first (so they appear behind nodes)
    renderConnections(links);
    
    // Render nodes
    renderNodes(nodes);
    
    // Auto-fit the chart
    setTimeout(() => {
        fitChartToView();
    }, 100);
    
    // Setup tooltip
    setupTooltip();
}

/**
 * Renders the L-shaped SVG paths for the links between nodes.
 * @param {Array<Object>} links The array of visible link objects to render.
 */
function renderConnections(links) {
    const connections = state.g.selectAll('.connection-line')
        .data(links, d => `${d.source.id}-${d.target.id}`);
        
    connections.enter()
        .append('path')
        .attr('class', d => `connection-line ${d.changeType || ''}`)
        .attr('d', generateLShapedPath)
        .style('opacity', 0)
        .transition()
        .duration(CONFIG.animationDuration)
        .style('opacity', d => d.changeType === 'exit' ? 0.5 : (d.changeType ? 0.8 : 0.6));
        
    connections.transition()
        .duration(CONFIG.animationDuration)
        .attr('d', generateLShapedPath)
        .attr('class', d => `connection-line ${d.changeType || ''}`);
        
    connections.exit()
        .transition()
        .duration(CONFIG.animationDuration)
        .style('opacity', 0)
        .remove();
}

/**
 * Generates an L-shaped path between two nodes.
 * @param {Object} link The link object with source and target nodes.
 * @returns {string} The SVG path string.
 */
function generateLShapedPath(link) {
    const sourceX = link.source.x;
    const sourceY = link.source.y + CONFIG.nodeHeight / 2;
    const targetX = link.target.x;
    const targetY = link.target.y - CONFIG.nodeHeight / 2;
    const midY = sourceY + (targetY - sourceY) / 2;
    
    return `M${sourceX},${sourceY} L${sourceX},${midY} L${targetX},${midY} L${targetX},${targetY}`;
}

/**
 * Renders the SVG groups for each visible node, including the card, text, and expand/collapse button.
 * It also handles the D3 data join and enter/update/exit selections.
 * @param {Array<Object>} nodes The array of visible node objects to render.
 */
function renderNodes(nodes) {
    const nodeGroups = state.g.selectAll('.node-group')
        .data(nodes, d => d.id);
    
    // Handle exit selection
    nodeGroups.exit()
        .transition()
        .duration(CONFIG.animationDuration)
        .style('opacity', 0)
        .remove();
    
    // Handle enter selection
    const enterGroups = nodeGroups.enter()
        .append('g')
        .attr('class', 'node-group')
        .attr('transform', d => `translate(${d.x}, ${d.y})`)
        .style('opacity', 0);
    
    // Add moved halo for moved nodes
    enterGroups.filter(d => d.changeType === 'moved')
        .append('rect')
        .attr('class', 'moved-halo')
        .attr('x', -CONFIG.nodeWidth / 2 - 4)
        .attr('y', -CONFIG.nodeHeight / 2 - 4)
        .attr('width', CONFIG.nodeWidth + 8)
        .attr('height', CONFIG.nodeHeight + 8);
    
    // Add main node card
    enterGroups.append('rect')
        .attr('class', d => `node-card ${d.changeType || ''}`)
        .attr('x', -CONFIG.nodeWidth / 2)
        .attr('y', -CONFIG.nodeHeight / 2)
        .attr('width', CONFIG.nodeWidth)
        .attr('height', CONFIG.nodeHeight);
    
    // Add name text with wrapping
    enterGroups.append('text')
        .attr('class', d => `node-text ${d.changeType || ''}`)
        .attr('y', -15)
        .each(function(d) {
            wrapSVGText(d3.select(this), d.name, CONFIG.nodeWidth - 20, 2, -15);
        });
    
    // Add title text with wrapping
    enterGroups.append('text')
        .attr('class', d => `node-title ${d.changeType || ''}`)
        .attr('y', 15)
        .each(function(d) {
            wrapSVGText(d3.select(this), d.title || '', CONFIG.nodeWidth - 20, 2, 15);
        });
    
    // Add hover and click handlers
    enterGroups
        .on('mouseenter', handleNodeHover)
        .on('mouseleave', handleNodeUnhover)
        .on('click', (event, d) => handleNodeClick(event, d));
    
    // Merge enter and update selections
    const allGroups = nodeGroups.merge(enterGroups);
    
    // Remove existing expand buttons
    allGroups.selectAll('.expand-button, .expand-icon').remove();
    
    // Add expand/collapse buttons for nodes with children
    allGroups.filter(d => d.children && d.children.length > 0)
        .each(function(d) {
            const group = d3.select(this);
            
            group.append('circle')
                .attr('class', 'expand-button')
                .attr('cx', CONFIG.nodeWidth / 2 - 10)
                .attr('cy', -CONFIG.nodeHeight / 2 + 10)
                .attr('r', 8)
                .on('click', (event, d) => {
                    event.stopPropagation();
                    d.expanded = !d.expanded;
                    renderChart();
                });
            
            group.append('text')
                .attr('class', 'expand-icon')
                .attr('x', CONFIG.nodeWidth / 2 - 10)
                .attr('y', -CONFIG.nodeHeight / 2 + 10)
                .text(d => d.expanded ? '−' : '+');
        });
    
    // Animate nodes into position
    allGroups.transition()
        .duration(CONFIG.animationDuration)
        .attr('transform', d => `translate(${d.x}, ${d.y})`)
        .style('opacity', 1);
    
    // Update selected state
    allGroups.select('.node-card')
        .attr('class', d => `node-card ${d.changeType || ''} ${state.selectedNode && state.selectedNode.id === d.id ? 'selected' : ''}`);
}

function getNodeColor(node) {
    if (!state.isComparisonMode) return '#f8fafc';
    
    switch (node.changeType) {
        case 'new': return 'rgba(5, 150, 105, 0.1)';
        case 'moved': return 'rgba(253, 226, 91, 0.3)';
        case 'exit': return 'rgba(220, 38, 38, 0.1)';
        default: return '#f8fafc';
    }
}

function getNodeBorderColor(node) {
    if (!state.isComparisonMode) return '#e2e8f0';
    
    switch (node.changeType) {
        case 'new': return '#059669';
        case 'moved': return '#FDE25B';
        case 'exit': return '#dc2626';
        default: return '#e2e8f0';
    }
}

/* ===========================================
   NODE SELECTION & INTERACTION
=========================================== */

export function selectNode(node) {
    // Update selected node in global state
    setSelectedNode(node);
    
    // Update visual selection
    state.g.selectAll('.node rect')
        .style('stroke-width', d => d === node ? 4 : 2)
        .style('stroke', d => d === node ? '#AACFCB' : getNodeBorderColor(d));
    
    // Update stats panel (handled by statsManager)
    updateSelectedNodeStats();
}

/* ===========================================
   CHART UTILITIES
=========================================== */

/**
 * Calculates the optimal scale and translation to fit the entire chart within the viewport.
 */
export function fitChartToView() {
    if (!state.g || !state.svg) return;
    
    const bounds = state.g.node().getBBox();
    if (bounds.width === 0 || bounds.height === 0) return;
    
    const fullWidth = state.width;
    const fullHeight = state.height;
    const widthScale = fullWidth / bounds.width;
    const heightScale = fullHeight / bounds.height;
    const scale = Math.min(widthScale, heightScale) * 0.9; // 90% to add some padding
    
    const centerX = fullWidth / 2 - bounds.x * scale - (bounds.width * scale) / 2;
    const centerY = fullHeight / 2 - bounds.y * scale - (bounds.height * scale) / 2;
    
    const transform = d3.zoomIdentity.translate(centerX, centerY).scale(scale);
    state.svg.transition().duration(750).call(state.zoom.transform, transform);
}

/**
 * Handles window resize events by updating the SVG dimensions and re-fitting the chart.
 */
export function handleResize() {
    const container = document.querySelector('.chart-area');
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    
    setDimensions(newWidth, newHeight);
    
    if (state.svg) {
        state.svg.attr('width', newWidth).attr('height', newHeight);
        fitChartToView();
    }
}

/* ===========================================
   MODULE INITIALIZATION
=========================================== */

/**
 * Initializes the chart renderer module, setting up the debounced resize handler.
 */
export function initChartRenderer() {
    console.log('[OrgChart] Chart renderer initialized');
    
    // Set up resize handler
    let resizeTimeout;
    window.addEventListener('resize', function() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 200);
    });
}
