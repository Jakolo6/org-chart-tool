/**
 * @file Export Manager component for exporting org chart data to Excel
 */

console.log('[OrgChart] exportManager loaded');

/**
 * Export the org chart data to Excel
 * @param {string} chartId - The ID of the chart to export
 * @returns {Promise} - A promise that resolves when the export is complete
 */
async function exportToExcel(chartId) {
    if (!chartId) {
        console.error('No chart ID provided for export');
        throw new Error('No chart ID provided for export');
    }

    try {
        console.log(`Exporting chart ${chartId} to Excel`);
        
        // Get the current data from state
        const state = window.state || {};
        const data = state.currentData || [];
        
        if (!data || data.length === 0) {
            console.error('No data available for export');
            throw new Error('No data available for export');
        }
        
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Convert data to worksheet format
        const wsData = data.map(emp => ({
            'ID': emp.id,
            'Name': emp.name,
            'Title': emp.title,
            'Manager ID': emp.manager,
            'FTE': emp.fte || 1,
            'Location': emp.location || '',
            'Job Family': emp.jobFamily || '',
            'Management Level': emp.managementLevel || ''
        }));
        
        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(wsData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Employees');
        
        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        // Convert buffer to Blob
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `org_chart_${chartId}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Export completed successfully');
        return { success: true };
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        throw error;
    }
}

// Export function to global window object
window.exportToExcel = exportToExcel;
