// --- Application State ---
const Y_STEP = 3.0;
let levelId = "04";
let levelName = "Sky Ruins";
let gridWidth = 100;
let gridHeight = 15;
let grid = []; // 2D array: grid[c][r] where c is column (X), r is visual row (Y-inverted)
let currentTool = "paint"; // "paint" | "erase"
let selectedElement = "#"; // Current painting character symbol
let isDrawing = false;
let zoomLevel = 1.0;
let showGridlines = true;
let activeTab = "tab-ascii";

// --- Elements Catalog ---
const ELEMENTS = [
    { symbol: "#", name: "Grass Platform", class: "platform", desc: "Basic solid block (CSGBox3D)", color: "var(--color-platform)" },
    { symbol: "/", name: "Ramp Up", class: "ramp-up", desc: "Solid diagonal ramp rising right", color: "var(--color-slope)" },
    { symbol: "\\", name: "Ramp Down", class: "ramp-down", desc: "Solid diagonal ramp falling right", color: "var(--color-slope)" },
    { symbol: "o", name: "Ring", class: "ring", desc: "Collectible item for points/lives", color: "var(--color-ring)" },
    { symbol: "V", name: "Vertical Spring", class: "spring-v", desc: "High vertical launch (LaunchForce: 22)", color: "var(--color-spring-v)" },
    { symbol: "F", name: "Diagonal Spring", class: "spring-d", desc: "Forward diagonal launch (LaunchForce: 25)", color: "var(--color-spring-d)" },
    { symbol: "D", name: "Booster (Dash)", class: "dash", desc: "Boosts player forward into roll state", color: "var(--color-dash)" },
    { symbol: "E", name: "Robot Enemy", class: "enemy", desc: "Standard patrolling enemy (Speed: 3)", color: "var(--color-enemy)" },
    { symbol: "C", name: "Cactus Enemy", class: "cactus", desc: "Patrolling cactus (Speed: 1.25)", color: "var(--color-cactus)" },
    { symbol: "S", name: "Spikes", class: "spikes", desc: "Ground spikes that cause damage", color: "var(--color-spikes)" },
    { symbol: "P", name: "Player Spawn", class: "spawn", desc: "Player starting point (Z:0, Y: Spawn + 0.5)", color: "var(--color-spawn)" },
    { symbol: "G", name: "Goal Coin", class: "goal", desc: "Giant spinning coin that finishes the stage", color: "var(--color-goal)" }
];

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    initPalette();
    initGrid(gridWidth, gridHeight);
    
    // Config events
    document.getElementById("level-id").addEventListener("input", (e) => {
        levelId = e.target.value;
        updateDynamicTexts();
        generateExports();
    });
    
    document.getElementById("level-name").addEventListener("input", (e) => {
        levelName = e.target.value;
        generateExports();
    });

    document.getElementById("grid-width").addEventListener("change", (e) => {
        let val = parseInt(e.target.value);
        if (val >= 10 && val <= 1000) gridWidth = val;
    });

    document.getElementById("grid-height").addEventListener("change", (e) => {
        let val = parseInt(e.target.value);
        if (val >= 5 && val <= 100) gridHeight = val;
    });

    // Mouse up handler to stop painting
    window.addEventListener("mouseup", () => {
        if (isDrawing) {
            isDrawing = false;
            generateExports();
        }
    });

    // Connect horizontal navigation slider
    const container = document.getElementById("grid-container");
    const slider = document.getElementById("scroll-slider");
    
    container.addEventListener("scroll", () => {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll > 0) {
            slider.value = (container.scrollLeft / maxScroll) * 100;
        }
    });

    slider.addEventListener("input", (e) => {
        const maxScroll = container.scrollWidth - container.clientWidth;
        container.scrollLeft = (e.target.value / 100) * maxScroll;
    });

    // Keyboard shortcuts (ignore while typing in inputs)
    window.addEventListener("keydown", (e) => {
        const tag = (e.target.tagName || "").toLowerCase();
        const typing = tag === "input" || tag === "textarea";
        if (e.key === "Escape") {
            const settings = document.getElementById("settings-modal");
            const maps = document.getElementById("maps-modal");
            if (settings && !settings.hidden) closeSettings();
            else if (maps && !maps.hidden) closeMaps();
            else setDrawer(false);
            return;
        }
        if (e.key === "F5") {
            e.preventDefault(); // do not reload the page
            testLevel();
            return;
        }
        if (typing) return;
        if (e.key === "b" || e.key === "B") setToolMode("paint");
        else if (e.key === "e" || e.key === "E") setToolMode("erase");
    });

    // Initial setups
    updateDynamicTexts();
    generateExports();
    loadGodotConfig();
});

// --- UI Construction ---

function initPalette() {
    const paletteList = document.getElementById("palette-list");
    paletteList.innerHTML = "";

    ELEMENTS.forEach((el) => {
        const glyph = el.symbol === "\\" ? "\\" : el.symbol;
        const item = document.createElement("button");
        item.className = "palette-chip" + (selectedElement === el.symbol ? " active" : "");
        item.dataset.tip = `${el.name}  ·  '${glyph}'`;
        item.title = el.desc;
        item.onclick = () => selectElement(el.symbol, item);

        item.innerHTML = `
            <div class="palette-swatch"><img src="icons/${el.class}.svg" alt="${el.name}" draggable="false"></div>
            <span class="palette-key">${el.name.split(" ")[0]}</span>
        `;
        paletteList.appendChild(item);
    });
}

