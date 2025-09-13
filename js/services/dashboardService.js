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
          lastUpdated: new Date().toISOString()
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

    // Get total employees across all charts
    const { data: charts, error: chartsDataError } = await supabase
      .from('org_charts')
      .select('id')
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

    return {
      stats: {
        totalCharts: totalCharts || 0,
        totalEmployees,
        recentCharts: recentCharts || [],
        lastUpdated: new Date().toISOString()
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

// Make functions available globally
window.getDashboardStats = getDashboardStats;
window.getUserProjects = getUserProjects;
window.deleteProject = deleteProject;
window.getRecentActivity = getRecentActivity;
