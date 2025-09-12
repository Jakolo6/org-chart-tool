// Global functions
// Access functions directly from window object to avoid redeclarations
const createDraftProject = window.createDraftProject;
const signOut = window.signOut;

// Global variables
let currentStep = 1;
let projectData = {
  name: '',
  description: '',
  isBaseline: true
};
let statusQuoFile = null;
let targetFile = null;
let statusQuoData = null;
let targetData = null;
let currentFileData = null;
let currentFileType = null;
let currentFileHeaders = null;
let columnMapping = {
  employeeName: null,
  manager: null,
  jobTitle: null,
  fte: null,
  location: null,
  jobFamily: null,
  managementLevel: null
};

// DOM Elements
const stepElements = {
  1: document.getElementById('step1'),
  2: document.getElementById('step2'),
  3: document.getElementById('step3'),
  4: document.getElementById('step4'),
  5: document.getElementById('step5')
};

const stepContents = {
  1: document.getElementById('step1-content'),
  2: document.getElementById('step2-content'),
  3: document.getElementById('step3-content')
};

const projectForm = document.getElementById('projectForm');
const projectNameInput = document.getElementById('projectName');
const projectDescriptionInput = document.getElementById('projectDescription');
const step1NextBtn = document.getElementById('step1NextBtn');
const step2BackBtn = document.getElementById('step2BackBtn');
const step2NextBtn = document.getElementById('step2NextBtn');
const step3BackBtn = document.getElementById('step3BackBtn');
const step3NextBtn = document.getElementById('step3NextBtn');
const statusQuoUpload = document.getElementById('statusQuoUpload');
const statusQuoFileInput = document.getElementById('statusQuoFileInput');
const statusQuoFileInfo = document.getElementById('statusQuoFileInfo');
const statusQuoFileName = document.getElementById('statusQuoFileName');
const statusQuoFileSize = document.getElementById('statusQuoFileSize');
const statusQuoRemoveBtn = document.getElementById('statusQuoRemoveBtn');
const targetUpload = document.getElementById('targetUpload');
const targetFileInput = document.getElementById('targetFileInput');
const targetFileInfo = document.getElementById('targetFileInfo');
const targetFileName = document.getElementById('targetFileName');
const targetFileSize = document.getElementById('targetFileSize');
const targetRemoveBtn = document.getElementById('targetRemoveBtn');
const columnMappingModal = document.getElementById('columnMappingModal');
const validationErrorsModal = document.getElementById('validationErrorsModal');
const validationErrorsList = document.getElementById('validationErrorsList');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const userInfo = document.getElementById('userInfo');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const isAuthenticated = await checkAuth();
  
  if (!isAuthenticated) {
    return;
  }
  
  // Set up event listeners
  setupEventListeners();
});