function initGrid(width, height) {
    gridWidth = width;
    gridHeight = height;
    
    // Initialize state grid matrix (width x height) filled with spaces
    grid = [];
    for (let c = 0; c < gridWidth; c++) {
        grid[c] = [];
        for (let r = 0; r < gridHeight; r++) {
            grid[c][r] = " ";
        }
    }
    
    // Set some defaults (e.g. Player Spawn at col 2, platform at bottom)
    grid[2][gridHeight - 2] = "P";
    for (let c = 0; c < 10; c++) {
        grid[c][gridHeight - 1] = "#";
    }
    
    renderGrid();
}

function renderGrid() {
    const mapGrid = document.getElementById("map-grid");
    mapGrid.innerHTML = "";
    
    // Set grid css template columns
    mapGrid.style.gridTemplateColumns = `repeat(${gridWidth}, var(--grid-cell-size))`;
    mapGrid.style.gridTemplateRows = `repeat(${gridHeight}, var(--grid-cell-size))`;
    
    // We render grid row-by-row, top to bottom.
    // In our 2D array: grid[col][row].
    // row 0 in HTML corresponds to the top line of text, which is coordinate Y = gridHeight - 1.
    // row gridHeight - 1 in HTML corresponds to bottom line of text, which is coordinate Y = 0.
    for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
            const char = grid[c][r];
            const cell = document.createElement("div");
            cell.className = "grid-cell " + getCellClass(char);
            cell.dataset.col = c;
            cell.dataset.row = r;
            
            // Set cell text content for some elements to look clear
            if (char === "#" || char === "/" || char === "\\") {
                cell.innerText = ""; // Shapes handle this in CSS
            } else {
                cell.innerText = (char === " " ? "" : char);
            }
            
            // Grid interaction events
            cell.addEventListener("mousedown", (e) => {
                e.preventDefault();
                isDrawing = true;
                applyTool(c, r);
            });
            
            cell.addEventListener("mouseenter", () => {
                updateCoordinatesDisplay(c, r);
                if (isDrawing) {
                    applyTool(c, r);
                }
            });
            
            mapGrid.appendChild(cell);
        }
    }
    
    // Trigger Lucide refreshes if we have nested SVG elements (not needed now since we draw shapes using CSS for speed)
    applyZoom();
}

function getCellClass(char) {
    if (char === " ") return "empty";
    const found = ELEMENTS.find(el => el.symbol === char);
    return found ? found.class : "empty";
}

// --- Grid Interactions ---

function applyTool(c, r) {
    const cell = document.querySelector(`.grid-cell[data-col="${c}"][data-row="${r}"]`);
    if (!cell) return;
    
    if (currentTool === "paint") {
        // Enforce single spawn point restriction if P is painted
        if (selectedElement === "P") {
            // Remove previous spawn point
            for (let tc = 0; tc < gridWidth; tc++) {
                for (let tr = 0; tr < gridHeight; tr++) {
                    if (grid[tc][tr] === "P") {
                        grid[tc][tr] = " ";
                        const prevCell = document.querySelector(`.grid-cell[data-col="${tc}"][data-row="${tr}"]`);
                        if (prevCell) {
                            prevCell.className = "grid-cell empty";
                            prevCell.innerText = "";
                        }
                    }
                }
            }
        }
        
        grid[c][r] = selectedElement;
        cell.className = "grid-cell " + getCellClass(selectedElement);
        cell.innerText = (selectedElement === "#" || selectedElement === "/" || selectedElement === "\\" ? "" : selectedElement);
    } else if (currentTool === "erase") {
        grid[c][r] = " ";
        cell.className = "grid-cell empty";
        cell.innerText = "";
    }
}

// Selects active palette element
function selectElement(symbol, elementBtn) {
    selectedElement = symbol;
    currentTool = "paint";
    
    // Update active UI classes
    document.querySelectorAll(".palette-chip").forEach(item => item.classList.remove("active"));
    if (elementBtn) {
        elementBtn.classList.add("active");
    }
    
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("tool-paint").classList.add("active");
}

function setToolMode(mode) {
    currentTool = mode;
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    
    if (mode === "paint") {
        document.getElementById("tool-paint").classList.add("active");
    } else if (mode === "erase") {
        document.getElementById("tool-erase").classList.add("active");
    }
}

function clearGrid() {
    if (confirm("Are you sure you want to clear the entire grid? All unsaved data will be lost.")) {
        for (let c = 0; c < gridWidth; c++) {
            for (let r = 0; r < gridHeight; r++) {
                grid[c][r] = " ";
            }
        }
        renderGrid();
        generateExports();
        showToast("Grid cleared successfully!", "trash-2");
    }
}

function changeGridSize(type, delta) {
    if (type === "width") {
        const input = document.getElementById("grid-width");
        let val = parseInt(input.value) + delta;
        val = Math.max(10, Math.min(1000, val));
        input.value = val;
        gridWidth = val;
    } else if (type === "height") {
        const input = document.getElementById("grid-height");
        let val = parseInt(input.value) + delta;
        val = Math.max(5, Math.min(100, val));
        input.value = val;
        gridHeight = val;
    }
}

function rebuildGrid() {
    // Rebuild grid keeping existing content if possible
    const oldWidth = gridWidth;
    const oldHeight = gridHeight;
    const oldGrid = JSON.parse(JSON.stringify(grid));
    
    // Read current inputs
    gridWidth = parseInt(document.getElementById("grid-width").value) || 100;
    gridHeight = parseInt(document.getElementById("grid-height").value) || 15;
    
    // Initialize new matrix
    grid = [];
    for (let c = 0; c < gridWidth; c++) {
        grid[c] = [];
        for (let r = 0; r < gridHeight; r++) {
            // Calculate offsets to keep bottom-left aligned
            const oldR = r - (gridHeight - oldHeight);
            if (c < oldWidth && oldR >= 0 && oldR < oldHeight) {
                grid[c][r] = oldGrid[c][oldR];
            } else {
                grid[c][r] = " ";
            }
        }
    }
    
    renderGrid();
    generateExports();
    showToast(`Grid resized to ${gridWidth}x${gridHeight}`, "grid");
}

