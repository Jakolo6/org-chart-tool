/**
 * Persistence utilities for immediate data saving
 */
import { supabase } from '../supabase.js';
import { getCurrentUser } from '../auth.js';

/**
 * Save data immediately with debouncing
 */
class PersistenceManager {
  constructor() {
    this.saveTimers = new Map();
    this.pendingSaves = new Map();
    this.DEBOUNCE_TIME = 1000; // 1 second debounce
    this.MAX_RETRY_COUNT = 3;
    this.RETRY_DELAY = 2000; // 2 seconds between retries
  }

  /**
   * Save data with debouncing
   * @param {string} key - Unique identifier for this save operation
   * @param {Function} saveFunction - Async function that performs the actual save
   * @param {Object} data - Data to save
   * @returns {Promise<void>}
   */
  async saveWithDebounce(key, saveFunction, data) {
    // Clear any existing timer for this key
    if (this.saveTimers.has(key)) {
      clearTimeout(this.saveTimers.get(key));
    }

    // Store the pending save
    this.pendingSaves.set(key, { data, retryCount: 0 });

    // Set a new timer
    const timer = setTimeout(async () => {
      try {
        const pendingSave = this.pendingSaves.get(key);
        if (!pendingSave) return;

        await saveFunction(pendingSave.data);
        
        // Remove from pending saves on success
        this.pendingSaves.delete(key);
        this.saveTimers.delete(key);
      } catch (error) {
        console.error(`Error saving ${key}:`, error);
        
        // Retry logic
        const pendingSave = this.pendingSaves.get(key);
        if (pendingSave && pendingSave.retryCount < this.MAX_RETRY_COUNT) {
          pendingSave.retryCount++;
          this.pendingSaves.set(key, pendingSave);
          
          // Schedule retry
          this.saveTimers.set(key, setTimeout(() => {
            this.saveWithDebounce(key, saveFunction, pendingSave.data);
          }, this.RETRY_DELAY));
        } else {
          // Give up after max retries
          this.pendingSaves.delete(key);
          this.saveTimers.delete(key);
          
          // Notify user of failure
          this.notifyFailure(key, error);
        }
      }
    }, this.DEBOUNCE_TIME);

    this.saveTimers.set(key, timer);
  }

  /**
   * Notify user of save failure
   * @param {string} key - Save operation identifier
   * @param {Error} error - Error object
   */
  notifyFailure(key, error) {
    // Create or update notification element
    let notification = document.getElementById('save-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'save-notification';
      notification.className = 'save-notification error';
      document.body.appendChild(notification);
    }

    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Failed to save changes. Please check your connection and try again.</span>
        <button class="retry-button" data-key="${key}">Retry</button>
        <button class="close-button">×</button>
      </div>
    `;

    // Show notification
    notification.style.display = 'block';
    
    // Add event listeners
    const retryButton = notification.querySelector('.retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        const pendingSave = this.pendingSaves.get(key);
        if (pendingSave) {
          pendingSave.retryCount = 0;
          this.pendingSaves.set(key, pendingSave);
          this.saveWithDebounce(key, saveFunction, pendingSave.data);
        }
        notification.style.display = 'none';
      });
    }
    
    const closeButton = notification.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        notification.style.display = 'none';
      });
    }
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
      notification.style.display = 'none';
    }, 10000);
  }

  /**
   * Force immediate save of all pending changes
   * @returns {Promise<void>}
   */
  async saveAllPending() {
    const savePromises = [];
    
    for (const [key, { saveFunction, data }] of this.pendingSaves.entries()) {
      // Clear any existing timer
      if (this.saveTimers.has(key)) {
        clearTimeout(this.saveTimers.get(key));
        this.saveTimers.delete(key);
      }
      
      // Create save promise
      savePromises.push(
        saveFunction(data)
          .then(() => {
            this.pendingSaves.delete(key);
          })
          .catch(error => {
            console.error(`Error saving ${key} during saveAllPending:`, error);
            // Keep in pending saves for potential retry
          })
      );
    }
    
    // Wait for all saves to complete
    await Promise.allSettled(savePromises);
  }
}

// Create singleton instance
const persistenceManager = new PersistenceManager();

/**
 * Save project data with debouncing
 * @param {string} projectId - Project ID
 * @param {Object} updates - Data to update
 * @returns {Promise<void>}
 */
export async function saveProjectData(projectId, updates) {
  const saveFunction = async (data) => {
    const { error } = await supabase
      .from('org_charts')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId);
    
    if (error) throw error;
  };
  
  await persistenceManager.saveWithDebounce(`project_${projectId}`, saveFunction, updates);
}

/**
 * Save column mapping with debouncing
 * @param {string} projectId - Project ID
 * @param {Object} mapping - Column mapping
 * @returns {Promise<void>}
 */
export async function saveColumnMappingData(projectId, mapping) {
  const saveFunction = async (data) => {
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
        column_mapping: data,
        updated_at: new Date().toISOString()
      })
      .eq('id', versionId);
    
    if (error) throw error;
  };
  
  await persistenceManager.saveWithDebounce(`mapping_${projectId}`, saveFunction, mapping);
}

/**
 * Save employee data with debouncing
 * @param {string} projectId - Project ID
 * @param {Array} employees - Employee data
 * @returns {Promise<void>}
 */
export async function saveEmployeeData(projectId, employees) {
  const saveFunction = async (data) => {
    // First delete any existing employees for this project
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('chart_id', projectId);
    
    if (deleteError) throw deleteError;
    
    // Insert new employees
    const employeeRecords = data.map(emp => ({
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
  };
  
  await persistenceManager.saveWithDebounce(`employees_${projectId}`, saveFunction, employees);
}

/**
 * Force save all pending changes
 * @returns {Promise<void>}
 */
export async function saveAllChanges() {
  await persistenceManager.saveAllPending();
}

/**
 * Setup auto-save on page unload
 */
export function setupAutoSave() {
  window.addEventListener('beforeunload', async (event) => {
    // Save all pending changes
    await saveAllChanges();
  });
}

/**
 * Setup periodic auto-save
 * @param {number} intervalMs - Interval in milliseconds
 */
export function setupPeriodicSave(intervalMs = 30000) {
  setInterval(async () => {
    await saveAllChanges();
  }, intervalMs);
}

/**
 * Initialize persistence for a page
 */
export function initPersistence() {
  setupAutoSave();
  setupPeriodicSave();
}
