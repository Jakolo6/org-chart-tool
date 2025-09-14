/**
 * @file Chart Manager component for saving, loading, and managing org charts
 */

import { supabase } from '../supabase.js';
import { getCurrentUser } from '../auth.js';
import { saveOrgChart, getOrgCharts, getOrgChart, updateOrgChart, exportToExcel } from '../orgChartService.js';
import { state, setBaselineData, setUpdateData, setCurrentData } from '../main.js';
import { buildHierarchy, renderChart } from './chartRenderer.js';

/**
 * Initialize the chart manager
 */
export function initChartManager() {
    // Add save chart button event listener
    const saveChartBtn = document.getElementById('saveChartBtn');
    if (saveChartBtn) {
        saveChartBtn.addEventListener('click', showSaveChartModal);
    }
    
    // Add load charts button event listener
    const loadChartsBtn = document.getElementById('loadChartsBtn');
    if (loadChartsBtn) {
        loadChartsBtn.addEventListener('click', showLoadChartsModal);
    }
}

/**
 * Show modal for saving a chart
 */
export function showSaveChartModal() {
    // Check if there's data to save
    if (!state.currentData || state.currentData.length === 0) {
        alert('No data to save. Please upload an Excel file first.');
        return;
    }
    
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'saveChartModal';
    
    // Create modal content
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Save Organization Chart</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="saveChartForm" class="chart-form">
                    <div class="form-group">
                        <label for="chartName">Chart Name</label>
                        <input type="text" id="chartName" name="chartName" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="chartDescription">Description (Optional)</label>
                        <textarea id="chartDescription" name="chartDescription" rows="3"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Chart Type</label>
                        <div class="radio-group">
                            <label>
                                <input type="radio" name="chartType" value="baseline" checked>
                                Baseline Chart
                            </label>
                            <label>
                                <input type="radio" name="chartType" value="target">
                                Target Chart
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-error" id="saveChartError"></div>
                    
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Save Chart</button>
                        <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    const saveForm = modal.querySelector('#saveChartForm');
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    saveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const chartName = document.getElementById('chartName').value;
        const chartDescription = document.getElementById('chartDescription').value;
        const chartType = document.querySelector('input[name="chartType"]:checked').value;
        const isBaseline = chartType === 'baseline';
        const isTarget = chartType === 'target';
        
        const saveChartError = document.getElementById('saveChartError');
        saveChartError.textContent = '';
        
        try {
            const { chart, version, error } = await saveOrgChart(
                state.currentData,
                chartName,
                chartDescription,
                isBaseline,
                isTarget
            );
            
            if (error) {
                saveChartError.textContent = error.message || 'Failed to save chart';
                return;
            }
            
            // Close modal
            document.body.removeChild(modal);
            
            // Show success message
            alert('Chart saved successfully!');
        } catch (error) {
            console.error('Error saving chart:', error);
            saveChartError.textContent = 'An unexpected error occurred';
        }
    });
}

/**
 * Show modal for loading saved charts
 */
