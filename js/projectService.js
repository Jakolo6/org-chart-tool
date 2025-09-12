import { supabase } from './supabase.js';
import { getCurrentUser } from './auth.js';

/**
 * Service for managing projects and their data in Supabase
 */

/**
 * Create a draft project with the uploaded data
 * @param {Array} parsedData - The parsed Excel data
 * @param {Object} projectInfo - Project metadata
 * @param {string} [existingProjectId] - Optional existing project ID for updates
 * @returns {Promise<{project, version, error}>} - The created project or error
 */
export async function createDraftProject(parsedData, projectInfo, existingProjectId = null) {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Extract headers (first row)
    const headers = parsedData[0];
    
    // Extract data rows (all except first row)
    const dataRows = parsedData.slice(1);
    
    // If updating existing project
    if (existingProjectId) {
      return await updateExistingProject(existingProjectId, headers, dataRows, projectInfo, user.id);
    }
    
    // Create new project with minimal fields
    const projectData = {
      owner_id: user.id,
      name: projectInfo.name,
      description: projectInfo.description || '',
      created_by: user.id
    };
    
    // Only add optional fields if they exist
    if (projectInfo.isBaseline !== undefined) {
      projectData.is_baseline = projectInfo.isBaseline;
    }
    
    if (projectInfo.isTarget !== undefined) {
      projectData.is_target = projectInfo.isTarget;
    }
    
    // Create new project
    const { data: project, error: projectError } = await supabase
      .from('org_charts')
      .insert(projectData)
      .select()
      .single();
    
    if (projectError) throw projectError;
    
    // Create initial version with raw data
    const versionData = {
      chart_id: project.id,
      version_number: 1,
      created_by: user.id
    };
    
    // Only add data fields if they exist
    if (dataRows && dataRows.length > 0) {
      versionData.raw_data = dataRows;
    }
    
    if (headers && headers.length > 0) {
      versionData.raw_headers = headers;
    }
    
    if (projectInfo.fileName) {
      versionData.file_name = projectInfo.fileName;
    }
    
    if (projectInfo.fileSize) {
      versionData.file_size = projectInfo.fileSize;
    }
    
    const { data: version, error: versionError } = await supabase
      .from('chart_versions')
      .insert(versionData)
      .select()
      .single();
    
    if (versionError) throw versionError;
    
    // Update user's last accessed project
    try {
      await updateLastAccessedProject(user.id, project.id);
    } catch (e) {
      console.warn('Could not update last accessed project:', e);
      // Non-critical error, continue
    }
    
    return { project, version, error: null };
  } catch (error) {
    console.error('Error creating draft project:', error);
    return { project: null, version: null, error };
  }
}

/**
 * Update an existing project with new data
 * @param {string} projectId - The project ID to update
 * @param {Array} headers - The column headers
 * @param {Array} dataRows - The data rows
 * @param {Object} projectInfo - Project metadata
 * @param {string} userId - The current user ID
 * @returns {Promise<{project, version, error}>} - The updated project or error
 */
async function updateExistingProject(projectId, headers, dataRows, projectInfo, userId) {
  try {
    // Get the project
    const { data: project, error: projectError } = await supabase
      .from('org_charts')
      .select()
      .eq('id', projectId)
      .single();
    
    if (projectError) throw projectError;
    
    // Update project metadata if provided
    if (projectInfo.name || projectInfo.description !== undefined) {
      const updates = {};
      
      if (projectInfo.name) {
        updates.name = projectInfo.name;
      }
      
      if (projectInfo.description !== undefined) {
        updates.description = projectInfo.description;
      }
      
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        
        const { error: updateError } = await supabase
          .from('org_charts')
          .update(updates)
          .eq('id', projectId);
        
        if (updateError) throw updateError;
      }
    }
    
    // Get latest version number
    const { data: versions, error: versionError } = await supabase
      .from('chart_versions')
      .select('version_number')
      .eq('chart_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1);
    
    if (versionError) throw versionError;
    
    const nextVersionNumber = versions.length > 0 ? versions[0].version_number + 1 : 1;
    
    // Create new version
    const { data: version, error: newVersionError } = await supabase
      .from('chart_versions')
      .insert({
        chart_id: projectId,
        version_number: nextVersionNumber,
        raw_data: dataRows,
        raw_headers: headers,
        file_name: projectInfo.fileName,
        file_size: projectInfo.fileSize,
        created_by: userId
      })
      .select()
      .single();
    
    if (newVersionError) throw newVersionError;
    
    // Update user's last accessed project
    await updateLastAccessedProject(userId, projectId);
    
    return { project, version, error: null };
  } catch (error) {
    console.error('Error updating project:', error);
    return { project: null, version: null, error };
  }
}

/**
 * Update the user's last accessed project
 * @param {string} userId - The user ID
 * @param {string} projectId - The project ID
 */
