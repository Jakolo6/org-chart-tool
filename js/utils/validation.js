/**
 * Validation utilities for org chart data
 */

/**
 * Validate org chart data based on column mapping
 * @param {Array} rawData - Raw data rows from Excel
 * @param {Object} columnMapping - Mapping of org chart fields to Excel columns
 * @returns {Object} Validation results
 */
export function validateOrgChartData(rawData, columnMapping) {
  const results = {
    totalRows: 0,
    validRows: 0,
    errors: [],
    warnings: [],
    stats: {}
  };

  if (!rawData || !Array.isArray(rawData)) {
    results.errors.push('No data found to validate');
    return results;
  }

  results.totalRows = rawData.length;

  // Track unique IDs and managers
  const uniqueIds = new Set();
  const uniqueManagers = new Set();
  const orphanedEmployees = [];
  const circularRefs = [];
  const employeeMap = new Map();

  // Process each row
  rawData.forEach((row, index) => {
    const employee = parseEmployeeFromRow(row, columnMapping, index + 1);

    // Check for duplicate IDs
    if (employee.id) {
      if (uniqueIds.has(employee.id)) {
        results.errors.push(`Duplicate employee ID "${employee.id}" found in row ${employee.rowNumber}`);
      } else {
        uniqueIds.add(employee.id);
        employeeMap.set(employee.id, employee);
      }
    } else {
      results.errors.push(`Missing employee ID in row ${employee.rowNumber}`);
    }

    // Check for missing name
    if (!employee.name || employee.name.trim() === '') {
      results.errors.push(`Missing employee name in row ${employee.rowNumber}`);
    }

    // Check for self-referencing manager
    if (employee.id && employee.managerId && employee.id === employee.managerId) {
      results.errors.push(`Employee "${employee.name}" (${employee.id}) reports to themselves in row ${employee.rowNumber}`);
    }

    // Track manager IDs
    if (employee.managerId) {
      uniqueManagers.add(employee.managerId);
    }

    // Validate FTE if present
    if (employee.fte !== undefined && employee.fte !== null) {
      const fte = parseFloat(employee.fte);
      if (isNaN(fte) || fte < 0 || fte > 2) {
        results.warnings.push(`Invalid FTE value "${employee.fte}" in row ${employee.rowNumber} (should be 0-2)`);
      }
    }

    // Count valid rows
    if (employee.id && employee.name) {
      results.validRows++;
    }
  });

  // Check for orphaned employees (managers that don't exist as employees)
  uniqueManagers.forEach(managerId => {
    if (!uniqueIds.has(managerId)) {
      orphanedEmployees.push(managerId);
    }
  });

  if (orphanedEmployees.length > 0) {
    results.warnings.push(`Found ${orphanedEmployees.length} manager IDs that don't exist as employees: ${orphanedEmployees.slice(0, 5).join(', ')}${orphanedEmployees.length > 5 ? '...' : ''}`);
  }

  // Check for circular references
  employeeMap.forEach((employee, id) => {
    const visited = new Set();
    let currentId = employee.managerId;
    
    while (currentId) {
      if (visited.has(currentId)) {
        circularRefs.push(id);
        results.errors.push(`Circular reference detected for employee "${employee.name}" (${id})`);
        break;
      }
      
      visited.add(currentId);
      const manager = employeeMap.get(currentId);
      if (!manager) break;
      currentId = manager.managerId;
    }
  });

  // Calculate stats
  results.stats = {
    totalEmployees: uniqueIds.size,
    uniqueManagers: uniqueManagers.size,
    hierarchyLevels: calculateHierarchyLevels(employeeMap),
    orphanedManagers: orphanedEmployees.length,
    averageTeamSize: calculateAverageTeamSize(employeeMap),
    circularReferences: circularRefs.length
  };

  return results;
}

/**
 * Parse employee data from a row based on column mapping
 * @param {Array} row - Data row
 * @param {Object} columnMapping - Column mapping
 * @param {number} rowNumber - Row number for error reporting
 * @returns {Object} Parsed employee data
 */
function parseEmployeeFromRow(row, columnMapping, rowNumber) {
  const employee = {
    rowNumber,
    id: null,
    name: null,
    managerId: null,
    title: null,
    department: null,
    location: null,
    fte: null,
    costCenter: null,
    jobFamily: null,
    managementLevel: null
  };

  // Map columns based on mapping config
  Object.entries(columnMapping).forEach(([field, columnName]) => {
    if (columnName && row[columnName] !== undefined) {
      employee[field] = row[columnName];
    }
  });

  return employee;
}

