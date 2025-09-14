/**
 * @file Responsible for all D3.js rendering, including nodes, links, zoom/pan,
 * and layout calculations for the organization chart.
 */

// Use global variables directly
// Access CONFIG from window object
if (!window.CONFIG) {
    window.CONFIG = {
        nodeWidth: 160,
        nodeHeight: 80,
        horizontalGap: 25,
        verticalGap: 100,
        animationDuration: 300
    };
}

// Access state from window object
if (!window.state) {
    window.state = {
        rootNode: null,
        selectedNode: null,
        svg: null,
        g: null,
        zoom: null,
        width: 1200,
        height: 800,
        isComparisonMode: false
    };
}

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
function initChart(container = '#chart-area') {
    console.log('Initializing chart with container:', container);
    
    // Get container dimensions
    const containerElement = document.querySelector(container);
    if (!containerElement) {
        console.error('Container not found:', container);
        return;
    }
    
    // Clear any existing content
    containerElement.innerHTML = '';
    
    // Create a new SVG element
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.setAttribute('id', 'chartSvg');
    svgElement.setAttribute('class', 'chart-svg');
    containerElement.appendChild(svgElement);
    
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;
    
    console.log(`Container dimensions: ${width}x${height}`);
    
    // Initialize state if not already done
    if (!window.state) {
        window.state = {};
    }
    
    // Store dimensions in state
    window.state.width = width;
    window.state.height = height;
    
    // Select the SVG element with D3
    const svg = d3.select('#chartSvg')
        .attr('width', width)
        .attr('height', height)
        .attr('class', 'org-chart');
    
    // Create a group for the chart content that will be transformed
    const g = svg.append('g')
        .attr('class', 'chart-content');
    
    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    
    // Store references in state
    window.state.svg = svg;
    window.state.g = g;
    window.state.zoom = zoom;
    
    console.log('Chart initialized successfully');
    
    return { svg, g, zoom };
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
    console.log('Building hierarchy with data:', data);
    
    if (!data || data.length === 0) {
        console.log('No data available for hierarchy building');
        return null;
    }

    // Create lookup map
    const employeeMap = new Map();
    
    // Add company node first if it doesn't exist in the data
    const companyNode = {
        id: 'company',
        name: 'The Nunatak Group GmbH',
        manager: '',
        title: 'Digital Growth Advisors',
        children: [],
        expanded: true
    };
    employeeMap.set('company', companyNode);
    
    // Add all employees to the map
    data.forEach(emp => {
        // Ensure ID is a string
        const id = String(emp.id || '');
        if (!id) {
            console.warn('Employee with no ID found:', emp);
            return;
        }
        
        console.log(`Adding employee to map: ID=${id}, Name=${emp.name}, Manager=${emp.manager}`);
        employeeMap.set(id, {
            ...emp,
            id: id, // Ensure ID is consistent
            children: [],
            expanded: false // Start with all nodes collapsed except root
        });
    });

    console.log('Employee map created with', employeeMap.size, 'entries');
    
    // Find root and build hierarchy
    let rootNode = employeeMap.get('company'); // Start with company as root
    let rootCount = 1;
    
    data.forEach(emp => {
        const id = String(emp.id || '');
        if (!id || !employeeMap.has(id)) {
            console.warn('Invalid employee ID:', id);
            return;
        }
        
        const node = employeeMap.get(id);
        const managerId = String(emp.manager || '');
        
        console.log(`Processing employee: ID=${id}, Name=${emp.name}, Manager=${managerId}`);
        
        if (!managerId || managerId === '' || managerId === id) {
            // This is a root node (no manager or self-managed)
            console.log(`Found root node: ${emp.name} (${id})`);
            // Add to company node
            employeeMap.get('company').children.push(node);
        } else if (managerId === 'company' || managerId.toLowerCase() === 'the nunatak group gmbh') {
            // Add to company node
            console.log(`Adding ${emp.name} (${id}) as child to company`);
            employeeMap.get('company').children.push(node);
        } else if (employeeMap.has(managerId)) {
            // Add as child to manager
            const managerNode = employeeMap.get(managerId);
            console.log(`Adding ${emp.name} (${id}) as child to ${managerNode.name} (${managerId})`);
            managerNode.children.push(node);
        } else {
            // Manager not found, add to company
            console.warn(`Manager ${managerId} not found for employee ${id} (${emp.name}). Adding to company.`);
            employeeMap.get('company').children.push(node);
        }
    });
    
    // Set expansion state for first level children of root
    if (rootNode && rootNode.children && rootNode.children.length > 0) {
        // Expand only the first level children of the root
        rootNode.children.forEach(child => {
            child.expanded = false; // Keep first level children collapsed initially
        });
    }
    
    console.log(`Using company node as root with ${employeeMap.get('company').children.length} direct reports.`);

    // Sort children by name
    const sortChildren = (node) => {
        if (node.children && node.children.length > 0) {
            node.children.sort((a, b) => a.name.localeCompare(b.name));
            node.children.forEach(sortChildren);
        }
    };
    
    sortChildren(rootNode);

    return rootNode;
}

