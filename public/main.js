// --- State Variables ---
let nodesData = [];
let workflowsData = [];
let selectedWorkflowId = null;

// Cache DOM Elements
const canvas = document.getElementById('canvas');
const canvasContainer = document.getElementById('canvas-container');
const stackWrapper = document.getElementById('stack-wrapper');
const nodeTooltip = document.getElementById('node-tooltip');
const tooltipDesc = document.getElementById('tooltip-desc');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const workflowSelectWrapper = document.getElementById('workflow-select-wrapper');
const workflowSelectedText = document.getElementById('workflow-selected-text');
const workflowDropdownList = document.getElementById('workflow-dropdown-list');
const workflowBackdrop = document.getElementById('workflow-backdrop');

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

// Custom CSV Parser to read nodes representation
function parseNodesCSV(content) {
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
        icon: row.Icon || '',
        layerId: row.LayerID || '',
        layerName: row.LayerName || '',
        layerOrder: parseInt(row.LayerOrder, 10) || 0,
        description: row.Description || ''
      });
    }
  }
  return nodes;
}

// Custom CSV Parser to read workflows
function parseWorkflowsCSV(content) {
  const lines = content.split(/\r?\n/);
  const workflows = [];
  if (lines.length === 0) return workflows;
  
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
    
    if (row.WorkflowID) {
      workflows.push({
        id: row.WorkflowID,
        name: row.WorkflowName || '',
        color: row.WorkflowColor || '#bc0000',
        description: row.Description || '',
        nodeIds: row.NodeIDs ? row.NodeIDs.split(';').map(n => n.trim()).filter(Boolean) : []
      });
    }
  }
  return workflows;
}

// Fetch and load data
async function init() {
  try {
    const nodesRes = await fetch('data.csv');
    const nodesCsv = await nodesRes.text();
    nodesData = parseNodesCSV(nodesCsv);

    const workflowsRes = await fetch('workflows.csv');
    const workflowsCsv = await workflowsRes.text();
    workflowsData = parseWorkflowsCSV(workflowsCsv);

    populateDropdown();
    renderStack();
    drawLines();
    setupInfraIconTooltips();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Populate workflow selection dropdown
function populateDropdown() {
  workflowDropdownList.innerHTML = '';

  // Add default reset option
  const defaultOpt = document.createElement('div');
  defaultOpt.className = 'workflow-option-item';
  defaultOpt.dataset.value = '';
  defaultOpt.textContent = 'Select a workflow...';
  defaultOpt.addEventListener('click', (e) => {
    e.stopPropagation();
    selectWorkflow('');
    closeDropdown();
  });
  workflowDropdownList.appendChild(defaultOpt);

  workflowsData.forEach(flow => {
    const opt = document.createElement('div');
    opt.className = 'workflow-option-item';
    opt.dataset.value = flow.id;
    opt.textContent = flow.name;
    opt.style.setProperty('--workflow-hover-color', flow.color);
    opt.style.setProperty('--workflow-item-color', flow.color);

    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      selectWorkflow(flow.id);
      closeDropdown();
    });
    workflowDropdownList.appendChild(opt);
  });

  // Toggle open/close dropdown list
  workflowSelectWrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = workflowSelectWrapper.classList.contains('open');
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });
}

function openDropdown() {
  workflowSelectWrapper.classList.add('open');
  workflowDropdownList.classList.remove('hidden');
  if (workflowBackdrop) workflowBackdrop.classList.remove('hidden');
}

function closeDropdown() {
  workflowSelectWrapper.classList.remove('open');
  workflowDropdownList.classList.add('hidden');
  if (workflowBackdrop) workflowBackdrop.classList.add('hidden');
}