// Check authentication
async function checkAuth() {
  try {
    const { user, profile, error } = await getCurrentUser();
    
    if (error || !user) {
      window.location.href = 'auth/login.html';
      return false;
    }
    
    // Update user info
    if (profile) {
      userInfo.innerHTML = `
        <div class="user-avatar">${getInitials(profile.display_name || user.email)}</div>
        <div class="user-info-trigger">
          <div class="user-name">${profile.display_name || user.email}</div>
          <i class="fas fa-chevron-down"></i>
          <div class="user-dropdown">
            <a href="profile.html" class="dropdown-item">
              <i class="fas fa-user"></i> Profile
            </a>
            <a href="#" id="signOutLink" class="dropdown-item">
              <i class="fas fa-sign-out-alt"></i> Sign Out
            </a>
          </div>
        </div>
      `;
    }
    
    // Add user dropdown toggle
    const userDropdown = document.querySelector('.user-dropdown');
    const userTrigger = document.querySelector('.user-info-trigger');
    
    if (userTrigger) {
      userTrigger.addEventListener('click', () => {
        userDropdown.classList.toggle('active');
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!userDropdown.contains(e.target) && !userTrigger.contains(e.target)) {
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
          await signOut();
          window.location.href = './landing.html';
        } catch (error) {
          console.error('Sign out error:', error);
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Authentication error:', error);
    window.location.href = 'auth/login.html';
    return false;
  }
}

// Get initials from name
function getInitials(name) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// Set up event listeners
function setupEventListeners() {
  // Step 1: Project Info
  step1NextBtn.addEventListener('click', () => {
    if (validateStep1()) {
      goToStep(2);
    }
  });
  
  // Step 2: Status Quo Upload
  step2BackBtn.addEventListener('click', () => {
    goToStep(1);
  });
  
  step2NextBtn.addEventListener('click', () => {
    goToStep(3);
  });
  
  statusQuoUpload.addEventListener('click', () => {
    statusQuoFileInput.click();
  });
  
  statusQuoFileInput.addEventListener('change', (e) => {
    handleFileSelect(e, 'baseline');
  });
  
  statusQuoRemoveBtn.addEventListener('click', () => {
    removeFile('baseline');
  });
  
  // Step 3: Target Upload
  step3BackBtn.addEventListener('click', () => {
    goToStep(2);
  });
  
  step3NextBtn.addEventListener('click', async () => {
    await createProject();
  });
  
  targetUpload.addEventListener('click', () => {
    targetFileInput.click();
  });
  
  targetFileInput.addEventListener('change', (e) => {
    handleFileSelect(e, 'update');
  });
  
  targetRemoveBtn.addEventListener('click', () => {
    removeFile('update');
  });
  
  // Drag and drop for file uploads
  setupDragAndDrop();
}

// Setup drag and drop
function setupDragAndDrop() {
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const highlight = (element) => {
    element.classList.add('highlight');
  };
  
  const unhighlight = (element) => {
    element.classList.remove('highlight');
  };
  
  const handleDrop = (e, fileType) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length) {
      const file = files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel') {
        processFile(file, fileType);
      } else {
        showToast('Please upload an Excel file (.xlsx or .xls)');
      }
    }
  };
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    statusQuoUpload.addEventListener(eventName, preventDefaults, false);
    targetUpload.addEventListener(eventName, preventDefaults, false);
  });
  
  ['dragenter', 'dragover'].forEach(eventName => {
    statusQuoUpload.addEventListener(eventName, () => highlight(statusQuoUpload), false);
    targetUpload.addEventListener(eventName, () => highlight(targetUpload), false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    statusQuoUpload.addEventListener(eventName, () => unhighlight(statusQuoUpload), false);
    targetUpload.addEventListener(eventName, () => unhighlight(targetUpload), false);
  });
  
  statusQuoUpload.addEventListener('drop', (e) => handleDrop(e, 'baseline'), false);
  targetUpload.addEventListener('drop', (e) => handleDrop(e, 'update'), false);
}

// Validate Step 1
function validateStep1() {
  const name = projectNameInput.value.trim();
  
  if (!name) {
    showToast('Please enter a project name');
    projectNameInput.focus();
    return false;
  }
  
  // Save project data
  projectData.name = name;
  projectData.description = projectDescriptionInput.value.trim();
  
  return true;
}

// Handle file select
function handleFileSelect(e, fileType) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.type === 'application/vnd.ms-excel') {
    processFile(file, fileType);
  } else {
    showToast('Please upload an Excel file (.xlsx or .xls)');
  }
}

// Process file
function processFile(file, fileType) {
  showLoading('Processing file...');
  
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Get first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        showToast('Excel file must contain at least a header row and one data row');
        hideLoading();
        return;
      }
      
      // Extract headers and data
      const headers = jsonData[0];
      const rows = jsonData.slice(1).filter(row => row.length > 0);
      
      if (fileType === 'baseline') {
        statusQuoFile = file;
        statusQuoData = jsonData;
        statusQuoFileName.textContent = file.name;
        statusQuoFileSize.textContent = formatFileSize(file.size);
        statusQuoFileInfo.style.display = 'block';
        step2NextBtn.disabled = false;
        
        // Enable target upload
        enableTargetUpload();
      } else {
        targetFile = file;
        targetData = jsonData;
        targetFileName.textContent = file.name;
        targetFileSize.textContent = formatFileSize(file.size);
        targetFileInfo.style.display = 'block';
      }
      
      // Set current file data for mapping
      currentFileData = jsonData;
      currentFileType = fileType;
      currentFileHeaders = headers;
      
      // Show column mapping dialog
      hideLoading();
      showColumnMappingDialog(headers);
    } catch (error) {
      console.error('Error processing Excel file:', error);
      showToast('Error processing Excel file');
      hideLoading();
    }
  };
  
  reader.onerror = () => {
    console.error('Error reading file');
    showToast('Error reading file');
    hideLoading();
  };
  
  reader.readAsArrayBuffer(file);
}

