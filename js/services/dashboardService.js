import { supabase } from '../supabase.js';
import { getCurrentUser } from '../auth.js';

/**
 * Get dashboard statistics for the current user
 * @returns {Promise<{stats: Object, error: Error}>}
 */
export async function getDashboardStats() {
  try {
    const { user, profile, error: userError } = await getCurrentUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Get organization ID from profile
    const organizationId = profile?.organization_id;
    if (!organizationId) throw new Error('Organization not found');

    // Get total charts count
    const { count: totalCharts, error: chartsError } = await supabase
      .from('org_charts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (chartsError) throw chartsError;

    // Get total employees across all charts
    const { data: charts, error: chartsDataError } = await supabase
      .from('org_charts')
      .select('id, employee_count')
      .eq('organization_id', organizationId);

    if (chartsDataError) throw chartsDataError;

    const totalEmployees = charts.reduce((sum, chart) => sum + (chart.employee_count || 0), 0);

    // Get recent activity (last 5 charts)
    const { data: recentCharts, error: recentError } = await supabase
      .from('org_charts')
      .select('id, name, updated_at, employee_count')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (recentError) throw recentError;

    // Get team members (other users in the same organization)
    const { data: teamMembers, error: teamError } = await supabase
      .from('profiles')
      .select('id, display_name, email, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (teamError) throw teamError;

    return {
      stats: {
        totalCharts: totalCharts || 0,
        totalEmployees,
        teamSize: teamMembers?.length || 1, // At least 1 (the current user)
        recentCharts: recentCharts || [],
        teamMembers: teamMembers || []
      },
      error: null
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return { stats: null, error };
  }
}

/**
 * Get recent activity for the dashboard
 * @returns {Promise<{activity: Array, error: Error}>}
 */
export async function getRecentActivity() {
  try {
    const { user, profile, error: userError } = await getCurrentUser();
    if (userError || !user) throw new Error('User not authenticated');

    const organizationId = profile?.organization_id;
    if (!organizationId) throw new Error('Organization not found');

    // Get recent activity from multiple tables
    const { data: chartActivity, error: chartError } = await supabase
      .from('org_charts')
      .select('id, name, updated_at, updated_by')
      .eq('organization_id', organizationId)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (chartError) throw chartError;

    // Format activity items
    const activity = (chartActivity || []).map(item => ({
      id: item.id,
      type: 'chart',
      title: item.name,
      timestamp: item.updated_at,
      action: 'updated',
      user: item.updated_by
    }));

    return { activity, error: null };
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return { activity: [], error };
  }
}
