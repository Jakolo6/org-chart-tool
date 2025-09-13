// Global functions
// Access functions directly from window object to avoid redeclarations

// UI helper functions
function showLoading(message) {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  if (loadingText) loadingText.textContent = message || 'Processing...';
  if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  if (toastMessage) toastMessage.textContent = message;
  if (toast) toast.classList.add('show');
  
  setTimeout(() => {
    if (toast) toast.classList.remove('show');
  }, 3000);
}

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

// Navigation functions
function goToStep(step) {
  // Hide all steps
  Object.values(stepContents).forEach(content => {
    if (content) content.classList.remove('active');
  });
  
  // Show current step
  if (stepContents[step]) stepContents[step].classList.add('active');
  
  // Update stepper
  Object.keys(stepElements).forEach(key => {
    const stepNum = parseInt(key);
    const element = stepElements[key];
    
    if (!element) return;
    
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
  
  // Update current step
  currentStep = step;
}

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
    // Get current user
    const { user, profile, error } = await window.getCurrentUser();
    
    if (error || !user) {
      console.error('Authentication error:', error);
      window.location.href = './auth/login.html?redirect=upload.html';
      return false;
    }
    
    // Update UI with user info
    if (userInfo) {
      if (profile?.display_name) {
        userInfo.textContent = profile.display_name;
      } else if (user?.email) {
        userInfo.textContent = user.email;
      }
    }
    
    // Set user initials
    const userInitials = document.getElementById('userInitials');
    if (userInitials) {
      userInitials.textContent = getInitials(profile?.display_name || user.email);
    }
    
    // Add sign out event listener
    const signOutLink = document.getElementById('signOutLink');
    if (signOutLink) {
      signOutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await window.signOut();
          window.location.href = './landing.html';
        } catch (error) {
          console.error('Sign out error:', error);
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('Authentication error:', error);
    window.location.href = './auth/login.html?redirect=upload.html';
    return false;
  }
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
  
  // Step 3: Target Upload
  step3BackBtn.addEventListener('click', () => {
    goToStep(2);
  });
  
  step3NextBtn.addEventListener('click', () => {
    createProject();
  });
  
  // Status Quo file upload
  statusQuoUpload.addEventListener('click', () => {
    statusQuoFileInput.click();
  });
  
  statusQuoFileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0], 'statusQuo');
  });
  
  statusQuoRemoveBtn.addEventListener('click', () => {
    removeFile('statusQuo');
  });
  
  // Target file upload
  targetUpload.addEventListener('click', () => {
    targetFileInput.click();
  });
  
  targetFileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0], 'target');
  });
  
  targetRemoveBtn.addEventListener('click', () => {
    removeFile('target');
  });
  
  // Project form
  projectForm.addEventListener('input', () => {
    projectData.name = projectNameInput.value;
    projectData.description = projectDescriptionInput.value;
  });
}