// Remove file
function removeFile(fileType) {
  if (fileType === 'baseline') {
    statusQuoFile = null;
    statusQuoData = null;
    statusQuoFileInput.value = '';
    statusQuoFileInfo.style.display = 'none';
    step2NextBtn.disabled = true;
    
    // Disable target upload
    disableTargetUpload();
  } else {
    targetFile = null;
    targetData = null;
    targetFileInput.value = '';
    targetFileInfo.style.display = 'none';
  }
}

// Enable target upload
function enableTargetUpload() {
  targetUpload.classList.remove('disabled');
  targetFileInput.disabled = false;
}

// Disable target upload
function disableTargetUpload() {
  targetUpload.classList.add('disabled');
  targetFileInput.disabled = true;
  removeFile('update');
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Column mapping dialog
function showColumnMappingDialog(headers) {
  const dropdowns = [
    'employeeNameMapping', 'managerMapping', 'jobTitleMapping',
    'fteMapping', 'locationMapping', 'jobFamilyMapping', 'managementLevelMapping'
  ];
  
  dropdowns.forEach(dropdownId => {
    const dropdown = document.getElementById(dropdownId);
    dropdown.innerHTML = '<option value="">Select column...</option>';
    headers.forEach(header => {
      const option = document.createElement('option');
      option.value = header;
      option.textContent = header;
      dropdown.appendChild(option);
    });
  });
  
  // Auto-detect & preselect suggestions
  autoDetectMappings(headers);
  
  // Show modal
  columnMappingModal.classList.add('show');
}

// Auto-detect mappings
function autoDetectMappings(headers) {
  const detectionRules = {
    employeeName: ['worker', 'employee', 'name', 'person', 'staff', 'anon worker', 'employee name', 'worker id', 'employee id'],
    manager: ['manager', 'supervisor', 'boss', 'lead', 'head', 'anon manager', 'manager name', 'manager id'],
    jobTitle: ['business title', 'title', 'position', 'job', 'role', 'function', 'job title'],
    fte: ['fte', 'full time equivalent', 'full-time equivalent', 'time', 'percentage', 'percent'],
    location: ['location', 'office', 'site', 'city', 'country', 'region', 'geography'],
    jobFamily: ['job family', 'family', 'department', 'function', 'division', 'group'],
    managementLevel: ['management level', 'level', 'grade', 'band', 'tier', 'seniority']
  };
  
  Object.keys(detectionRules).forEach(field => {
    const rules = detectionRules[field];
    const dropdown = document.getElementById(field + 'Mapping');
    const info = document.getElementById(field + 'Info');
    
    let bestMatch = null;
    let bestScore = 0;
    
    headers.forEach(header => {
      const headerLower = header.toLowerCase();
      let score = 0;
      
      rules.forEach((rule, index) => {
        if (headerLower.includes(rule)) {
          score = Math.max(score, 100 + (rules.length - index));
          if (headerLower === rule) {
            score = 1000 + (rules.length - index);
          }
        }
      });
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = header;
      }
    });
    
    if (bestMatch) {
      dropdown.value = bestMatch;
      info.textContent = `Auto-detected: ${bestMatch}`;
      info.style.color = '#059669';
    } else {
      info.textContent = 'No auto-detection available';
      info.style.color = '#6b7280';
    }
  });
}