export async function showLoadChartsModal() {
    try {
        // Get saved charts
        const { charts, error } = await getOrgCharts();
        
        if (error) {
            alert(`Error loading charts: ${error.message}`);
            return;
        }
        
        if (charts.length === 0) {
            alert('No saved charts found.');
            return;
        }
        
        // Create modal element
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'loadChartsModal';
        
        // Create modal content
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Your Saved Charts</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="charts-list">
                        ${charts.map(chart => `
                            <div class="chart-item" data-id="${chart.id}">
                                <div class="chart-info">
                                    <h3>${chart.name}</h3>
                                    <p>${chart.description || 'No description'}</p>
                                    <div class="chart-meta">
                                        <span class="chart-type ${chart.is_baseline ? 'baseline' : 'target'}">${chart.is_baseline ? 'Baseline' : 'Target'}</span>
                                        <span class="chart-date">Created: ${new Date(chart.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div class="chart-actions">
                                    <button class="btn btn-primary load-chart-btn">Load</button>
                                    <button class="btn btn-secondary export-chart-btn">Export</button>
                                    <button class="btn btn-danger delete-chart-btn">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Add load chart event listeners
        const loadBtns = modal.querySelectorAll('.load-chart-btn');
        loadBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const chartId = btn.closest('.chart-item').dataset.id;
                await loadChart(chartId);
                document.body.removeChild(modal);
            });
        });
        
        // Add export chart event listeners
        const exportBtns = modal.querySelectorAll('.export-chart-btn');
        exportBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const chartId = btn.closest('.chart-item').dataset.id;
                await exportChart(chartId);
            });
        });
        
        // Add delete chart event listeners
        const deleteBtns = modal.querySelectorAll('.delete-chart-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const chartId = btn.closest('.chart-item').dataset.id;
                const chartName = btn.closest('.chart-item').querySelector('h3').textContent;
                
                if (confirm(`Are you sure you want to delete the chart "${chartName}"?`)) {
                    await deleteChart(chartId);
                    btn.closest('.chart-item').remove();
                    
                    if (modal.querySelectorAll('.chart-item').length === 0) {
                        document.body.removeChild(modal);
                        alert('No more charts to display.');
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error showing load charts modal:', error);
        alert('Failed to load charts. Please try again.');
    }
}

/**
 * Load a chart by ID
 * @param {string} chartId - The chart ID
 */
export async function loadChart(chartId) {
    try {
        const { chart, version, employees, error } = await getOrgChart(chartId);
        
        if (error) {
            alert(`Error loading chart: ${error.message}`);
            return;
        }
        
        // Convert employees to the format expected by the chart renderer
        const chartData = employees.map(emp => ({
            id: emp.employee_id,
            name: emp.name,
            managerId: emp.manager_id,
            title: emp.title,
            fte: emp.fte,
            location: emp.location,
            jobFamily: emp.job_family,
            managementLevel: emp.management_level
        }));
        
        // Update state based on chart type
        if (chart.is_baseline) {
            setBaselineData(chartData);
            setCurrentData(chartData);
            
            // Update UI to show we're in baseline mode
            const modeIndicator = document.querySelector('.mode-indicator');
            if (modeIndicator) {
                modeIndicator.textContent = 'Baseline View';
                modeIndicator.className = 'mode-indicator baseline';
            }
        } else if (chart.is_target) {
            setUpdateData(chartData);
            setCurrentData(chartData);
            
            // Update UI to show we're in target mode
            const modeIndicator = document.querySelector('.mode-indicator');
            if (modeIndicator) {
                modeIndicator.textContent = 'Target View';
                modeIndicator.className = 'mode-indicator update';
            }
        }
        
        // Build hierarchy and render chart
        const hierarchy = buildHierarchy(chartData);
        renderChart(hierarchy);
        
        // Update file status indicators
        if (chart.is_baseline) {
            const baselineStatus = document.getElementById('baselineStatus');
            if (baselineStatus) {
                baselineStatus.textContent = `Loaded: ${chart.name}`;
                baselineStatus.className = 'file-status success';
            }
        } else if (chart.is_target) {
            const updateStatus = document.getElementById('updateStatus');
            if (updateStatus) {
                updateStatus.textContent = `Loaded: ${chart.name}`;
                updateStatus.className = 'file-status success';
            }
        }
        
        // Enable compare button if both baseline and update data are loaded
        const compareBtn = document.getElementById('compareBtn');
        if (compareBtn && state.baselineData.length > 0 && state.updateData.length > 0) {
            compareBtn.disabled = false;
        }
        
        alert(`Chart "${chart.name}" loaded successfully!`);
    } catch (error) {
        console.error('Error loading chart:', error);
        alert('Failed to load chart. Please try again.');
    }
}

/**
 * Export a chart to Excel
 * @param {string} chartId - The chart ID
 */
export async function exportChart(chartId) {
    try {
        const { data, fileName, error } = await exportToExcel(chartId);
        
        if (error) {
            alert(`Error exporting chart: ${error.message}`);
            return;
        }
        
        // Create a download link and trigger the download
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        alert(`Chart exported successfully as ${fileName}`);
    } catch (error) {
        console.error('Error exporting chart:', error);
        alert('Failed to export chart. Please try again.');
    }
}

/**
 * Delete a chart
 * @param {string} chartId - The chart ID
 */
export async function deleteChart(chartId) {
    try {
        const { success, error } = await window.deleteOrgChart(chartId);
        
        if (error) {
            alert(`Error deleting chart: ${error.message}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error deleting chart:', error);
        alert('Failed to delete chart. Please try again.');
        return false;
    }
}