/**
 * Calculate the maximum hierarchy depth
 * @param {Map} employeeMap - Map of employees by ID
 * @returns {number} Maximum hierarchy depth
 */
function calculateHierarchyLevels(employeeMap) {
  let maxLevel = 0;
  const levelCache = new Map();

  employeeMap.forEach((employee, id) => {
    const level = calculateEmployeeLevel(id, employeeMap, levelCache);
    maxLevel = Math.max(maxLevel, level);
  });

  return maxLevel;
}

/**
 * Calculate the hierarchy level for an employee
 * @param {string} employeeId - Employee ID
 * @param {Map} employeeMap - Map of employees by ID
 * @param {Map} levelCache - Cache of calculated levels
 * @param {Set} visited - Set of visited employee IDs (for cycle detection)
 * @returns {number} Hierarchy level
 */
function calculateEmployeeLevel(employeeId, employeeMap, levelCache = new Map(), visited = new Set()) {
  // Check cache first
  if (levelCache.has(employeeId)) {
    return levelCache.get(employeeId);
  }

  // Detect cycles
  if (visited.has(employeeId)) {
    return 0;
  }
  visited.add(employeeId);

  const employee = employeeMap.get(employeeId);
  if (!employee || !employee.managerId) {
    levelCache.set(employeeId, 0);
    return 0;
  }

  const managerLevel = calculateEmployeeLevel(employee.managerId, employeeMap, levelCache, visited);
  const level = managerLevel + 1;
  levelCache.set(employeeId, level);
  return level;
}

/**
 * Calculate average team size
 * @param {Map} employeeMap - Map of employees by ID
 * @returns {number} Average team size
 */
function calculateAverageTeamSize(employeeMap) {
  const managerCounts = new Map();

  employeeMap.forEach(employee => {
    if (employee.managerId) {
      managerCounts.set(employee.managerId, (managerCounts.get(employee.managerId) || 0) + 1);
    }
  });

  if (managerCounts.size === 0) return 0;

  const totalDirectReports = Array.from(managerCounts.values()).reduce((sum, count) => sum + count, 0);
  return Math.round((totalDirectReports / managerCounts.size) * 10) / 10;
}

/**
 * Transform raw data into hierarchical structure for visualization
 * @param {Array} rawData - Raw data rows
 * @param {Object} columnMapping - Column mapping
 * @returns {Array} Hierarchical data structure
 */
export function transformDataForChart(rawData, columnMapping) {
  const employees = [];

  // Build employee objects
  rawData.forEach((row, index) => {
    const employee = {
      id: getValueFromRow(row, columnMapping.id) || `emp_${index}`,
      name: getValueFromRow(row, columnMapping.name) || 'Unknown',
      managerId: getValueFromRow(row, columnMapping.managerId) || null,
      title: getValueFromRow(row, columnMapping.title) || '',
      department: getValueFromRow(row, columnMapping.department) || '',
      level: 0,
      children: []
    };

    // Clean up empty strings
    Object.keys(employee).forEach(key => {
      if (employee[key] === '') {
        employee[key] = null;
      }
    });

    employees.push(employee);
  });

  // Build hierarchy
  const employeeMap = new Map();
  employees.forEach(emp => employeeMap.set(emp.id, emp));

  // Set up parent-child relationships
  employees.forEach(emp => {
    if (emp.managerId && employeeMap.has(emp.managerId)) {
      const manager = employeeMap.get(emp.managerId);
      if (!manager.children) manager.children = [];
      manager.children.push(emp);
    }
  });

  // Calculate levels
  employees.forEach(emp => {
    emp.level = calculateLevel(emp, employeeMap);
  });

  // Return only root nodes (employees with no manager)
  return employees.filter(emp => !emp.managerId || !employeeMap.has(emp.managerId));
}

/**
 * Calculate hierarchy level for an employee
 * @param {Object} employee - Employee object
 * @param {Map} employeeMap - Map of employees by ID
 * @returns {number} Hierarchy level
 */
function calculateLevel(employee, employeeMap) {
  if (!employee.managerId || !employeeMap.has(employee.managerId)) {
    return 0;
  }

  const manager = employeeMap.get(employee.managerId);
  return calculateLevel(manager, employeeMap) + 1;
}

/**
 * Get value from row using column name
 * @param {Array|Object} row - Data row
 * @param {string} columnName - Column name
 * @returns {*} Value from row
 */
function getValueFromRow(row, columnName) {
  if (!columnName) return null;
  return row[columnName];
}
