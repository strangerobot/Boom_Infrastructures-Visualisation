const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const assetsDir = path.join(publicDir, 'assets');

// 1. Load all assets as Base64 Data URIs
const assetMap = {};
const assetFiles = fs.readdirSync(assetsDir);

assetFiles.forEach(file => {
  const filePath = path.join(assetsDir, file);
  if (fs.statSync(filePath).isFile()) {
    const ext = path.extname(file).toLowerCase();
    const content = fs.readFileSync(filePath);
    const base64 = content.toString('base64');
    let mimeType = 'image/png';
    if (ext === '.svg') {
      mimeType = 'image/svg+xml';
    }
    const key = `assets/${file}`;
    assetMap[key] = `data:${mimeType};base64,${base64}`;
  }
});

// 2. Load CSV files as strings
const dataCsv = fs.readFileSync(path.join(publicDir, 'data.csv'), 'utf8');
const workflowsCsv = fs.readFileSync(path.join(publicDir, 'workflows.csv'), 'utf8');

// 3. Load CSS
const cssContent = fs.readFileSync(path.join(publicDir, 'style.css'), 'utf8');

// 4. Load & patch JS
let jsContent = fs.readFileSync(path.join(publicDir, 'main.js'), 'utf8');

// Replace the init() function or CSV loading logic with the inlined variables
// We'll insert nodesCsv and workflowsCsv at the top of the script
const csvDeclarations = `
const nodesCsv = ${JSON.stringify(dataCsv)};
const workflowsCsv = ${JSON.stringify(workflowsCsv)};
const ASSET_MAP = ${JSON.stringify(assetMap)};
`;

jsContent = csvDeclarations + '\n' + jsContent;

// Replace main.js logic to use local strings instead of fetching
const targetFetchBlock = `    const nodesRes = await fetch('data.csv');
    const nodesCsv = await nodesRes.text();
    nodesData = parseNodesCSV(nodesCsv);

    const workflowsRes = await fetch('workflows.csv');
    const workflowsCsv = await workflowsRes.text();
    workflowsData = parseWorkflowsCSV(workflowsCsv);`;

const replacementFetchBlock = `    nodesData = parseNodesCSV(nodesCsv);
    workflowsData = parseWorkflowsCSV(workflowsCsv);`;

if (!jsContent.includes(targetFetchBlock)) {
  console.error("Warning: target fetch block not found exactly in main.js. Please verify replacement.");
} else {
  jsContent = jsContent.replace(targetFetchBlock, replacementFetchBlock);
}

// Modify node creation to translate icon URL to Base64 in ASSET_MAP
const targetIconBlock = `  if (node.icon && node.icon !== 'none') {
    const img = document.createElement('img');
    img.src = node.icon;
    img.alt = node.name;
    iconWrapper.appendChild(img);
  }`;

const replacementIconBlock = `  if (node.icon && node.icon !== 'none') {
    const img = document.createElement('img');
    img.src = ASSET_MAP[node.icon] || node.icon;
    img.alt = node.name;
    iconWrapper.appendChild(img);
  }`;

if (!jsContent.includes(targetIconBlock)) {
  console.error("Warning: target icon block not found exactly in main.js. Please verify replacement.");
} else {
  jsContent = jsContent.replace(targetIconBlock, replacementIconBlock);
}

// 5. Load and compile HTML
let htmlContent = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

// Replace favicon link, full screen button, and infra-header logos with Base64 in HTML
Object.keys(assetMap).forEach(assetKey => {
  // Replace references like src="assets/foo.png" or href="assets/foo.svg"
  const regexSrc = new RegExp(`src="${assetKey}"`, 'g');
  const regexHref = new RegExp(`href="${assetKey}"`, 'g');
  htmlContent = htmlContent.replace(regexSrc, `src="${assetMap[assetKey]}"`);
  htmlContent = htmlContent.replace(regexHref, `href="${assetMap[assetKey]}"`);
});

// Inline CSS
const cssTagPattern = `<link rel="stylesheet" href="style.css">`;
const inlineCssTag = `<style>${cssContent}</style>`;
htmlContent = htmlContent.replace(cssTagPattern, inlineCssTag);

// Inline JS
const jsTagPattern = `<script src="main.js"></script>`;
const inlineJsTag = `<script>${jsContent}</script>`;
htmlContent = htmlContent.replace(jsTagPattern, inlineJsTag);

// Write to package.html
const outputFilePath = path.join(__dirname, 'package.html');
fs.writeFileSync(outputFilePath, htmlContent, 'utf8');
console.log(`Successfully compiled self-contained HTML file: ${outputFilePath}`);
