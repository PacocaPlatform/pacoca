// --- Application State ---
let levelId = "04";
let levelName = "Ruínas Celestes";
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
    { symbol: "#", name: "Plataforma Grama", class: "platform", desc: "Bloco sólido básico (CSGBox3D)", color: "var(--color-platform)" },
    { symbol: "/", name: "Rampa Subindo", class: "ramp-up", desc: "Rampa sólida diagonal direita", color: "var(--color-slope)" },
    { symbol: "\\", name: "Rampa Descendo", class: "ramp-down", desc: "Rampa sólida diagonal esquerda", color: "var(--color-slope)" },
    { symbol: "o", name: "Anel", class: "ring", desc: "Item colecionável para pontos/vida", color: "var(--color-ring)" },
    { symbol: "V", name: "Mola Vertical", class: "spring-v", desc: "Impulso vertical alto (LaunchForce: 22)", color: "var(--color-spring-v)" },
    { symbol: "F", name: "Mola Diagonal", class: "spring-d", desc: "Impulso diagonal frente (LaunchForce: 25)", color: "var(--color-spring-d)" },
    { symbol: "D", name: "Acelerador (Dash)", class: "dash", desc: "Impulsiona o player para frente no rolo", color: "var(--color-dash)" },
    { symbol: "E", name: "Inimigo Robô", class: "enemy", desc: "Inimigo patrulheiro padrão (Speed: 3)", color: "var(--color-enemy)" },
    { symbol: "C", name: "Inimigo Cacto", class: "cactus", desc: "Cacto patrulheiro (Speed: 1.25)", color: "var(--color-cactus)" },
    { symbol: "S", name: "Espinhos", class: "spikes", desc: "Espinhos no chão que causam dano", color: "var(--color-spikes)" },
    { symbol: "P", name: "Spawn Jogador", class: "spawn", desc: "Ponto inicial do jogador (Z:0, Y: Spawn + 0.5)", color: "var(--color-spawn)" }
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

    // Set toggle buttons to active initially
    document.getElementById("btn-toggle-sidebar").classList.add("active");
    document.getElementById("btn-toggle-output").classList.add("active");

    // Initial setups
    updateDynamicTexts();
    generateExports();
});

// --- UI Construction ---