// Handle workflow selection
function selectWorkflow(flowId) {
  selectedWorkflowId = flowId;
  const flow = workflowsData.find(w => w.id === flowId);

  // Update active option items highlighting
  const optionItems = document.querySelectorAll('.workflow-option-item');
  optionItems.forEach(item => {
    if (item.dataset.value === flowId) {
      item.classList.add('active-option');
    } else {
      item.classList.remove('active-option');
    }
  });

  if (flow) {
    workflowSelectedText.textContent = flow.name;

    // Apply workflow theme styling properties
    canvasContainer.classList.add('workflow-active');
    canvasContainer.style.setProperty('--active-workflow-color', flow.color);
    canvasContainer.style.setProperty('--active-workflow-glow-color', hexToRgbA(flow.color, 0.1));

    stackWrapper.classList.add('active-state');
    stackWrapper.style.setProperty('--workflow-color', flow.color);
    stackWrapper.style.setProperty('--workflow-bg-color', hexToRgbA(flow.color, 0.12));
    stackWrapper.style.setProperty('--workflow-glow-color', hexToRgbA(flow.color, 0.25));

    // Mark nodes on active path
    const allNodeEls = document.querySelectorAll('.node');
    allNodeEls.forEach(el => {
      const nodeId = el.dataset.nodeId;
      if (flow.nodeIds.includes(nodeId)) {
        el.classList.add('active-path-node');
      } else {
        el.classList.remove('active-path-node');
      }
    });

  } else {
    workflowSelectedText.textContent = 'Select a workflow...';

    // Return to neutral unselected state
    canvasContainer.classList.remove('workflow-active');
    stackWrapper.classList.remove('active-state');
    
    const allNodeEls = document.querySelectorAll('.node');
    allNodeEls.forEach(el => {
      el.classList.remove('active-path-node');
    });
  }

  drawLines();
}

