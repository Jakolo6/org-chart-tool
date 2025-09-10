/**
 * Export utilities for org chart data
 * Preserves original column order and data fidelity
 */

/**
 * Export data to Excel format
 * @param {Object} project - Project data
 * @param {Array} employees - Employee data
 * @param {Object} options - Export options
 * @returns {Blob} Excel file blob
 */
export function exportToExcel(project, employees, options = {}) {
  // Get the latest version with raw headers
  const latestVersion = project.chart_versions.sort((a, b) => 
    b.version_number - a.version_number
  )[0];
  
  const rawHeaders = latestVersion.raw_headers || [];
  const columnMapping = latestVersion.column_mapping || {};
  
  // Create reverse mapping (field -> column)
  const reverseMapping = {};
  Object.entries(columnMapping).forEach(([field, column]) => {
    reverseMapping[field] = column;
  });
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Create worksheet data
  const wsData = [];
  
  // Add headers row
  wsData.push(rawHeaders);
  
  // Add employee data rows
  employees.forEach(employee => {
    const row = [];
    
    // For each original column, find the corresponding value
    rawHeaders.forEach(header => {
      // Find which field this column was mapped to
      const mappedField = Object.keys(columnMapping).find(
        field => columnMapping[field] === header
      );
      
      // If mapped, use the employee value, otherwise use empty string
      if (mappedField && employee[mappedField] !== undefined) {
        row.push(employee[mappedField]);
      } else {
        row.push('');
      }
    });
    
    wsData.push(row);
  });
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Org Chart");
  
  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Export data to CSV format
 * @param {Object} project - Project data
 * @param {Array} employees - Employee data
 * @param {Object} options - Export options
 * @returns {Blob} CSV file blob
 */
export function exportToCSV(project, employees, options = {}) {
  // Get the latest version with raw headers
  const latestVersion = project.chart_versions.sort((a, b) => 
    b.version_number - a.version_number
  )[0];
  
  const rawHeaders = latestVersion.raw_headers || [];
  const columnMapping = latestVersion.column_mapping || {};
  
  // Create reverse mapping (field -> column)
  const reverseMapping = {};
  Object.entries(columnMapping).forEach(([field, column]) => {
    reverseMapping[field] = column;
  });
  
  // Create workbook and worksheet for XLSX.js to generate CSV
  const wb = XLSX.utils.book_new();
  
  // Create worksheet data
  const wsData = [];
  
  // Add headers row
  wsData.push(rawHeaders);
  
  // Add employee data rows
  employees.forEach(employee => {
    const row = [];
    
    // For each original column, find the corresponding value
    rawHeaders.forEach(header => {
      // Find which field this column was mapped to
      const mappedField = Object.keys(columnMapping).find(
        field => columnMapping[field] === header
      );
      
      // If mapped, use the employee value, otherwise use empty string
      if (mappedField && employee[mappedField] !== undefined) {
        row.push(employee[mappedField]);
      } else {
        row.push('');
      }
    });
    
    wsData.push(row);
  });
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Generate CSV
  const csvOutput = XLSX.utils.sheet_to_csv(ws, { FS: options.delimiter || ',' });
  
  return new Blob([csvOutput], { type: 'text/csv;charset=utf-8' });
}

/**
 * Export data to SVG format
 * @param {string} svgContent - SVG content
 * @param {Object} options - Export options
 * @returns {Blob} SVG file blob
 */
export function exportToSVG(svgContent, options = {}) {
  // Add XML declaration if not present
  if (!svgContent.startsWith('<?xml')) {
    svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgContent;
  }
  
  return new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Export data to PNG format
 * @param {string} svgContent - SVG content
 * @param {Object} options - Export options
 * @returns {Promise<Blob>} PNG file blob
 */
export function exportToPNG(svgContent, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Create SVG data URL
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      // Create Image element
      const img = new Image();
      
      img.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement('canvas');
          const scale = options.scale || 2; // Higher scale for better quality
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          // Draw SVG on canvas
          const ctx = canvas.getContext('2d');
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);
          
          // Convert to PNG
          canvas.toBlob(blob => {
            URL.revokeObjectURL(svgUrl);
            resolve(blob);
          }, 'image/png');
        } catch (err) {
          URL.revokeObjectURL(svgUrl);
          reject(err);
        }
      };
      
      img.onerror = err => {
        URL.revokeObjectURL(svgUrl);
        reject(err);
      };
      
      img.src = svgUrl;
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Export data to PDF format
 * @param {string} svgContent - SVG content
 * @param {Object} project - Project data
 * @param {Object} options - Export options
 * @returns {Promise<Blob>} PDF file blob
 */
export async function exportToPDF(svgContent, project, options = {}) {
  // This function requires jsPDF and svg2pdf libraries
  // For this implementation, we'll use a simpler approach with HTML and print-to-PDF
  
  return new Promise((resolve, reject) => {
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        reject(new Error('Could not open print window. Please allow popups for this site.'));
        return;
      }
      
      // Write HTML content
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${project.name || 'Org Chart'} - Export</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .chart-container {
              text-align: center;
              overflow: auto;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            @media print {
              @page {
                size: landscape;
                margin: 10mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${project.name || 'Org Chart'}</h1>
            <p>${project.description || ''}</p>
          </div>
          <div class="chart-container">
            ${svgContent}
          </div>
          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString()} with Organigram Analyzer</p>
          </div>
          <script>
            // Auto-print when loaded
            window.onload = function() {
              setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
              }, 1000);
            };
          </script>
        </body>
        </html>
      `);
      
      // Close the document
      printWindow.document.close();
      
      // Resolve with null as we're using the browser's print functionality
      resolve(null);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Trigger a file download
 * @param {Blob} blob - File blob
 * @param {string} filename - File name
 */
export function downloadFile(blob, filename) {
  // Create download link
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  
  // Append to document
  document.body.appendChild(link);
  
  // Trigger click
  link.click();
  
  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
    document.body.removeChild(link);
  }, 100);
}
