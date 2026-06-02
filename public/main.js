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
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Populate workflow selection dropdown
function populateDropdown() {
  workflowDropdownList.innerHTML = '';

  workflowsData.forEach(flow => {
    const opt = document.createElement('div');
    opt.className = 'workflow-option-item';
    opt.dataset.value = flow.id;
    opt.textContent = flow.name;
    opt.style.setProperty('--workflow-hover-color', flow.color);
    opt.style.setProperty('--workflow-item-color', flow.color);
    opt.style.setProperty('--workflow-hover-bg', hexToRgbA(flow.color, 0.1));

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
    const hasDatasetInFlow = flow && flow.nodeIds.some(id => {
      const node = nodesData.find(n => n.id === id);
      return node && node.layerId === 'datasets';
    });
    
    const isClothoffFlow = flow && flow.id === 'scenario_clothoff';

    const allNodeEls = document.querySelectorAll('.node');
    allNodeEls.forEach(el => {
      const nodeId = el.dataset.nodeId;
      const node = nodesData.find(n => n.id === nodeId);
      const isDatasetNode = node && node.layerId === 'datasets';
      const isMlModelNode = node && node.layerId === 'ml_models';
      
      const shouldHighlight = flow && (
        flow.nodeIds.includes(nodeId) || 
        (isDatasetNode && hasDatasetInFlow) ||
        (isMlModelNode && isClothoffFlow)
      );
      
      if (shouldHighlight) {
        el.classList.add('active-path-node');
      } else {
        el.classList.remove('active-path-node');
      }
    });

    // Highlight outline of datasets layer if active
    const datasetsLayerEl = document.querySelector('.layer-row[data-layer-id="datasets"] .layer-container');
    if (datasetsLayerEl) {
      if (hasDatasetInFlow) {
        datasetsLayerEl.classList.add('active-layer-highlight');
        datasetsLayerEl.style.setProperty('--layer-active-color', flow.color);
      } else {
        datasetsLayerEl.classList.remove('active-layer-highlight');
        datasetsLayerEl.style.removeProperty('--layer-active-color');
      }
    }

    // Highlight outline of ml_models layer if active (specifically for ClothOff scenario)
    const mlModelsLayerEl = document.querySelector('.layer-row[data-layer-id="ml_models"] .layer-container');
    if (mlModelsLayerEl) {
      if (isClothoffFlow) {
        mlModelsLayerEl.classList.add('active-layer-highlight');
        mlModelsLayerEl.style.setProperty('--layer-active-color', flow.color);
      } else {
        mlModelsLayerEl.classList.remove('active-layer-highlight');
        mlModelsLayerEl.style.removeProperty('--layer-active-color');
      }
    }

  } else {
    workflowSelectedText.textContent = 'Choose a scenario to explore';

    // Return to neutral unselected state
    canvasContainer.classList.remove('workflow-active');
    stackWrapper.classList.remove('active-state');
    
    const allNodeEls = document.querySelectorAll('.node');
    allNodeEls.forEach(el => {
      el.classList.remove('active-path-node');
    });

    const datasetsLayerEl = document.querySelector('.layer-row[data-layer-id="datasets"] .layer-container');
    if (datasetsLayerEl) {
      datasetsLayerEl.classList.remove('active-layer-highlight');
      datasetsLayerEl.style.removeProperty('--layer-active-color');
    }

    const mlModelsLayerEl = document.querySelector('.layer-row[data-layer-id="ml_models"] .layer-container');
    if (mlModelsLayerEl) {
      mlModelsLayerEl.classList.remove('active-layer-highlight');
      mlModelsLayerEl.style.removeProperty('--layer-active-color');
    }
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

  el.appendChild(iconWrapper);
  el.appendChild(label);

  if (hasTooltip && node.description) {
    el.addEventListener('mouseenter', () => {
      showTooltip(node, el, false);
    });
    el.addEventListener('mouseleave', () => {
      if (!nodeTooltip.dataset.pinned) hideTooltip();
    });
    el.addEventListener('click', (e) => {
      e.stopPropagation();
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
                     node.layerId === 'model_access' ? 'Interfaces through which more technical users can access models and build on top of AI models. Providers might also support model downloads, gamification and monetisation features.' :
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
      containerEl.classList.add('solid-border');
    }
    
    layer.nodes.forEach(node => {
      const nodeEl = createNodeEl(node, true); // all layers get tooltip
      containerEl.appendChild(nodeEl);
    });

    // Add "more" three-dot icon at the right end of each layer
    const moreEl = document.createElement('div');
    moreEl.className = 'layer-more-dots';
    moreEl.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="5" cy="12" r="2" fill="currentColor"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
        <circle cx="19" cy="12" r="2" fill="currentColor"/>
      </svg>
    `;
    containerEl.appendChild(moreEl);
    
    rowEl.appendChild(textboxEl);
    rowEl.appendChild(containerEl);
    
    stackWrapper.appendChild(rowEl);
  });
}

// Helper to create an animated SVG dashed line
function createSvgLine(x1, y1, x2, y2, strokeColor, svg) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1);
  line.setAttribute('y1', y1);
  line.setAttribute('x2', x2);
  line.setAttribute('y2', y2);
  line.setAttribute('stroke', strokeColor);
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

// --- Draw SVG connections ---
function drawLines() {
  const svg = document.getElementById('connections-svg');
  if (!svg) return;
  svg.innerHTML = '';
  
  if (!selectedWorkflowId) return;
  
  const canvasRect = canvas.getBoundingClientRect();
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

    // Segment active nodes by layer type for routing
    const baseNodes = flow.nodeIds.filter(id => {
      const node = nodesData.find(n => n.id === id);
      return node && node.layerId !== 'ml_models' && node.layerId !== 'datasets';
    });
    
    const mlNodes = flow.nodeIds.filter(id => {
      const node = nodesData.find(n => n.id === id);
      return node && node.layerId === 'ml_models';
    });
    
    const datasetNodes = flow.nodeIds.filter(id => {
      const node = nodesData.find(n => n.id === id);
      return node && node.layerId === 'datasets';
    });
    
    // 1. Connect base nodes sequentially (Discovery -> GUI -> Model Access)
    for (let i = 0; i < baseNodes.length - 1; i++) {
      const fromId = baseNodes[i];
      const toId = baseNodes[i + 1];
      const p1 = centers[fromId];
      const p2 = centers[toId];
      if (p1 && p2) {
        createSvgLine(p1.x, p1.y, p2.x, p2.y, flow.color, svg);
      }
    }
    
    // 2. Connect the last base node to all active ML model nodes (handles branching)
    if (baseNodes.length > 0 && mlNodes.length > 0) {
      const lastBaseId = baseNodes[baseNodes.length - 1];
      const pLastBase = centers[lastBaseId];
      if (pLastBase) {
        mlNodes.forEach(mlId => {
          const pMl = centers[mlId];
          if (pMl) {
            createSvgLine(pLastBase.x, pLastBase.y, pMl.x, pMl.y, flow.color, svg);
          }
        });
      }
    }
    
    // 3. Connect all active ML model nodes straight down to the datasets layer top border
    if (mlNodes.length > 0 && datasetNodes.length > 0) {
      const datasetsLayerContainer = document.querySelector('.layer-row[data-layer-id="datasets"] .layer-container');
      if (datasetsLayerContainer) {
        const containerRect = datasetsLayerContainer.getBoundingClientRect();
        const topY = containerRect.top - canvasRect.top;
        
        mlNodes.forEach(mlId => {
          const pMl = centers[mlId];
          if (pMl) {
            createSvgLine(pMl.x, pMl.y, pMl.x, topY, flow.color, svg);
          }
        });
      }
    }
    // Fallback: If there are no ML nodes, connect last base node straight to Datasets layer top
    else if (baseNodes.length > 0 && datasetNodes.length > 0) {
      const lastBaseId = baseNodes[baseNodes.length - 1];
      const pLastBase = centers[lastBaseId];
      
      const datasetsLayerContainer = document.querySelector('.layer-row[data-layer-id="datasets"] .layer-container');
      if (pLastBase && datasetsLayerContainer) {
        const containerRect = datasetsLayerContainer.getBoundingClientRect();
        const topY = containerRect.top - canvasRect.top;
        createSvgLine(pLastBase.x, pLastBase.y, pLastBase.x, topY, flow.color, svg);
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