// Build standard nodes
// hasTooltip: whether this node belongs to one of the last 3 layers
function createNodeEl(node, hasTooltip) {
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
  // Wrap text in a span so it aligns correctly as a flex item alongside the info icon
  const nameSpan = document.createElement('span');
  nameSpan.textContent = node.name;
  label.appendChild(nameSpan);

  if (hasTooltip && node.description) {
    const infoBtn = document.createElement('button');
    infoBtn.className = 'node-info-btn';
    infoBtn.setAttribute('aria-label', 'More info about ' + node.name);
    infoBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="5" cy="5" r="4.5" stroke="currentColor"/><path d="M5 4.5v3" stroke="currentColor" stroke-linecap="round"/><circle cx="5" cy="3" r="0.5" fill="currentColor"/></svg>`;
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Toggle pin: if already pinned for this node, hide; otherwise pin
      if (nodeTooltip.dataset.pinned && nodeTooltip.dataset.pinnedFor === node.id) {
        hideTooltip();
      } else {
        showTooltip(node, infoBtn, true);
      }
    });
    infoBtn.addEventListener('mouseenter', () => {
      showTooltip(node, infoBtn, false);
    });
    infoBtn.addEventListener('mouseleave', () => {
      if (!nodeTooltip.dataset.pinned) hideTooltip();
    });
    label.appendChild(infoBtn);
  }
  
  el.appendChild(iconWrapper);
  el.appendChild(label);

  // On mobile/tablet the info btn is hidden — tapping the node itself shows the tooltip
  if (hasTooltip && node.description) {
    el.addEventListener('click', (e) => {
      // Only handle on touch/small-screen sizes; desktop uses the info btn
      if (window.innerWidth > 768) return;
      e.stopPropagation();
      // Toggle: tap again to dismiss
      if (nodeTooltip.dataset.pinned && nodeTooltip.dataset.pinnedFor === node.id) {
        hideTooltip();
      } else {
        showTooltip(node, el, true);
      }
    });
  }

  return el;
}

// Assemble layers and nodes
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
        description: node.layerId === 'discovery' ? 'Platforms through which people can find the services that nudify or generate sexual scenes.' :
                     node.layerId === 'gui' ? 'The easy to use modality via which non technical users can upload images to generate synthetic content' :
                     node.layerId === 'model_access' ? 'Interfaces through which more technical users can access and build on top of AI models. Beyond simple access, providers might also enable download of the model (HuggingFace, GitHub) and provide features such as gamification and monetary rewards (CivitAI)' :
                     node.layerId === 'ml_models' ? 'Models are trained on individual/corporate hardware and datasets. Large base media models are fine tuned on specific sexual scenes.' :
                     'Images and videos are collected and annotated. Datasets enable base model training and fine-tuning',
        nodes: []
      };
    }
    layers[node.layerId].nodes.push(node);
  });
  
  // 2. Sort layers by LayerOrder
  const sortedLayers = Object.values(layers).sort((a, b) => a.order - b.order);
  
  // 3. Render rows
  sortedLayers.forEach((layer, idx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'layer-row';
    rowEl.dataset.layerId = layer.id;
    
    // Textbox left
    const textboxEl = document.createElement('div');
    textboxEl.className = 'layer-textbox';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'layer-title';
    titleEl.textContent = layer.name;
    
    const descEl = document.createElement('div');
    descEl.className = 'layer-desc';
    descEl.textContent = layer.description;
    
    textboxEl.appendChild(titleEl);
    textboxEl.appendChild(descEl);
    
    // Container right
    const containerEl = document.createElement('div');
    containerEl.className = 'layer-container';
    if (idx >= sortedLayers.length - 2) {
      containerEl.classList.add('dotted-border');
    }
    
    layer.nodes.forEach(node => {
      const nodeEl = createNodeEl(node, true); // all layers get tooltip
      containerEl.appendChild(nodeEl);
    });
    
    rowEl.appendChild(textboxEl);
    rowEl.appendChild(containerEl);
    
    stackWrapper.appendChild(rowEl);
  });
}

// --- Draw SVG connections ---
function drawLines() {
  const svg = document.getElementById('connections-svg');
  if (!svg) return;
  svg.innerHTML = '';
  
  const canvasRect = canvas.getBoundingClientRect();

  // Create defs for arrow marker
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrow-marker');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '8');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto');
  
  const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  markerPath.setAttribute('d', 'M 0 1.5 L 8 5 L 0 8.5 z');
  markerPath.setAttribute('fill', 'rgba(0, 0, 0, 0.2)');
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // 1. Draw static layer-to-layer connections
  const layerRows = Array.from(document.querySelectorAll('.layer-row'));
  const layerContainers = layerRows.map(row => row.querySelector('.layer-container'));
  
  // Draw vertical arrows between sequential layers
  for (let i = 0; i < layerContainers.length - 1; i++) {
    const current = layerContainers[i];
    const next = layerContainers[i + 1];
    
    if (current && next) {
      const currentRect = current.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();
      
      const x = (currentRect.left + currentRect.right) / 2 - canvasRect.left;
      const y1 = currentRect.bottom - canvasRect.top;
      const y2 = nextRect.top - canvasRect.top;
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', 'rgba(0, 0, 0, 0.08)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('marker-end', 'url(#arrow-marker)');
      svg.appendChild(line);
    }
  }

  // Draw Layer 1 -> Layer 3 side arrow
  if (layerContainers.length >= 3) {
    const l1 = layerContainers[0];
    const l3 = layerContainers[2];
    
    if (l1 && l3) {
      const l1Rect = l1.getBoundingClientRect();
      const l3Rect = l3.getBoundingClientRect();
      
      const x1 = l1Rect.right - canvasRect.left;
      const y1 = (l1Rect.top + l1Rect.bottom) / 2 - canvasRect.top;
      
      const x2 = l3Rect.right - canvasRect.left;
      const y2 = (l3Rect.top + l3Rect.bottom) / 2 - canvasRect.top;
      
      // Calculate layout box bounds so side arrow goes off to the right nicely and doesn't get clipped
      const maxAllowedX = canvasRect.width - (window.innerWidth <= 768 ? 4 : 8);
      const xMax = Math.min(Math.max(l1Rect.right, l3Rect.right) - canvasRect.left + (window.innerWidth <= 768 ? 11 : 17), maxAllowedX);
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} H ${xMax} V ${y2} H ${x2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(0, 0, 0, 0.08)');
      path.setAttribute('stroke-width', '1');
      path.setAttribute('marker-end', 'url(#arrow-marker)');
      svg.appendChild(path);
    }
  }

  // 2. Draw Active Workflow Nodes Sequenced Dotted Line Path
  if (selectedWorkflowId) {
    const flow = workflowsData.find(w => w.id === selectedWorkflowId);
    if (flow && flow.nodeIds.length > 1) {
      const centers = {};
      const allNodeEls = document.querySelectorAll('.node');
      
      allNodeEls.forEach(el => {
        const id = el.dataset.nodeId;
        const iconEl = el.querySelector('.node-icon') || el;
        const iconRect = iconEl.getBoundingClientRect();
        centers[id] = {
          x: (iconRect.left + iconRect.right) / 2 - canvasRect.left,
          y: (iconRect.top + iconRect.bottom) / 2 - canvasRect.top
        };
      });

      for (let i = 0; i < flow.nodeIds.length - 1; i++) {
        const fromId = flow.nodeIds[i];
        const toId = flow.nodeIds[i + 1];
        const p1 = centers[fromId];
        const p2 = centers[toId];
        
        if (p1 && p2) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', p1.x);
          line.setAttribute('y1', p1.y);
          line.setAttribute('x2', p2.x);
          line.setAttribute('y2', p2.y);
          line.setAttribute('stroke', flow.color);
          line.setAttribute('stroke-width', '1.5');
          line.setAttribute('stroke-dasharray', '6,4');
          line.setAttribute('opacity', '0.5');
          
          const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
          animate.setAttribute('attributeName', 'stroke-dashoffset');
          animate.setAttribute('values', '10;0');
          animate.setAttribute('dur', '1.2s');
          animate.setAttribute('repeatCount', 'indefinite');
          line.appendChild(animate);
          
          svg.appendChild(line);
        }
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

// --- Tooltip Logic ---
let tooltipHideTimer = null;

function showTooltip(node, anchorEl, pin = false) {
  clearTimeout(tooltipHideTimer);

  // Populate content
  tooltipDesc.textContent = node.description;

  // Mark active info btn
  document.querySelectorAll('.node-info-btn').forEach(b => b.classList.remove('active'));
  anchorEl.classList.add('active');

  // Pin state + background dimming
  if (pin) {
    nodeTooltip.dataset.pinned = 'true';
    nodeTooltip.dataset.pinnedFor = node.id;
    // Find the node element — anchorEl is either the node itself (mobile) or the info btn (desktop)
    const sourceNode = anchorEl.closest('.node') || anchorEl;
    document.querySelectorAll('.tooltip-source').forEach(n => n.classList.remove('tooltip-source'));
    sourceNode.classList.add('tooltip-source');
    canvas.classList.add('tooltip-pinned');
  } else {
    delete nodeTooltip.dataset.pinned;
    delete nodeTooltip.dataset.pinnedFor;
    canvas.classList.remove('tooltip-pinned');
    document.querySelectorAll('.tooltip-source').forEach(n => n.classList.remove('tooltip-source'));
  }

  // Show (unhide first so getBoundingClientRect works)
  nodeTooltip.classList.remove('hidden');

  // Position tooltip near anchor, avoiding viewport edges
  const anchorRect = anchorEl.getBoundingClientRect();
  const tooltipRect = nodeTooltip.getBoundingClientRect();
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Try to place tooltip above the anchor first
  let top = anchorRect.top - tooltipRect.height - margin;
  let left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;

  // Flip below if no room above
  if (top < margin) {
    top = anchorRect.bottom + margin;
  }
  // Clamp horizontally
  left = Math.max(margin, Math.min(left, vw - tooltipRect.width - margin));
  // Clamp vertically
  top = Math.max(margin, Math.min(top, vh - tooltipRect.height - margin));

  nodeTooltip.style.top = top + 'px';
  nodeTooltip.style.left = left + 'px';
}

function hideTooltip() {
  nodeTooltip.classList.add('hidden');
  delete nodeTooltip.dataset.pinned;
  delete nodeTooltip.dataset.pinnedFor;
  canvas.classList.remove('tooltip-pinned');
  document.querySelectorAll('.tooltip-source').forEach(n => n.classList.remove('tooltip-source'));
  document.querySelectorAll('.node-info-btn').forEach(b => b.classList.remove('active'));
}

// Click outside dismisses tooltip and resets workflow if active
document.addEventListener('click', (e) => {
  const isDropdownClick = e.target.closest('#workflow-select-wrapper');
  const isInfoBtnClick = e.target.closest('.node-info-btn');

  if (!isDropdownClick) {
    closeDropdown();
    // Reset workflow selection when clicking anywhere outside the dropdown
    if (selectedWorkflowId) {
      selectWorkflow('');
    }
  }

  if (!isInfoBtnClick) {
    hideTooltip();
  }
});

// --- Fullscreen Toggle ---
fullscreenBtn.addEventListener('click', () => {
  const wrapper = document.getElementById('visualisation-wrapper');
  
  if (!document.fullscreenElement &&
      !document.mozFullScreenElement && 
      !document.webkitFullscreenElement && 
      !document.msFullscreenElement) {
    
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
               document.msFullScreenElement;
  
  if (isFS) {
    fullscreenBtn.classList.add('in-fullscreen');
    fullscreenBtn.title = "Exit Full Screen";
  } else {
    fullscreenBtn.classList.remove('in-fullscreen');
    fullscreenBtn.title = "Toggle Full Screen";
  }
  setTimeout(drawLines, 100);
}

// --- Initialize App ---
init();