// --- Viewport Zoom & Gridlines Control ---

function adjustZoom(delta, reset = false) {
    if (reset) {
        zoomLevel = 1.0;
    } else {
        zoomLevel = Math.max(0.4, Math.min(2.0, zoomLevel + delta));
    }
    
    document.getElementById("zoom-label").innerText = `${Math.round(zoomLevel * 100)}%`;
    applyZoom();
}

function applyZoom() {
    const mapGrid = document.getElementById("map-grid");
    if (mapGrid) {
        mapGrid.style.transform = `scale(${zoomLevel})`;
    }
}

function toggleGridlines() {
    showGridlines = !showGridlines;
    const mapGrid = document.getElementById("map-grid");
    const btn = document.getElementById("btn-toggle-grid");
    
    if (showGridlines) {
        mapGrid.classList.remove("no-gridlines");
        btn.classList.add("active");
    } else {
        mapGrid.classList.add("no-gridlines");
        btn.classList.remove("active");
    }
}

function updateCoordinatesDisplay(c, r) {
    // Col c represents X coord: c * 2.0
    // Visual row r represents Y coord: (gridHeight - 1 - r) * Y_STEP
    const xCoord = (c * 2.0).toFixed(1);
    const yCoord = ((gridHeight - 1 - r) * Y_STEP).toFixed(1);
    
    document.getElementById("coord-display").innerText =
        `Col ${c}, Row ${r}  ·  X: ${xCoord}m  Y: ${yCoord}m`;
}

// --- Exporters (ASCII & JSON) ---

function generateExports() {
    generateASCIIExport();
    generateJSONExport();
}

function generateASCIIExport() {
    let output = "";
    output += `level: ${levelId}\n`;
    output += `name: ${levelName}\n`;
    // Emit ystep so convert_map.py parses rows at the same scale the editor draws
    // them (Y_STEP). Without this, the converter falls back to its default and the
    // map comes out vertically compressed.
    output += `ystep: ${Y_STEP.toFixed(1)}\n\n`;
    output += `[grid]\n`;
    
    // We output line-by-line from row r = 0 to gridHeight - 1
    for (let r = 0; r < gridHeight; r++) {
        let line = "";
        for (let c = 0; c < gridWidth; c++) {
            line += grid[c][r];
        }
        // Trim right spaces to save file size, except we keep width consistency in parser usually, but trim is fine
        // Actually, convert_map.py uses W = max(len(line) for line in grid_lines) and pads them. So right trim is safe.
        output += line.trimEnd() + "\n";
    }
    
    document.getElementById("ascii-output").value = output;
}

