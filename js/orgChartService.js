// Access global functions
const supabase = window.supabaseClient;

/**
 * Service for managing org chart data in Supabase
 */

/**
 * Save a new org chart
 * @param {string} name - Chart name
 * @param {string} description - Chart description
 * @param {Object} chartData - The chart data
 * @param {boolean} isBaseline - Whether this is a baseline chart
 * @param {boolean} isTarget - Whether this is a target chart
 * @returns {Promise<{chart, version, error}>} - The created chart, version, and error if any
 */
async function saveOrgChart(name, description, chartData, isBaseline = false, isTarget = false) {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Create a new chart
    const { data: chart, error: chartError } = await supabase
      .from('org_charts')
      .insert([{
        name,
        description,
        owner_id: user.id,
        is_baseline: isBaseline,
        is_target: isTarget
      }])
      .select()
      .single();
    
    if (chartError) throw chartError;
    
    // Create the first version
    const { data: version, error: versionError } = await supabase
      .from('chart_versions')
      .insert([{
        chart_id: chart.id,
        version_number: 1,
        data: chartData,
        created_by: user.id
      }])
      .select()
      .single();
    
    if (versionError) throw versionError;
    
    // If employee data is provided, insert employees
    if (chartData && Array.isArray(chartData)) {
      try {
        // Prepare employee records
        const employees = chartData.map(employee => ({
          chart_id: chart.id,
          employee_id: employee.id,
          name: employee.name,
          manager_id: employee.manager_id,
          title: employee.title,
          fte: employee.fte,
          location: employee.location,
          job_family: employee.job_family,
          management_level: employee.management_level,
          additional_data: employee.additional_data || {}
        }));
        
        // Insert employees in batches to avoid payload size limits
        const batchSize = 100;
        for (let i = 0; i < employees.length; i += batchSize) {
          const batch = employees.slice(i, i + batchSize);
          await supabase.from('employees').insert(batch);
        }
      } catch (employeeError) {
        console.error('Error inserting employees:', employeeError);
        // Continue even if employee insertion fails
      }
    }
    
    return { chart, version, error: null };
  } catch (error) {
    console.error('Error saving org chart:', error);
    return { chart: null, version: null, error };
  }
}

/**
 * Get all org charts for the current user
 * @returns {Promise<{charts: Array, error: Error}>} - The org charts or error
 */
