/**
 * @file Zoom controls component for the org chart
 */

console.log('[OrgChart] zoomControls loaded');

/**
 * Initialize the zoom controls for the chart
 */
function initZoomControls() {
    // Remove any existing zoom controls
    const existingControls = document.querySelector('.zoom-controls');
    if (existingControls) {
        existingControls.remove();
    }
    
    // Create the zoom controls container
    const zoomControlsContainer = document.createElement('div');
    zoomControlsContainer.className = 'zoom-controls';
    zoomControlsContainer.style.position = 'fixed';
    zoomControlsContainer.style.top = '100px';
    zoomControlsContainer.style.right = '20px';
    zoomControlsContainer.style.left = 'auto';
    zoomControlsContainer.style.zIndex = '9999';
    
    // Add directly to the body for fixed positioning
    document.body.appendChild(zoomControlsContainer);
    
    // Create zoom in button
    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'zoom-btn zoom-in';
    zoomInBtn.innerHTML = '<i class="fas fa-plus"></i>';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.addEventListener('click', () => {
        if (window.zoomChart) {
            window.zoomChart(1.2);
        }
    });
    
    // Create zoom out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'zoom-btn zoom-out';
    zoomOutBtn.innerHTML = '<i class="fas fa-minus"></i>';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.addEventListener('click', () => {
        if (window.zoomChart) {
            window.zoomChart(0.8);
        }
    });
    
    // Create fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'zoom-btn fullscreen';
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    fullscreenBtn.title = 'Toggle Fullscreen';
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Create center button
    const centerBtn = document.createElement('button');
    centerBtn.className = 'zoom-btn center';
    centerBtn.innerHTML = '<i class="fas fa-bullseye"></i>';
    centerBtn.title = 'Center Chart';
    centerBtn.addEventListener('click', () => {
        if (window.centerChart) {
            window.centerChart();
        }
    });
    
    // Add buttons to container
    zoomControlsContainer.appendChild(zoomInBtn);
    zoomControlsContainer.appendChild(zoomOutBtn);
    zoomControlsContainer.appendChild(fullscreenBtn);
    zoomControlsContainer.appendChild(centerBtn);
    
    // Add styles for zoom controls
    addZoomControlStyles();
    
    console.log('Zoom controls initialized');
}

/**
 * Toggle fullscreen mode for the chart area
 */
function toggleFullscreen() {
    const chartArea = document.getElementById('chart-area');
    if (!chartArea) return;
    
    if (!document.fullscreenElement) {
        // Enter fullscreen
        if (chartArea.requestFullscreen) {
            chartArea.requestFullscreen();
        } else if (chartArea.webkitRequestFullscreen) {
            chartArea.webkitRequestFullscreen();
        } else if (chartArea.msRequestFullscreen) {
            chartArea.msRequestFullscreen();
        }
    } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

/**
 * Add CSS styles for zoom controls
 */
function addZoomControlStyles() {
    // Check if styles already exist
    if (document.getElementById('zoom-control-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'zoom-control-styles';
    styleEl.textContent = `
        .zoom-controls {
            position: absolute;
            top: 20px;
            right: 20px; /* Ensure controls are on the right side */
            left: auto; /* Override any left positioning */
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1000;
        }
        
        .zoom-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: white;
            border: 1px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
        }
        
        .zoom-btn:hover {
            background-color: #f8f8f8;
            transform: scale(1.05);
        }
        
        .zoom-btn:active {
            transform: scale(0.95);
        }
        
        .zoom-btn i {
            color: #555;
            font-size: 16px;
        }
    `;
    
    document.head.appendChild(styleEl);
}

// Export functions to global window object
window.initZoomControls = initZoomControls;
window.toggleFullscreen = toggleFullscreen;