function generateJSONExport() {
    // Prepare structures
    let spawn = [0.0, 1.5];
    let platforms = [];
    let ramps_up = [];
    let ramps_down = [];
    let rings = [];
    let springs_vert = [];
    let springs_diag = [];
    let dash_pads = [];
    let enemies = [];
    let cactus_enemies = [];
    let spikes = [];
    let goals = [];
    
    // Scanners and mergers
    let visitedHashes = new Set();
    let visitedRampsUp = new Set();
    let visitedRampsDown = new Set();
    
    // Helper check cell
    function getCell(c, r) {
        if (c < 0 || c >= gridWidth || r < 0 || r >= gridHeight) return " ";
        return grid[c][r];
    }
    
    // 1. Merge Platforms '#'
    for (let r = 0; r < gridHeight; r++) {
        const yCoord = (gridHeight - 1 - r) * Y_STEP;
        let c = 0;
        while (c < gridWidth) {
            if (getCell(c, r) === "#" && !visitedHashes.has(`${c},${r}`)) {
                let cStart = c;
                while (c < gridWidth && getCell(c, r) === "#") {
                    visitedHashes.add(`${c},${r}`);
                    c++;
                }
                let cEnd = c - 1;
                
                let width = (cEnd - cStart + 1) * 2.0;
                let x = ((cStart + cEnd) / 2.0) * 2.0;
                
                // Detect if floating (r < gridHeight - 1 and no solid block below it visually)
                // Note: visually, r = gridHeight - 1 is the bottom row.
                // Visually, the row below r is r + 1.
                let isFloating = r < gridHeight - 1;
                if (isFloating) {
                    for (let col = cStart; col <= cEnd; col++) {
                        let charBelow = getCell(col, r + 1);
                        if (charBelow === "#" || charBelow === "/" || charBelow === "\\") {
                            isFloating = false;
                            break;
                        }
                    }
                }
                
                platforms.push({
                    x: parseFloat(x.toFixed(2)),
                    y: parseFloat(yCoord.toFixed(2)),
                    width: parseFloat(width.toFixed(2)),
                    rock_height: isFloating ? 1.0 : 4.0
                });
            } else {
                c++;
            }
        }
    }
    
    // 2. Merge Ramps Up '/' (visually moving up-right diagonal chain: col index increases, visual row index decreases)
    for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
            if (getCell(c, r) === "/" && !visitedRampsUp.has(`${c},${r}`)) {
                let chain = [[c, r]];
                visitedRampsUp.add(`${c},${r}`);
                let currC = c;
                let currR = r;
                
                // Visual diagonal up-right: c+1, r-1
                while (getCell(currC + 1, currR - 1) === "/") {
                    currC++;
                    currR--;
                    chain.push([currC, currR]);
                    visitedRampsUp.add(`${currC},${currR}`);
                }
                
                let [cStart, rStart] = chain[0]; // Bottom-left visually
                let [cEnd, rEnd] = chain[chain.length - 1]; // Top-right visually
                
                let width = (cEnd - cStart + 1) * 2.0;
                let height = (rStart - rEnd + 1) * Y_STEP;
                let start_x = cStart * 2.0 - 1.0;
                let start_y = (gridHeight - 1 - rStart) * Y_STEP - Y_STEP + 0.5;
                
                ramps_up.push({
                    x: parseFloat(start_x.toFixed(2)),
                    y: parseFloat(start_y.toFixed(2)),
                    width: parseFloat(width.toFixed(2)),
                    height: parseFloat(height.toFixed(2))
                });
            }
        }
    }

    // 3. Merge Ramps Down '\' (visually moving down-right diagonal chain: col index increases, visual row index increases)
    for (let r = gridHeight - 1; r >= 0; r--) {
        for (let c = 0; c < gridWidth; c++) {
            if (getCell(c, r) === "\\" && !visitedRampsDown.has(`${c},${r}`)) {
                let chain = [[c, r]];
                visitedRampsDown.add(`${c},${r}`);
                let currC = c;
                let currR = r;
                
                // Visual diagonal down-right: c+1, r+1
                while (getCell(currC + 1, currR + 1) === "\\") {
                    currC++;
                    currR++;
                    chain.push([currC, currR]);
                    visitedRampsDown.add(`${currC},${currR}`);
                }
                
                let [cStart, rStart] = chain[0]; // Top-left visually
                let [cEnd, rEnd] = chain[chain.length - 1]; // Bottom-right visually
                
                let width = (cEnd - cStart + 1) * 2.0;
                let height = (rEnd - rStart + 1) * Y_STEP;
                let start_x = cStart * 2.0 - 1.0;
                let start_y = (gridHeight - 1 - rStart) * Y_STEP + 0.5;
                
                ramps_down.push({
                    x: parseFloat(start_x.toFixed(2)),
                    y: parseFloat(start_y.toFixed(2)),
                    width: parseFloat(width.toFixed(2)),
                    height: parseFloat(height.toFixed(2))
                });
            }
        }
    }

    // 4. Parse Items
    for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
            const char = grid[c][r];
            const xCoord = c * 2.0;
            
            if (char === "o") {
                rings.push([parseFloat(xCoord.toFixed(2)), parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 1.2).toFixed(2))]);
            } else if (char === "V") {
                springs_vert.push({ x: parseFloat(xCoord.toFixed(2)), y: parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 0.5).toFixed(2)), force: 22.0 });
            } else if (char === "F") {
                springs_diag.push({ 
                    x: parseFloat(xCoord.toFixed(2)), 
                    y: parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 0.5).toFixed(2)), 
                    force: 25.0, 
                    dx: 1.2, 
                    dy: 1.5, 
                    lock: 0.6 
                });
            } else if (char === "D") {
                dash_pads.push([parseFloat(xCoord.toFixed(2)), parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 0.5).toFixed(2))]);
            } else if (char === "E") {
                enemies.push({ x: parseFloat(xCoord.toFixed(2)), y: parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 1.0).toFixed(2)), speed: 3.0 });
            } else if (char === "C") {
                cactus_enemies.push({ x: parseFloat(xCoord.toFixed(2)), y: parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 1.0).toFixed(2)), speed: 1.25 });
            } else if (char === "S") {
                spikes.push([parseFloat(xCoord.toFixed(2)), parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 0.5).toFixed(2))]);
            } else if (char === "P") {
                spawn = [parseFloat(xCoord.toFixed(2)), parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 1.5).toFixed(2))];
            } else if (char === "G") {
                goals.push([parseFloat(xCoord.toFixed(2)), parseFloat(((gridHeight - 1 - r - 1) * Y_STEP + 2.0).toFixed(2))]);
            }
        }
    }
    
    const jsonObj = {
        level: levelId,
        name: levelName,
        spawn: spawn,
        platforms: platforms,
        ramps_up: ramps_up,
        ramps_down: ramps_down,
        rings: rings,
        springs_vert: springs_vert,
        springs_diag: springs_diag,
        dash_pads: dash_pads,
        enemies: enemies,
        cactus_enemies: cactus_enemies,
        spikes: spikes,
        goals: goals
    };
    
    document.getElementById("json-output").value = JSON.stringify(jsonObj, null, 2);
}

// --- Dynamic Text Updates ---

function updateDynamicTexts() {
    // Update IDs inside compiling guide tab
    document.querySelectorAll(".dynamic-level-id").forEach(el => el.innerText = levelId);
    
    const compileCmd = `python scripts/convert_map.py --input ../tools/map_editor/levels/level_${levelId}_map.txt --level ${levelId}`;
    document.getElementById("compile-command").innerText = compileCmd;
}

// --- Import / Load Map Functionality ---

function importMap() {
    const text = document.getElementById("import-input").value.trim();
    if (!text) {
        alert("Paste the map code to import!");
        return;
    }
    
    try {
        if (text.startsWith("{")) {
            // JSON Import
            const data = JSON.parse(text);
            importJSON(data);
        } else {
            // ASCII Import
            importASCII(text);
        }
    } catch (e) {
        alert("Error importing map. Make sure the text format is correct.\nError: " + e.message);
    }
}