async function getOrgCharts() {
  try {
    // Get current user
    const { user, profile, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Get all charts for the user
    const { data: charts, error: chartsError } = await supabase
      .from('org_charts')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    
    if (chartsError) throw chartsError;
    
    return { charts: charts || [], error: null };
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
async function getOrgChartById(chartId) {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Get the chart
    const { data: chart, error: chartError } = await supabase
      .from('org_charts')
      .select('*')
      .eq('id', chartId)
      .single();
    
    if (chartError) throw chartError;
    
    // Verify ownership
    if (chart.owner_id !== user.id) {
      throw new Error('You do not have permission to view this chart');
    }
    
    // Get the latest version
    const { data: versions, error: versionError } = await supabase
      .from('chart_versions')
      .select('*')
      .eq('chart_id', chartId)
      .order('version_number', { ascending: false })
      .limit(1);
    
    if (versionError) throw versionError;
    
    // Get employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('*')
      .eq('chart_id', chartId);
    
    if (employeesError) throw employeesError;
    
    return { 
      chart, 
      version: versions && versions.length > 0 ? versions[0] : null,
      employees: employees || [],
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
async function updateOrgChart(chartId, chartData, updates = {}) {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Get the chart to verify ownership
    const { data: chart, error: chartError } = await supabase
      .from('org_charts')
      .select('*')
      .eq('id', chartId)
      .single();
    
    if (chartError) throw chartError;
    
    // Verify ownership
    if (chart.owner_id !== user.id) {
      throw new Error('You do not have permission to update this chart');
    }
    
    // Update chart metadata if provided
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('org_charts')
        .update(updates)
        .eq('id', chartId);
      
      if (updateError) throw updateError;
    }
    
    // Get the latest version number
    const { data: latestVersion, error: versionError } = await supabase
      .from('chart_versions')
      .select('version_number')
      .eq('chart_id', chartId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    
    if (versionError && !versionError.message.includes('No rows found')) {
      throw versionError;
    }
    
    const nextVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;
    
    // Create a new version
    const { data: version, error: newVersionError } = await supabase
      .from('chart_versions')
      .insert([{
        chart_id: chartId,
        version_number: nextVersionNumber,
        data: chartData,
        created_by: user.id
      }])
      .select()
      .single();
    
    if (newVersionError) throw newVersionError;
    
    // Update employees
    if (chartData && Array.isArray(chartData)) {
      try {
        // First delete existing employees
        await supabase
          .from('employees')
          .delete()
          .eq('chart_id', chartId);
        
        // Then insert new employees
        const employees = chartData.map(employee => ({
          chart_id: chartId,
          employee_id: employee.id,
          name: employee.name,
          manager_id: employee.manager_id,
          title: employee.title,
          fte: employee.fte,
          location: employee.location,
          job_family: employee.job_family,
          management_level: employee.management_level,
          additional_data: employee.additional_data || {}
        }));
        
        // Insert employees in batches to avoid payload size limits
        const batchSize = 100;
        for (let i = 0; i < employees.length; i += batchSize) {
          const batch = employees.slice(i, i + batchSize);
          await supabase.from('employees').insert(batch);
        }
      } catch (employeeError) {
        console.error('Error updating employees:', employeeError);
        // Continue even if employee update fails
      }
    }
    
    // Get the updated chart
    const { data: updatedChart, error: getChartError } = await supabase
      .from('org_charts')
      .select('*')
      .eq('id', chartId)
      .single();
    
    if (getChartError) throw getChartError;
    
    return { chart: updatedChart, version, error: null };
  } catch (error) {
    console.error('Error updating org chart:', error);
    return { chart: null, version: null, error };
  }
}

/**
 * Delete an org chart
 * @param {string} chartId - The chart ID
 * @returns {Promise<{success, error}>} - Success status or error
 */
async function deleteOrgChart(chartId) {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Get the chart to verify ownership
    const { data: chart, error: chartError } = await supabase
      .from('org_charts')
      .select('*')
      .eq('id', chartId)
      .single();
    
    if (chartError) throw chartError;
    
    // Verify ownership
    if (chart.owner_id !== user.id) {
      throw new Error('You do not have permission to delete this chart');
    }
    
    // Delete the chart (cascade will delete versions and employees)
    const { error: deleteError } = await supabase
      .from('org_charts')
      .delete()
      .eq('id', chartId);
    
    if (deleteError) throw deleteError;
    
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
async function exportToExcel(chartId) {
  try {
    // Get the chart data
    const { chart, employees, error } = await getOrgChart(chartId);
    
    if (error) throw error;
    
    // Format data for Excel export
    const excelData = employees.map(employee => ({
      'Employee ID': employee.employee_id,
      'Name': employee.name,
      'Manager ID': employee.manager_id,
      'Title': employee.title,
      'FTE': employee.fte,
      'Location': employee.location,
      'Job Family': employee.job_family,
      'Management Level': employee.management_level
    }));
    
    // Generate filename
    const fileName = `${chart.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return { data: excelData, fileName, error: null };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { data: null, fileName: null, error };
  }
}

// Make functions available globally
window.saveOrgChart = saveOrgChart;
window.getOrgCharts = getOrgCharts;
window.getOrgChartById = getOrgChartById;
window.getOrgChartVersions = getOrgChartVersions;
window.getOrgChartVersionById = getOrgChartVersionById;
window.deleteOrgChart = deleteOrgChart;
window.updateOrgChart = updateOrgChart;
window.exportToExcel = exportToExcel;
