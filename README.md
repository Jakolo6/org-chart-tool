# Organigram Analyzer (Refactor Scaffold)

This project restructures the single large HTML file into a maintainable website layout.

## Structure
```
org-chart-tool/
├── index.html
├── css/
│   ├── styles.css
│   └── components/
│       ├── header.css
│       ├── legend.css
│       ├── stats.css
│       └── chart.css
├── js/
│   ├── main.js
│   ├── components/
│   │   ├── fileHandler.js
│   │   ├── chartRenderer.js
│   │   ├── statsManager.js
│   │   └── uiManager.js
│   └── utils/
│       └── helpers.js
└── assets/
```

## 🛠️ Setup and Installation

### Prerequisites
- Modern web browser with ES6 module support
- Local web server (for development)

### Quick Start

1. **Clone or download** the project files to your local machine

2. **Start a local web server** in the project directory:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Python 2
   python -m SimpleHTTPServer 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server -p 8000
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:8000
   ```

4. **Upload your Excel file** with organizational data and start analyzing!

## 📊 Excel File Format

Your Excel file should contain employee data with the following information:

### Required Columns
- **Employee Name**: Full name of the employee
- **Manager**: Name of the direct manager (must match an employee name)

### Optional Columns
- **Job Title**: Employee's position/role
- **FTE**: Full-time equivalent (0.0 - 1.0)
- **Location**: Work location/office
- **Job Family**: Department or job category
- **Management Level**: Hierarchical level (1-10)

### Example Data Structure
```
| Employee Name | Manager      | Job Title        | FTE | Location | Job Family |
|---------------|--------------|------------------|-----|----------|------------|
| John Smith    |              | CEO              | 1.0 | Berlin   | Executive  |
| Jane Doe      | John Smith   | VP Engineering   | 1.0 | Berlin   | Engineering|
| Bob Johnson   | Jane Doe     | Senior Developer | 1.0 | Munich   | Engineering|
```

## 🎯 Usage Guide

### Basic Workflow

1. **Upload Baseline Data**
   - Click "Choose File" under "Status Quo (Baseline)"
   - Select your current organizational structure Excel file
   - Map columns if auto-detection doesn't work perfectly

2. **View Organization Chart**
   - Interactive D3.js visualization will render
   - Use mouse wheel to zoom in/out
   - Click and drag to pan around
   - Click on nodes to view detailed statistics

3. **Optional: Compare with Target State**
   - Upload a second Excel file under "Target State (Optional)"
   - Click "Compare" to enable comparison mode
   - View changes highlighted in different colors

### Advanced Features

#### Search Functionality
- Use the search bar to quickly find employees
- Real-time filtering as you type
- Click search results to navigate to employee

#### Statistics Panels
- **Overall Statistics**: Summary of organizational metrics
- **Selected Node Statistics**: Detailed info for clicked employees
- **Change Log**: Comprehensive list of all changes in comparison mode

#### Data Validation
- Automatic validation of manager-employee relationships
- Detection of circular references
- Identification of orphaned employees
- Download detailed error reports

## 🔧 Technical Architecture

### Frontend Technologies
- **HTML5**: Semantic markup and structure
- **CSS3**: Modern styling with flexbox and grid
- **JavaScript ES6+**: Modular architecture with ES modules
- **D3.js v7.8.5**: Data visualization and SVG manipulation
- **xlsx.js v0.18.5**: Excel file parsing and processing

### Module Architecture

#### `main.js` - Application Core
- Application initialization and configuration
- Global state management
- Module coordination and imports
- Event system setup

#### `chartRenderer.js` - Visualization Engine
- D3.js chart setup and rendering
- Hierarchy calculation and layout
- Node positioning and styling
- Zoom and pan interactions
- Selection and highlighting

#### `fileHandler.js` - Data Processing
- Excel file upload handling
- XLSX parsing and validation
- Column mapping dialog
- Data transformation and normalization
- Error handling and reporting

#### `uiManager.js` - User Interface
- Modal dialog management
- Search functionality
- Tooltip system
- Sidebar and panel controls
- Upload screen interactions

#### `statsManager.js` - Analytics Engine
- Statistical calculations
- Comparison analysis
- Change detection and categorization
- Metrics dashboard updates
- Change log generation

### Design Patterns
- **Module Pattern**: Each component is a self-contained ES module
- **Observer Pattern**: Event-driven communication between modules
- **Factory Pattern**: Dynamic creation of UI elements and chart nodes
- **Strategy Pattern**: Flexible data processing and validation strategies

## 🎨 Customization

### Styling
All styles are centralized in `css/styles.css` and organized by component:
- Global styles and resets
- Header and navigation
- Chart and visualization
- Modals and dialogs
- Statistics panels
- Responsive design

### Configuration
Application settings can be modified in `js/main.js`:
```javascript
const CONFIG = {
    chart: {
        nodeWidth: 180,
        nodeHeight: 100,
        levelHeight: 150,
        // ... other chart settings
    },
    ui: {
        animationDuration: 300,
        searchDelay: 300,
        // ... other UI settings
    }
};
```

## 🐛 Troubleshooting

### Common Issues

**File Upload Not Working**
- Ensure you're running a local web server (not opening file:// directly)
- Check that the Excel file is not corrupted
- Verify file format is .xlsx or .xls

**Chart Not Rendering**
- Check browser console for JavaScript errors
- Ensure D3.js library loaded successfully
- Verify data structure has required columns

**Column Mapping Issues**
- Check that column names don't have special characters
- Ensure manager names exactly match employee names
- Verify there are no circular manager relationships

### Browser Support
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 📝 Development Notes

### Original Refactoring
This application was refactored from a single large HTML file (~5,232 lines, 204KB) into a modular, maintainable structure. The refactoring preserved 100% of the original functionality while improving:

- **Code Organization**: Separated concerns into logical modules
- **Maintainability**: Easier to update and extend individual components
- **Performance**: Better caching and loading strategies
- **Developer Experience**: Clear structure and documentation

### Future Enhancements
- Add unit tests for core functionality
- Implement progressive web app (PWA) features
- Add more export formats (PDF, PNG, SVG)
- Enhanced mobile responsive design
- Real-time collaboration features

## 📄 License

This project is proprietary software developed for RedCare Pharmacy.

## 🤝 Support

For technical support or feature requests, please contact the development team.
