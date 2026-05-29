# Infrastructure Tech Stack

An interactive, premium visualization mapping the infrastructure tech stack of generative AI applications. The application features layer-based technology categorization, responsive grids, dynamic workflow connection paths, and high-contrast interactive tooltip overlays.

## Table of Contents
1. [How It Works](#how-it-works)
2. [Local Development](#local-development)
3. [Modifying the Diagram](#modifying-the-diagram)
4. [Deployment & Hosting](#deployment--hosting)
5. [Embedding the Visualisation](#embedding-the-visualisation)

---

## How It Works

This project is built using a decoupled architecture of a simple Node.js backend and a dynamic client-side frontend:

*   **Backend (`server.js`)**: An Express server that acts as a parser and static asset provider. It reads and parses `public/data.csv` supporting multi-line quotes, and exposes the parsed JSON data at `/api/data`.
*   **Frontend (`public/`)**:
    *   [index.html](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Infrastructures%20Visualisation/public/index.html) - Structural framework containing the title, layout containers, and full-screen toggle viewport.
    *   [main.js](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Infrastructures%20Visualisation/public/main.js) - Fetches the dataset files directly, structures the layers dynamically, draws SVG connection lines between nodes representing active scenario workflows, and handles interactive click/hover tooltips.
    *   [style.css](file:///Users/yatharth/Documents/Development/Tattle/Boom%20Visualisations/Infrastructures%20Visualisation/public/style.css) - Contains layout rules, color variables, typography tokens, hover states (including parent-hover sibling fading with `:has()`), and media query parameters.

---

## Local Development

To run the application locally on your computer:

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Start the development server**:
    ```bash
    npm start
    ```
3.  **Open the application**:
    Navigate to `http://localhost:3000` in your web browser.

---

## Modifying the Diagram

All data is dynamically loaded from CSV files in the `public/` folder. You can modify these files to change layer configurations, add/remove technology nodes, or set up new scenario paths.

### 1. Stack Nodes (`data.csv`)
Defines the individual tech stack components. Columns:
*   `NodeID`: Unique key of the node (e.g. `civitai`, `flux`).
*   `NodeName`: The display title of the node card (e.g. `CivitAI`, `Flux`).
*   `Icon`: Path to the image asset (e.g. `assets/civit_ai.svg`).
*   `LayerID`: Identifies the category row (e.g. `discovery`, `gui`, `model_access`, `ml_models`, `datasets`).
*   `LayerName`: Header name for the layer row.
*   `LayerOrder`: Vertical placement ordering of the row (1 to 5).
*   `Description`: Description text displayed inside the hover/click tooltip.

### 2. Scenario Workflows (`workflows.csv`)
Configures the interactive scenario selector. Columns:
*   `WorkflowID`: Unique key of the scenario (e.g. `scenario_clothoff`).
*   `WorkflowName`: Label text of the scenario in the dropdown.
*   `WorkflowColor`: Accent hex color for active path outline and connection lines (e.g. `#BC0000`).
*   `Description`: Narrative description of the scenario.
*   `NodeIDs`: Semicolon-separated path of `NodeID` keys in sequence (e.g. `x_grok;rest_api;grok`).

---

## Deployment & Hosting

### 1. Static Hosting (Netlify / Vercel / GitHub Pages / Cloudflare Pages)
Because the application runs client-side and fetches the static data files, you can deploy the `public` directory directly to any static web host. Hook the repository up to your preferred hosting platform and point the build directory to the `public/` folder.

### 2. Node.js Hosting (Heroku / Render / Railway)
To deploy the backend server:
*   Make sure to configure the start script as `npm start`.
*   The application automatically binds to the `process.env.PORT` variable provided by the host environment.

---

## Embedding the Visualisation

You can seamlessly embed this tech stack diagram into any external article, blog post, or webpage using the following responsive `<iframe>` code template:

```html
<iframe 
  src="https://boom-infrastructures-visualisation.yatharthswebsite.workers.dev/" 
  style="width: 100%; height: 900px; border: none; padding: 0; display: block;" 
  allow="fullscreen" 
  allowfullscreen 
  title="Infrastructure Visualisation">
</iframe>
```