function importJSON(data) {
    levelId = data.level || "03";
    levelName = data.name || "Imported Level";
    
    document.getElementById("level-id").value = levelId;
    document.getElementById("level-name").value = levelName;
    
    // Find limits to establish canvas size
    let maxX = 50; // default min width
    let maxY = 12; // default min height
    
    // Detect import Y_STEP automatically
    let import_Y_STEP = 4.0;
    if (data.level === "01" || (data.platforms && data.platforms.some(p => p.y % 4 !== 0))) {
        import_Y_STEP = 1.0;
    }
    
    // Scan coordinates to set grid size
    const checkCoords = (x, y) => {
        const c = Math.round(x / 2.0);
        const r = Math.round(y / import_Y_STEP);
        if (c > maxX) maxX = c;
        if (r > maxY) maxY = r;
    };
    
    // Adjust y coordinates scan helper
    if (data.spawn) checkCoords(data.spawn[0], data.spawn[1]);
    if (data.platforms) {
        data.platforms.forEach(p => {
            const colWidth = p.width / 2.0;
            const colCenter = p.x / 2.0;
            const cEnd = Math.round(colCenter + colWidth / 2.0 - 0.5);
            if (cEnd > maxX) maxX = cEnd;
            checkCoords(p.x, p.y);
        });
    }
    if (data.ramps_up) {
        data.ramps_up.forEach(r => {
            const cEnd = Math.round((r.x + r.width) / 2.0);
            if (cEnd > maxX) maxX = cEnd;
            checkCoords(r.x, r.y);
            checkCoords(r.x + r.width, r.y + r.height);
        });
    }
    if (data.ramps_down) {
        data.ramps_down.forEach(r => {
            const cEnd = Math.round((r.x + r.width) / 2.0);
            if (cEnd > maxX) maxX = cEnd;
            checkCoords(r.x, r.y);
            checkCoords(r.x + r.width, r.y - r.height);
        });
    }
    
    // Arrays helper
    const scanArray = (arr) => {
        if (arr) {
            arr.forEach(item => {
                let x = Array.isArray(item) ? item[0] : item.x;
                let y = Array.isArray(item) ? item[1] : item.y;
                checkCoords(x, y);
            });
        }
    };
    
    scanArray(data.rings);
    scanArray(data.springs_vert);
    scanArray(data.springs_diag);
    scanArray(data.dash_pads);
    scanArray(data.enemies);
    scanArray(data.cactus_enemies);
    scanArray(data.spikes);
    scanArray(data.goals);
    
    // Re-initialize grid size
    gridWidth = maxX + 10; // Extra padding
    gridHeight = maxY + 5;  // Extra padding
    
    document.getElementById("grid-width").value = gridWidth;
    document.getElementById("grid-height").value = gridHeight;
    
    // Initialize empty matrix
    grid = [];
    for (let c = 0; c < gridWidth; c++) {
        grid[c] = [];
        for (let r = 0; r < gridHeight; r++) {
            grid[c][r] = " ";
        }
    }
    
    // Helper to set element in grid: x -> col, r -> visual row index
    const setElementAt = (x, r, char) => {
        const c = Math.round(x / 2.0);
        const r_visual = gridHeight - 1 - r;
        if (c >= 0 && c < gridWidth && r_visual >= 0 && r_visual < gridHeight) {
            grid[c][r_visual] = char;
        }
    };
    
    // Populate platforms
    if (data.platforms) {
        data.platforms.forEach(p => {
            const colWidth = Math.round(p.width / 2.0);
            const colCenter = p.x / 2.0;
            const cStart = Math.round(colCenter - colWidth / 2.0);
            const cEnd = cStart + colWidth - 1;
            const r = Math.round(p.y / import_Y_STEP);
            
            for (let c = cStart; c <= cEnd; c++) {
                const r_visual = gridHeight - 1 - r;
                if (c >= 0 && c < gridWidth && r_visual >= 0 && r_visual < gridHeight) {
                    grid[c][r_visual] = "#";
                }
            }
        });
    }
    
    // Populate ramps up
    if (data.ramps_up) {
        data.ramps_up.forEach(ramp => {
            const colWidth = Math.round(ramp.width / 2.0);
            const cStart = Math.round((ramp.x + 1.0) / 2.0);
            const rStart = Math.round((ramp.y - 0.5) / import_Y_STEP) + 1;
            
            for (let i = 0; i < colWidth; i++) {
                const c = cStart + i;
                const r = rStart + i;
                const r_visual = gridHeight - 1 - r;
                if (c >= 0 && c < gridWidth && r_visual >= 0 && r_visual < gridHeight) {
                    grid[c][r_visual] = "/";
                }
            }
        });
    }
    
    // Populate ramps down
    if (data.ramps_down) {
        data.ramps_down.forEach(ramp => {
            const colWidth = Math.round(ramp.width / 2.0);
            const cStart = Math.round((ramp.x + 1.0) / 2.0);
            const rStart = Math.round((ramp.y - 0.5) / import_Y_STEP);
            
            for (let i = 0; i < colWidth; i++) {
                const c = cStart + i;
                const r = rStart - i;
                const r_visual = gridHeight - 1 - r;
                if (c >= 0 && c < gridWidth && r_visual >= 0 && r_visual < gridHeight) {
                    grid[c][r_visual] = "\\";
                }
            }
        });
    }
    
    // Populate items
    if (data.spawn) {
        const r = Math.round((data.spawn[1] - 1.5) / import_Y_STEP) + 1;
        setElementAt(data.spawn[0], r, "P");
    }
    if (data.rings) {
        data.rings.forEach(item => {
            const r = Math.round((item[1] - 1.2) / import_Y_STEP) + 1;
            setElementAt(item[0], r, "o");
        });
    }
    if (data.springs_vert) {
        data.springs_vert.forEach(item => {
            const r = Math.round((item.y - 0.5) / import_Y_STEP) + 1;
            setElementAt(item.x, r, "V");
        });
    }
    if (data.springs_diag) {
        data.springs_diag.forEach(item => {
            const r = Math.round((item.y - 0.5) / import_Y_STEP) + 1;
            setElementAt(item.x, r, "F");
        });
    }
    if (data.dash_pads) {
        data.dash_pads.forEach(item => {
            const r = Math.round((item[1] - 0.5) / import_Y_STEP) + 1;
            setElementAt(item[0], r, "D");
        });
    }
    if (data.enemies) {
        data.enemies.forEach(item => {
            const r = Math.round((item.y - 1.0) / import_Y_STEP) + 1;
            setElementAt(item.x, r, "E");
        });
    }
    if (data.cactus_enemies) {
        data.cactus_enemies.forEach(item => {
            const r = Math.round((item.y - 1.0) / import_Y_STEP) + 1;
            setElementAt(item.x, r, "C");
        });
    }
    if (data.spikes) {
        data.spikes.forEach(item => {
            const r = Math.round((item[1] - 0.5) / import_Y_STEP) + 1;
            setElementAt(item[0], r, "S");
        });
    }
    if (data.goals) {
        data.goals.forEach(item => {
            const r = Math.round((item[1] - 2.0) / import_Y_STEP) + 1;
            setElementAt(item[0], r, "G");
        });
    }
    
    renderGrid();
    generateExports();
    showToast(`JSON map imported successfully! Level: ${levelId}`, "upload");
}

