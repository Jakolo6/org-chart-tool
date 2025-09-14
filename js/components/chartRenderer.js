/**
 * @file Responsible for all D3.js rendering, including nodes, links, zoom/pan,
 * and layout calculations for the organization chart.
 */

// Use global variables instead of imports
const CONFIG = window.CONFIG || {
    nodeWidth: 160,
    nodeHeight: 80,
    horizontalGap: 25,
    verticalGap: 100,
    animationDuration: 300
};

const state = window.state || {
    rootNode: null,
    selectedNode: null,
    svg: null,
    g: null,
    zoom: null,
    width: 1200,
    height: 800,
    isComparisonMode: false
};

// Helper functions
function wrapSVGText(textElement, text, width, maxLines, baseY) {
    if (!text) return;
    
    const words = text.split(/\s+/).reverse();
    let word;
    let line = [];
    let lineNumber = 0;
    const lineHeight = 1.1; // ems
    const y = baseY || 0;
    
    let tspan = textElement.text(null).append("tspan")
        .attr("x", 0)
        .attr("y", y)
        .attr("dy", 0);
        
    while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        
        if (tspan.node().getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            
            lineNumber++;
            if (maxLines && lineNumber >= maxLines) {
                // Add ellipsis if we've reached max lines
                if (line.join(" ").length > 3) {
                    tspan.text(tspan.text() + "...");
                }
                break;
            }
            
            tspan = textElement.append("tspan")
                .attr("x", 0)
                .attr("y", y)
                .attr("dy", lineHeight + "em")
                .text(word);
        }
    }
    
    // Center the text vertically based on number of lines
    const tspans = textElement.selectAll("tspan");
    const lineCount = tspans.size();
    
    if (lineCount > 1) {
        const offset = (lineCount - 1) * lineHeight / 2;
        tspans.attr("dy", function(d, i) {
            return (i === 0 ? -offset : lineHeight) + "em";
        });
    }
}

console.log('[OrgChart] chartRenderer loaded');

/* ===========================================
   CHART INITIALIZATION
=========================================== */

/**
 * Initializes the chart with the given selector.
 * @param {string} selector The CSS selector for the chart container.
 */
