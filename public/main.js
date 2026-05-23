// --- State Variables ---
let nodesData = [];
let selectedNodeId = null;

// No drag/pan variables needed

// Cache DOM Elements
const canvas = document.getElementById('canvas');
const stackWrapper = document.getElementById('stack-wrapper');
const detailTitle = document.getElementById('detail-title');
const detailDesc = document.getElementById('detail-desc');
const fullscreenBtn = document.getElementById('fullscreen-btn');

// --- Helper Functions ---

// Convert Hex to RGBA for smooth glowing shadows
function hexToRgbA(hex, alpha) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
  }
  return hex;
}

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
function parseDataCSV(content) {
  const lines = content.split(/\r?\n/);
  const nodes = [];
  
  if (lines.length === 0) return nodes;
  
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
  
  nodes.sort((a, b) => {
    if (a.layerOrder !== b.layerOrder) {
      return a.layerOrder - b.layerOrder;
    }
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
  });
  
  return nodes;
}

// Fetch and load standard CSV nodes representation
async function init() {
  try {
    const response = await fetch('data.csv');
    const csvText = await response.text();
    nodesData = parseDataCSV(csvText);
    renderStack();
  } catch (error) {
    console.error('Error loading visualisation data:', error);
    detailTitle.textContent = 'Error Loading Data';
    detailDesc.textContent = 'Please make sure data.csv is accessible in the public directory.';
  }
}

// Build standard nodes
function createNodeEl(node) {
  const el = document.createElement('div');
  el.className = 'node';
  el.dataset.nodeId = node.id;
  
  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'node-icon';
  
  if (node.icon && node.icon !== 'none') {
    const img = document.createElement('img');
    img.src = node.icon;
    img.alt = node.name;
    iconWrapper.appendChild(img);
  }
  
  const label = document.createElement('div');
  label.className = 'node-label';
  label.textContent = node.name;
  
  el.appendChild(iconWrapper);
  el.appendChild(label);
  
  // Custom highlight theme overrides
  el.style.setProperty('--node-color', node.activeColor);
  el.style.setProperty('--node-glow-color', hexToRgbA(node.activeColor, 0.25));
  el.style.setProperty('--node-glow-color-soft', hexToRgbA(node.activeColor, 0.12));
  
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    selectNode(node.id);
  });
  
  return el;
}

// Build sublayer nodes (e.g., Value Addons pill nodes)
function createSublayerNodeEl(node) {
  const el = document.createElement('div');
  el.className = 'sublayer-node';
  el.dataset.nodeId = node.id;
  
  const label = document.createElement('div');
  label.className = 'sublayer-node-label';
  label.textContent = node.name;
  
  el.appendChild(label);
  
  // Custom highlight theme overrides
  el.style.setProperty('--node-color', node.activeColor);
  el.style.setProperty('--node-glow-color', hexToRgbA(node.activeColor, 0.25));
  el.style.setProperty('--node-glow-color-soft', hexToRgbA(node.activeColor, 0.12));
  
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    selectNode(node.id);
  });
  
  return el;
}

// Assemble diagram dynamically from CSV nodes
function renderStack() {
  stackWrapper.innerHTML = '';
  
  // 1. Group nodes by layer
  const layers = {};
  nodesData.forEach(node => {
    if (!layers[node.layerId]) {
      layers[node.layerId] = {
        id: node.layerId,
        name: node.layerName,
        order: node.layerOrder,
        row: node.layerRow,
        width: node.layerWidth,
        sublayerName: node.sublayerName,
        standardNodes: [],
        sublayerNodes: []
      };
    }
    if (node.isSublayerNode) {
      layers[node.layerId].sublayerNodes.push(node);
    } else {
      layers[node.layerId].standardNodes.push(node);
    }
  });
  
  // 2. Group layers by row
  const rows = {};
  Object.values(layers).forEach(layer => {
    if (!rows[layer.row]) {
      rows[layer.row] = [];
    }
    rows[layer.row].push(layer);
  });
  
  // Sort layers inside each row by order
  Object.keys(rows).forEach(rowNum => {
    rows[rowNum].sort((a, b) => a.order - b.order);
  });
  
  // 3. Render rows sequentially
  const sortedRowNumbers = Object.keys(rows).map(Number).sort((a, b) => a - b);
  sortedRowNumbers.forEach(rowNum => {
    const rowLayers = rows[rowNum];
    const rowEl = document.createElement('div');
    rowEl.className = 'layer-row';
    
    rowLayers.forEach(layer => {
      const layerEl = document.createElement('div');
      layerEl.className = `layer width-${layer.width}`;
      layerEl.dataset.layerId = layer.id;
      
      const titleEl = document.createElement('div');
      titleEl.className = 'layer-name';
      titleEl.textContent = layer.name;
      layerEl.appendChild(titleEl);
      
      const contentEl = document.createElement('div');
      contentEl.className = 'layer-content';
      
      // Render standard nodes area
      const nodesAreaEl = document.createElement('div');
      nodesAreaEl.className = 'nodes-area';
      layer.standardNodes.forEach(node => {
        const nodeEl = createNodeEl(node);
        nodesAreaEl.appendChild(nodeEl);
      });
      contentEl.appendChild(nodesAreaEl);
      
      // Render sublayer (Value Addons) if exists
      if (layer.sublayerName && layer.sublayerName !== '') {
        contentEl.classList.add('has-sublayer');
        
        const sublayerBoxEl = document.createElement('div');
        sublayerBoxEl.className = 'sublayer-box';
        
        const subTitleEl = document.createElement('div');
        subTitleEl.className = 'sublayer-title';
        subTitleEl.textContent = layer.sublayerName;
        sublayerBoxEl.appendChild(subTitleEl);
        
        const subNodesEl = document.createElement('div');
        subNodesEl.className = 'sublayer-nodes';
        layer.sublayerNodes.forEach(node => {
          const nodeEl = createSublayerNodeEl(node);
          subNodesEl.appendChild(nodeEl);
        });
        sublayerBoxEl.appendChild(subNodesEl);
        
        contentEl.appendChild(sublayerBoxEl);
      }
      
      layerEl.appendChild(contentEl);
      rowEl.appendChild(layerEl);
    });
    
    stackWrapper.appendChild(rowEl);
  });
}

