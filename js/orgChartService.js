import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';

/**
 * Service for managing org chart data in Supabase
 */

/**
 * Save an org chart to the database
 * @param {Object} chartData - The org chart data
 * @param {string} name - Chart name
 * @param {string} description - Chart description
 * @param {boolean} isBaseline - Whether this is a baseline chart
 * @param {boolean} isTarget - Whether this is a target chart
 * @returns {Promise<{chart, error}>} - The saved chart or error
 */
export async function saveOrgChart(chartData, name, description = '', isBaseline = true, isTarget = false) {
  try {
    // Get current user and organization
    const { user, profile, organization, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Create chart record
    const { data: chart, error: chartError } = await supabase
      .from('org_charts')
      .insert({
        organization_id: profile.organization_id,
        name,
        description,
        created_by: user.id,
        is_baseline: isBaseline,
        is_target: isTarget
      })
      .select()
      .single();
    
    if (chartError) throw chartError;
    
    // Create chart version
    const { data: version, error: versionError } = await supabase
      .from('chart_versions')
      .insert({
        chart_id: chart.id,
        version_number: 1,
        data: chartData,
        created_by: user.id
      })
      .select()
      .single();
    
    if (versionError) throw versionError;
    
    // Insert employees
    const employees = chartData.map(emp => ({
      chart_id: chart.id,
      employee_id: emp.id || '',
      name: emp.name || '',
      manager_id: emp.managerId || '',
      title: emp.title || '',
      fte: emp.fte || null,
      location: emp.location || '',
      job_family: emp.jobFamily || '',
      management_level: emp.managementLevel || ''
    }));
    
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .insert(employees);
    
    if (empError) throw empError;
    
    return { chart, version, error: null };
  } catch (error) {
    console.error('Error saving org chart:', error);
    return { chart: null, version: null, error };
  }
}

/**
 * Get all org charts for the current user's organization
 * @returns {Promise<{charts, error}>} - The org charts or error
 */
export async function getOrgCharts() {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Get all charts for the user's organization
    const { data: charts, error: chartsError } = await supabase
      .from('org_charts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (chartsError) throw chartsError;
    
    return { charts, error: null };
  } catch (error) {
    console.error('Error getting org charts:', error);
    return { charts: [], error };
  }
}

/**
 * Get a specific org chart by ID
 * @param {string} chartId - The chart ID
 * @returns {Promise<{chart, employees, error}>} - The chart, employees, and error if any
 */
export async function getOrgChart(chartId) {
  try {
    // Get chart
    const { data: chart, error: chartError } = await supabase
      .from('org_charts')
      .select('*')
      .eq('id', chartId)
      .single();
    
    if (chartError) throw chartError;
    
    // Get latest version
    const { data: versions, error: versionError } = await supabase
      .from('chart_versions')
      .select('*')
      .eq('chart_id', chartId)
      .order('version_number', { ascending: false })
      .limit(1);
    
    if (versionError) throw versionError;
    
    const latestVersion = versions[0];
    
    // Get employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('chart_id', chartId);
    
    if (empError) throw empError;
    
    return { 
      chart, 
      version: latestVersion,
      employees, 
      error: null 
    };
  } catch (error) {
    console.error('Error getting org chart:', error);
    return { chart: null, version: null, employees: [], error };
  }
}

/**
 * Update an existing org chart
 * @param {string} chartId - The chart ID
 * @param {Object} chartData - The updated chart data
 * @param {Object} updates - Updates to the chart metadata
 * @returns {Promise<{chart, error}>} - The updated chart or error
 */
export async function updateOrgChart(chartId, chartData, updates = {}) {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Update chart metadata if provided
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('org_charts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', chartId);
      
      if (updateError) throw updateError;
    }
    
    // Get latest version number
    const { data: versions, error: versionError } = await supabase
      .from('chart_versions')
      .select('version_number')
      .eq('chart_id', chartId)
      .order('version_number', { ascending: false })
      .limit(1);
    
    if (versionError) throw versionError;
    
    const nextVersionNumber = versions.length > 0 ? versions[0].version_number + 1 : 1;
    
    // Create new version
    const { data: version, error: newVersionError } = await supabase
      .from('chart_versions')
      .insert({
        chart_id: chartId,
        version_number: nextVersionNumber,
        data: chartData,
        created_by: user.id
      })
      .select()
      .single();
    
    if (newVersionError) throw newVersionError;
    
    // Update employees
    // First delete existing employees
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('chart_id', chartId);
    
    if (deleteError) throw deleteError;
    
    // Then insert new employees
    const employees = chartData.map(emp => ({
      chart_id: chartId,
      employee_id: emp.id || '',
      name: emp.name || '',
      manager_id: emp.managerId || '',
      title: emp.title || '',
      fte: emp.fte || null,
      location: emp.location || '',
      job_family: emp.jobFamily || '',
      management_level: emp.managementLevel || ''
    }));
    
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .insert(employees);
    
    if (empError) throw empError;
    
    return { version, error: null };
  } catch (error) {
    console.error('Error updating org chart:', error);
    return { version: null, error };
  }
}

/**
 * Delete an org chart
 * @param {string} chartId - The chart ID
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function deleteOrgChart(chartId) {
  try {
    const { error } = await supabase
      .from('org_charts')
      .delete()
      .eq('id', chartId);
    
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting org chart:', error);
    return { success: false, error };
  }
}

/**
 * Export org chart data to Excel format
 * @param {string} chartId - The chart ID
 * @returns {Promise<{data, fileName, error}>} - The Excel data, filename, or error
 */
export async function exportToExcel(chartId) {
  try {
    // Get chart details
    const { data: chart, error: chartError } = await supabase
      .from('org_charts')
      .select('*')
      .eq('id', chartId)
      .single();
    
    if (chartError) throw chartError;
    
    // Get employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('chart_id', chartId);
    
    if (empError) throw empError;
    
    // Convert to Excel format using SheetJS
    // Create worksheet data
    const worksheetData = employees.map(emp => ({
      'Employee ID': emp.employee_id,
      'Name': emp.name,
      'Manager ID': emp.manager_id,
      'Title': emp.title,
      'FTE': emp.fte,
      'Location': emp.location,
      'Job Family': emp.job_family,
      'Management Level': emp.management_level
    }));
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    
    // Convert to Blob
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Generate filename
    const fileName = `${chart.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return { data: blob, fileName, error: null };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { data: null, fileName: null, error };
  }
}
