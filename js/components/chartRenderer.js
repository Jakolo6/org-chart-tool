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
    
    // Call imported updateSelectedNodeStats function
    updateSelectedNodeStats();
    
    // Update visual selection styling
    state.g.selectAll('.node-card').classed('selected', node => node.id === d.id);
}

/**
 * Handles mouse hover events on a chart node.
 * Highlights the ancestor path of the hovered node.
 * @param {Event} event The D3 event object.
 * @param {Object} d The data object for the hovered node.
 */
function handleNodeHover(event, d) {
    if (d.isStub) return;
    const ancestors = findAncestors(d);
    state.g.selectAll('.node-card').classed('ancestor-highlight', node => ancestors.includes(node.id));
}

/**
 * Handles mouse unhover events to clear any ancestor highlighting.
 */
function handleNodeUnhover() {
    state.g.selectAll('.node-card').classed('ancestor-highlight', false);
}

/**
 * Finds all ancestor IDs for a given node by traversing up the parent chain.
 * @param {Object} node The node to find ancestors for.
 * @returns {Array<string>} An array of ancestor IDs.
 */
function findAncestors(node) {
    const ancestors = [];
    const parentMap = new Map();
    state.currentData.forEach(p => {
        if (p.children) {
            p.children.forEach(c => parentMap.set(c.id, p.id));
        }
    });
    let currentId = node.id;
    while (parentMap.has(currentId)) {
        const parentId = parentMap.get(currentId);
        ancestors.push(parentId);
        currentId = parentId;
    }
    return ancestors;
}

/* ===========================================
   CHART RENDERING
=========================================== */

/**
 * Main rendering function for the chart.
 * It clears the SVG, gets the visible nodes and links, and calls the respective
 * rendering functions for them.
 */
export function renderChart() {
    if (!state.g || !state.rootNode) {
        console.log('Chart not initialized or no data to render');
        return;
    }

    // Clear existing content
    state.g.selectAll('*').remove();

    // Get only visible nodes and links based on expanded state
    const nodes = getVisibleNodes(state.rootNode);
    const links = getVisibleLinks(state.rootNode);

    // Render links first (so they appear behind nodes)
    renderLinks(links);
    
    // Render nodes
    renderNodes(nodes);
    
    // Auto-fit the chart
    setTimeout(() => {
        fitChartToView();
    }, 100);
}

/**
 * Renders the L-shaped SVG paths for the links between nodes.
 * @param {Array<Object>} links The array of visible link objects to render.
 */
function renderLinks(links) {
    const linkSelection = state.g.selectAll('.link')
        .data(links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d => {
            // Use same coordinate logic as original generateLShapedPath function
            const sourceX = d.source.x;
            const sourceY = d.source.y + CONFIG.nodeHeight / 2;
            const targetX = d.target.x;
            const targetY = d.target.y - CONFIG.nodeHeight / 2;
            const midY = sourceY + (targetY - sourceY) / 2;
            
            return `M${sourceX},${sourceY} L${sourceX},${midY} L${targetX},${midY} L${targetX},${targetY}`;
        })
        .style('fill', 'none')
        .style('stroke', '#ccc')
        .style('stroke-width', 2);
}

/**
 * Renders the SVG groups for each visible node, including the card, text, and expand/collapse button.
 * It also handles the D3 data join and enter/update/exit selections.
 * @param {Array<Object>} nodes The array of visible node objects to render.
 */
function renderNodes(nodes) {
    // Clear existing nodes
    state.g.selectAll('.node-group').remove();
    
    const nodeGroups = state.g.selectAll('.node-group')
        .data(nodes, d => d.id);
    
    const enterGroups = nodeGroups.enter()
        .append('g')
        .attr('class', 'node-group')
        .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
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
            wrapSVGText(d3.select(this), d.title, CONFIG.nodeWidth - 20, 2, 15);
        });
    
    // Add hover and click handlers
    enterGroups
        .on('mouseenter', handleNodeHover)
        .on('mouseleave', handleNodeUnhover)
        .on('click', (event, d) => handleNodeClick(event, d));
    
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
                    calculateLayout(state.rootNode, 0, 0);
                    renderChart();
                });
            
            group.append('text')
                .attr('class', 'expand-icon')
                .attr('x', CONFIG.nodeWidth / 2 - 10)
                .attr('y', -CONFIG.nodeHeight / 2 + 10)
                .text(d => d.expanded ? '−' : '+');
        });
    
    // Animate nodes into position
    const t = allGroups.transition()
        .duration(CONFIG.animationDuration)
        .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
        .style('opacity', 1);

    // Notify when all node transitions have finished (for reliable follow-up actions)
    try {
        let ended = 0;
        const total = allGroups.size();
        t.on('end', () => {
            ended++;
            if (ended >= total) {
                if (window.__onChartRenderComplete) {
                    try { window.__onChartRenderComplete(); } catch(_) {}
                    // one-time by default; consumer can reassign if needed
                    window.__onChartRenderComplete = null;
                }
            }
        });
    } catch(_) {}
    
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