// Get user initials
function getInitials(name) {
  if (!name) return '';
  
  return name
    .split(' ')
    .filter(part => part.length > 0)
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

// Validate step 1
function validateStep1() {
  if (!projectData.name) {
    showToast('Please enter a project name');
    return false;
  }
  
  return true;
}

// Handle file select
function handleFileSelect(file, fileType) {
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
      
      // Store file and data
      if (fileType === 'statusQuo') {
        statusQuoFile = file;
        statusQuoData = jsonData;
        statusQuoFileName.textContent = file.name;
        statusQuoFileSize.textContent = formatFileSize(file.size);
        statusQuoFileInfo.style.display = 'flex';
        statusQuoUpload.style.display = 'none';
        
        // Enable next button if file is uploaded
        step2NextBtn.disabled = false;
        
        // Show column mapping modal for status quo
        currentFileData = jsonData;
        currentFileType = 'statusQuo';
        currentFileHeaders = jsonData[0];
        showColumnMappingModal();
      } else {
        targetFile = file;
        targetData = jsonData;
        targetFileName.textContent = file.name;
        targetFileSize.textContent = formatFileSize(file.size);
        targetFileInfo.style.display = 'flex';
        targetUpload.style.display = 'none';
      }
      
      hideLoading();
    } catch (error) {
      console.error('Error processing file:', error);
      showToast('Error processing file: ' + error.message);
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
  if (fileType === 'statusQuo') {
    statusQuoFile = null;
    statusQuoData = null;
    statusQuoFileInfo.style.display = 'none';
    statusQuoUpload.style.display = 'flex';
    step2NextBtn.disabled = true;
  } else {
    targetFile = null;
    targetData = null;
    targetFileInfo.style.display = 'none';
    targetUpload.style.display = 'flex';
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Show column mapping modal
function showColumnMappingModal() {
  // Populate column mapping dropdowns
  const headers = currentFileHeaders;
  const dropdowns = [
    'employeeNameMapping',
    'managerMapping',
    'jobTitleMapping',
    'fteMapping',
    'locationMapping',
    'jobFamilyMapping',
    'managementLevelMapping'
  ];
  
  // Try to auto-detect columns
  const columnGuesses = {
    employeeName: ['name', 'employee', 'employee name', 'person', 'employee id', 'id'],
    manager: ['manager', 'reports to', 'supervisor', 'boss', 'manager id', 'manager name'],
    jobTitle: ['title', 'job title', 'position', 'role'],
    fte: ['fte', 'full time equivalent', 'hours', 'time'],
    location: ['location', 'office', 'site', 'country', 'city'],
    jobFamily: ['job family', 'family', 'department', 'function', 'group'],
    managementLevel: ['level', 'management level', 'grade', 'seniority']
  };
  
  dropdowns.forEach(dropdown => {
    const select = document.getElementById(dropdown);
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '<option value="">Select column</option>';
    
    // Add header options
    headers.forEach((header, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = header;
      select.appendChild(option);
      
      // Auto-select if header matches guess
      const fieldName = dropdown.replace('Mapping', '');
      const guesses = columnGuesses[fieldName];
      if (guesses && guesses.includes(header.toString().toLowerCase())) {
        select.value = index;
      }
    });
  });
  
  // Show modal
  columnMappingModal.classList.add('show');
}

// Cancel column mapping
function cancelColumnMapping() {
  columnMappingModal.classList.remove('show');
  
  // If this was the initial status quo upload and mapping was cancelled, remove the file
  if (currentFileType === 'statusQuo' && !columnMapping.employeeName) {
    removeFile('statusQuo');
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
  
  // Validate required fields
  if (!mapping.employeeName || !mapping.manager) {
    showToast('Employee Name and Manager columns are required');
    return;
  }
  
  // Store mapping
  columnMapping = mapping;
  
  // Hide modal
  columnMappingModal.classList.remove('show');
  
  // Validate data
  validateData();
}

// Validate data
function validateData() {
  if (!statusQuoData) return;
  
  const errors = [];
  const data = statusQuoData.slice(1); // Skip header row
  const employeeCol = parseInt(columnMapping.employeeName);
  const managerCol = parseInt(columnMapping.manager);
  
  // Check for empty values
  data.forEach((row, index) => {
    if (!row[employeeCol]) {
      errors.push(`Row ${index + 2}: Missing employee name`);
    }
  });
  
  // Check for cycles in reporting structure
  const adjList = new Map();
  const employees = new Set();
  
  // Build adjacency list and employee set
  data.forEach(row => {
    const employee = row[employeeCol]?.toString();
    const manager = row[managerCol]?.toString();
    
    if (employee) {
      employees.add(employee);
      
      if (manager && manager !== employee) {
        if (!adjList.has(employee)) {
          adjList.set(employee, []);
        }
        adjList.get(employee).push(manager);
      }
    }
  });
  
  // Find cycles
  const cycles = [];
  const visited = new Set();
  const recursionStack = new Set();
  
  employees.forEach(employee => {
    if (!visited.has(employee)) {
      const path = [];
      findCycle(employee, visited, recursionStack, path, adjList, cycles);
    }
  });
  
  // Add cycle errors
  cycles.forEach(cycle => {
    errors.push(`Reporting cycle detected: ${cycle.join(' -> ')}`);
  });
  
  // Show validation errors if any
  if (errors.length > 0) {
    showValidationErrors(errors);
  }
}

// Find cycle in graph
function findCycle(node, visited, recursionStack, path, adjList, cycles) {
  visited.add(node);
  recursionStack.add(node);
  path.push(node);
  
  const neighbors = adjList.get(node) || [];
  
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      if (findCycle(neighbor, visited, recursionStack, path, adjList, cycles)) {
        return true;
      }
    } else if (recursionStack.has(neighbor)) {
      // Cycle found
      const cycleStart = path.indexOf(neighbor);
      cycles.push(path.slice(cycleStart).concat(neighbor));
      return true;
    }
  }
  
  recursionStack.delete(node);
  path.pop();
  return false;
}

// Show validation errors
function showValidationErrors(errors) {
  // Clear existing errors
  validationErrorsList.innerHTML = '';
  
  // Add errors
  errors.forEach(error => {
    const li = document.createElement('li');
    li.textContent = error;
    validationErrorsList.appendChild(li);
  });
  
  // Show modal
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
    const statusQuoResult = await window.createDraftProject(
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
      const targetResult = await window.createDraftProject(
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

function markStepCompleted(step) {
  stepElements[step].classList.add('completed');
}

// Make functions available globally
window.cancelColumnMapping = cancelColumnMapping;
window.confirmColumnMapping = confirmColumnMapping;
window.closeValidationErrors = closeValidationErrors;
