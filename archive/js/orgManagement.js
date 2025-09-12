import { supabase } from './supabase.js';

/**
 * Organization management module for handling organization and team operations
 */

/**
 * Get organization details
 * @param {string} orgId - Organization ID
 * @returns {Promise<{organization, error}>} - The organization or error
 */
export async function getOrganization(orgId) {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();
    
    if (error) throw error;
    
    return { organization: data, error: null };
  } catch (error) {
    console.error('Error getting organization:', error);
    return { organization: null, error };
  }
}

/**
 * Update organization details
 * @param {string} orgId - Organization ID
 * @param {Object} updates - Organization updates
 * @returns {Promise<{organization, error}>} - The updated organization or error
 */
export async function updateOrganization(orgId, updates) {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single();
    
    if (error) throw error;
    
    return { organization: data, error: null };
  } catch (error) {
    console.error('Error updating organization:', error);
    return { organization: null, error };
  }
}

/**
 * Get all users in an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<{users, error}>} - The users or error
 */
export async function getOrgUsers(orgId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, role, created_at')
      .eq('organization_id', orgId);
    
    if (error) throw error;
    
    return { users: data, error: null };
  } catch (error) {
    console.error('Error getting organization users:', error);
    return { users: [], error };
  }
}

/**
 * Update a user's role
 * @param {string} userId - User ID
 * @param {string} role - New role ('admin' or 'user')
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function updateUserRole(userId, role) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error };
  }
}

/**
 * Remove a user from an organization
 * @param {string} userId - User ID
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function removeUser(userId) {
  try {
    // This would typically involve multiple operations:
    // 1. Remove user's access to organization data
    // 2. Update user's profile to remove organization_id
    // 3. Potentially delete the user account if desired
    
    // For now, we'll just update the profile to remove organization_id
    const { data, error } = await supabase
      .from('profiles')
      .update({ organization_id: null })
      .eq('id', userId);
    
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error removing user:', error);
    return { success: false, error };
  }
}

/**
 * Get organization statistics
 * @param {string} orgId - Organization ID
 * @returns {Promise<{stats, error}>} - Organization statistics or error
 */
export async function getOrgStats(orgId) {
  try {
    // Get count of users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('organization_id', orgId);
    
    if (usersError) throw usersError;
    
    // Get count of charts
    const { data: charts, error: chartsError } = await supabase
      .from('org_charts')
      .select('id')
      .eq('organization_id', orgId);
    
    if (chartsError) throw chartsError;
    
    // Get count of employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, org_charts!inner(organization_id)')
      .eq('org_charts.organization_id', orgId);
    
    if (employeesError) throw employeesError;
    
    return { 
      stats: {
        userCount: users.length,
        chartCount: charts.length,
        employeeCount: employees.length
      }, 
      error: null 
    };
  } catch (error) {
    console.error('Error getting organization stats:', error);
    return { stats: null, error };
  }
}
