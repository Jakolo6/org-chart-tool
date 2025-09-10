import { getCurrentUser } from './auth.js';
import { saveOrgChart, getOrgCharts, getOrgChart, updateOrgChart } from './orgChartService.js';
import { state } from './main.js';

/**
 * App module for handling authentication and data persistence
 */

// Check authentication status
export async function checkAuth() {
  try {
    const { user, profile, organization, error } = await getCurrentUser();
    
    if (error || !user) {
      // Redirect to login if not authenticated
      window.location.href = './auth/login.html';
      return false;
    }
    
    // Update UI with user info
    updateUserInfo(user, profile, organization);
    return true;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

// Update UI with user info
function updateUserInfo(user, profile, organization) {
  const userInfoEl = document.getElementById('userInfo');
  if (!userInfoEl) return;
  
  userInfoEl.innerHTML = `
    <div class="user-name">${profile.display_name || user.email}</div>
    <div class="user-org">${organization.name}</div>
    <div class="user-actions">
      <a href="./auth/profile.html">Profile</a>
      <a href="#" id="signOutLink">Sign Out</a>
    </div>
  `;
  
  // Add sign out event listener
  const signOutLink = document.getElementById('signOutLink');
  if (signOutLink) {
    signOutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { signOut } = await import('./auth.js');
        await signOut();
        window.location.href = './auth/login.html';
      } catch (error) {
        console.error('Sign out error:', error);
      }
    });
  }
}

// Save current org chart
export async function saveCurrentOrgChart(name, description = '', isBaseline = true) {
  try {
    if (!state.currentData || state.currentData.length === 0) {
      throw new Error('No data to save');
    }
    
    const { chart, version, error } = await saveOrgChart(
      state.currentData,
      name,
      description,
      isBaseline,
      !isBaseline
    );
    
    if (error) throw error;
    
    return { chart, version };
  } catch (error) {
    console.error('Error saving chart:', error);
    throw error;
  }
}

// Load saved org charts
export async function loadSavedOrgCharts() {
  try {
    const { charts, error } = await getOrgCharts();
    
    if (error) throw error;
    
    return charts;
  } catch (error) {
    console.error('Error loading charts:', error);
    throw error;
  }
}

// Load specific org chart
export async function loadOrgChart(chartId) {
  try {
    const { chart, version, employees, error } = await getOrgChart(chartId);
    
    if (error) throw error;
    
    // Update state with loaded data
    const { setBaselineData, setCurrentData } = await import('./main.js');
    
    if (chart.is_baseline) {
      setBaselineData(employees);
    } else if (chart.is_target) {
      setUpdateData(employees);
    }
    
    setCurrentData(employees);
    
    return { chart, version, employees };
  } catch (error) {
    console.error('Error loading chart:', error);
    throw error;
  }
}

// Initialize app
export async function initApp() {
  // Check if user is authenticated
  const isAuthenticated = await checkAuth();
  
  if (!isAuthenticated) {
    return;
  }
  
  // Initialize the main application
  const { initializeApplication } = await import('./main.js');
  initializeApplication();
  
  // Add save chart button event listener
  const saveChartBtn = document.getElementById('saveChartBtn');
  if (saveChartBtn) {
    saveChartBtn.addEventListener('click', async () => {
      try {
        const name = prompt('Enter a name for this chart:');
        if (!name) return;
        
        const description = prompt('Enter a description (optional):');
        const isBaseline = confirm('Is this a baseline chart? Click OK for baseline, Cancel for target.');
        
        await saveCurrentOrgChart(name, description, isBaseline);
        alert('Chart saved successfully!');
      } catch (error) {
        alert(`Error saving chart: ${error.message}`);
      }
    });
  }
  
  // Add load charts button event listener
  const loadChartsBtn = document.getElementById('loadChartsBtn');
  if (loadChartsBtn) {
    loadChartsBtn.addEventListener('click', async () => {
      try {
        const charts = await loadSavedOrgCharts();
        
        if (charts.length === 0) {
          alert('No saved charts found.');
          return;
        }
        
        // Show charts in a modal
        showChartsModal(charts);
      } catch (error) {
        alert(`Error loading charts: ${error.message}`);
      }
    });
  }
}

// Show charts modal
function showChartsModal(charts) {
  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'chartsModal';
  
  // Create modal content
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Your Saved Charts</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="charts-list">
          ${charts.map(chart => `
            <div class="chart-item" data-id="${chart.id}">
              <div class="chart-info">
                <h3>${chart.name}</h3>
                <p>${chart.description || 'No description'}</p>
                <div class="chart-meta">
                  <span class="chart-type ${chart.is_baseline ? 'baseline' : 'target'}">${chart.is_baseline ? 'Baseline' : 'Target'}</span>
                  <span class="chart-date">Created: ${new Date(chart.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div class="chart-actions">
                <button class="btn btn-primary load-chart-btn">Load</button>
                <button class="btn btn-danger delete-chart-btn">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  // Add modal to body
  document.body.appendChild(modal);
  
  // Add event listeners
  const closeBtn = modal.querySelector('.modal-close');
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Add load chart event listeners
  const loadBtns = modal.querySelectorAll('.load-chart-btn');
  loadBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const chartId = btn.closest('.chart-item').dataset.id;
      try {
        await loadOrgChart(chartId);
        document.body.removeChild(modal);
        alert('Chart loaded successfully!');
      } catch (error) {
        alert(`Error loading chart: ${error.message}`);
      }
    });
  });
  
  // Add delete chart event listeners
  const deleteBtns = modal.querySelectorAll('.delete-chart-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const chartId = btn.closest('.chart-item').dataset.id;
      if (confirm('Are you sure you want to delete this chart?')) {
        try {
          const { deleteOrgChart } = await import('./orgChartService.js');
          const { success, error } = await deleteOrgChart(chartId);
          
          if (error) throw error;
          
          // Remove chart item from list
          btn.closest('.chart-item').remove();
          
          if (modal.querySelectorAll('.chart-item').length === 0) {
            document.body.removeChild(modal);
            alert('No more charts to display.');
          }
        } catch (error) {
          alert(`Error deleting chart: ${error.message}`);
        }
      }
    });
  });
}
