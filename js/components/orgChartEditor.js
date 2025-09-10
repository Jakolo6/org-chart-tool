/**
 * Org Chart Editor Component
 * Provides editing capabilities with undo/redo and auto-save
 */
import { saveEmployeeData } from '../utils/persistence.js';

export class OrgChartEditor {
  /**
   * Create a new OrgChartEditor
   * @param {string} projectId - Project ID
   * @param {Array} initialData - Initial employee data
   * @param {Object} options - Editor options
   */
  constructor(projectId, initialData = [], options = {}) {
    this.projectId = projectId;
    this.data = [...initialData];
    this.options = {
      autoSave: true,
      maxUndoSteps: 50,
      onChange: null,
      onSave: null,
      ...options
    };
    
    // History for undo/redo
    this.history = [];
    this.historyIndex = -1;
    
    // Save initial state
    this.saveHistoryState();
    
    // Auto-save timer
    this.autoSaveTimer = null;
    this.isDirty = false;
    
    // Bind methods
    this.updateEmployee = this.updateEmployee.bind(this);
    this.addEmployee = this.addEmployee.bind(this);
    this.deleteEmployee = this.deleteEmployee.bind(this);
    this.undo = this.undo.bind(this);
    this.redo = this.redo.bind(this);
    this.save = this.save.bind(this);
    this.getData = this.getData.bind(this);
    
    // Setup auto-save if enabled
    if (this.options.autoSave) {
      this.setupAutoSave();
    }
  }
  
  /**
   * Save current state to history
   * @private
   */
  saveHistoryState() {
    // If we're not at the end of the history, truncate it
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // Add current state to history
    this.history.push(JSON.stringify(this.data));
    
    // Limit history size
    if (this.history.length > this.options.maxUndoSteps) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
    
    // Mark as dirty for auto-save
    this.isDirty = true;
  }
  
  /**
   * Setup auto-save functionality
   * @private
   */
  setupAutoSave() {
    // Save on page unload
    window.addEventListener('beforeunload', () => {
      if (this.isDirty) {
        this.save();
      }
    });
    
    // Periodic auto-save
    setInterval(() => {
      if (this.isDirty) {
        this.save();
      }
    }, 30000); // Auto-save every 30 seconds if dirty
  }
  
  /**
   * Update an employee
   * @param {string} employeeId - Employee ID
   * @param {Object} updates - Properties to update
   * @returns {boolean} Success
   */
  updateEmployee(employeeId, updates) {
    const index = this.data.findIndex(emp => emp.id === employeeId);
    if (index === -1) return false;
    
    // Create a new array with the updated employee
    const newData = [...this.data];
    newData[index] = {
      ...newData[index],
      ...updates
    };
    
    // Update data
    this.data = newData;
    
    // Save to history
    this.saveHistoryState();
    
    // Trigger change callback
    if (this.options.onChange) {
      this.options.onChange(this.data);
    }
    
    return true;
  }
  
