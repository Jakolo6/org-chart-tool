// js/import-summary/org-chart-preview.js
import { getProject } from '../projectService.js';
import { AdvancedOrgChart } from '../components/advancedOrgChart.js';

export async function renderOrgChartPreview(projectId) {
  try {
    const { project, error } = await getProject(projectId);
    if (error) throw error;

    const latestVersion = project.chart_versions[0];

    // Transform data for visualization
    const chartData = transformDataForChart(latestVersion.raw_data, latestVersion.column_mapping);

    // Prepare container for chart
    const previewEl = document.getElementById('orgChartPreview');
    previewEl.innerHTML = `
      <div class="chart-container">
        <div class="chart-stats">
          <div class="stat-item">
            <span class="stat-number">${getEmployeeCount(chartData)}</span>
            <span class="stat-label">Total Employees</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${getUniqueManagers(chartData)}</span>
            <span class="stat-label">Managers</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${getHierarchyDepth(chartData)}</span>
            <span class="stat-label">Levels Deep</span>
          </div>
        </div>
        <div class="chart-visualization" id="chartVisualization" style="height: 500px; position: relative;"></div>
      </div>
    `;

    // Initialize advanced chart
    if (chartData.length > 0) {
      const chart = new AdvancedOrgChart('chartVisualization', {
        nodeWidth: 180,
        nodeHeight: 80,
        showStats: true,
        comparisonMode: false
      });
      
      // Set chart data
      chart.setData(chartData[0]);
      
      // Add node selection event listener
      document.getElementById('chartVisualization').addEventListener('nodeSelected', (event) => {
        const node = event.detail.node;
        showNodeDetails(node);
      });
    } else {
      document.getElementById('chartVisualization').innerHTML = `
        <div class="empty-chart-message">
          <i class="fas fa-info-circle"></i>
          <p>No data available to display chart</p>
        </div>
      `;
    }

  } catch (error) {
    console.error('Error rendering org chart preview:', error);
    document.getElementById('orgChartPreview').innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        Error generating chart preview: ${error.message || 'Unknown error'}
      </div>
    `;
  }
}

function transformDataForChart(rawData, columnMapping) {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }
  
  const employees = [];

  // Build employee hierarchy
  rawData.forEach((row, index) => {
    const employee = {
      id: getValueFromRow(row, columnMapping.id) || `emp_${index}`,
      name: getValueFromRow(row, columnMapping.name) || 'Unknown',
      managerId: getValueFromRow(row, columnMapping.managerId) || null,
      title: getValueFromRow(row, columnMapping.title) || '',
      department: getValueFromRow(row, columnMapping.department) || '',
      location: getValueFromRow(row, columnMapping.location) || '',
      fte: getValueFromRow(row, columnMapping.fte) || null,
      jobFamily: getValueFromRow(row, columnMapping.jobFamily) || '',
      managementLevel: getValueFromRow(row, columnMapping.managementLevel) || '',
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

  // Return only root nodes (employees with no manager)
  return employees.filter(emp => !emp.managerId || !employeeMap.has(emp.managerId));
}

function getValueFromRow(row, columnName) {
  if (!columnName) return null;
  return row[columnName];
}

function getEmployeeCount(chartData) {
  let count = 0;
  
  function countNodes(node) {
    count++;
    if (node.children) {
      node.children.forEach(countNodes);
    }
  }
  
  chartData.forEach(countNodes);
  return count;
}

function getUniqueManagers(chartData) {
  const managers = new Set();

  function traverse(node) {
    if (node.children && node.children.length > 0) {
      managers.add(node.id);
      node.children.forEach(traverse);
    }
  }

  chartData.forEach(traverse);
  return managers.size;
}

function getHierarchyDepth(chartData) {
  let maxDepth = 0;

  function traverse(node, depth = 0) {
    maxDepth = Math.max(maxDepth, depth);
    if (node.children) {
      node.children.forEach(child => traverse(child, depth + 1));
    }
  }

  chartData.forEach(node => traverse(node, 0));
  return maxDepth;
}

function showNodeDetails(node) {
  // Create or update node details panel
  let detailsPanel = document.getElementById('nodeDetailsPanel');
  
  if (!detailsPanel) {
    detailsPanel = document.createElement('div');
    detailsPanel.id = 'nodeDetailsPanel';
    detailsPanel.className = 'node-details-panel';
    document.getElementById('orgChartPreview').appendChild(detailsPanel);
  }
  
  // Populate details
  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>${node.name}</h3>
      <button class="close-btn"><i class="fas fa-times"></i></button>
    </div>
    <div class="details-content">
      <div class="detail-item">
        <span class="detail-label">ID:</span>
        <span class="detail-value">${node.id || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Title:</span>
        <span class="detail-value">${node.title || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Department:</span>
        <span class="detail-value">${node.department || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Location:</span>
        <span class="detail-value">${node.location || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">FTE:</span>
        <span class="detail-value">${node.fte !== null ? node.fte : 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Job Family:</span>
        <span class="detail-value">${node.jobFamily || 'N/A'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Management Level:</span>
        <span class="detail-value">${node.managementLevel || 'N/A'}</span>
      </div>
    </div>
  `;
  
  // Show panel
  detailsPanel.style.display = 'block';
  
  // Add close button event
  detailsPanel.querySelector('.close-btn').addEventListener('click', () => {
    detailsPanel.style.display = 'none';
  });
}
