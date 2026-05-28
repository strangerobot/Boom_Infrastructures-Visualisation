// --- State Variables ---
let layersData = [];
let nodesData = [];
let workflowsData = [];
let selectedWorkflowId = null;

// Cache DOM Elements
const canvas = document.getElementById('canvas');
const stackWrapper = document.getElementById('stack-wrapper');
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

// Custom CSV Parser to read the nodes, layers, and workflows
function parseDataCSV(content) {
  const lines = content.split(/\r?\n/);
  const layers = [];
  const nodes = [];
  const workflows = [];
  
  if (lines.length === 0) return { layers, nodes, workflows };
  
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
    
    const type = (row.Type || '').toLowerCase();
    if (type === 'layer') {
      layers.push({
        id: row.ID,
        name: row.Name,
        description: row.Description || '',
        order: parseInt(row.Order, 10) || 0
      });
    } else if (type === 'node') {
      nodes.push({
        id: row.ID,
        name: row.Name,
        icon: row.Icon || 'none',
        layerId: row.LayerID
      });
    } else if (type === 'workflow') {
      workflows.push({
        id: row.ID,
        name: row.Name,
        color: row.Color || '#bc0000',
        nodes: row.WorkflowNodes ? row.WorkflowNodes.split(';').map(n => n.trim()).filter(Boolean) : []
      });
    }
  }
  
  // Sort layers by Order
  layers.sort((a, b) => a.order - b.order);
  
  return { layers, nodes, workflows };
}

