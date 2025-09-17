/**
 * Initialize all components and modules
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[App] Initializing application...');
    
    try {
        // Initialize LegendManager first
        if (window.legendManager) {
            console.log('[App] LegendManager initialized');
            // Ensure legend is hidden by default
            window.legendManager.hide();
        } else {
            console.warn('[App] LegendManager not found. Legend functionality may not work correctly.');
            // Create a dummy legendManager to prevent errors
            window.legendManager = {
                show: () => console.warn('LegendManager not properly initialized'),
                hide: () => console.warn('LegendManager not properly initialized'),
                toggle: () => console.warn('LegendManager not properly initialized'),
                isLegendVisible: () => false
            };
        }
        
        // Initialize comparison manager
        if (typeof window.initComparisonManager === 'function') {
            window.initComparisonManager();
            console.log('[App] Comparison manager initialized');
        } else {
            console.warn('[App] Comparison manager not found');
        }
        
        // Initialize other components here
        
        console.log('[App] Application initialized successfully');
    } catch (error) {
        console.error('[App] Error during initialization:', error);
    }
});
