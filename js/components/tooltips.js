/**
 * Tooltip functionality for the org chart tool
 */

// Initialize tooltips when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTooltips);

/**
 * Initialize tooltips for elements with data-tooltip attribute
 */
function initializeTooltips() {
    // Create tooltip element if it doesn't exist
    let tooltip = document.querySelector('.custom-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        document.body.appendChild(tooltip);
    }
    
    // Add event listeners to all tooltip elements
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
    
    function showTooltip(e) {
        const tooltipText = this.getAttribute('data-tooltip');
        if (!tooltipText) return;
        
        tooltip.textContent = tooltipText;
        tooltip.style.display = 'block';
        
        // Position the tooltip above the element
        const rect = this.getBoundingClientRect();
        const tooltipHeight = tooltip.offsetHeight;
        
        // Position tooltip centered above the element
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltipHeight - 10 + 'px';
        
        // If tooltip would go off the top of the screen, position it below the element
        if (parseFloat(tooltip.style.top) < 0) {
            tooltip.style.top = rect.bottom + 10 + 'px';
        }
        
        // If tooltip would go off the left or right of the screen, adjust horizontal position
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.left < 0) {
            tooltip.style.left = '10px';
        } else if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = (window.innerWidth - tooltipRect.width - 10) + 'px';
        }
    }
    
    function hideTooltip() {
        tooltip.style.display = 'none';
    }
}

// Create a MutationObserver to watch for changes in the DOM
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
            // Re-initialize tooltips when new nodes are added
            initializeTooltips();
        }
    });
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });

// Export the function for use in other modules
window.initializeTooltips = initializeTooltips;
