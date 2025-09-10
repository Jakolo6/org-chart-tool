/**
 * Advanced Org Chart Component
 * Provides rich visualization with zoom, pan, tooltips, and comparison features
 */

export class AdvancedOrgChart {
  /**
   * Create a new AdvancedOrgChart
   * @param {string} containerId - ID of the container element
   * @param {Object} options - Chart options
   */
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }
    
    this.options = {
      nodeWidth: 180,
      nodeHeight: 80,
      nodePadding: 12,
      levelHeight: 200,
      duration: 750,
      nodeColor: '#3b82f6',
      linkColor: '#94a3b8',
      textColor: '#ffffff',
      highlightColor: '#ef4444',
      comparisonMode: false,
      showStats: true,
      ...options
    };
    
    // Initialize state
    this.data = null;
    this.comparisonData = null;
    this.root = null;
    this.svg = null;
    this.g = null;
    this.zoom = null;
    this.tooltip = null;
    this.selectedNode = null;
    this.nodeMap = new Map();
    
    // Initialize chart
    this.initChart();
  }
  
  /**
   * Initialize chart
   * @private
   */
  initChart() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('class', 'org-chart-svg');
    
    // Create zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });
    
    // Apply zoom to SVG
    this.svg.call(this.zoom);
    
    // Create main group
    this.g = this.svg.append('g')
      .attr('class', 'org-chart-container');
    
    // Create tooltip
    this.tooltip = d3.select(this.container)
      .append('div')
      .attr('class', 'org-chart-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('padding', '10px')
      .style('box-shadow', '0 2px 4px rgba(0,0,0,0.1)')
      .style('pointer-events', 'none')
      .style('z-index', 1000);
    
    // Add controls
    this.addControls();
  }
  
  /**
   * Add chart controls
   * @private
   */
  addControls() {
    const controls = d3.select(this.container)
      .append('div')
      .attr('class', 'org-chart-controls')
      .style('position', 'absolute')
      .style('top', '10px')
      .style('right', '10px')
      .style('display', 'flex')
      .style('gap', '5px');
    
    // Zoom in button
    controls.append('button')
      .attr('class', 'org-chart-control-btn')
      .html('<i class="fas fa-search-plus"></i>')
      .on('click', () => {
        this.svg.transition()
          .duration(500)
          .call(this.zoom.scaleBy, 1.2);
      });
    
    // Zoom out button
    controls.append('button')
      .attr('class', 'org-chart-control-btn')
      .html('<i class="fas fa-search-minus"></i>')
      .on('click', () => {
        this.svg.transition()
          .duration(500)
          .call(this.zoom.scaleBy, 0.8);
      });
    
    // Reset zoom button
    controls.append('button')
      .attr('class', 'org-chart-control-btn')
      .html('<i class="fas fa-expand"></i>')
      .on('click', () => {
        this.resetZoom();
      });
    
    // Toggle comparison mode button
    if (this.options.comparisonMode) {
      controls.append('button')
        .attr('class', 'org-chart-control-btn')
        .attr('id', 'toggleComparisonBtn')
        .html('<i class="fas fa-exchange-alt"></i>')
        .on('click', () => {
          this.toggleComparisonMode();
        });
    }
    
    // Toggle stats button
    if (this.options.showStats) {
      controls.append('button')
        .attr('class', 'org-chart-control-btn')
        .attr('id', 'toggleStatsBtn')
        .html('<i class="fas fa-chart-bar"></i>')
        .on('click', () => {
          this.toggleStats();
        });
    }
    
    // Style buttons
    d3.selectAll('.org-chart-control-btn')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('cursor', 'pointer')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('justify-content', 'center')
      .style('width', '32px')
      .style('height', '32px')
      .style('font-size', '14px')
      .style('color', '#333')
      .style('transition', 'all 0.2s ease');
  }
  
  /**
   * Reset zoom to fit the chart
   */
  resetZoom() {
    const bounds = this.g.node().getBBox();
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    const scale = 0.9 / Math.max(bounds.width / containerWidth, bounds.height / containerHeight);
    const translate = [
      containerWidth / 2 - scale * (bounds.x + bounds.width / 2),
      containerHeight / 2 - scale * (bounds.y + bounds.height / 2)
    ];
    
    this.svg.transition()
      .duration(750)
      .call(
        this.zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  }
  
  /**
   * Toggle comparison mode
   */
  toggleComparisonMode() {
    this.options.comparisonMode = !this.options.comparisonMode;
    this.update();
  }
  
  /**
   * Toggle stats display
   */
  toggleStats() {
    this.options.showStats = !this.options.showStats;
    this.update();
  }
  
  /**
   * Set chart data
   * @param {Object} data - Hierarchical data
   */
  setData(data) {
    this.data = data;
    this.update();
  }
  
  /**
   * Set comparison data
   * @param {Object} data - Hierarchical data for comparison
   */
  setComparisonData(data) {
    this.comparisonData = data;
    if (this.options.comparisonMode) {
      this.update();
    }
  }
  
  /**
   * Update chart
   */
  update() {
    if (!this.data) return;
    
    // Clear existing chart
    this.g.selectAll('*').remove();
    this.nodeMap.clear();
    
    // Create hierarchy
    this.root = d3.hierarchy(this.data);
    
    // Calculate node positions
    const treeLayout = d3.tree()
      .nodeSize([this.options.nodeWidth + 40, this.options.nodeHeight + 60]);
    
    treeLayout(this.root);
    
    // Create links
    const links = this.g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(this.root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => {
        return `M${d.source.y},${d.source.x}
                C${(d.source.y + d.target.y) / 2},${d.source.x}
                 ${(d.source.y + d.target.y) / 2},${d.target.x}
                 ${d.target.y},${d.target.x}`;
      })
      .attr('fill', 'none')
      .attr('stroke', this.options.linkColor)
      .attr('stroke-width', 1.5);
    
    // Create nodes
    const nodes = this.g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(this.root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .attr('data-id', d => d.data.id)
      .on('click', (event, d) => this.selectNode(d))
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip());
    
    // Store nodes in map for quick access
    nodes.each(d => {
      this.nodeMap.set(d.data.id, d);
    });
    
    // Add node rectangles
    nodes.append('rect')
      .attr('width', this.options.nodeWidth)
      .attr('height', this.options.nodeHeight)
      .attr('x', -this.options.nodeWidth / 2)
      .attr('y', -this.options.nodeHeight / 2)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', d => this.getNodeColor(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);
    
    // Add node text
    nodes.append('text')
      .attr('class', 'node-name')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .attr('fill', this.options.textColor)
      .attr('font-weight', 'bold')
      .text(d => this.truncateText(d.data.name, 20));
    
    // Add title text
    nodes.append('text')
      .attr('class', 'node-title')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('fill', this.options.textColor)
      .attr('font-size', '0.8em')
      .text(d => this.truncateText(d.data.title || '', 25));
    
    // Add comparison indicators if in comparison mode
    if (this.options.comparisonMode && this.comparisonData) {
      this.addComparisonIndicators();
    }
    
    // Add stats if enabled
    if (this.options.showStats) {
      this.addNodeStats();
    }
    
    // Center the chart
    this.resetZoom();
  }
  
  /**
   * Get node color based on level and state
   * @param {Object} d - Node data
   * @returns {string} Color
   */
  getNodeColor(d) {
    if (d === this.selectedNode) {
      return this.options.highlightColor;
    }
    
    // Color based on level
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    return colors[d.depth % colors.length];
  }
  
  /**
   * Truncate text to fit in node
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  /**
   * Select a node
   * @param {Object} d - Node data
   */
  selectNode(d) {
    // Deselect previous node
    if (this.selectedNode) {
      d3.select(`g.node[data-id="${this.selectedNode.data.id}"]`)
        .select('rect')
        .attr('fill', node => this.getNodeColor(node));
    }
    
    // Select new node
    this.selectedNode = (this.selectedNode === d) ? null : d;
    
    if (this.selectedNode) {
      d3.select(`g.node[data-id="${this.selectedNode.data.id}"]`)
        .select('rect')
        .attr('fill', this.options.highlightColor);
      
      // Trigger node selection event
      const event = new CustomEvent('nodeSelected', {
        detail: { node: this.selectedNode.data }
      });
      this.container.dispatchEvent(event);
    } else {
      // Trigger node deselection event
      const event = new CustomEvent('nodeDeselected');
      this.container.dispatchEvent(event);
    }
  }
  
  /**
   * Show tooltip
   * @param {Event} event - Mouse event
   * @param {Object} d - Node data
   */
  showTooltip(event, d) {
    const nodeData = d.data;
    
    // Format tooltip content
    let content = `
      <div style="font-weight: bold; margin-bottom: 5px;">${nodeData.name}</div>
      ${nodeData.title ? `<div>${nodeData.title}</div>` : ''}
      ${nodeData.department ? `<div>Department: ${nodeData.department}</div>` : ''}
      ${nodeData.location ? `<div>Location: ${nodeData.location}</div>` : ''}
      ${nodeData.fte !== undefined ? `<div>FTE: ${nodeData.fte}</div>` : ''}
    `;
    
    // Add comparison data if available
    if (this.options.comparisonMode && this.comparisonData) {
      const comparisonNode = this.findComparisonNode(nodeData.id);
      if (comparisonNode) {
        content += `
          <hr style="margin: 5px 0; border-top: 1px solid #ddd;">
          <div style="font-weight: bold; color: #10b981;">Comparison Data:</div>
          ${comparisonNode.title !== nodeData.title ? `<div>Title: ${comparisonNode.title || 'N/A'}</div>` : ''}
          ${comparisonNode.department !== nodeData.department ? `<div>Department: ${comparisonNode.department || 'N/A'}</div>` : ''}
        `;
      }
    }
    
    // Show tooltip
    this.tooltip
      .html(content)
      .style('left', (event.pageX + 15) + 'px')
      .style('top', (event.pageY - 28) + 'px')
      .transition()
      .duration(200)
      .style('opacity', 1);
  }
  
  /**
   * Hide tooltip
   */
  hideTooltip() {
    this.tooltip
      .transition()
      .duration(500)
      .style('opacity', 0);
  }
  
  /**
   * Find node in comparison data
   * @param {string} id - Node ID
   * @returns {Object|null} Comparison node
   */
  findComparisonNode(id) {
    if (!this.comparisonData) return null;
    
    // Recursive search function
    function findNode(node) {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child);
          if (found) return found;
        }
      }
      return null;
    }
    
    return findNode(this.comparisonData);
  }
  
  /**
   * Add comparison indicators to nodes
   */
  addComparisonIndicators() {
    if (!this.comparisonData) return;
    
    // Create a map of comparison nodes
    const comparisonMap = new Map();
    
    function mapNodes(node) {
      comparisonMap.set(node.id, node);
      if (node.children) {
        node.children.forEach(mapNodes);
      }
    }
    
    mapNodes(this.comparisonData);
    
    // Add indicators to nodes
    this.g.selectAll('g.node').each((d) => {
      const nodeId = d.data.id;
      const comparisonNode = comparisonMap.get(nodeId);
      
      if (!comparisonNode) {
        // Node doesn't exist in comparison data (added)
        d3.select(this)
          .append('circle')
          .attr('r', 8)
          .attr('cx', this.options.nodeWidth / 2 - 10)
          .attr('cy', -this.options.nodeHeight / 2 - 5)
          .attr('fill', '#10b981')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1);
        
        d3.select(this)
          .append('text')
          .attr('x', this.options.nodeWidth / 2 - 10)
          .attr('y', -this.options.nodeHeight / 2 - 5)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.3em')
          .attr('fill', '#ffffff')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text('+');
      } else if (
        d.data.title !== comparisonNode.title ||
        d.data.department !== comparisonNode.department
      ) {
        // Node exists but has changes
        d3.select(this)
          .append('circle')
          .attr('r', 8)
          .attr('cx', this.options.nodeWidth / 2 - 10)
          .attr('cy', -this.options.nodeHeight / 2 - 5)
          .attr('fill', '#f59e0b')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1);
        
        d3.select(this)
          .append('text')
          .attr('x', this.options.nodeWidth / 2 - 10)
          .attr('y', -this.options.nodeHeight / 2 - 5)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.3em')
          .attr('fill', '#ffffff')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text('Δ');
      }
    });
    
    // Find nodes in comparison data that don't exist in current data (removed)
    comparisonMap.forEach((node, id) => {
      if (!this.nodeMap.has(id)) {
        // TODO: Add visual indication of removed nodes
      }
    });
  }
  
  /**
   * Add stats to nodes
   */
  addNodeStats() {
    this.g.selectAll('g.node').each(function(d) {
      // Count direct reports
      const directReports = d.children ? d.children.length : 0;
      
      // Count total team size (all descendants)
      let totalTeamSize = 0;
      function countDescendants(node) {
        if (node.children) {
          totalTeamSize += node.children.length;
          node.children.forEach(countDescendants);
        }
      }
      countDescendants(d);
      
      // Add stats badge
      const statsGroup = d3.select(this)
        .append('g')
        .attr('class', 'node-stats')
        .attr('transform', `translate(${-90},${40})`);
      
      statsGroup.append('rect')
        .attr('width', 180)
        .attr('height', 24)
        .attr('rx', 12)
        .attr('ry', 12)
        .attr('fill', 'rgba(255, 255, 255, 0.9)')
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);
      
      statsGroup.append('text')
        .attr('x', 90)
        .attr('y', 12)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', '#1e293b')
        .attr('font-size', '11px')
        .text(`Direct: ${directReports} | Total: ${totalTeamSize}`);
    });
  }
}
