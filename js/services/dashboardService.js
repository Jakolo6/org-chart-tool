// Access global functions directly

/**
 * Get dashboard statistics for the current user
 * @returns {Promise<{stats: Object, error: Error}>}
 */
async function getDashboardStats() {
  try {
    const { user, profile, error: userError } = await getCurrentUser();
    if (userError || !user) throw new Error('User not authenticated');

    // If no profile, return default stats
    if (!profile) {
      return {
        stats: {
          totalCharts: 0,
          totalEmployees: 0,
          lastUpdated: new Date().toISOString(),
          storageUsed: 0,
          storageLimit: 500, // 500 KB default limit
          storagePercentage: 0
        },
        error: null
      };
    }

    // Get total charts count
    const { count: totalCharts, error: chartsError } = await supabase
      .from('org_charts')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id);

    if (chartsError) throw chartsError;

    // Get all charts with their data for the user
    const { data: charts, error: chartsDataError } = await supabase
      .from('org_charts')
      .select('id, name, created_at, updated_at')
      .eq('owner_id', user.id);

    if (chartsDataError) throw chartsDataError;
    
    // Count employees from the employees table
    let totalEmployees = 0;
    try {
      // Get employee count from employees table
      const { count: employeeCount, error: employeeError } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .in('chart_id', charts.map(chart => chart.id));
        
      if (!employeeError) {
        totalEmployees = employeeCount || 0;
      }
    } catch (error) {
      console.warn('Could not get employee count:', error);
      // Continue with zero count
    }

    // Get recent activity (last 5 charts)
    const { data: recentCharts, error: recentError } = await supabase
      .from('org_charts')
      .select('id, name, updated_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (recentError) throw recentError;
    
    // Get chart versions to calculate storage usage
    const { data: versions, error: versionsError } = await supabase
      .from('chart_versions')
      .select('id, data, created_at')
      .in('chart_id', charts.map(chart => chart.id));
      
    if (versionsError) throw versionsError;
    
    // Calculate storage usage based on JSON data size
    let storageUsed = 0;
    let lastUploadDate = null;
    
    if (versions && versions.length > 0) {
      versions.forEach(version => {
        // Calculate size of the data in KB
        const dataSize = JSON.stringify(version.data).length / 1024;
        storageUsed += dataSize;
        
        // Track the most recent upload date
        const uploadDate = new Date(version.created_at);
        if (!lastUploadDate || uploadDate > lastUploadDate) {
          lastUploadDate = uploadDate;
        }
      });
    }
    
    // Round to 2 decimal places
    storageUsed = Math.round(storageUsed * 100) / 100;
    
    // Get storage limit from profile or use default
    const storageLimit = profile.storage_limit || 500; // 500 KB default
    const storagePercentage = Math.min(Math.round((storageUsed / storageLimit) * 100), 100);

    // Get chart analytics data if there are charts
    let chartAnalytics = {
      avgDepth: 0,
      maxDepth: 0,
      avgSpan: 0,
      maxSpan: 0,
      departmentDistribution: {}
    };
    
    if (charts && charts.length > 0 && versions && versions.length > 0) {
      chartAnalytics = await calculateChartAnalytics(versions);
    }

    return {
      stats: {
        totalCharts: totalCharts || 0,
        totalEmployees,
        recentCharts: recentCharts || [],
        lastUpdated: new Date().toISOString(),
        storageUsed,
        storageLimit,
        storagePercentage,
        lastUploadDate: lastUploadDate ? lastUploadDate.toISOString() : null,
        chartAnalytics
      },
      error: null
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return default stats on error
    return {
      stats: {
        totalCharts: 0,
        totalEmployees: 0,
        lastUpdated: new Date().toISOString(),
        storageUsed: 0,
        storageLimit: 500,
        storagePercentage: 0,
        error: error.message
      },
      error
    };
  }
}

/**
 * Get recent activity for the dashboard
 * @returns {Promise<{activity: Array, error: Error}>}
 */
async function getRecentActivity() {
  try {
    const { user, profile, error: userError } = await getCurrentUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Get recent chart activity
    const { data: recentCharts, error: chartsError } = await window.supabaseClient
      .from('org_charts')
      .select('id, name, created_at, updated_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (chartsError) throw chartsError;

    // Format activity items
    const activity = recentCharts.map(chart => ({
      id: chart.id,
      type: 'chart_update',
      name: chart.name,
      timestamp: chart.updated_at,
      message: `Chart "${chart.name}" was updated`
    }));

    return { activity, error: null };
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return { activity: [], error };
  }
}

/**
 * Get all projects for the current user
 * @returns {Promise<{projects: Array, error: Error}>}
 */
async function getUserProjects() {
  try {
    const { user, error: userError } = await window.getCurrentUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Get projects from the database
    const { data: projects, error } = await window.supabaseClient
      .from('org_charts')
      .select('*')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return { projects, error: null };
  } catch (error) {
    console.error('Error getting user projects:', error);
    return { projects: [], error };
  }
}

/**
 * Delete a project by ID
 * @param {string} projectId - The project ID to delete
 * @returns {Promise<{success: boolean, error: Error}>}
 */
async function deleteProject(projectId) {
  try {
    const { user, error: userError } = await window.getCurrentUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Soft delete the project
    const { error } = await window.supabaseClient
      .from('org_charts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { success: false, error };
  }
}

/**
 * Calculate chart analytics from version data
 * @param {Array} versions - Array of chart versions with data
 * @returns {Object} - Chart analytics metrics
 */
async function calculateChartAnalytics(versions) {
  try {
    // Initialize analytics
    let totalDepth = 0;
    let maxDepth = 0;
    let totalSpan = 0;
    let maxSpan = 0;
    let totalManagers = 0;
    let departmentDistribution = {};
    
    // Process each version's data
    for (const version of versions) {
      if (!version.data || !Array.isArray(version.data)) continue;
      
      // Convert data to hierarchical structure
      const hierarchy = buildHierarchy(version.data);
      if (!hierarchy) continue;
      
      // Calculate metrics for this chart
      const metrics = calculateHierarchyMetrics(hierarchy);
      
      // Accumulate metrics
      totalDepth += metrics.avgDepth;
      maxDepth = Math.max(maxDepth, metrics.maxDepth);
      totalSpan += metrics.avgSpan;
      maxSpan = Math.max(maxSpan, metrics.maxSpan);
      totalManagers += metrics.totalManagers;
      
      // Accumulate department distribution
      metrics.departments.forEach(dept => {
        if (!departmentDistribution[dept.name]) {
          departmentDistribution[dept.name] = 0;
        }
        departmentDistribution[dept.name] += dept.count;
      });
    }
    
    // Calculate averages
    const chartCount = versions.length;
    const avgDepth = chartCount > 0 ? totalDepth / chartCount : 0;
    const avgSpan = chartCount > 0 ? totalSpan / chartCount : 0;
    
    return {
      avgDepth: parseFloat(avgDepth.toFixed(1)),
      maxDepth,
      avgSpan: parseFloat(avgSpan.toFixed(1)),
      maxSpan,
      departmentDistribution
    };
  } catch (error) {
    console.error('Error calculating chart analytics:', error);
    return {
      avgDepth: 0,
      maxDepth: 0,
      avgSpan: 0,
      maxSpan: 0,
      departmentDistribution: {}
    };
  }
}

/**
 * Build hierarchy from flat employee data
 * @param {Array} data - Flat array of employee data
 * @returns {Object} - Hierarchical structure
 */
function buildHierarchy(data) {
  try {
    // Handle different data formats
    let employees = data;
    
    // If data is in Excel format (array of arrays), convert to objects
    if (Array.isArray(data[0])) {
      // Skip header row if present
      const startIndex = data[0].length <= 3 ? 1 : 0;
      
      employees = data.slice(startIndex).map(row => {
        // Assuming format: [name, manager, title, fte, location, jobFamily, managementLevel]
        return {
          id: row[0],
          name: row[0],
          manager: row[1],
          title: row[2],
          fte: row[3],
          location: row[4],
          jobFamily: row[5],
          managementLevel: row[6]
        };
      });
    }
    
    // Create employee map
    const employeeMap = new Map();
    employees.forEach(emp => {
      const id = String(emp.id || emp.name || '');
      if (id) {
        employeeMap.set(id, {
          ...emp,
          children: []
        });
      }
    });
    
    // Build hierarchy
    let rootNode = null;
    
    employees.forEach(emp => {
      const id = String(emp.id || emp.name || '');
      if (!id) return;
      
      const node = employeeMap.get(id);
      const managerId = String(emp.manager || '');
      
      if (!managerId || managerId === '' || managerId === id) {
        // This is a root node
        rootNode = node;
      } else if (employeeMap.has(managerId)) {
        // Add as child to manager
        const managerNode = employeeMap.get(managerId);
        managerNode.children.push(node);
      } else if (!rootNode) {
        // Manager not found, treat as root if no root yet
        rootNode = node;
      }
    });
    
    return rootNode;
  } catch (error) {
    console.error('Error building hierarchy:', error);
    return null;
  }
}

/**
 * Calculate metrics from a hierarchy
 * @param {Object} node - Root node of hierarchy
 * @returns {Object} - Metrics for the hierarchy
 */
function calculateHierarchyMetrics(node) {
  // Initialize metrics
  let maxDepth = 0;
  let totalDepth = 0;
  let nodeCount = 0;
  let maxSpan = 0;
  let totalSpan = 0;
  let managerCount = 0;
  let departments = {};
  
  // Recursive function to traverse hierarchy
  function traverse(node, depth) {
    if (!node) return;
    
    nodeCount++;
    totalDepth += depth;
    maxDepth = Math.max(maxDepth, depth);
    
    // Count departments
    const dept = node.jobFamily || 'Unknown';
    if (!departments[dept]) {
      departments[dept] = 0;
    }
    departments[dept]++;
    
    // Process children
    if (node.children && node.children.length > 0) {
      managerCount++;
      const span = node.children.length;
      totalSpan += span;
      maxSpan = Math.max(maxSpan, span);
      
      node.children.forEach(child => traverse(child, depth + 1));
    }
  }
  
  // Start traversal from root
  traverse(node, 0);
  
  // Calculate averages
  const avgDepth = nodeCount > 0 ? totalDepth / nodeCount : 0;
  const avgSpan = managerCount > 0 ? totalSpan / managerCount : 0;
  
  // Convert departments object to array
  const departmentsArray = Object.keys(departments).map(name => ({
    name,
    count: departments[name]
  }));
  
  return {
    avgDepth,
    maxDepth,
    avgSpan,
    maxSpan,
    totalManagers: managerCount,
    departments: departmentsArray
  };
}

// Make functions available globally
window.getDashboardStats = getDashboardStats;
window.getUserProjects = getUserProjects;
window.deleteProject = deleteProject;
window.getRecentActivity = getRecentActivity;
window.calculateChartAnalytics = calculateChartAnalytics;