function importASCII(text) {
    const lines = text.split(/\r?\n/);
    let inGrid = false;
    let gridLines = [];
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            if (inGrid) gridLines.push(line);
            return;
        }
        
        if (trimmed === "[grid]") {
            inGrid = true;
            return;
        }
        
        if (inGrid) {
            gridLines.push(line);
        } else {
            // Meta parsing
            if (line.includes(":")) {
                const parts = line.split(":");
                const key = parts[0].trim().toLowerCase();
                const val = parts.slice(1).join(":").trim();
                
                if (key === "level") {
                    levelId = val;
                    document.getElementById("level-id").value = val;
                } else if (key === "name") {
                    levelName = val;
                    document.getElementById("level-name").value = val;
                }
            }
        }
    });
    
    // Clean trailing empty lines
    while (gridLines.length > 0 && gridLines[gridLines.length - 1].trim() === "") {
        gridLines.pop();
    }
    
    if (gridLines.length === 0) {
        throw new Error("'[grid]' section not found or empty in pasted text.");
    }
    
    // Establish dimensions
    gridHeight = gridLines.length;
    gridWidth = Math.max(...gridLines.map(l => l.length));
    
    document.getElementById("grid-width").value = gridWidth;
    document.getElementById("grid-height").value = gridHeight;
    
    // Re-initialize state grid
    grid = [];
    for (let c = 0; c < gridWidth; c++) {
        grid[c] = [];
        for (let r = 0; r < gridHeight; r++) {
            grid[c][r] = " ";
        }
    }
    
    // Load character grid
    for (let r = 0; r < gridHeight; r++) {
        const line = gridLines[r];
        for (let c = 0; c < gridWidth; c++) {
            const char = (c < line.length ? line[c] : " ");
            grid[c][r] = char;
        }
    }
    
    renderGrid();
    updateDynamicTexts();
    generateExports();
    showToast(`ASCII map imported successfully! Level: ${levelId}`, "upload");
}

// --- Utilities (Copy / Download / Notifications) ---

function switchTab(tabId) {
    // Deactivate all
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
    
    // Activate clicked
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add("active");
    
    const activePanel = document.getElementById(tabId);
    if (activePanel) activePanel.classList.add("active");
    
    activeTab = tabId;
}

function copyToClipboard(elementId) {
    const textarea = document.getElementById(elementId);
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        navigator.clipboard.writeText(textarea.value);
        showToast("Copied to clipboard!", "check");
    } catch (err) {
        // Fallback
        document.execCommand("copy");
        showToast("Copied!", "check");
    }
}

function copyCommand() {
    const cmdText = document.getElementById("compile-command").innerText;
    try {
        navigator.clipboard.writeText(cmdText);
        showToast("Command copied!", "terminal");
    } catch (err) {
        showToast("Error copying command.", "alert-triangle");
    }
}

// --- Saved maps (persistence) ---

function openMaps() {
    const modal = document.getElementById("maps-modal");
    modal.hidden = false;
    lucide.createIcons();
    const hint = document.getElementById("maps-savehint");
    hint.textContent = `Saves as level_${(levelId || "").padStart(2, "0")}_map.txt in tools/map_editor/levels/`;
    if (location.protocol === "file:") {
        document.getElementById("maps-list").innerHTML =
            '<p class="tab-note">Requires the local server (python tools/map_editor/server.py).</p>';
        return;
    }
    refreshMapsList();
}

// Closes maps modal
function closeMaps() {
    document.getElementById("maps-modal").hidden = true;
}

function onMapsBackdrop(e) {
    if (e.target === document.getElementById("maps-modal")) closeMaps();
}