// Cancel column mapping
function cancelColumnMapping() {
  columnMappingModal.classList.remove('show');
  
  // If this was the initial status quo upload and mapping was cancelled, remove the file
  if (currentFileType === 'baseline' && !columnMapping.employeeName) {
    removeFile('baseline');
  }
}

// Confirm column mapping
function confirmColumnMapping() {
  const mapping = {
    employeeName: document.getElementById('employeeNameMapping').value,
    manager: document.getElementById('managerMapping').value,
    jobTitle: document.getElementById('jobTitleMapping').value,
    fte: document.getElementById('fteMapping').value,
    location: document.getElementById('locationMapping').value,
    jobFamily: document.getElementById('jobFamilyMapping').value,
    managementLevel: document.getElementById('managementLevelMapping').value
  };
  
  if (!mapping.employeeName || !mapping.manager) {
    alert('Worker and Manager columns are required. Please select them.');
    return;
  }
  
  // Validate the current file's rows against mapping
  const errors = validateRelations(currentFileData.slice(1), mapping.employeeName, mapping.manager);
  
  if (errors.length > 0) {
    showValidationErrors(errors);
    return;
  }
  
  // If validation passes
  columnMappingModal.classList.remove('show');
  
  if (currentFileType === 'baseline') {
    columnMapping = mapping;
    markStepCompleted(2);
    showToast('✓ Status Quo file validated successfully!');
    
    // Enable target upload and next button
    enableTargetUpload();
    step2NextBtn.disabled = false;
  } else {
    // For target file, store mapping in the same format
    // but we'll use the same columnMapping object for both files
    // since the structure should be the same
    showToast('✓ Target file validated successfully!');
  }

// Helper function to check if a value is blank or empty
function isBlankOrEmpty(value) {
  return value === undefined || value === null || value === '';
}

// Validation functions
function validateRelations(rows, workerColumn, managerColumn) {
  const errors = [];
  const workerIdMap = new Map();
  const rootNodes = [];
  
  // First pass: check for duplicates, blanks, and self-references
  rows.forEach((row, index) => {
    const workerId = row[workerColumn]?.toString().trim();
    const managerId = row[managerColumn]?.toString().trim();
    
    // Skip empty rows
    if (isBlankOrEmpty(workerId) && isBlankOrEmpty(managerId)) {
      return;
    }
    
    // Only check for duplicates if there is a worker ID
    if (!isBlankOrEmpty(workerId)) {
      if (workerIdMap.has(workerId)) {
        errors.push({
          type: 'Duplicate Employee ID',
          message: `The employee ID "${workerId}" is used more than once. All IDs must be unique.`,
          details: `Row ${index+2} is a duplicate of row ${workerIdMap.get(workerId).rowIndex+2}`
        });
      } else {
        workerIdMap.set(workerId, { row, rowIndex: index });
      }
    }
    
    // Check for self-reference
    if (workerId && managerId && workerId === managerId) {
      errors.push({ 
        type: 'Self-Reference Error', 
        message: `Employee "${workerId}" cannot be their own manager.`, 
        details: `Row ${index+2}` 
      });
    }
    
    // Identify potential root nodes
    if (isBlankOrEmpty(managerId) && !isBlankOrEmpty(workerId)) {
      rootNodes.push(workerId);
    }
  });
  
  // Check for multiple root nodes or no root nodes
  if (workerIdMap.size > 0) {
    if (rootNodes.length > 1) {
      errors.push({ 
        type: 'Multiple CEOs Found', 
        message: 'Your organization has more than one person without a manager. There should be only one CEO.', 
        details: `Found ${rootNodes.length} top-level employees: ${rootNodes.join(', ')}` 
      });
    } else if (rootNodes.length === 0) {
      errors.push({ 
        type: 'No CEO Found', 
        message: 'No employee was found without a manager. Your organization must have one top-level person (CEO).', 
        details: 'Please ensure at least one employee has a blank manager field.' 
      });
    }
  }
  
  // Second pass: check manager references
  rows.forEach((row, index) => {
    const workerId = row[workerColumn]?.toString().trim();
    const managerId = row[managerColumn]?.toString().trim();
    
    if (!isBlankOrEmpty(managerId) && !isBlankOrEmpty(workerId)) {
      if (!workerIdMap.has(managerId)) {
        errors.push({
          type: 'Manager Does Not Exist',
          message: `A manager listed for an employee does not exist as an employee in the file.`,
          details: `Row ${index+2}: Manager "${managerId}" for Employee "${workerId}" is not a valid employee.`
        });
      }
    }
  });
  
  // Third pass: check for cycles
  const cycles = detectCycles(rows, workerColumn, managerColumn);
  if (cycles.length > 0) {
    cycles.forEach(cycle => {
      errors.push({ 
        type: 'Circular Reference Found', 
        message: 'A circular reporting structure (a loop) was detected.', 
        details: `Cycle path: ${cycle.join(' → ')} → ${cycle[0]}` 
      });
    });
  }
  
  return errors;
}

function detectCycles(rows, workerColumn, managerColumn) {
  const adjList = new Map();
  const allNodes = new Set();
  
  rows.forEach(row => {
    const workerId = row[workerColumn]?.toString().trim();
    if (workerId) allNodes.add(workerId);
  });
  
  rows.forEach(row => {
    const workerId = row[workerColumn]?.toString().trim();
    const managerId = row[managerColumn]?.toString().trim();
    if (workerId && managerId && allNodes.has(managerId)) {
      if (!adjList.has(workerId)) adjList.set(workerId, []);
      adjList.get(workerId).push(managerId);
    }
  });
  
  const cycles = [];
  const visited = new Set();
  
  for (const node of allNodes) {
    if (!visited.has(node)) {
      const recursionStack = new Set();
      const path = [];
      findCycleUtil(node, visited, recursionStack, path, adjList, cycles);
    }
  }
  
  const uniqueCycles = [];
  const seenCycles = new Set();
  cycles.forEach(cycle => {
    const sortedCycle = [...cycle].sort().join(',');
    if (!seenCycles.has(sortedCycle)) {
      uniqueCycles.push(cycle);
      seenCycles.add(sortedCycle);
    }
  });
  
  return uniqueCycles;
}

function findCycleUtil(node, visited, recursionStack, path, adjList, cycles) {
  visited.add(node);
  recursionStack.add(node);
  path.push(node);
  
  const neighbors = adjList.get(node) || [];
  for (const neighbor of neighbors) {
    if (recursionStack.has(neighbor)) {
      const cycle = path.slice(path.indexOf(neighbor));
      cycles.push(cycle);
    } else if (!visited.has(neighbor)) {
      findCycleUtil(neighbor, visited, recursionStack, path, adjList, cycles);
    }
  }
  
  recursionStack.delete(node);
  path.pop();
  return false;
}

// Confirm column mapping
function confirmColumnMapping() {
  const mapping = {
    employeeName: document.getElementById('employeeNameMapping').value,
    manager: document.getElementById('managerMapping').value,
    jobTitle: document.getElementById('jobTitleMapping').value,
    fte: document.getElementById('fteMapping').value,
    location: document.getElementById('locationMapping').value,
    jobFamily: document.getElementById('jobFamilyMapping').value,
    managementLevel: document.getElementById('managementLevelMapping').value
  };
  
  if (!mapping.employeeName || !mapping.manager) {
    alert('Worker and Manager columns are required. Please select them.');
    return;
  }
  
  // Validate the current file's rows against mapping
  const errors = validateRelations(currentFileData.slice(1), mapping.employeeName, mapping.manager);
  
  if (errors.length > 0) {
    showValidationErrors(errors);
    return;
  }
  
  // If validation passes
  columnMappingModal.classList.remove('show');
  
  if (currentFileType === 'baseline') {
    columnMapping = mapping;
    markStepCompleted(2);
    showToast('✓ Status Quo file validated successfully!');
    
    // Enable target upload and next button
    enableTargetUpload();
    step2NextBtn.disabled = false;
  } else {
    // For target file, store mapping in the same format
    // but we'll use the same columnMapping object for both files
    // since the structure should be the same
    showToast('✓ Target file validated successfully!');
  }
}

// Show validation errors
function showValidationErrors(errors) {
  validationErrorsList.innerHTML = '';
  
  errors.forEach(error => {
    const errorElement = document.createElement('div');
    errorElement.className = 'validation-error';
    errorElement.innerHTML = `
      <div class="validation-error-type">${error.type}</div>
      <div class="validation-error-message">${error.message}</div>
      <div class="validation-error-details">${error.details}</div>
    `;
    validationErrorsList.appendChild(errorElement);
  });
  
  validationErrorsModal.classList.add('show');
}

// Close validation errors
function closeValidationErrors() {
  validationErrorsModal.classList.remove('show');
}

// Create project
async function createProject() {
  if (!statusQuoData) {
    showToast('Please upload a Status Quo file');
    return;
  }
  
  showLoading('Creating project...');
  
  try {
    // Create project with status quo data
    const statusQuoResult = await createDraftProject(
      statusQuoData,
      {
        name: projectData.name,
        description: projectData.description,
        isBaseline: true,
        isTarget: false,
        fileName: statusQuoFile.name,
        fileSize: statusQuoFile.size,
        // Pass column mapping for Status Quo
        columnMapping: {
          id: columnMapping.employeeName,
          name: columnMapping.employeeName,
          managerId: columnMapping.manager,
          title: columnMapping.jobTitle,
          fte: columnMapping.fte,
          location: columnMapping.location,
          jobFamily: columnMapping.jobFamily,
          managementLevel: columnMapping.managementLevel
        }
      }
    );
    
    if (statusQuoResult.error) {
      throw statusQuoResult.error;
    }
    
    console.log('Status Quo project created:', statusQuoResult.project.id);
    showToast('✓ Status Quo project created successfully!');
    
    // If target data exists, create target project
    if (targetData) {
      const targetResult = await createDraftProject(
        targetData,
        {
          name: `${projectData.name} (Target)`,
          description: projectData.description,
          isBaseline: false,
          isTarget: true,
          fileName: targetFile.name,
          fileSize: targetFile.size,
          // Pass column mapping for Target
          columnMapping: {
            id: columnMapping.employeeName,
            name: columnMapping.employeeName,
            managerId: columnMapping.manager,
            title: columnMapping.jobTitle,
            fte: columnMapping.fte,
            location: columnMapping.location,
            jobFamily: columnMapping.jobFamily,
            managementLevel: columnMapping.managementLevel
          }
        }
      );
      
      if (targetResult.error) {
        throw targetResult.error;
      }
      
      console.log('Target project created:', targetResult.project.id);
      showToast('✓ Target project created successfully!');
    }
    
    // Redirect to dashboard after short delay to show success message
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
  } catch (error) {
    console.error('Error creating project:', error);
    showToast('Error creating project: ' + (error.message || 'Unknown error'));
    hideLoading();
  }
}

// Navigation functions
function goToStep(step) {
  // Hide all steps
  Object.values(stepContents).forEach(content => {
    content.classList.remove('active');
  });
  
  // Show current step
  stepContents[step].classList.add('active');
  
  // Update stepper
  Object.keys(stepElements).forEach(key => {
    const stepNum = parseInt(key);
    const element = stepElements[key];
    
    if (stepNum < step) {
      element.classList.remove('active');
      element.classList.add('completed');
    } else if (stepNum === step) {
      element.classList.add('active');
      element.classList.remove('completed');
    } else {
      element.classList.remove('active');
      element.classList.remove('completed');
    }
  });
  
  currentStep = step;
}

function markStepCompleted(step) {
  stepElements[step].classList.add('completed');
}

// UI helper functions
function showLoading(message) {
  loadingText.textContent = message || 'Processing...';
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Make functions available globally
window.cancelColumnMapping = cancelColumnMapping;
window.confirmColumnMapping = confirmColumnMapping;
window.closeValidationErrors = closeValidationErrors;
}