async function updateLastAccessedProject(userId, projectId) {
  try {
    // Update profile with last accessed project
    await supabase
      .from('profiles')
      .update({
        last_accessed_project_id: projectId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    // Also store in session storage for client-side use
    sessionStorage.setItem('lastAccessedProject', projectId);
  } catch (error) {
    console.error('Error updating last accessed project:', error);
    // Non-critical error, so we don't throw
  }
}

/**
 * Get all projects for the current user's organization
 * @param {boolean} [includeDeleted=false] - Whether to include soft-deleted projects
 * @returns {Promise<{projects, error}>} - The projects or error
 */
export async function getProjects(includeDeleted = false) {
  try {
    // Get current user
    const { user, error: userError } = await getCurrentUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }
    
    // Build query
    let query = supabase
      .from('org_charts')
      .select(`
        *,
        chart_versions (
          version_number,
          created_at,
          created_by,
          file_name,
          file_size
        ),
        employees (count)
      `)
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false });
    
    // Exclude deleted projects unless specified
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data: projects, error: projectsError } = await query;
    
    if (projectsError) throw projectsError;
    
    return { projects, error: null };
  } catch (error) {
    console.error('Error getting projects:', error);
    return { projects: [], error };
  }
}

/**
 * Get a specific project by ID
 * @param {string} projectId - The project ID
 * @returns {Promise<{project, error}>} - The project or error
 */
export async function getProject(projectId) {
  try {
    const { data: project, error: projectError } = await supabase
      .from('org_charts')
      .select(`
        *,
        chart_versions (
          id,
          version_number,
          created_at,
          created_by,
          file_name,
          file_size,
          raw_headers,
          column_mapping
        ),
        employees (
          id,
          employee_id,
          name,
          manager_id,
          title,
          fte,
          location,
          job_family,
          management_level
        )
      `)
      .eq('id', projectId)
      .single();
    
    if (projectError) throw projectError;
    
    return { project, error: null };
  } catch (error) {
    console.error('Error getting project:', error);
    return { project: null, error };
  }
}

/**
 * Update project timestamp
 * @param {string} projectId - The project ID
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function updateProjectTimestamp(projectId) {
  try {
    const { error } = await supabase
      .from('org_charts')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating project timestamp:', error);
    return { success: false, error };
  }
}

/**
 * Delete a project (soft delete)
 * @param {string} projectId - The project ID
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function deleteProject(projectId) {
  try {
    const { error } = await supabase
      .from('org_charts')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { success: false, error };
  }
}

/**
 * Save column mapping for a project
 * @param {string} projectId - The project ID
 * @param {Object} mapping - The column mapping configuration
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function saveColumnMapping(projectId, mapping) {
  try {
    // Get the latest version
    const { data: versions, error: versionError } = await supabase
      .from('chart_versions')
      .select('id')
      .eq('chart_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1);
    
    if (versionError) throw versionError;
    
    if (versions.length === 0) {
      throw new Error('No version found for this project');
    }
    
    const versionId = versions[0].id;
    
    // Update the version with mapping
    const { error } = await supabase
      .from('chart_versions')
      .update({
        column_mapping: mapping,
        updated_at: new Date().toISOString()
      })
      .eq('id', versionId);
    
    if (error) throw error;
    
    // Update project timestamp
    await updateProjectTimestamp(projectId);
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error saving column mapping:', error);
    return { success: false, error };
  }
}

/**
 * Save validated employee data
 * @param {string} projectId - The project ID
 * @param {Array} employees - The validated employee data
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function saveEmployeeData(projectId, employees) {
  try {
    // First delete any existing employees for this project
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('chart_id', projectId);
    
    if (deleteError) throw deleteError;
    
    // Insert new employees
    const employeeRecords = employees.map(emp => ({
      chart_id: projectId,
      employee_id: emp.id,
      name: emp.name,
      manager_id: emp.managerId,
      title: emp.title,
      fte: emp.fte,
      location: emp.location,
      job_family: emp.jobFamily,
      management_level: emp.managementLevel
    }));
    
    const { error: insertError } = await supabase
      .from('employees')
      .insert(employeeRecords);
    
    if (insertError) throw insertError;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error saving employee data:', error);
    return { success: false, error };
  }
}

/**
 * Finalize project (commit)
 * @param {string} projectId - The project ID
 * @returns {Promise<{success, error}>} - Success status or error
 */
export async function finalizeProject(projectId) {
  try {
    // Update project timestamp
    const { error } = await supabase
      .from('org_charts')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (error) throw error;
    
    // Create snapshot
    const timestamp = new Date().toISOString().split('T')[0];
    
    const { data: project, error: projectError } = await supabase
      .from('org_charts')
      .select('is_baseline, is_target')
      .eq('id', projectId)
      .single();
    
    if (projectError) throw projectError;
    
    const snapshotName = project.is_baseline ? 
      `Baseline ${timestamp}` : 
      `Target ${timestamp}`;
    
    const { error: snapshotError } = await supabase
      .from('chart_snapshots')
      .insert({
        chart_id: projectId,
        name: snapshotName,
        type: project.is_baseline ? 'baseline' : 'target',
        created_at: new Date().toISOString()
      });
    
    if (snapshotError) throw snapshotError;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error finalizing project:', error);
    return { success: false, error };
  }
}