function formatMtime(epochSeconds) {
    try {
        return new Date(epochSeconds * 1000).toLocaleString("en-US", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch (e) {
        return "";
    }
}

async function refreshMapsList() {
    const list = document.getElementById("maps-list");
    list.innerHTML = '<p class="tab-note">Loading...</p>';
    try {
        const resp = await fetch("/api/maps");
        const data = await resp.json();
        const maps = (data && data.maps) || [];
        if (!maps.length) {
            list.innerHTML = '<p class="tab-note">No maps saved yet. Draw and click "Save current map".</p>';
            return;
        }
        list.innerHTML = "";
        maps.forEach(m => {
            const row = document.createElement("div");
            row.className = "map-row";
            const name = m.name ? m.name : "(no name)";
            row.innerHTML = `
                <div class="map-meta">
                    <span class="map-badge">${m.level}</span>
                    <div class="map-text">
                        <span class="map-name">${escapeHtml(name)}</span>
                        <span class="map-sub">${m.file} · ${formatMtime(m.mtime)}</span>
                    </div>
                </div>
                <div class="map-actions">
                    <button class="btn btn-sm btn-secondary" title="Open to edit"><i data-lucide="pencil"></i> Edit</button>
                    <button class="btn btn-sm btn-danger-outline" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            const [editBtn, delBtn] = row.querySelectorAll("button");
            editBtn.onclick = () => openMap(m.level, m.format);
            delBtn.onclick = () => deleteMap(m.level, m.format, name);
            list.appendChild(row);
        });
        lucide.createIcons();
    } catch (err) {
        list.innerHTML = '<p class="tab-note">Local server not found.</p>';
    }
}

async function saveCurrentMap() {
    if (location.protocol === "file:") { showToast("Requires local server", "alert-triangle"); return; }
    try {
        const content = document.getElementById("ascii-output").value;
        const resp = await fetch("/api/maps", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level: levelId, format: "txt", content })
        });
        const data = await resp.json();
        if (data.ok) {
            showToast(`Map saved: ${data.file}`, "save");
            refreshMapsList();
        } else {
            showToast(data.error || "Failed to save", "alert-triangle");
        }
    } catch (err) {
        showToast("Local server not found", "alert-triangle");
    }
}

async function openMap(level, format) {
    try {
        const resp = await fetch(`/api/maps/item?level=${encodeURIComponent(level)}&format=${encodeURIComponent(format)}`);
        const data = await resp.json();
        if (!data.ok) {
            showToast(data.error || "Failed to open", "alert-triangle");
            return;
        }
        if (data.format === "json") {
            importJSON(JSON.parse(data.content));
        } else {
            importASCII(data.content);
        }
        closeMaps();
        showToast(`Map ${data.level} loaded for editing`, "pencil");
    } catch (err) {
        showToast("Local server not found", "alert-triangle");
    }
}

async function deleteMap(level, format, name) {
    if (!confirm(`Delete map for level ${level}${name ? ` ("${name}")` : ""}? This action cannot be undone.`)) return;
    try {
        const resp = await fetch("/api/maps/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level, format })
        });
        const data = await resp.json();
        if (data.ok) {
            showToast(`Map ${level} deleted`, "trash-2");
            refreshMapsList();
        } else {
            showToast(data.error || "Failed to delete", "alert-triangle");
        }
    } catch (err) {
        showToast("Local server not found", "alert-triangle");
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

// --- Godot path configuration ---

const GODOT_SOURCE_LABELS = {
    saved: "manually defined",
    env: "GODOT_BIN env variable",
    path: "detected in PATH",
    default: "default path",
};

function applyGodotConfig(data) {
    const input = document.getElementById("godot-path");
    const status = document.getElementById("godot-status");
    if (data && data.godot_bin && document.activeElement !== input) {
        input.value = data.godot_bin;
    }
    status.classList.remove("ok", "bad");
    if (!data || !data.ok) {
        status.textContent = "Could not read configuration.";
        status.classList.add("bad");
        return;
    }
    const label = GODOT_SOURCE_LABELS[data.source] || data.source;
    if (data.exists) {
        status.textContent = `✓ Godot found · ${label}`;
        status.classList.add("ok");
    } else {
        status.textContent = `✗ Not found at this path (${label})`;
        status.classList.add("bad");
    }
}

async function loadGodotConfig() {
    if (location.protocol === "file:") return;
    try {
        const resp = await fetch("/api/config");
        applyGodotConfig(await resp.json());
    } catch (err) {
        // server not reachable; leave defaults
    }
}

function openSettings() {
    const modal = document.getElementById("settings-modal");
    modal.hidden = false;
    lucide.createIcons();
    if (location.protocol === "file:") {
        const status = document.getElementById("godot-status");
        status.textContent = "Requires the local server (python tools/map_editor/server.py).";
        status.classList.remove("ok");
        status.classList.add("bad");
        return;
    }
    loadGodotConfig();
    setTimeout(() => document.getElementById("godot-path").focus(), 50);
}

function closeSettings() {
    document.getElementById("settings-modal").hidden = true;
}

function onSettingsBackdrop(e) {
    if (e.target === document.getElementById("settings-modal")) closeSettings();
}

async function postGodotConfig(godotBin) {
    const resp = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ godot_bin: godotBin })
    });
    return resp.json();
}

async function detectGodot() {
    if (location.protocol === "file:") { showToast("Requires local server", "alert-triangle"); return; }
    try {
        // Clearing the saved value makes the server auto-detect (env -> PATH -> default).
        const data = await postGodotConfig("");
        applyGodotConfig(data);
        if (data.exists && data.source === "path") showToast("Godot detected in PATH!", "check");
        else if (data.exists) showToast("Using Godot (" + (GODOT_SOURCE_LABELS[data.source] || data.source) + ")", "check");
        else showToast("Godot not found in PATH — specify the path", "alert-triangle");
    } catch (err) {
        showToast("Local server not found", "alert-triangle");
    }
}

async function saveGodotPath() {
    if (location.protocol === "file:") { showToast("Requires local server", "alert-triangle"); return; }
    const value = document.getElementById("godot-path").value.trim();
    try {
        const data = await postGodotConfig(value);
        applyGodotConfig(data);
        if (data.exists) showToast("Godot path saved!", "check");
        else showToast("Saved, but the path does not exist", "alert-triangle");
    } catch (err) {
        showToast("Local server not found", "alert-triangle");
    }
}

async function testLevel() {
    if (location.protocol === "file:") {
        showToast("Use the local server to test the stage", "alert-triangle");
        return;
    }

    const btn = document.getElementById("btn-test-level");
    const resultBox = document.getElementById("compile-result");
    btn.disabled = true;
    showToast("Compiling level " + levelId + "...", "hammer");

    try {
        // 1. Compile the current ASCII map.
        const content = document.getElementById("ascii-output").value;
        const cResp = await fetch("/api/compile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level: levelId, format: "txt", content })
        });
        const cData = await cResp.json();

        if (!cData.ok) {
            openDrawerTab("tab-instructions");
            resultBox.hidden = false;
            resultBox.textContent =
                "❌ Compilation failed:\n\n" +
                ((cData.stderr || cData.error || "").trim()) +
                (cData.stdout ? "\n\n" + cData.stdout.trim() : "");
            showToast("Compilation failed", "alert-triangle");
            return;
        }

        // 2. Launch Godot straight into this level.
        showToast("Compiled! Starting Godot...", "gamepad-2");
        const rResp = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level: levelId })
        });
        const rData = await rResp.json();

        if (rData.ok) {
            showToast(`Testing level ${rData.level} in Godot!`, "check");
            if (rData.build_warning) showToast(rData.build_warning, "alert-triangle");
        } else {
            openDrawerTab("tab-instructions");
            resultBox.hidden = false;
            resultBox.textContent =
                "❌ " + (rData.error || "Failed to start Godot") +
                (rData.build_log ? "\n\n" + rData.build_log.trim() : "");
            showToast(rData.error || "Failed to execute", "alert-triangle");
        }
    } catch (err) {
        showToast("Local server not found", "alert-triangle");
    } finally {
        btn.disabled = false;
    }
}

async function runGame() {
    if (location.protocol === "file:") {
        showToast("Use the local server to run", "alert-triangle");
        return;
    }
    showToast("Starting Godot...", "gamepad-2");
    try {
        const resp = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });
        const data = await resp.json();
        if (data.ok) {
            showToast("Godot started!", "check");
        } else {
            showToast(data.error || "Failed to start Godot", "alert-triangle");
        }
    } catch (err) {
        showToast("Local server not found", "alert-triangle");
    }
}

async function compileLevel() {
    const btn = document.getElementById("btn-compile-live");
    const resultBox = document.getElementById("compile-result");

    if (location.protocol === "file:") {
        resultBox.hidden = false;
        resultBox.textContent =
            "⚠️ You opened the editor via file://, which cannot compile.\n" +
            "Start the local server and open it in the browser:\n\n" +
            "  python tools/map_editor/server.py\n" +
            "  http://localhost:8000";
        showToast("Use the local server to compile", "alert-triangle");
        return;
    }

    const content = document.getElementById("ascii-output").value;
    resultBox.hidden = false;
    resultBox.textContent = "⏳ Compiling level " + levelId + "...";
    btn.disabled = true;

    try {
        const resp = await fetch("/api/compile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level: levelId, format: "txt", content })
        });
        const data = await resp.json();

        if (data.ok) {
            resultBox.textContent =
                `✅ Level ${data.level} compiled successfully!\n` +
                `Map:   ${data.map_file}\n` +
                `Scene: ${data.scene_file}\n\n` +
                `Open/reload the project in Godot to test.\n\n` +
                (data.stdout || "").trim();
            showToast(`Level ${data.level} ready for Godot!`, "check");
        } else {
            resultBox.textContent =
                `❌ Compilation failed.\n\n` +
                ((data.stderr || data.error || "").trim()) +
                (data.stdout ? "\n\n" + data.stdout.trim() : "");
            showToast("Compilation failed", "alert-triangle");
        }
    } catch (err) {
        resultBox.textContent =
            "⚠️ Could not connect to the local server.\n" +
            "Make sure it is running:\n\n" +
            "  python tools/map_editor/server.py\n" +
            "  http://localhost:8000\n\n" +
            "Detail: " + err.message;
        showToast("Local server not found", "alert-triangle");
    } finally {
        btn.disabled = false;
    }
}

function downloadFile(format) {
    const levelIdSanitized = levelId.padStart(2, '0');
    let filename = `level_${levelIdSanitized}_map.txt`;
    let content = "";
    
    if (format === "txt") {
        content = document.getElementById("ascii-output").value;
    } else if (format === "json") {
        filename = `level_${levelIdSanitized}_map.json`;
        content = document.getElementById("json-output").value;
    }
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Download of '${filename}' started!`, "download");
    }
}

function showToast(message, iconName = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons({ attrs: { class: 'lucide-toast-icon' } }); // refresh for the new toast
    
    // Automatically remove after animation finishes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// --- Drawer (code / compile panel) ---

function setDrawer(open) {
    const app = document.querySelector(".app");
    const btn = document.getElementById("btn-toggle-output");
    app.classList.toggle("drawer-open", open);
    if (btn) btn.classList.toggle("active", open);
}

function toggleOutput() {
    const isOpen = document.querySelector(".app").classList.contains("drawer-open");
    setDrawer(!isOpen);
}

function openDrawerTab(tabId) {
    setDrawer(true);
    switchTab(tabId);
}
