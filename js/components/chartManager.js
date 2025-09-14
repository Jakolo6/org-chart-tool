/**
 * @file Chart Manager component for saving, loading, and managing org charts
 */

console.log('[OrgChart] chartManager loaded');

/**
 * Initialize the chart manager
 */
function initChartManager() {
    // Add save chart button event listener
    const saveChartBtn = document.getElementById('saveChartBtn');
    if (saveChartBtn) {
        saveChartBtn.addEventListener('click', showSaveChartModal);
    }
    
    // Add export chart button event listener
    const exportChartBtn = document.getElementById('exportChartBtn');
    if (exportChartBtn) {
        exportChartBtn.addEventListener('click', exportOrgChart);
    }
    
    console.log('[OrgChart] Chart manager initialized');
}

/**
 * Show the save chart modal
 */
function showSaveChartModal() {
    const modal = document.getElementById('saveChartModal');
    if (!modal) return;
    
    // Clear previous inputs
    const nameInput = document.getElementById('chartName');
    if (nameInput) nameInput.value = '';
    
    // Show modal
    modal.style.display = 'flex';
    
    // Add save button event listener
    const saveBtn = document.getElementById('confirmSaveChart');
    if (saveBtn) {
        // Remove previous event listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        // Add new event listener
        newSaveBtn.addEventListener('click', handleSaveChart);
    }
    
    // Add cancel button event listener
    const cancelBtn = document.getElementById('cancelSaveChart');
    if (cancelBtn) {
        // Remove previous event listeners
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // Add new event listener
        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
}

/**
 * Handle saving the chart
 */
async function handleSaveChart() {
    const nameInput = document.getElementById('chartName');
    if (!nameInput || !nameInput.value.trim()) {
        alert('Please enter a name for your chart');
        return;
    }
    
    const chartName = nameInput.value.trim();
    const state = window.state || {};
    
    try {
        // Show loading state
        const saveBtn = document.getElementById('confirmSaveChart');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }
        
        // Get current user
        const { user, error: userError } = await window.getCurrentUser();
        if (userError || !user) {
            throw new Error('You must be logged in to save a chart');
        }
        
        // Prepare chart data
        const chartData = {
            name: chartName,
            data: state.currentData || [],
            created_by: user.id
        };
        
        // Save chart
        const { data, error } = await window.saveOrgChart(chartData);
        if (error) throw error;
        
        // Hide modal
        const modal = document.getElementById('saveChartModal');
        if (modal) modal.style.display = 'none';
        
        // Show success message
        alert('Chart saved successfully!');
        
    } catch (error) {
        console.error('Error saving chart:', error);
        alert('Error saving chart: ' + error.message);
    } finally {
        // Reset button state
        const saveBtn = document.getElementById('confirmSaveChart');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    }
}

/**
 * Export the current org chart to Excel
 */
function exportOrgChart() {
    const state = window.state || {};
    if (!state.currentData || state.currentData.length === 0) {
        alert('No data to export');
        return;
    }
    
    try {
        window.exportToExcel(state.currentData);
    } catch (error) {
        console.error('Error exporting chart:', error);
        alert('Error exporting chart: ' + error.message);
    }
}

// Export functions to global window object
window.initChartManager = initChartManager;
window.showSaveChartModal = showSaveChartModal;
window.handleSaveChart = handleSaveChart;
window.exportOrgChart = exportOrgChart;
