// js/import-summary/validation-results.js
import { getProject } from '../projectService.js';

export async function renderValidationResults(projectId) {
  try {
    const { project, error } = await getProject(projectId);
    if (error) throw error;

    const latestVersion = project.chart_versions[0];
    const validationResults = validateOrgChartData(
      latestVersion.raw_data,
      latestVersion.column_mapping
    );

    const resultsEl = document.getElementById('validationResults');
    resultsEl.innerHTML = renderValidationHTML(validationResults);

    // Enable/disable finalize button based on validation
    const finalizeBtn = document.getElementById('finalizeBtn');
    finalizeBtn.disabled = validationResults.errors.length > 0;

  } catch (error) {
    console.error('Error rendering validation results:', error);
    document.getElementById('validationResults').innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        Error loading validation results: ${error.message || 'Unknown error'}
      </div>
    `;
  }
}

function validateOrgChartData(rawData, columnMapping) {
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

  // Calculate stats
  results.stats = {
    totalEmployees: uniqueIds.size,
    uniqueManagers: uniqueManagers.size,
    hierarchyLevels: calculateHierarchyLevels(employeeMap),
    orphanedManagers: orphanedEmployees.length,
    averageTeamSize: calculateAverageTeamSize(employeeMap)
  };

  return results;
}

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
    if (columnName && row.hasOwnProperty(columnName)) {
      employee[field] = row[columnName];
    }
  });

  return employee;
}

function calculateHierarchyLevels(employeeMap) {
  let maxLevel = 0;

  employeeMap.forEach(employee => {
    const level = calculateEmployeeLevel(employee, employeeMap);
    maxLevel = Math.max(maxLevel, level);
  });

  return maxLevel;
}

function calculateEmployeeLevel(employee, employeeMap, visited = new Set()) {
  if (!employee.managerId || visited.has(employee.id)) {
    return 0;
  }

  if (visited.has(employee.id)) {
    return 0; // Circular reference
  }

  visited.add(employee.id);
  const manager = employeeMap.get(employee.managerId);

  if (!manager) {
    return 0; // Manager not found
  }

  return calculateEmployeeLevel(manager, employeeMap, visited) + 1;
}

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

function renderValidationHTML(results) {
  let html = '';

  // Summary stats
  html += `
    <div class="validation-summary">
      <div class="summary-stat">
        <div class="stat-value">${results.totalRows}</div>
        <div class="stat-label">Total Rows</div>
      </div>
      <div class="summary-stat">
        <div class="stat-value">${results.validRows}</div>
        <div class="stat-label">Valid Employees</div>
      </div>
      <div class="summary-stat">
        <div class="stat-value">${results.stats.totalEmployees || 0}</div>
        <div class="stat-label">Unique Employees</div>
      </div>
      <div class="summary-stat">
        <div class="stat-value">${results.stats.hierarchyLevels || 0}</div>
        <div class="stat-label">Hierarchy Levels</div>
      </div>
    </div>
  `;

  // Errors
  if (results.errors.length > 0) {
    html += `
      <div class="validation-errors">
        <h3><i class="fas fa-exclamation-triangle"></i> Errors (${results.errors.length})</h3>
        <ul>
          ${results.errors.slice(0, 10).map(error => `<li>${error}</li>`).join('')}
          ${results.errors.length > 10 ? `<li>...and ${results.errors.length - 10} more errors</li>` : ''}
        </ul>
      </div>
    `;
  }

  // Warnings
  if (results.warnings.length > 0) {
    html += `
      <div class="validation-warnings">
        <h3><i class="fas fa-exclamation-circle"></i> Warnings (${results.warnings.length})</h3>
        <ul>
          ${results.warnings.slice(0, 10).map(warning => `<li>${warning}</li>`).join('')}
          ${results.warnings.length > 10 ? `<li>...and ${results.warnings.length - 10} more warnings</li>` : ''}
        </ul>
      </div>
    `;
  }

  // Success message
  if (results.errors.length === 0) {
    html += `
      <div class="validation-success">
        <i class="fas fa-check-circle"></i>
        <strong>All validation checks passed!</strong>
        Your data looks good and is ready to be imported.
      </div>
    `;
  }

  return html;
}