function initPalette() {
    const paletteList = document.getElementById("palette-list");
    paletteList.innerHTML = "";
    
    ELEMENTS.forEach((el, index) => {
        const item = document.createElement("button");
        item.className = "palette-item" + (selectedElement === el.symbol ? " active" : "");
        item.title = el.desc;
        item.onclick = () => selectElement(el.symbol, item);
        
        let styleAttr = `background-color: ${el.color}; color: white;`;
        if (el.symbol === "o" || el.symbol === "D") {
            styleAttr = `border: 2px solid ${el.color}; color: ${el.color}; background: rgba(255,255,255,0.05);`;
        } else if (el.symbol === "S") {
            styleAttr = `border-bottom: 4px solid ${el.color}; border-top: 1px solid var(--border-color); color: ${el.color}; background: rgba(255,255,255,0.05);`;
        }
        
        item.innerHTML = `
            <div class="palette-swatch" style="${styleAttr}">${el.symbol === "\\" ? "\\\\" : el.symbol}</div>
            <div class="palette-info">
                <span class="palette-name">${el.name}</span>
                <span class="palette-symbol">Caractere: '${el.symbol === "\\" ? "\\\\" : el.symbol}'</span>
            </div>
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

function selectElement(symbol, elementBtn) {
    selectedElement = symbol;
    currentTool = "paint";
    
    // Update active UI classes
    document.querySelectorAll(".palette-item").forEach(item => item.classList.remove("active"));
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
    if (confirm("Tem certeza que deseja limpar todo o grid? Todos os dados não salvos serão perdidos.")) {
        for (let c = 0; c < gridWidth; c++) {
            for (let r = 0; r < gridHeight; r++) {
                grid[c][r] = " ";
            }
        }
        renderGrid();
        generateExports();
        showToast("Grid limpo com sucesso!", "trash-2");
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
    showToast(`Grid redimensionado para ${gridWidth}x${gridHeight}`, "grid");
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
    // Visual row r represents Y coord: (gridHeight - 1 - r) * 1.0
    const xCoord = (c * 2.0).toFixed(1);
    const yCoord = ((gridHeight - 1 - r) * 1.0).toFixed(1);
    
    document.getElementById("coord-display").innerText = 
        `Coord: Col: ${c}, Lin: ${r} | Posição Real (Godot): X: ${xCoord}m, Y: ${yCoord}m`;
}

// --- Exporters (ASCII & JSON) ---

function generateExports() {
    generateASCIIExport();
    generateJSONExport();
}

function generateASCIIExport() {
    let output = "";
    output += `level: ${levelId}\n`;
    output += `name: ${levelName}\n\n`;
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
        const yCoord = (gridHeight - 1 - r) * 1.0;
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
                
                platforms.push({
                    x: parseFloat(x.toFixed(2)),
                    y: parseFloat(yCoord.toFixed(2)),
                    width: parseFloat(width.toFixed(2))
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
                let height = (rStart - rEnd + 1) * 1.0;
                let start_x = cStart * 2.0 - 1.0;
                let start_y = (gridHeight - 1 - rStart) * 1.0 - 0.5;
                
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
                let height = (rEnd - rStart + 1) * 1.0;
                let start_x = cStart * 2.0 - 1.0;
                let start_y = (gridHeight - 1 - rStart) * 1.0 + 0.5;
                
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
        const yCoord = (gridHeight - 1 - r) * 1.0;
        for (let c = 0; c < gridWidth; c++) {
            const char = grid[c][r];
            const xCoord = c * 2.0;
            
            if (char === "o") {
                rings.push([parseFloat(xCoord.toFixed(2)), parseFloat((yCoord + 0.2).toFixed(2))]);
            } else if (char === "V") {
                springs_vert.push({ x: parseFloat(xCoord.toFixed(2)), y: parseFloat((yCoord - 0.5).toFixed(2)), force: 22.0 });
            } else if (char === "F") {
                springs_diag.push({ 
                    x: parseFloat(xCoord.toFixed(2)), 
                    y: parseFloat((yCoord - 0.5).toFixed(2)), 
                    force: 25.0, 
                    dx: 1.2, 
                    dy: 1.5, 
                    lock: 0.6 
                });
            } else if (char === "D") {
                dash_pads.push([parseFloat(xCoord.toFixed(2)), parseFloat((yCoord - 0.5).toFixed(2))]);
            } else if (char === "E") {
                enemies.push({ x: parseFloat(xCoord.toFixed(2)), y: parseFloat(yCoord.toFixed(2)), speed: 3.0 });
            } else if (char === "C") {
                cactus_enemies.push({ x: parseFloat(xCoord.toFixed(2)), y: parseFloat(yCoord.toFixed(2)), speed: 1.25 });
            } else if (char === "S") {
                spikes.push([parseFloat(xCoord.toFixed(2)), parseFloat((yCoord - 0.5).toFixed(2))]);
            } else if (char === "P") {
                spawn = [parseFloat(xCoord.toFixed(2)), parseFloat((yCoord + 0.5).toFixed(2))];
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
        spikes: spikes
    };
    
    document.getElementById("json-output").value = JSON.stringify(jsonObj, null, 2);
}

// --- Dynamic Text Updates ---

function updateDynamicTexts() {
    // Update IDs inside compiling guide tab
    document.querySelectorAll(".dynamic-level-id").forEach(el => el.innerText = levelId);
    
    const compileCmd = `python scripts/convert_map.py --input scripts/levels/level_${levelId}_map.txt --level ${levelId}`;
    document.getElementById("compile-command").innerText = compileCmd;
}

// --- Import / Load Map Functionality ---

function importMap() {
    const text = document.getElementById("import-input").value.trim();
    if (!text) {
        alert("Cole o código do mapa para importar!");
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
        alert("Erro ao importar o mapa. Certifique-se de que o formato do texto está correto.\nErro: " + e.message);
    }
}

function importJSON(data) {
    levelId = data.level || "03";
    levelName = data.name || "Nível Importado";
    
    document.getElementById("level-id").value = levelId;
    document.getElementById("level-name").value = levelName;
    
    // Find limits to establish canvas size
    let maxX = 50; // default min width
    let maxY = 12; // default min height
    
    // Scan coordinates to set grid size
    const checkCoords = (x, y) => {
        const c = Math.round(x / 2.0);
        const r = Math.round(y);
        if (c > maxX) maxX = c;
        if (r > maxY) maxY = r;
    };
    
    if (data.spawn) checkCoords(data.spawn[0], data.spawn[1]);
    if (data.platforms) {
        data.platforms.forEach(p => {
            // start_col to end_col
            const colWidth = p.width / 2.0;
            const colCenter = p.x / 2.0;
            const cEnd = Math.round(colCenter + colWidth / 2.0 - 0.5);
            if (cEnd > maxX) maxX = cEnd;
            if (p.y > maxY) maxY = Math.round(p.y);
        });
    }
    if (data.ramps_up) {
        data.ramps_up.forEach(r => {
            const cEnd = Math.round((r.x + r.width) / 2.0);
            if (cEnd > maxX) maxX = cEnd;
            if (r.y + r.height > maxY) maxY = Math.round(r.y + r.height);
        });
    }
    if (data.ramps_down) {
        data.ramps_down.forEach(r => {
            const cEnd = Math.round((r.x + r.width) / 2.0);
            if (cEnd > maxX) maxX = cEnd;
            if (r.y > maxY) maxY = Math.round(r.y);
        });
    }
    
    // Arrays helper
    const scanArray = (arr, hasYOffset = false, yOffset = 0) => {
        if (arr) {
            arr.forEach(item => {
                let x = Array.isArray(item) ? item[0] : item.x;
                let y = Array.isArray(item) ? item[1] : item.y;
                checkCoords(x, y + yOffset);
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
    
    // Helper to set element in grid: x -> col, y -> visual row
    const setCellByCoords = (x, y, char) => {
        const c = Math.round(x / 2.0);
        const r_coord = Math.round(y);
        const r_visual = gridHeight - 1 - r_coord;
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
            const r_visual = gridHeight - 1 - Math.round(p.y);
            
            for (let c = cStart; c <= cEnd; c++) {
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
            const height = Math.round(ramp.height / 1.0);
            const cStart = Math.round((ramp.x + 1.0) / 2.0);
            const rStartCoord = Math.round(ramp.y + 0.5);
            
            for (let i = 0; i < colWidth; i++) {
                const c = cStart + i;
                const rCoord = rStartCoord + i; // slope up-right: coordinate Y increases
                const r_visual = gridHeight - 1 - rCoord;
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
            const height = Math.round(ramp.height / 1.0);
            const cStart = Math.round((ramp.x + 1.0) / 2.0);
            const rStartCoord = Math.round(ramp.y - 0.5); // top visual y coordinate
            
            for (let i = 0; i < colWidth; i++) {
                const c = cStart + i;
                const rCoord = rStartCoord - i; // slope down-right: coordinate Y decreases
                const r_visual = gridHeight - 1 - rCoord;
                if (c >= 0 && c < gridWidth && r_visual >= 0 && r_visual < gridHeight) {
                    grid[c][r_visual] = "\\";
                }
            }
        });
    }
    
    // Populate items
    if (data.spawn) setCellByCoords(data.spawn[0], data.spawn[1] - 0.5, "P");
    if (data.rings) data.rings.forEach(item => setCellByCoords(item[0], item[1] - 0.2, "o"));
    if (data.springs_vert) data.springs_vert.forEach(item => setCellByCoords(item.x, item.y + 0.5, "V"));
    if (data.springs_diag) data.springs_diag.forEach(item => setCellByCoords(item.x, item.y + 0.5, "F"));
    if (data.dash_pads) data.dash_pads.forEach(item => setCellByCoords(item[0], item[1] + 0.5, "D"));
    if (data.enemies) data.enemies.forEach(item => setCellByCoords(item.x, item.y, "E"));
    if (data.cactus_enemies) data.cactus_enemies.forEach(item => setCellByCoords(item.x, item.y, "C"));
    if (data.spikes) data.spikes.forEach(item => setCellByCoords(item[0], item[1] + 0.5, "S"));
    
    renderGrid();
    generateExports();
    showToast(`Mapa JSON importado com sucesso! Nível: ${levelId}`, "upload");
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
        throw new Error("Seção '[grid]' não encontrada ou vazia no texto colado.");
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
    showToast(`Mapa ASCII importado com sucesso! Nível: ${levelId}`, "upload");
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
        showToast("Copiado para a área de transferência!", "check");
    } catch (err) {
        // Fallback
        document.execCommand("copy");
        showToast("Copiado!", "check");
    }
}

function copyCommand() {
    const cmdText = document.getElementById("compile-command").innerText;
    try {
        navigator.clipboard.writeText(cmdText);
        showToast("Comando copiado!", "terminal");
    } catch (err) {
        showToast("Erro ao copiar comando.", "alert-triangle");
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
        showToast(`Download de '${filename}' iniciado!`, "download");
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

// --- Responsive/Collapsible Panels Logic ---

function toggleSidebar() {
    const body = document.querySelector(".app-body");
    const btn = document.getElementById("btn-toggle-sidebar");
    
    body.classList.toggle("sidebar-collapsed");
    updateAppBodyClasses();
    
    if (body.classList.contains("sidebar-collapsed")) {
        btn.classList.remove("active");
        btn.innerHTML = `<i data-lucide="chevron-right"></i> Configurações`;
    } else {
        btn.classList.add("active");
        btn.innerHTML = `<i data-lucide="chevron-left"></i> Configurações`;
    }
    lucide.createIcons();
}

function toggleOutput() {
    const body = document.querySelector(".app-body");
    const btn = document.getElementById("btn-toggle-output");
    
    body.classList.toggle("output-collapsed");
    updateAppBodyClasses();
    
    if (body.classList.contains("output-collapsed")) {
        btn.classList.remove("active");
        btn.innerHTML = `Código <i data-lucide="chevron-left"></i>`;
    } else {
        btn.classList.add("active");
        btn.innerHTML = `Código <i data-lucide="chevron-right"></i>`;
    }
    lucide.createIcons();
}

function updateAppBodyClasses() {
    const body = document.querySelector(".app-body");
    const hasSidebarCollapsed = body.classList.contains("sidebar-collapsed");
    const hasOutputCollapsed = body.classList.contains("output-collapsed");
    
    body.classList.remove("both-collapsed");
    
    if (hasSidebarCollapsed && hasOutputCollapsed) {
        body.classList.add("both-collapsed");
    }
}