  /**
   * Add a new employee
   * @param {Object} employee - Employee data
   * @returns {string} New employee ID
   */
  addEmployee(employee) {
    // Generate ID if not provided
    const id = employee.id || `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Create employee object
    const newEmployee = {
      id,
      name: employee.name || 'New Employee',
      managerId: employee.managerId || null,
      title: employee.title || '',
      department: employee.department || '',
      location: employee.location || '',
      fte: employee.fte || 1,
      ...employee
    };
    
    // Add to data
    this.data = [...this.data, newEmployee];
    
    // Save to history
    this.saveHistoryState();
    
    // Trigger change callback
    if (this.options.onChange) {
      this.options.onChange(this.data);
    }
    
    return id;
  }
  
  /**
   * Delete an employee
   * @param {string} employeeId - Employee ID
   * @returns {boolean} Success
   */
  deleteEmployee(employeeId) {
    const index = this.data.findIndex(emp => emp.id === employeeId);
    if (index === -1) return false;
    
    // Create a new array without the employee
    const newData = this.data.filter(emp => emp.id !== employeeId);
    
    // Update data
    this.data = newData;
    
    // Save to history
    this.saveHistoryState();
    
    // Trigger change callback
    if (this.options.onChange) {
      this.options.onChange(this.data);
    }
    
    return true;
  }
  
  /**
   * Undo the last change
   * @returns {boolean} Success
   */
  undo() {
    if (this.historyIndex <= 0) return false;
    
    // Move back in history
    this.historyIndex--;
    
    // Restore state
    this.data = JSON.parse(this.history[this.historyIndex]);
    
    // Mark as dirty
    this.isDirty = true;
    
    // Trigger change callback
    if (this.options.onChange) {
      this.options.onChange(this.data);
    }
    
    return true;
  }
  
  /**
   * Redo the last undone change
   * @returns {boolean} Success
   */
  redo() {
    if (this.historyIndex >= this.history.length - 1) return false;
    
    // Move forward in history
    this.historyIndex++;
    
    // Restore state
    this.data = JSON.parse(this.history[this.historyIndex]);
    
    // Mark as dirty
    this.isDirty = true;
    
    // Trigger change callback
    if (this.options.onChange) {
      this.options.onChange(this.data);
    }
    
    return true;
  }
  
  /**
   * Save changes to the database
   * @returns {Promise<boolean>} Success
   */
  async save() {
    try {
      // Save to database
      await saveEmployeeData(this.projectId, this.data);
      
      // Mark as clean
      this.isDirty = false;
      
      // Trigger save callback
      if (this.options.onSave) {
        this.options.onSave(this.data);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving org chart data:', error);
      return false;
    }
  }
  
  /**
   * Get the current data
   * @returns {Array} Employee data
   */
  getData() {
    return [...this.data];
  }
  
  /**
   * Check if there are unsaved changes
   * @returns {boolean} Has unsaved changes
   */
  hasUnsavedChanges() {
    return this.isDirty;
  }
  
  /**
   * Check if undo is available
   * @returns {boolean} Can undo
   */
  canUndo() {
    return this.historyIndex > 0;
  }
  
  /**
   * Check if redo is available
   * @returns {boolean} Can redo
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }
  
  /**
   * Get employee by ID
   * @param {string} employeeId - Employee ID
   * @returns {Object|null} Employee or null if not found
   */
  getEmployee(employeeId) {
    return this.data.find(emp => emp.id === employeeId) || null;
  }
  
  /**
   * Get direct reports for a manager
   * @param {string} managerId - Manager ID
   * @returns {Array} Direct reports
   */
  getDirectReports(managerId) {
    return this.data.filter(emp => emp.managerId === managerId);
  }
  
  /**
   * Move an employee to a new manager
   * @param {string} employeeId - Employee ID
   * @param {string|null} newManagerId - New manager ID (null for root)
   * @returns {boolean} Success
   */
  moveEmployee(employeeId, newManagerId) {
    // Check for circular reference
    if (newManagerId) {
      let currentId = newManagerId;
      const visited = new Set();
      
      while (currentId) {
        if (currentId === employeeId) {
          // Would create a circular reference
          return false;
        }
        
        if (visited.has(currentId)) {
          // Circular reference already exists
          return false;
        }
        
        visited.add(currentId);
        const manager = this.getEmployee(currentId);
        if (!manager) break;
        currentId = manager.managerId;
      }
    }
    
    // Update manager
    return this.updateEmployee(employeeId, { managerId: newManagerId });
  }
  
  /**
   * Bulk update employees
   * @param {Array} updates - Array of {id, updates} objects
   * @returns {boolean} Success
   */
  bulkUpdate(updates) {
    if (!Array.isArray(updates) || updates.length === 0) return false;
    
    // Create a new data array with all updates
    const newData = [...this.data];
    
    updates.forEach(({ id, updates }) => {
      const index = newData.findIndex(emp => emp.id === id);
      if (index !== -1) {
        newData[index] = {
          ...newData[index],
          ...updates
        };
      }
    });
    
    // Update data
    this.data = newData;
    
    // Save to history
    this.saveHistoryState();
    
    // Trigger change callback
    if (this.options.onChange) {
      this.options.onChange(this.data);
    }
    
    return true;
  }
}
