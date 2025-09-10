// js/import-summary/summary.js
import { getCurrentUser } from '../auth.js';
import { getProject, finalizeProject } from '../projectService.js';
import { renderValidationResults } from './validation-results.js';
import { renderOrgChartPreview } from './org-chart-preview.js';

export async function setupSummary(projectId, user, profile, organization) {
  try {
    showLoading('Loading project data...');

    // Load project data
    const { project, error } = await getProject(projectId);
    if (error) throw error;

    // Render the summary
    renderSummary(project, projectId);

    // Load validation results
    await renderValidationResults(projectId);

    // Load org chart preview
    await renderOrgChartPreview(projectId);

    // Update user info
    updateUserInfo(user, profile, organization);

    hideLoading();
  } catch (error) {
    console.error('Error setting up summary:', error);
    showError('Error loading project data: ' + (error.message || 'Unknown error'));
    hideLoading();
  }
}

function renderSummary(project, projectId) {
  const summaryEl = document.getElementById('importSummary');

  summaryEl.innerHTML = `
    <div class="summary-header">
      <h1>Import Summary: ${project.name}</h1>
      <p>Review the import results before finalizing your org chart.</p>
    </div>

    <div class="summary-content">
      <div class="summary-section" id="validationResultsSection">
        <h2>Validation Results</h2>
        <div id="validationResults">
          <!-- Validation results will be loaded here -->
          <div class="loading-placeholder">Loading validation results...</div>
        </div>
      </div>

      <div class="summary-section" id="chartPreviewSection">
        <h2>Org Chart Preview</h2>
        <div id="orgChartPreview">
          <!-- Org chart preview will be loaded here -->
          <div class="loading-placeholder">Generating preview...</div>
        </div>
      </div>

      <div class="summary-actions">
        <button id="backToMappingBtn" class="btn btn-secondary">
          <i class="fas fa-arrow-left"></i> Back to Mapping
        </button>
        <button id="finalizeBtn" class="btn btn-primary" disabled>
          <i class="fas fa-check"></i> Finalize Import
        </button>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById('backToMappingBtn').addEventListener('click', () => {
    window.location.href = `mapping.html?project=${projectId}`;
  });

  document.getElementById('finalizeBtn').addEventListener('click', async () => {
    await finalizeImport(projectId);
  });
}

async function finalizeImport(projectId) {
  try {
    showLoading('Finalizing import...');

    const { success, error } = await finalizeProject(projectId);

    if (error) throw error;

    // Redirect to dashboard or editor
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error('Error finalizing import:', error);
    showError('Error finalizing import: ' + (error.message || 'Unknown error'));
    hideLoading();
  }
}

function updateUserInfo(user, profile, organization) {
  const userInfo = document.getElementById('userInfo');
  if (!userInfo) return;

  // Get first name for greeting
  const fullName = profile?.display_name || user.email.split('@')[0];
  const initials = getInitials(fullName);

  userInfo.innerHTML = `
    <div class="user-dropdown">
      <div class="user-info-trigger">
        <div class="user-avatar">${initials}</div>
        <div class="user-details">
          <div class="user-name">${fullName}</div>
          <div class="user-org">${organization?.name || 'My Organization'}</div>
        </div>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="user-dropdown-menu">
        <a href="./auth/profile.html" class="dropdown-item">
          <i class="fas fa-user"></i> My Profile
        </a>
        <a href="dashboard.html" class="dropdown-item">
          <i class="fas fa-chart-bar"></i> My Charts
        </a>
        <div class="dropdown-divider"></div>
        <a href="#" class="dropdown-item" id="signOutLink">
          <i class="fas fa-sign-out-alt"></i> Sign Out
        </a>
      </div>
    </div>
  `;

  // Add dropdown toggle
  const userDropdown = document.querySelector('.user-dropdown');
  const userTrigger = document.querySelector('.user-info-trigger');

  if (userTrigger) {
    userTrigger.addEventListener('click', () => {
      userDropdown.classList.toggle('active');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target)) {
        userDropdown.classList.remove('active');
      }
    });
  }

  // Add sign out event listener
  const signOutLink = document.getElementById('signOutLink');
  if (signOutLink) {
    signOutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { signOut } = await import('../auth.js');
        await signOut();
        window.location.href = './landing.html';
      } catch (error) {
        console.error('Sign out error:', error);
      }
    });
  }
}

function getInitials(name) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function showLoading(message) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  loadingText.textContent = message;
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
  document.querySelector('.app-content').prepend(errorDiv);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}
