// js/import-summary/init.js
import { getCurrentUser } from '../auth.js';
import { setupSummary } from './summary.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check authentication
    const { user, profile, organization, error: authError } = await getCurrentUser();
    if (authError || !user) {
      window.location.href = './auth/login.html';
      return;
    }

    // Get project ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');
    
    if (!projectId) {
      window.location.href = 'dashboard.html';
      return;
    }

    // Initialize the summary
    await setupSummary(projectId, user, profile, organization);
  } catch (error) {
    console.error('Initialization error:', error);
    showError('An error occurred while initializing the page');
  }
});

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  document.querySelector('.app-content').prepend(errorDiv);
}
