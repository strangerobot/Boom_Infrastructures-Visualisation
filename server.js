const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Helper to parse standard CSV line with quotes and escaped quote support
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Custom CSV Parser to read the nodes, layers, and connections
function parseDataCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const nodes = [];
    
    if (lines.length === 0) return nodes;
    
    // Header row
    const headers = parseCSVLine(lines[0]);
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      const row = {};
      
      headers.forEach((header, index) => {
        if (header) {
          row[header] = values[index] || '';
        }
      });
      
      // Sanitise types
      if (row.NodeID) {
        nodes.push({
          id: row.NodeID,
          name: row.NodeName || '',
          layerId: row.LayerID || '',
          layerName: row.LayerName || '',
          layerOrder: parseInt(row.LayerOrder, 10) || 0,
          layerRow: parseInt(row.LayerRow, 10) || 0,
          layerWidth: row.LayerWidth || 'full',
          sublayerName: row.SublayerName || '',
          isSublayerNode: row.IsSublayerNode === 'true',
          icon: row.Icon || '',
          description: row.Description || '',
          activeColor: row.ActiveColor || '#bc0000',
          connections: row.Connections ? row.Connections.split(';').map(c => c.trim()).filter(Boolean) : []
        });
      }
    }
    
    // Sort nodes by layer order, row, and ID for consistent rendering
    nodes.sort((a, b) => {
      if (a.layerOrder !== b.layerOrder) {
        return a.layerOrder - b.layerOrder;
      }
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    return nodes;
  } catch (error) {
    console.error('Error reading or parsing CSV file:', error);
    return [];
  }
}

// API Endpoint to get the parsed stack diagram data
app.get('/api/data', (req, res) => {
  const csvPath = path.join(__dirname, 'public', 'data.csv');
  const parsedData = parseDataCSV(csvPath);
  res.json(parsedData);
});

// Start server
app.listen(PORT, () => {
  console.log(`Interactive Visualisation Server is running on http://localhost:${PORT}`);
});
