/**
 * Legend Manager - Handles all legend-related functionality
 */

class LegendManager {
    constructor() {
        this.legendContainer = null;
        this.isVisible = false;
        this.init();
    }

    init() {
        // Create or get the legend container
        this.legendContainer = document.getElementById('legendContainer');
        
        if (!this.legendContainer) {
            this.legendContainer = document.createElement('div');
            this.legendContainer.id = 'legendContainer';
            this.legendContainer.className = 'legend-container hidden';
            
            // Add to header or body if header-left doesn't exist
            const headerLeft = document.querySelector('.page-header-left');
            if (headerLeft) {
                headerLeft.appendChild(this.legendContainer);
            } else {
                document.body.appendChild(this.legendContainer);
            }
        }
        
        // Initialize with hidden state
        this.hide();
    }
    
    show() {
        if (!this.legendContainer) return;
        
        // Clear existing content
        this.legendContainer.innerHTML = '';
        
        // Create legend items
        const legendItems = [
            { className: 'new', label: 'New' },
            { className: 'moved', label: 'Moved' },
            { className: 'exit', label: 'Exit' }
        ];
        
        // Add items to legend
        legendItems.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = `legend-color ${item.className}`;
            
            const label = document.createElement('span');
            label.className = 'legend-label';
            label.textContent = item.label;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            this.legendContainer.appendChild(legendItem);
        });
        
        // Show the legend
        this.legendContainer.classList.remove('hidden');
        this.isVisible = true;
        
        // Force reflow to ensure styles are applied
        void this.legendContainer.offsetHeight;
    }
    
    hide() {
        if (!this.legendContainer) return;
        
        // Hide the legend using multiple methods
        this.legendContainer.classList.add('hidden');
        this.legendContainer.style.display = 'none';
        this.legendContainer.style.visibility = 'hidden';
        this.legendContainer.setAttribute('aria-hidden', 'true');
        
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    isLegendVisible() {
        return this.isVisible;
    }
}

// Create and expose a singleton instance
const legendManager = new LegendManager();

// Expose to window for global access
if (typeof window !== 'undefined') {
    window.legendManager = legendManager;
}

// Export for ES modules
export default legendManager;
