/**
 * @file UX enhancements for the org chart tool
 */

console.log('[OrgChart] UX enhancements loaded');

/**
 * Initialize UX enhancements
 */
function initUxEnhancements() {
    // Add keyboard shortcuts
    addKeyboardShortcuts();
    
    // Add chart area resize observer
    addChartAreaResizeObserver();
    
    // Add double-click to zoom feature
    addDoubleClickZoom();
    
    // Add chart loading animation
    improveChartLoadingAnimation();
    
    // Add help tooltip
    addHelpTooltip();
    
    console.log('UX enhancements initialized');
}

/**
 * Add keyboard shortcuts for common actions
 */
function addKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Only handle keyboard shortcuts when not in an input field
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Zoom in: + or =
        if (event.key === '+' || event.key === '=') {
            if (window.zoomChart) {
                window.zoomChart(1.2);
                event.preventDefault();
            }
        }
        
        // Zoom out: -
        if (event.key === '-') {
            if (window.zoomChart) {
                window.zoomChart(0.8);
                event.preventDefault();
            }
        }
        
        // Reset zoom: 0
        if (event.key === '0') {
            if (window.resetZoom) {
                window.resetZoom();
                event.preventDefault();
            }
        }
        
        // Center chart: c
        if (event.key === 'c') {
            if (window.centerChart) {
                window.centerChart();
                event.preventDefault();
            }
        }
        
        // Toggle fullscreen: f
        if (event.key === 'f') {
            if (window.toggleFullscreen) {
                window.toggleFullscreen();
                event.preventDefault();
            }
        }
    });
    
    console.log('Keyboard shortcuts added');
}

/**
 * Add chart area resize observer to ensure chart fits properly
 */
function addChartAreaResizeObserver() {
    const chartArea = document.getElementById('chart-area');
    if (!chartArea) return;
    
    // Create a resize observer
    const resizeObserver = new ResizeObserver(entries => {
        // When the chart area is resized, fit the chart to view
        if (window.fitChartToView) {
            window.fitChartToView();
        }
    });
    
    // Start observing the chart area
    resizeObserver.observe(chartArea);
    
    console.log('Chart area resize observer added');
}

/**
 * Add double-click to zoom feature
 */
function addDoubleClickZoom() {
    const chartArea = document.getElementById('chart-area');
    if (!chartArea) return;
    
    chartArea.addEventListener('dblclick', (event) => {
        // Prevent default behavior
        event.preventDefault();
        
        // Zoom in on double-click
        if (window.zoomChart) {
            window.zoomChart(1.5);
        }
    });
    
    console.log('Double-click zoom feature added');
}

/**
 * Improve chart loading animation
 */
function improveChartLoadingAnimation() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) return;
    
    // Add a loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'loading-message';
    loadingMessage.textContent = 'Loading your organization chart...';
    loadingOverlay.appendChild(loadingMessage);
    
    // Add CSS for the loading message
    const style = document.createElement('style');
    style.textContent = `
        .loading-message {
            margin-top: 20px;
            color: #333;
            font-size: 1.2rem;
            font-weight: 500;
        }
        
        .loading-spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-left-color: #0ea5e9;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    console.log('Chart loading animation improved');
}

/**
 * Add help tooltip with keyboard shortcuts
 */
function addHelpTooltip() {
    // Create help button
    const helpButton = document.createElement('button');
    helpButton.className = 'help-button';
    helpButton.innerHTML = '<i class="fas fa-question-circle"></i>';
    helpButton.title = 'Keyboard Shortcuts';
    
    // Create help tooltip
    const helpTooltip = document.createElement('div');
    helpTooltip.className = 'help-tooltip';
    helpTooltip.innerHTML = `
        <h3>Keyboard Shortcuts</h3>
        <ul>
            <li><kbd>+</kbd> or <kbd>=</kbd> - Zoom in</li>
            <li><kbd>-</kbd> - Zoom out</li>
            <li><kbd>0</kbd> - Reset zoom</li>
            <li><kbd>c</kbd> - Center chart</li>
            <li><kbd>f</kbd> - Toggle fullscreen</li>
        </ul>
        <div class="help-tooltip-arrow"></div>
    `;
    
    // Add to body
    document.body.appendChild(helpButton);
    document.body.appendChild(helpTooltip);
    
    // Add CSS for help button and tooltip
    const style = document.createElement('style');
    style.textContent = `
        .help-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: #0ea5e9;
            color: white;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 1000;
            transition: all 0.2s ease;
        }
        
        .help-button:hover {
            transform: scale(1.1);
        }
        
        .help-tooltip {
            position: fixed;
            bottom: 70px;
            right: 20px;
            background-color: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            display: none;
            max-width: 300px;
        }
        
        .help-tooltip h3 {
            margin-top: 0;
            margin-bottom: 10px;
            color: #333;
        }
        
        .help-tooltip ul {
            margin: 0;
            padding-left: 20px;
        }
        
        .help-tooltip li {
            margin-bottom: 5px;
        }
        
        .help-tooltip kbd {
            background-color: #f1f1f1;
            border: 1px solid #ccc;
            border-radius: 3px;
            box-shadow: 0 1px 0 rgba(0,0,0,0.2);
            color: #333;
            display: inline-block;
            font-size: 0.85em;
            font-weight: 700;
            line-height: 1;
            padding: 2px 5px;
            white-space: nowrap;
        }
        
        .help-tooltip-arrow {
            position: absolute;
            bottom: -10px;
            right: 20px;
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 10px solid white;
        }
    `;
    document.head.appendChild(style);
    
    // Toggle tooltip on click
    helpButton.addEventListener('click', () => {
        const isVisible = helpTooltip.style.display === 'block';
        helpTooltip.style.display = isVisible ? 'none' : 'block';
    });
    
    // Hide tooltip when clicking elsewhere
    document.addEventListener('click', (event) => {
        if (!helpButton.contains(event.target) && !helpTooltip.contains(event.target)) {
            helpTooltip.style.display = 'none';
        }
    });
    
    console.log('Help tooltip added');
}

// Export functions to global window object
window.initUxEnhancements = initUxEnhancements;