function initChart(selector) {
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
 * Centers the chart in the viewport.
 */
function centerChart() {
    if (!state.g || !state.svg || !state.zoom) return;
    
    const bounds = state.g.node().getBBox();
    const width = state.width;
    const height = state.height;
    
    const scale = 0.9;
    const translateX = width / 2 - bounds.x * scale - bounds.width * scale / 2;
    const translateY = height / 2 - bounds.y * scale - bounds.height * scale / 2;
    
    state.svg.transition().duration(500).call(
        state.zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );
}

/* ===========================================
   HIERARCHY BUILDING
=========================================== */

/**
 * Constructs the hierarchical data structure from the flat data array.
 * @param {Array} data The flat array of employee data.
 * @returns {Object|null} The root node of the hierarchy.
 */
function buildHierarchy(data) {
    if (!data || data.length === 0) {
        console.log('No data available for hierarchy building');
        return null;
    }

    // Create lookup map
    const employeeMap = new Map();
    data.forEach(emp => {
        employeeMap.set(emp.id, {
            ...emp,
            children: [],
            expanded: true
        });
    });

    // Find root and build hierarchy
    let rootNode = null;
    data.forEach(emp => {
        const node = employeeMap.get(emp.id);
        
        if (!emp.manager || emp.manager === '' || emp.manager === emp.id) {
            // This is a root node (no manager or self-managed)
            rootNode = node;
        } else if (employeeMap.has(emp.manager)) {
            // Add as child to manager
            const managerNode = employeeMap.get(emp.manager);
            managerNode.children.push(node);
        } else {
            // Manager not found, treat as root
            console.warn(`Manager ${emp.manager} not found for employee ${emp.id}`);
            if (!rootNode) rootNode = node;
        }
    });

    // Sort children by name
    const sortChildren = (node) => {
        if (node.children && node.children.length > 0) {
            node.children.sort((a, b) => a.name.localeCompare(b.name));
            node.children.forEach(sortChildren);
        }
    };
    
    if (rootNode) {
        sortChildren(rootNode);
    }

    return rootNode;
}

/* ===========================================
   LAYOUT CALCULATION
=========================================== */

/**
 * Recursively calculates the x and y coordinates for each node in the hierarchy.
 * @param {Object} node The current node to calculate layout for.
 * @param {number} x The x-coordinate for the current node.
 * @param {number} y The y-coordinate for the current node.
 * @returns {number} The total width of the subtree rooted at this node.
 */
function calculateLayout(node, x, y) {
    node.x = x;
    node.y = y;
    
    if (!node.children || node.children.length === 0 || !node.expanded) {
        // Leaf node or collapsed node
        node.width = CONFIG.nodeWidth;
        return node.width;
    }
    
    // Calculate layout for visible children
    let totalChildrenWidth = 0;
    const visibleChildren = node.children;
    
    visibleChildren.forEach(child => {
        const childWidth = calculateLayout(
            child, 
            x - node.width / 2 + totalChildrenWidth + child.width / 2, 
            y + CONFIG.verticalGap
        );
        totalChildrenWidth += childWidth + CONFIG.horizontalGap;
    });
    
    // Adjust for the last horizontal gap
    if (visibleChildren.length > 0) {
        totalChildrenWidth -= CONFIG.horizontalGap;
    }
    
    // Center parent over children
    if (totalChildrenWidth > CONFIG.nodeWidth) {
        node.width = totalChildrenWidth;
        
        // Recenter children
        let currentX = x - totalChildrenWidth / 2 + visibleChildren[0].width / 2;
        visibleChildren.forEach(child => {
            child.x = currentX;
            currentX += child.width + CONFIG.horizontalGap;
        });
    } else {
        node.width = CONFIG.nodeWidth;
    }
    
    return node.width;
}

/**
 * Gets all visible nodes in the hierarchy based on expanded state.
 * @param {Object} node The root node to start from.
 * @returns {Array} Array of visible nodes.
 */
function getVisibleNodes(node) {
    if (!node) return [];
    
    const nodes = [node];
    
    if (node.expanded && node.children) {
        node.children.forEach(child => {
            nodes.push(...getVisibleNodes(child));
        });
    }
    
    return nodes;
}

/**
 * Gets all visible links in the hierarchy based on expanded state.
 * @param {Object} node The root node to start from.
 * @returns {Array} Array of visible links.
 */
function getVisibleLinks(node) {
    if (!node || !node.expanded || !node.children || node.children.length === 0) {
        return [];
    }
    
    const links = node.children.map(child => ({
        source: node,
        target: child,
        changeType: child.changeType
    }));
    
    node.children.forEach(child => {
        links.push(...getVisibleLinks(child));
    });
    
    return links;
}

/* ===========================================
   NODE INTERACTION HANDLERS
=========================================== */

/**
 * Handle node click event.
 * @param {Event} event The mouse event.
 * @param {Object} d The node data object.
 */
function handleNodeClick(event, d) {
    event.stopPropagation();
    if (d.isStub) return;
    
    // Update selected node in state
    state.selectedNode = d;
    
    // Update visual selection
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
function expandAll() {
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
function collapseAll() {
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
function resetView() {
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
function renderChart(rootNode, selector) {
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

function selectNode(node) {
    // Update selected node in global state
    state.selectedNode = node;
    
    // Update visual selection
    state.g.selectAll('.node-card')
        .classed('selected', d => d.id === node.id);
    
    // Update node statistics
    updateSelectedNodeStatistics(node);
}

/* ===========================================
   CHART UTILITIES
=========================================== */

/**
 * Calculates the optimal scale and translation to fit the entire chart within the viewport.
 */
function fitChartToView() {
    if (!state.g || !state.svg) return;
    
    const bounds = state.g.node().getBBox();
    if (bounds.width === 0 || bounds.height === 0) return;
    
    const fullWidth = state.width;
    const fullHeight = state.height;
    const widthScale = fullWidth / bounds.width;
    const heightScale = fullHeight / bounds.height;
    const scale = Math.min(widthScale, heightScale) * 0.9; // 90% to add some padding
    
    const translateX = fullWidth / 2 - (bounds.x + bounds.width / 2) * scale;
    const translateY = fullHeight / 2 - (bounds.y + bounds.height / 2) * scale;
    
    state.svg.transition().duration(500).call(
        state.zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale)
    );
}

/**
 * Handles window resize events by updating the SVG dimensions and re-fitting the chart.
 */
function handleResize() {
    const container = document.querySelector('.chart-area');
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    
    if (state.svg) {
        state.svg.attr('width', newWidth).attr('height', newHeight);
        state.width = newWidth;
        state.height = newHeight;
        fitChartToView();
    }
}

// Set up resize handler
let resizeTimeout;
window.addEventListener('resize', function() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 200);
});

// Export functions to global window object
window.renderChart = renderChart;
window.initChart = initChart;
window.buildHierarchy = buildHierarchy;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
window.resetView = resetView;
window.centerChart = centerChart;
window.fitChartToView = fitChartToView;
window.selectNode = selectNode;