/* ===========================================
   LAYOUT CALCULATION
=========================================== */

/**
 * Calculates the total width needed for all children of a node.
 * @param {Object} node The node to calculate children width for.
 * @returns {number} The total width.
 */
function getTotalChildrenWidth(node) {
    if (!node.children || node.children.length === 0 || !node.expanded) {
        return window.CONFIG.nodeWidth;
    }
    
    // Sum up the width of all children plus gaps between them
    let totalWidth = 0;
    node.children.forEach((child, index) => {
        totalWidth += getNodeWidth(child);
        // Add horizontal gap between children (except after the last child)
        if (index < node.children.length - 1) {
            totalWidth += window.CONFIG.horizontalGap;
        }
    });
    
    return Math.max(window.CONFIG.nodeWidth, totalWidth);
}

/**
 * Gets the width of a node, considering its children if expanded.
 * @param {Object} node The node to get width for.
 * @returns {number} The node width.
 */
function getNodeWidth(node) {
    if (!node.children || node.children.length === 0 || !node.expanded) {
        return window.CONFIG.nodeWidth;
    }
    
    // For expanded nodes, return the total width of all children
    return getTotalChildrenWidth(node);
}

/**
 * Recursively calculates the x and y coordinates for each node in the hierarchy.
 * @param {Object} node The current node to calculate layout for.
 * @param {number} x The x-coordinate for the current node.
 * @param {number} y The y-coordinate for the current node.
 * @returns {number} The total width of the subtree rooted at this node.
 */
function calculateLayout(node, x0 = 0, y0 = 0, level = 0) {
    // Set node position
    node.x = x0;
    node.y = y0;
    node.level = level;
    
    if (!node.children || node.children.length === 0 || !node.expanded) {
        // Leaf node or collapsed node
        node.width = window.CONFIG.nodeWidth;
        node.height = window.CONFIG.nodeHeight;
        return node;
    }
    
    // Process children
    let totalChildrenWidth = getTotalChildrenWidth(node);
    let currentX = x0 - (totalChildrenWidth / 2);
    const childY = y0 + window.CONFIG.nodeHeight + window.CONFIG.verticalGap;
    
    // Ensure minimum horizontal gap between nodes
    node.children.forEach(child => {
        // Calculate width for this child (including its descendants if expanded)
        const childWidth = getNodeWidth(child);
        // Position child in the center of its allocated space
        const childX = currentX + (childWidth / 2);
        // Recursively calculate layout for this child
        calculateLayout(child, childX, childY, level + 1);
        // Move to the next child position
        currentX += childWidth + window.CONFIG.horizontalGap;
    });
    
    // Update node dimensions
    node.width = Math.max(window.CONFIG.nodeWidth, totalChildrenWidth);
    node.height = window.CONFIG.nodeHeight;
    
    return node;
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
    
    // Select the node
    selectNode(d);
    
    // Show node statistics
    showNodeStats(d);
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
    event.stopPropagation();
    if (d.isStub) return;
    
    // Find ancestors for highlighting
    const ancestors = findAncestors(d);
    window.state.g.selectAll('.node-card').classed('ancestor-highlight', node => ancestors.includes(node.id));
}

/**
 * Handle node unhover event.
 * @param {Event} event The mouse event.
 * @param {Object} d The node data object.
 */