// Click to select node, highlight relations, and update description
function selectNode(nodeId) {
  if (selectedNodeId === nodeId) {
    clearSelection();
    return;
  }
  
  selectedNodeId = nodeId;
  stackWrapper.classList.add('active-selection');
  
  const activeNode = nodesData.find(n => n.id === nodeId);
  if (!activeNode) return;
  
  // Update detail box
  detailTitle.textContent = activeNode.name;
  detailDesc.textContent = activeNode.description;
  
  // Highlight connections
  const allNodeElements = document.querySelectorAll('[data-node-id]');
  allNodeElements.forEach(el => {
    const elId = el.dataset.nodeId;
    el.classList.remove('state-active', 'state-connected');
    
    if (elId === nodeId) {
      el.classList.add('state-active');
    } else {
      const otherNode = nodesData.find(n => n.id === elId);
      // Bidirectional connection resolve
      const isConnected = activeNode.connections.includes(elId) || 
                          (otherNode && otherNode.connections.includes(nodeId));
      if (isConnected) {
        el.classList.add('state-connected');
      }
    }
  });
}

// Clear selected states
function clearSelection() {
  selectedNodeId = null;
  stackWrapper.classList.remove('active-selection');
  
  const allNodeElements = document.querySelectorAll('[data-node-id]');
  allNodeElements.forEach(el => {
    el.classList.remove('state-active', 'state-connected');
  });
  
  // Reset detail box
  detailTitle.textContent = 'Select a service';
  detailDesc.textContent = 'Click on any node in the stack diagram below to view technical details and highlight infrastructure flows.';
}

// Clicking canvas background clears selections
canvas.addEventListener('click', () => {
  clearSelection();
});

// --- Fullscreen Toggle Binder ---
const wrapper = document.getElementById('visualisation-wrapper');

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement &&
      !document.mozFullScreenElement && 
      !document.webkitFullscreenElement && 
      !document.msFullscreenElement) {
    // Enter Fullscreen
    const enterFS = wrapper.requestFullscreen || 
                    wrapper.mozRequestFullScreen || 
                    wrapper.webkitRequestFullscreen || 
                    wrapper.msRequestFullscreen;
    if (enterFS) {
      enterFS.call(wrapper).catch(err => {
        console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
      });
    }
  } else {
    // Exit Fullscreen
    const exitFS = document.exitFullscreen || 
                   document.mozCancelFullScreen || 
                   document.webkitExitFullscreen || 
                   document.msExitFullscreen;
    if (exitFS) {
      exitFS.call(document);
    }
  }
});

// Sync UI on Fullscreen state changes
document.addEventListener('fullscreenchange', handleFSChange);
document.addEventListener('webkitfullscreenchange', handleFSChange);
document.addEventListener('mozfullscreenchange', handleFSChange);
document.addEventListener('MSFullscreenChange', handleFSChange);

function handleFSChange() {
  const isFS = document.fullscreenElement ||
               document.webkitFullscreenElement ||
               document.mozFullScreenElement ||
               document.msFullscreenElement;
  
  if (isFS) {
    fullscreenBtn.classList.add('in-fullscreen');
    fullscreenBtn.title = "Exit Full Screen";
  } else {
    fullscreenBtn.classList.remove('in-fullscreen');
    fullscreenBtn.title = "Toggle Full Screen";
  }
  
}

// --- Initialize App ---
init();