// Fetch and load CSV nodes representation
async function init() {
  try {
    const response = await fetch('data.csv');
    const csvText = await response.text();
    const parsed = parseDataCSV(csvText);
    
    layersData = parsed.layers;
    nodesData = parsed.nodes;
    workflowsData = parsed.workflows;
    
    renderStack();
    populateWorkflowSelector();
    
    // Select the first workflow by default
    if (workflowsData.length > 0) {
      selectWorkflow(workflowsData[0].id);
    } else {
      drawLines();
    }
  } catch (error) {
    console.error('Error loading visualisation data:', error);
    const title = document.getElementById('diagram-title');
    if (title) title.textContent = 'Error Loading Data';
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
  
  return el;
}

// Assemble diagram dynamically from CSV nodes
function renderStack() {
  if (!stackWrapper) return;
  stackWrapper.innerHTML = '';
  
  layersData.forEach(layer => {
    const rowEl = document.createElement('div');
    rowEl.className = 'layer-row';
    rowEl.dataset.layerId = layer.id;
    
    // Left column: Info
    const infoEl = document.createElement('div');
    infoEl.className = 'layer-info';
    
    const titleEl = document.createElement('h3');
    titleEl.className = 'layer-title';
    titleEl.textContent = layer.name;
    
    const descEl = document.createElement('p');
    descEl.className = 'layer-description';
    descEl.textContent = layer.description;
    
    infoEl.appendChild(titleEl);
    infoEl.appendChild(descEl);
    rowEl.appendChild(infoEl);
    
    // Right column: Box containing nodes
    const boxEl = document.createElement('div');
    boxEl.className = 'layer-box';
    
    const nodesAreaEl = document.createElement('div');
    nodesAreaEl.className = 'nodes-area';
    
    // Find nodes belonging to this layer
    const layerNodes = nodesData.filter(n => n.layerId === layer.id);
    layerNodes.forEach(node => {
      const nodeEl = createNodeEl(node);
      nodesAreaEl.appendChild(nodeEl);
    });
    
    boxEl.appendChild(nodesAreaEl);
    rowEl.appendChild(boxEl);
    
    stackWrapper.appendChild(rowEl);
  });
}

// Populate workflow dropdown selector options
function populateWorkflowSelector() {
  const select = document.getElementById('workflow-select');
  if (!select) return;
  
  select.innerHTML = '';
  
  workflowsData.forEach(wf => {
    const option = document.createElement('option');
    option.value = wf.id;
    option.textContent = wf.name;
    select.appendChild(option);
  });
  
  select.addEventListener('change', (e) => {
    selectWorkflow(e.target.value);
  });
}

// Highlight the selected workflow path
function selectWorkflow(workflowId) {
  selectedWorkflowId = workflowId;
  const wf = workflowsData.find(w => w.id === workflowId);
  if (!wf) return;
  
  // Update theme colors on root visualisation-wrapper
  const wrapper = document.getElementById('visualisation-wrapper');
  if (wrapper) {
    wrapper.style.setProperty('--workflow-color', wf.color);
    wrapper.style.setProperty('--workflow-glow-color', hexToRgbA(wf.color, 0.25));
  }
  
  // Sync the dropdown menu value
  const select = document.getElementById('workflow-select');
  if (select && select.value !== workflowId) {
    select.value = workflowId;
  }
  
  // Highlight active nodes
  if (stackWrapper) {
    stackWrapper.classList.add('active-selection');
  }
  
  const allNodeElements = document.querySelectorAll('[data-node-id]');
  allNodeElements.forEach(el => {
    const nodeId = el.dataset.nodeId;
    el.classList.remove('state-active', 'state-connected');
    
    if (wf.nodes.includes(nodeId)) {
      el.classList.add('state-active');
    }
  });
  
  // Redraw SVG connection lines
  drawLines();
}

// --- SVG Connection Lines Drawer ---
function drawLines() {
  const svg = document.getElementById('connections-svg');
  if (!svg) return;
  svg.innerHTML = '';
  
  const canvasRect = canvas.getBoundingClientRect();
  
  // 1. Set up arrow definition marker
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '7');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto-start-reverse');
  
  const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  markerPath.setAttribute('d', 'M 0 2.5 L 7 5 L 0 7.5 z');
  markerPath.setAttribute('fill', '#bbbbbb');
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);
  
  // 2. Draw static downward arrows between consecutive layer boxes
  const boxes = Array.from(document.querySelectorAll('.layer-box'));
  if (boxes.length >= 2) {
    for (let i = 0; i < boxes.length - 1; i++) {
      const boxA = boxes[i];
      const boxB = boxes[i + 1];
      
      const rectA = boxA.getBoundingClientRect();
      const rectB = boxB.getBoundingClientRect();
      
      const xA = (rectA.left + rectA.right) / 2 - canvasRect.left;
      const xB = (rectB.left + rectB.right) / 2 - canvasRect.left;
      const x = (xA + xB) / 2;
      
      const yStart = rectA.bottom - canvasRect.top;
      const yEnd = rectB.top - canvasRect.top;
      
      if (yEnd > yStart) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', yStart + 3);
        line.setAttribute('x2', x);
        line.setAttribute('y2', yEnd - 6);
        line.setAttribute('stroke', '#bbbbbb');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('marker-end', 'url(#arrow)');
        svg.appendChild(line);
      }
    }
  }
  
  // 3. Draw static bypass arrow from Layer 1 to Layer 3 (right side loop)
  if (boxes.length >= 3) {
    const box1 = boxes[0];
    const box3 = boxes[2];
    
    const rect1 = box1.getBoundingClientRect();
    const rect3 = box3.getBoundingClientRect();
    
    const rightEdge1 = rect1.right - canvasRect.left;
    const y1 = (rect1.top + rect1.bottom) / 2 - canvasRect.top;
    
    const rightEdge3 = rect3.right - canvasRect.left;
    const y3 = (rect3.top + rect3.bottom) / 2 - canvasRect.top;
    
    const maxRight = Math.max(rightEdge1, rightEdge3);
    const loopOffset = 25; // Loop offset to the right
    const loopX = maxRight + loopOffset;
    
    const bypassPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathD = `M ${rightEdge1},${y1} ` +
                  `L ${loopX - 8},${y1} ` +
                  `Q ${loopX},${y1} ${loopX},${y1 + 8} ` +
                  `L ${loopX},${y3 - 8} ` +
                  `Q ${loopX},${y3} ${loopX - 8},${y3} ` +
                  `L ${rightEdge3 + 6},${y3}`;
    
    bypassPath.setAttribute('d', pathD);
    bypassPath.setAttribute('stroke', '#bbbbbb');
    bypassPath.setAttribute('stroke-width', '1.5');
    bypassPath.setAttribute('fill', 'none');
    bypassPath.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(bypassPath);
  }
  
  // 4. Draw dynamic workflow path (dotted, colored, animated)
  if (selectedWorkflowId) {
    const wf = workflowsData.find(w => w.id === selectedWorkflowId);
    if (wf && wf.nodes.length >= 2) {
      const points = [];
      wf.nodes.forEach(nodeId => {
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeEl) {
          const iconEl = nodeEl.querySelector('.node-icon') || nodeEl;
          const rect = iconEl.getBoundingClientRect();
          points.push({
            x: (rect.left + rect.right) / 2 - canvasRect.left,
            y: (rect.top + rect.bottom) / 2 - canvasRect.top
          });
        }
      });
      
      if (points.length >= 2) {
        const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
        
        // A. Glow Line (thick, semi-transparent)
        const glowLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glowLine.setAttribute('d', pathD);
        glowLine.setAttribute('stroke', wf.color);
        glowLine.setAttribute('stroke-width', '6');
        glowLine.setAttribute('opacity', '0.18');
        glowLine.setAttribute('fill', 'none');
        svg.appendChild(glowLine);
        
        // B. Active Path Line (dotted & animated)
        const pathLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathLine.setAttribute('d', pathD);
        pathLine.setAttribute('stroke', wf.color);
        pathLine.setAttribute('stroke-width', '2.5');
        pathLine.setAttribute('stroke-dasharray', '6,4');
        pathLine.setAttribute('fill', 'none');
        
        // Dash flow animation
        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animate.setAttribute('attributeName', 'stroke-dashoffset');
        animate.setAttribute('values', '10;0');
        animate.setAttribute('dur', '1.2s');
        animate.setAttribute('repeatCount', 'indefinite');
        pathLine.appendChild(animate);
        
        svg.appendChild(pathLine);
      }
    }
  }
}

// Observe canvas size changes to redraw connection lines automatically
const resizeObserver = new ResizeObserver(() => {
  drawLines();
});
if (canvas) {
  resizeObserver.observe(canvas);
}

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