function handleNodeUnhover(event, d) {
    event.stopPropagation();
    
    // Remove ancestor highlighting
    window.state.g.selectAll('.node-card').classed('ancestor-highlight', false);
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
    
    if (window.state.rootNode) {
        buildParentMap(window.state.rootNode);
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
 * (Disabled as per user request)
 */
function setupTooltip() {
    // Tooltip functionality disabled
}

/**
 * Expands all nodes in the chart.
 */
function expandAll() {
    if (!window.state.rootNode) return;
    expandAllNodes(window.state.rootNode);
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
    if (!window.state.rootNode) return;
    collapseAllNodes(window.state.rootNode);
    window.state.rootNode.expanded = true; // Keep root expanded
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
    if (!window.state.rootNode || !window.state.svg || !window.state.zoom) return;
    
    collapseAllNodes(window.state.rootNode);
    window.state.rootNode.expanded = true;
    window.state.selectedNode = window.state.rootNode;
    renderChart();
    updateSelectedNodeStatistics(window.state.rootNode);
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
    console.log('renderChart called with rootNode:', rootNode, 'selector:', selector);
    
    if (!rootNode) {
        console.error('No data to render');
        return;
    }
    
    // Initialize chart if selector is provided
    if (selector) {
        console.log('Initializing chart with selector:', selector);
        initChart(selector);
    }
    
    if (!window.state || !window.state.g) {
        console.error('Chart not initialized properly. state:', window.state);
        return;
    }
    
    // Set root node in state
    window.state.rootNode = rootNode;
    
    // Calculate layout
    console.log('Calculating layout...');
    calculateLayout(window.state.rootNode, window.state.width / 2, 100);
    
    // Get only visible nodes and links based on expanded state
    const nodes = getVisibleNodes(window.state.rootNode);
    const links = getVisibleLinks(window.state.rootNode);
    
    console.log('Visible nodes:', nodes.length, 'Visible links:', links.length);

    // Render connections first (so they appear behind nodes)
    console.log('Rendering connections...');
    renderConnections(links);
    
    // Render nodes
    console.log('Rendering nodes...');
    renderNodes(nodes);
    
    // Auto-fit the chart
    console.log('Scheduling fitChartToView...');
    setTimeout(() => {
        console.log('Fitting chart to view...');
        fitChartToView();
    }, 300); // Increased timeout to ensure DOM is ready
    
    // Setup tooltip
    setupTooltip();
    
    console.log('Chart rendering complete');
}

/**
 * Renders the L-shaped SVG paths for the links between nodes.
 * @param {Array<Object>} links The array of visible link objects to render.
 */
function renderConnections(links) {
    // Create connection lines
    const connectionLines = window.state.g.selectAll('.connection-line')
        .data(links, d => d.target.id);
    
    // Handle enter selection
    connectionLines.enter()
        .append('path')
        .attr('class', 'connection-line')
        .attr('d', d => generateLShapedPath(d))
        .style('fill', 'none')
        .style('stroke', '#cbd5e1')
        .style('stroke-width', '1.5px');
    
    // Handle update selection
    connectionLines
        .transition()
        .duration(window.CONFIG.animationDuration)
        .attr('d', d => generateLShapedPath(d));
    
    // Handle exit selection
    connectionLines.exit().remove();
    
    // Update connection styles based on change type
    window.state.g.selectAll('.connection-line')
        .style('stroke', d => {
            if (!window.state.isComparisonMode) return '#cbd5e1';
            
            switch (d.changeType) {
                case 'new': return '#059669';
                case 'moved': return '#f59e0b';
                case 'exit': return '#dc2626';
                default: return '#cbd5e1';
            }
        })
        .style('stroke-width', d => d.changeType ? '2px' : '1.5px')
        .style('stroke-dasharray', d => d.changeType === 'exit' ? '4' : 'none');
}

/**
 * Generates a straight path between two nodes.
 * @param {Object} link The link object with source and target nodes.
 * @returns {string} The SVG path string.
 */
function generateLShapedPath(link) {
    const sourceX = link.source.x;
    const sourceY = link.source.y + window.CONFIG.nodeHeight / 2;
    const targetX = link.target.x;
    const targetY = link.target.y - window.CONFIG.nodeHeight / 2;
    
    // Calculate midpoint Y for the vertical segment
    const midY = sourceY + (targetY - sourceY) / 2;
    
    // Create a path with straight lines and right angles
    return `M${sourceX},${sourceY} L${sourceX},${midY} L${targetX},${midY} L${targetX},${targetY}`;
}

/**
 * Renders the SVG groups for each visible node, including the card, text, and expand/collapse button.
 * It also handles the D3 data join and enter/update/exit selections.
 * @param {Array<Object>} nodes The array of visible node objects to render.
 */
function renderNodes(nodes) {
    const nodeGroups = window.state.g.selectAll('.node-group')
        .data(nodes, d => d.id);
    
    // Handle exit selection
    nodeGroups.exit()
        .transition()
        .duration(window.CONFIG.animationDuration)
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
        .attr('x', -window.CONFIG.nodeWidth / 2 - 4)
        .attr('y', -window.CONFIG.nodeHeight / 2 - 4)
        .attr('width', window.CONFIG.nodeWidth + 8)
        .attr('height', window.CONFIG.nodeHeight + 8)
        .attr('rx', 6)
        .attr('ry', 6);
    
    // Add main node card
    enterGroups.append('rect')
        .attr('class', d => `node-card ${d.changeType || ''}`)
        .attr('x', -window.CONFIG.nodeWidth / 2)
        .attr('y', -window.CONFIG.nodeHeight / 2)
        .attr('width', window.CONFIG.nodeWidth)
        .attr('height', window.CONFIG.nodeHeight)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('fill', d => getNodeColor(d))
        .style('stroke', d => getNodeBorderColor(d));
    
    // Add name text with wrapping
    enterGroups.append('text')
        .attr('class', d => `node-text ${d.changeType || ''}`)
        .attr('y', -15)
        .each(function(d) {
            wrapSVGText(d3.select(this), d.name, window.CONFIG.nodeWidth - 20, 2, -15);
        });
    
    // Add title text with wrapping
    enterGroups.append('text')
        .attr('class', d => `node-title ${d.changeType || ''}`)
        .attr('y', 15)
        .each(function(d) {
            wrapSVGText(d3.select(this), d.title || '', window.CONFIG.nodeWidth - 20, 2, 15);
        });
    
    // Add change indicator for moved nodes
    enterGroups.filter(d => d.changeType === 'moved' && d.previousManagerName)
        .append('text')
        .attr('class', 'change-indicator')
        .attr('y', window.CONFIG.nodeHeight / 2 - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#f59e0b')
        .text(d => `Moved from: ${d.previousManagerName}`);
    
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
                .attr('cx', window.CONFIG.nodeWidth / 2 - 10)
                .attr('cy', -window.CONFIG.nodeHeight / 2 + 10)
                .attr('r', 8)
                .on('click', (event, d) => {
                    event.stopPropagation();
                    d.expanded = !d.expanded;
                    renderChart(window.state.rootNode);
                });
            
            group.append('text')
                .attr('class', 'expand-icon')
                .attr('x', window.CONFIG.nodeWidth / 2 - 10)
                .attr('y', -window.CONFIG.nodeHeight / 2 + 10)
                .text(d => d.expanded ? '−' : '+');
        });
    
    // Animate nodes into position
    allGroups.transition()
        .duration(window.CONFIG.animationDuration)
        .attr('transform', d => `translate(${d.x}, ${d.y})`)
        .style('opacity', 1);
    
    // Update selected state and change type
    allGroups.select('.node-card')
        .attr('class', d => `node-card ${d.changeType || ''} ${window.state.selectedNode && window.state.selectedNode.id === d.id ? 'selected' : ''}`)
        .style('fill', d => getNodeColor(d))
        .style('stroke', d => getNodeBorderColor(d));
}

function getNodeColor(node) {
    if (!window.state.isComparisonMode) return '#f8fafc';
    
    switch (node.changeType) {
        case 'new': return 'rgba(5, 150, 105, 0.1)';
        case 'moved': return 'rgba(245, 158, 11, 0.1)';
        case 'exit': return 'rgba(220, 38, 38, 0.1)';
        default: return '#f8fafc';
    }
}

function getNodeBorderColor(node) {
    if (!window.state.isComparisonMode) return '#e2e8f0';
    
    switch (node.changeType) {
        case 'new': return '#059669';
        case 'moved': return '#f59e0b';
        case 'exit': return '#dc2626';
        default: return '#e2e8f0';
    }
}

/* ===========================================
   NODE SELECTION & INTERACTION
=========================================== */

function selectNode(node) {
    // Deselect all nodes
    window.state.g.selectAll('.node-card').classed('selected', false);
    
    // Select the clicked node
    window.state.g.selectAll('.node-card')
        .filter(d => d.id === node.id)
        .classed('selected', true);
    
    // Store the selected node in state
    window.state.selectedNode = node;
}

/**
 * Shows the statistics for the selected node.
 * @param {Object} node The node to show statistics for.
 */
function showNodeStats(node) {
    const statsDisplay = document.getElementById('selectedStatsDisplay');
    const statsContainer = document.getElementById('selectedStatsContainer');
    
    if (!statsDisplay || !statsContainer) return;
    
    // Show the stats panel
    statsDisplay.style.display = 'block';
    
    // Generate HTML content for the stats
    let statsHTML = `
        <div class="node-stats">
            <div class="node-stats-header">
                <h3>${node.name || 'Unknown'}</h3>
                <div class="node-stats-title">${node.title || 'No title'}</div>
            </div>
            <div class="node-stats-details">
                <div class="node-stats-item">
                    <span class="node-stats-label">ID:</span>
                    <span class="node-stats-value">${node.id || 'N/A'}</span>
                </div>
                <div class="node-stats-item">
                    <span class="node-stats-label">Manager:</span>
                    <span class="node-stats-value">${node.manager || 'None'}</span>
                </div>
    `;
    
    // Add additional properties if they exist
    if (node.department) {
        statsHTML += `
            <div class="node-stats-item">
                <span class="node-stats-label">Department:</span>
                <span class="node-stats-value">${node.department}</span>
            </div>
        `;
    }
    
    if (node.location) {
        statsHTML += `
            <div class="node-stats-item">
                <span class="node-stats-label">Location:</span>
                <span class="node-stats-value">${node.location}</span>
            </div>
        `;
    }
    
    // Add direct reports count if the node has children
    if (node.children && node.children.length > 0) {
        statsHTML += `
            <div class="node-stats-item">
                <span class="node-stats-label">Direct Reports:</span>
                <span class="node-stats-value">${node.children.length}</span>
            </div>
        `;
    }
    
    // Add change type information if in comparison mode
    if (window.state.isComparisonMode && node.changeType) {
        let changeTypeText = '';
        let changeTypeClass = '';
        
        switch (node.changeType) {
            case 'new':
                changeTypeText = 'New Position';
                changeTypeClass = 'new';
                break;
            case 'moved':
                changeTypeText = `Moved from ${node.previousManagerName || 'Unknown'}`;
                changeTypeClass = 'moved';
                break;
            case 'exit':
                changeTypeText = 'Position Removed';
                changeTypeClass = 'exit';
                break;
        }
        
        if (changeTypeText) {
            statsHTML += `
                <div class="node-stats-item change-type ${changeTypeClass}">
                    <span class="node-stats-label">Change:</span>
                    <span class="node-stats-value">${changeTypeText}</span>
                </div>
            `;
        }
    }
    
    statsHTML += `
            </div>
        </div>
    `;
    
    // Update the container with the stats HTML
    statsContainer.innerHTML = statsHTML;
}

/* ===========================================
   CHART UTILITIES
=========================================== */

/**
 * Centers the chart in the viewport without changing the zoom level.
 */
function centerChart() {
    if (!window.state.g || !window.state.svg) return;
    
    try {
        const gNode = window.state.g.node();
        if (!gNode) return;
        
        const bounds = gNode.getBBox();
        if (bounds.width === 0 || bounds.height === 0) return;
        
        const fullWidth = window.state.width;
        const fullHeight = window.state.height;
        const currentTransform = d3.zoomTransform(window.state.svg.node());
        const scale = currentTransform.k;
        
        const translateX = fullWidth / 2 - (bounds.x + bounds.width / 2) * scale;
        const translateY = fullHeight / 2 - (bounds.y + bounds.height / 2) * scale;
        
        window.state.svg.transition().duration(500).call(
            window.state.zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
    } catch (error) {
        console.error('Error centering chart:', error);
    }
}

function fitChartToView() {
    if (!window.state.g || !window.state.svg) return;
    
    try {
        const gNode = window.state.g.node();
        if (!gNode) return;
        
        const bounds = gNode.getBBox();
        if (bounds.width === 0 || bounds.height === 0) return;
        
        const fullWidth = window.state.width;
        const fullHeight = window.state.height;
        const widthScale = fullWidth / bounds.width;
        const heightScale = fullHeight / bounds.height;
        const scale = Math.min(widthScale, heightScale) * 0.9; // 90% to add some padding
        
        const translateX = fullWidth / 2 - (bounds.x + bounds.width / 2) * scale;
        const translateY = fullHeight / 2 - (bounds.y + bounds.height / 2) * scale;
        
        window.state.svg.transition().duration(500).call(
            window.state.zoom.transform,
            d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
    } catch (error) {
        console.error('Error fitting chart to view:', error);
    }
}

/**
 * Handles window resize events by updating the SVG dimensions and re-fitting the chart.
 */
function handleResize() {
    const container = document.getElementById('chart-area');
    if (!container) return; // Exit if container not found
    
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;
    
    if (window.state.svg) {
        window.state.svg.attr('width', newWidth).attr('height', newHeight);
        window.state.width = newWidth;
        window.state.height = newHeight;
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
window.initChart = initChart;
window.buildHierarchy = buildHierarchy;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
window.resetView = resetView;
window.centerChart = centerChart;
window.fitChartToView = fitChartToView;
window.selectNode = selectNode;
window.renderChart = renderChart;
