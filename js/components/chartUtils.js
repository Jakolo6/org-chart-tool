/**
 * @file Chart utility functions for the org chart tool
 */

console.log('[OrgChart] chartUtils loaded');

/**
 * Centers the chart in the viewport
 */
function centerChart() {
    const state = window.state || {};
    if (!state.rootNode || !state.svg || !state.zoom) return;
    
    const visibleNodes = getVisibleNodes(state.rootNode);
    if (visibleNodes.length === 0) return;

    const width = parseInt(state.svg.style('width')) || state.width || 1200;
    const height = parseInt(state.svg.style('height')) || state.height || 800;
    const CONFIG = window.CONFIG || {
        nodeWidth: 180,
        nodeHeight: 70
    };

    const bounds = {
        minX: d3.min(visibleNodes, d => d.x - CONFIG.nodeWidth / 2),
        maxX: d3.max(visibleNodes, d => d.x + CONFIG.nodeWidth / 2),
        minY: d3.min(visibleNodes, d => d.y - CONFIG.nodeHeight / 2),
        maxY: d3.max(visibleNodes, d => d.y + CONFIG.nodeHeight / 2)
    };
    
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    
    const scale = Math.min((width * 0.9) / contentWidth, (height * 0.9) / contentHeight, 1);
    const centerX = width / 2 - (bounds.minX + contentWidth / 2) * scale;
    const centerY = height / 2 - (bounds.minY + contentHeight / 2) * scale + 20; // Nudge down a bit
    
    const transform = d3.zoomIdentity.translate(centerX, centerY).scale(scale);
    state.svg.transition().duration(750).call(state.zoom.transform, transform);
    
    console.log('Chart centered with scale:', scale);
}

/**
 * Gets all visible nodes in the hierarchy based on expanded state
 * @param {Object} node - The root node to start from
 * @returns {Array} - Array of visible nodes
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
 * Fits the chart to view all visible nodes
 */
function fitChartToView() {
    centerChart();
}

// Export functions to global window object
window.centerChart = centerChart;
window.fitChartToView = fitChartToView;
window.getVisibleNodes = getVisibleNodes;
