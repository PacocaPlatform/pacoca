// --- Application State ---
let Y_STEP = 3.0;
let X_STEP = 2.0;
// The level ID is internal: users only type a name, and the ID is derived
// from it (see slugifyLevelName). Opening a saved map keeps the file's ID
// until the name is edited.
let levelName = "Nova Fase";
let levelId = "novafase";
let levelTheme = "forest"; // forest | glacial | cidade | caverna
let gridWidth = 100;
let gridHeight = 15;
let grid = []; // 2D array: grid[c][r] where c is column (X), r is visual row (Y-inverted)
let currentTool = "paint"; // paint | erase | line | rect | fill | select
let selectedElement = "#"; // Current painting character symbol
let isDrawing = false;
let zoomLevel = 1.0;

// --- Shape tools / selection / clipboard ---
let dragStart = null;       // {c, r} where the current drag began
let lastHover = null;       // {c, r} last hovered cell
let ghostKeys = [];         // "c,r" keys currently rendered as shape/paste ghost
let selection = null;       // {c0, r0, c1, r1} normalized selection rect
let clipboard = null;       // 2D array [rows][cols] of chars copied from a selection
let pasteMode = false;      // true = next click stamps the clipboard

// --- Undo / Redo history (snapshots of the grid matrix) ---
const MAX_HISTORY = 100;
let undoStack = [];
let redoStack = [];
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
// Derives the internal level ID from the level name: lowercase, accents
// stripped, alphanumerics only. Purely numeric names get a "fase" prefix so
// they can never collide with the builtin level IDs (01-04, 41, ...).
function slugifyLevelName(name) {
    let slug = (name || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/^\d+$/.test(slug)) slug = "fase" + slug;
    return slug.slice(0, 24);
}

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initPalette();
    initGrid(gridWidth, gridHeight);
    
    // Config events. The name IS the level's identity: editing it re-derives
    // the internal ID, so a renamed map compiles as a new level.
    document.getElementById("level-name").addEventListener("input", (e) => {
        levelName = e.target.value;
        levelId = slugifyLevelName(levelName);
        updateDynamicTexts();
        generateExports();
    });

    document.getElementById("level-theme").addEventListener("change", (e) => {
        levelTheme = e.target.value;
        generateExports();
    });

    document.getElementById("grid-width").addEventListener("change", (e) => {
        let val = parseInt(e.target.value);
        if (!isNaN(val)) {
            e.target.value = Math.max(10, Math.min(1000, val));
        }
    });

    document.getElementById("grid-height").addEventListener("change", (e) => {
        let val = parseInt(e.target.value);
        if (!isNaN(val)) {
            e.target.value = Math.max(5, Math.min(100, val));
        }
    });

    document.getElementById("x-step").addEventListener("change", (e) => {
        let val = parseFloat(e.target.value);
        if (val >= 0.5 && val <= 5.0) {
            X_STEP = val;
            generateExports();
        }
    });

    document.getElementById("y-step").addEventListener("change", (e) => {
        let val = parseFloat(e.target.value);
        if (val >= 0.5 && val <= 5.0) {
            Y_STEP = val;
            generateExports();
        }
    });

    // Mouse up handler: finish strokes and commit shape drags
    window.addEventListener("mouseup", () => {
        if (!isDrawing) return;
        isDrawing = false;
        if ((currentTool === "line" || currentTool === "rect") && dragStart && lastHover) {
            commitShape();
        }
        dragStart = null;
        generateExports();
    });

    // Connect horizontal navigation slider
    const container = document.getElementById("grid-container");
    const slider = document.getElementById("scroll-slider");
    
    container.addEventListener("scroll", () => {
        const maxScroll = container.scrollWidth - container.clientWidth;
        if (maxScroll > 0) {
            slider.value = (container.scrollLeft / maxScroll) * 100;
        }
        renderPreview(); // keep the minimap viewport indicator in sync
    });

    document.getElementById("preview-strip").addEventListener("click", onPreviewClick);
    window.addEventListener("resize", renderPreview);

    slider.addEventListener("input", (e) => {
        const maxScroll = container.scrollWidth - container.clientWidth;
        container.scrollLeft = (e.target.value / 100) * maxScroll;
    });

    // Keyboard shortcuts (ignore while typing in inputs)
    window.addEventListener("keydown", (e) => {
        const tag = (e.target.tagName || "").toLowerCase();
        const typing = tag === "input" || tag === "textarea";
        if (e.key === "Escape") {
            const maps = document.getElementById("maps-modal");
            if (pasteMode) cancelPaste();
            else if (selection) clearSelection();
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
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
            e.preventDefault();
            redo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C") && selection) {
            e.preventDefault();
            copySelection();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "x" || e.key === "X") && selection) {
            e.preventDefault();
            cutSelection();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V") && clipboard) {
            e.preventDefault();
            startPaste();
            return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && selection) {
            e.preventDefault();
            deleteSelection();
            return;
        }
        if (e.key === "b" || e.key === "B") setToolMode("paint");
        else if (e.key === "e" || e.key === "E") setToolMode("erase");
        else if (e.key === "l" || e.key === "L") setToolMode("line");
        else if (e.key === "r" || e.key === "R") setToolMode("rect");
        else if (e.key === "g" || e.key === "G") setToolMode("fill");
        else if (e.key === "m" || e.key === "M") setToolMode("select");
    });

    // Initial setups
    updateDynamicTexts();
    generateExports();
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
                onCellDown(c, r);
            });

            cell.addEventListener("mouseenter", () => {
                onCellEnter(c, r);
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

// --- Undo / Redo ---

function snapshotGrid() {
    return grid.map(col => col.slice());
}

// Push the CURRENT state before a mutation (stroke start, clear, resize, import).
function pushHistory() {
    undoStack.push(snapshotGrid());
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
}

function restoreSnapshot(snapshot) {
    grid = snapshot;
    gridWidth = grid.length;
    gridHeight = grid[0] ? grid[0].length : 0;
    document.getElementById("grid-width").value = gridWidth;
    document.getElementById("grid-height").value = gridHeight;
    renderGrid();
    generateExports();
}

function undo() {
    if (!undoStack.length) { showToast("Nothing to undo", "undo-2"); return; }
    redoStack.push(snapshotGrid());
    restoreSnapshot(undoStack.pop());
}

function redo() {
    if (!redoStack.length) { showToast("Nothing to redo", "redo-2"); return; }
    undoStack.push(snapshotGrid());
    restoreSnapshot(redoStack.pop());
}

// --- Grid Interactions ---

// Writes one cell to both the state matrix and the DOM.
function setCellChar(c, r, char) {
    if (c < 0 || c >= gridWidth || r < 0 || r >= gridHeight) return;
    grid[c][r] = char;
    const cell = document.querySelector(`.grid-cell[data-col="${c}"][data-row="${r}"]`);
    if (cell) {
        cell.className = "grid-cell " + getCellClass(char);
        const hideText = char === " " || char === "#" || char === "/" || char === "\\";
        cell.innerText = hideText ? "" : char;
    }
}

// Removes every existing spawn point (only one P is allowed).
function clearSpawns() {
    for (let tc = 0; tc < gridWidth; tc++) {
        for (let tr = 0; tr < gridHeight; tr++) {
            if (grid[tc][tr] === "P") setCellChar(tc, tr, " ");
        }
    }
}

function onCellDown(c, r) {
    if (pasteMode && clipboard) {
        commitPaste(c, r);
        return;
    }
    lastHover = { c, r };
    switch (currentTool) {
        case "paint":
        case "erase":
            pushHistory(); // one undo step per stroke
            isDrawing = true;
            applyTool(c, r);
            break;
        case "line":
        case "rect":
            isDrawing = true;
            dragStart = { c, r };
            updateGhost(c, r);
            break;
        case "fill":
            floodFill(c, r);
            break;
        case "select":
            isDrawing = true;
            dragStart = { c, r };
            setSelection(c, r, c, r);
            break;
    }
}

function onCellEnter(c, r) {
    updateCoordinatesDisplay(c, r);
    lastHover = { c, r };
    if (pasteMode && clipboard) {
        showPasteGhost(c, r);
        return;
    }
    if (!isDrawing) return;
    switch (currentTool) {
        case "paint":
        case "erase":
            applyTool(c, r);
            break;
        case "line":
        case "rect":
            updateGhost(c, r);
            break;
        case "select":
            if (dragStart) setSelection(dragStart.c, dragStart.r, c, r);
            break;
    }
}

function applyTool(c, r) {
    if (currentTool === "paint") {
        if (selectedElement === "P") clearSpawns();
        setCellChar(c, r, selectedElement);
    } else if (currentTool === "erase") {
        setCellChar(c, r, " ");
    }
}

// --- Shape tools (line / rectangle) ---

// Cells covered by the current shape drag from dragStart to (c, r).
function shapeCells(c, r) {
    const cells = [];
    const a = dragStart;
    if (!a) return cells;
    if (currentTool === "rect") {
        const cMin = Math.min(a.c, c), cMax = Math.max(a.c, c);
        const rMin = Math.min(a.r, r), rMax = Math.max(a.r, r);
        for (let cc = cMin; cc <= cMax; cc++) {
            for (let rr = rMin; rr <= rMax; rr++) cells.push([cc, rr]);
        }
    } else {
        // Bresenham line from a to (c, r)
        let x0 = a.c, y0 = a.r;
        const dx = Math.abs(c - x0), sx = x0 < c ? 1 : -1;
        const dy = -Math.abs(r - y0), sy = y0 < r ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            cells.push([x0, y0]);
            if (x0 === c && y0 === r) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    return cells;
}

function clearGhost() {
    ghostKeys.forEach(key => {
        const [c, r] = key.split(",").map(Number);
        const cell = document.querySelector(`.grid-cell[data-col="${c}"][data-row="${r}"]`);
        if (cell) cell.classList.remove("ghost");
    });
    ghostKeys = [];
}

function setGhost(cells) {
    clearGhost();
    cells.forEach(([c, r]) => {
        const cell = document.querySelector(`.grid-cell[data-col="${c}"][data-row="${r}"]`);
        if (cell) {
            cell.classList.add("ghost");
            ghostKeys.push(`${c},${r}`);
        }
    });
}

function updateGhost(c, r) {
    setGhost(shapeCells(c, r));
}

function commitShape() {
    const cells = shapeCells(lastHover.c, lastHover.r);
    clearGhost();
    if (!cells.length) return;
    pushHistory();
    if (selectedElement === "P") clearSpawns();
    cells.forEach(([c, r]) => setCellChar(c, r, selectedElement));
    if (selectedElement === "P" && cells.length > 1) {
        // A shape can only carry one spawn: keep the last cell drawn
        cells.slice(0, -1).forEach(([c, r]) => setCellChar(c, r, " "));
    }
}

// --- Fill bucket ---

function floodFill(c, r) {
    const target = grid[c][r];
    if (target === selectedElement) return;
    pushHistory();
    if (selectedElement === "P") clearSpawns();
    const stack = [[c, r]];
    const seen = new Set([`${c},${r}`]);
    let filled = 0;
    while (stack.length) {
        const [cc, rr] = stack.pop();
        if (grid[cc][rr] !== target) continue;
        grid[cc][rr] = selectedElement;
        filled++;
        [[cc + 1, rr], [cc - 1, rr], [cc, rr + 1], [cc, rr - 1]].forEach(([nc, nr]) => {
            const key = `${nc},${nr}`;
            if (nc >= 0 && nc < gridWidth && nr >= 0 && nr < gridHeight &&
                !seen.has(key) && grid[nc][nr] === target) {
                seen.add(key);
                stack.push([nc, nr]);
            }
        });
    }
    if (selectedElement === "P" && filled > 1) {
        // Only one spawn allowed; a bucket fill with P keeps just the clicked cell
        for (let tc = 0; tc < gridWidth; tc++) {
            for (let tr = 0; tr < gridHeight; tr++) {
                if (grid[tc][tr] === "P" && !(tc === c && tr === r)) grid[tc][tr] = " ";
            }
        }
    }
    renderGrid();
    generateExports();
}

// --- Selection / clipboard ---

function setSelection(c0, r0, c1, r1) {
    clearSelectionHighlight();
    selection = {
        c0: Math.min(c0, c1), r0: Math.min(r0, r1),
        c1: Math.max(c0, c1), r1: Math.max(r0, r1),
    };
    for (let c = selection.c0; c <= selection.c1; c++) {
        for (let r = selection.r0; r <= selection.r1; r++) {
            const cell = document.querySelector(`.grid-cell[data-col="${c}"][data-row="${r}"]`);
            if (cell) cell.classList.add("sel");
        }
    }
}

function clearSelectionHighlight() {
    document.querySelectorAll(".grid-cell.sel").forEach(cell => cell.classList.remove("sel"));
}

function clearSelection() {
    clearSelectionHighlight();
    selection = null;
}

function copySelection() {
    if (!selection) { showToast("Nothing selected (use the Select tool)", "box-select"); return false; }
    clipboard = [];
    for (let r = selection.r0; r <= selection.r1; r++) {
        const row = [];
        for (let c = selection.c0; c <= selection.c1; c++) {
            row.push(grid[c][r]);
        }
        clipboard.push(row);
    }
    showToast(`Copied ${clipboard[0].length}×${clipboard.length} cells — Ctrl+V then click to place`, "copy");
    return true;
}

function deleteSelection() {
    if (!selection) return;
    pushHistory();
    for (let c = selection.c0; c <= selection.c1; c++) {
        for (let r = selection.r0; r <= selection.r1; r++) {
            setCellChar(c, r, " ");
        }
    }
    generateExports();
}

function cutSelection() {
    if (copySelection()) deleteSelection();
}

function startPaste() {
    if (!clipboard) { showToast("Clipboard empty — select and Ctrl+C first", "clipboard"); return; }
    pasteMode = true;
    clearSelection();
    showToast("Click on the grid to place the copied block (Esc cancels)", "clipboard-paste");
    if (lastHover) showPasteGhost(lastHover.c, lastHover.r);
}

function cancelPaste() {
    pasteMode = false;
    clearGhost();
}

function showPasteGhost(c, r) {
    const cells = [];
    for (let dr = 0; dr < clipboard.length; dr++) {
        for (let dc = 0; dc < clipboard[dr].length; dc++) {
            if (clipboard[dr][dc] !== " ") cells.push([c + dc, r + dr]);
        }
    }
    setGhost(cells);
}

function commitPaste(c, r) {
    pushHistory();
    clearGhost();
    let pastedSpawn = false;
    for (let dr = 0; dr < clipboard.length; dr++) {
        for (let dc = 0; dc < clipboard[dr].length; dc++) {
            const char = clipboard[dr][dc];
            if (char === " ") continue; // transparent paste: don't blank surroundings
            if (char === "P") {
                if (pastedSpawn) continue;
                clearSpawns();
                pastedSpawn = true;
            }
            setCellChar(c + dc, r + dr, char);
        }
    }
    pasteMode = false;
    generateExports();
    showToast("Block pasted", "check");
}

// Selects active palette element
function selectElement(symbol, elementBtn) {
    selectedElement = symbol;
    // Shape tools keep working with the newly picked element; only the
    // non-painting tools (erase/select) switch back to the brush.
    if (!["paint", "line", "rect", "fill"].includes(currentTool)) {
        setToolMode("paint");
    }

    // Update active UI classes
    document.querySelectorAll(".palette-chip").forEach(item => item.classList.remove("active"));
    if (elementBtn) {
        elementBtn.classList.add("active");
    }
}

function setToolMode(mode) {
    currentTool = mode;
    if (mode !== "select") clearSelection();
    cancelPaste();
    document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("active"));
    const btn = document.getElementById("tool-" + mode);
    if (btn) btn.classList.add("active");
}

function clearGrid() {
    if (confirm("Are you sure you want to clear the entire grid? All unsaved data will be lost.")) {
        pushHistory();
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
    pushHistory();
    // Rebuild grid keeping existing content if possible
    const oldWidth = grid.length;
    const oldHeight = grid[0] ? grid[0].length : 0;
    const oldGrid = JSON.parse(JSON.stringify(grid));
    
    // Read current inputs
    let targetWidth = parseInt(document.getElementById("grid-width").value) || 100;
    let targetHeight = parseInt(document.getElementById("grid-height").value) || 15;
    
    // Clamp to allowed range
    targetWidth = Math.max(10, Math.min(1000, targetWidth));
    targetHeight = Math.max(5, Math.min(100, targetHeight));
    
    // Update inputs to clamped values
    document.getElementById("grid-width").value = targetWidth;
    document.getElementById("grid-height").value = targetHeight;
    
    gridWidth = targetWidth;
    gridHeight = targetHeight;
    
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

/* ===================== THEME (light / dark) ===================== */
const THEME_KEY = "pacoca-map-editor-theme";

function applyTheme(theme) {
    const isLight = theme === "light";
    document.documentElement.setAttribute("data-theme", isLight ? "light" : "dark");

    const btn = document.getElementById("btn-toggle-theme");
    if (btn) {
        // Show the icon for the theme you'd switch TO. Rebuild the <i> because
        // lucide.createIcons() replaces it with an <svg> after the first render.
        btn.innerHTML = `<i data-lucide="${isLight ? "moon" : "sun"}"></i>`;
        btn.title = isLight ? "Switch to dark theme" : "Switch to light theme";
        if (window.lucide) lucide.createIcons();
    }
}

function initTheme() {
    let saved = "dark";
    try {
        saved = localStorage.getItem(THEME_KEY) || "dark";
    } catch (e) {
        console.warn("localStorage is not accessible:", e);
    }
    applyTheme(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    try {
        localStorage.setItem(THEME_KEY, next);
    } catch (e) {
        console.warn("localStorage is not accessible:", e);
    }
    applyTheme(next);
}

function updateCoordinatesDisplay(c, r) {
    // Col c represents X coord: c * X_STEP
    // Visual row r represents Y coord: (gridHeight - 1 - r) * Y_STEP
    const xCoord = (c * X_STEP).toFixed(1);
    const yCoord = ((gridHeight - 1 - r) * Y_STEP).toFixed(1);
    
    document.getElementById("coord-display").innerText =
        `Col ${c}, Row ${r}  ·  X: ${xCoord}m  Y: ${yCoord}m`;
}

// --- Exporters (ASCII & JSON) ---

function generateExports() {
    generateASCIIExport();
    generateJSONExport();
    renderPreview();
}

function generateASCIIExport() {
    let output = "";
    output += `level: ${levelId}\n`;
    output += `name: ${levelName}\n`;
    output += `theme: ${levelTheme}\n`;
    output += `xstep: ${X_STEP.toFixed(1)}\n`;
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

// Scans the drawing grid into the canonical *structured* level JSON consumed by
// the in-engine RuntimeLevelBuilder, the community backend (/api/levels) and the
// browser test flow. Returns the level object (does not touch the DOM).
function buildStructuredMap() {
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
    // Runs are split by "exposure": cells with another '#' directly above them
    // (visual row r - 1) are interior wall blocks and export grass: false, so
    // the converter renders them as solid rock instead of grass-capped slabs.
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

                // Split the run into segments with uniform exposure
                let segStart = cStart;
                while (segStart <= cEnd) {
                    const exposed = getCell(segStart, r - 1) !== "#";
                    let segEnd = segStart;
                    while (segEnd + 1 <= cEnd && (getCell(segEnd + 1, r - 1) !== "#") === exposed) {
                        segEnd++;
                    }

                    let width = (segEnd - segStart + 1) * X_STEP;
                    let x = ((segStart + segEnd) / 2.0) * X_STEP;

                    // Detect if floating (visually, the row below r is r + 1;
                    // r = gridHeight - 1 is the bottom row).
                    let isFloating = r < gridHeight - 1;
                    if (isFloating) {
                        for (let col = segStart; col <= segEnd; col++) {
                            let charBelow = getCell(col, r + 1);
                            if (charBelow === "#" || charBelow === "/" || charBelow === "\\") {
                                isFloating = false;
                                break;
                            }
                        }
                    }

                    const plat = {
                        x: parseFloat(x.toFixed(2)),
                        y: parseFloat(yCoord.toFixed(2)),
                        width: parseFloat(width.toFixed(2)),
                        rock_height: isFloating ? 1.0 : 4.0
                    };
                    if (!exposed) plat.grass = false;
                    platforms.push(plat);
                    segStart = segEnd + 1;
                }
            } else {
                c++;
            }
        }
    }
    
    // 2. Merge Ramps Up '/'
    // Diagonal chains (c+1, visual r-1) make steep ramps (Y_STEP per column);
    // horizontal runs ("///") make ONE gentle ramp rising a single row over the
    // whole run — the recommended walkable slope at the default scale.
    for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
            if (getCell(c, r) === "/" && !visitedRampsUp.has(`${c},${r}`)) {
                let chain = [[c, r]];
                let currC = c;
                let currR = r;

                // Visual diagonal up-right: c+1, r-1
                while (getCell(currC + 1, currR - 1) === "/") {
                    currC++;
                    currR--;
                    chain.push([currC, currR]);
                }
                if (chain.length < 2) continue; // lone '/': horizontal pass below
                chain.forEach(([cc, rr]) => visitedRampsUp.add(`${cc},${rr}`));

                let [cStart, rStart] = chain[0]; // Bottom-left visually
                let [cEnd, rEnd] = chain[chain.length - 1]; // Top-right visually

                let width = (cEnd - cStart + 1) * X_STEP;
                let height = (rStart - rEnd + 1) * Y_STEP;
                let start_x = cStart * X_STEP - (X_STEP / 2.0);
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

    // 2b. Horizontal runs of remaining '/': one ramp rising one row over the run
    for (let r = 0; r < gridHeight; r++) {
        let c = 0;
        while (c < gridWidth) {
            if (getCell(c, r) === "/" && !visitedRampsUp.has(`${c},${r}`)) {
                let cStart = c;
                while (c < gridWidth && getCell(c, r) === "/" && !visitedRampsUp.has(`${c},${r}`)) {
                    visitedRampsUp.add(`${c},${r}`);
                    c++;
                }
                let cEnd = c - 1;
                let width = (cEnd - cStart + 1) * X_STEP;
                let start_x = cStart * X_STEP - (X_STEP / 2.0);
                let start_y = (gridHeight - 1 - r) * Y_STEP - Y_STEP + 0.5;
                ramps_up.push({
                    x: parseFloat(start_x.toFixed(2)),
                    y: parseFloat(start_y.toFixed(2)),
                    width: parseFloat(width.toFixed(2)),
                    height: parseFloat(Y_STEP.toFixed(2))
                });
            } else {
                c++;
            }
        }
    }

    // 3. Merge Ramps Down '\' (diagonal chains: c+1, visual r+1; then horizontal runs)
    for (let r = gridHeight - 1; r >= 0; r--) {
        for (let c = 0; c < gridWidth; c++) {
            if (getCell(c, r) === "\\" && !visitedRampsDown.has(`${c},${r}`)) {
                let chain = [[c, r]];
                let currC = c;
                let currR = r;

                // Visual diagonal down-right: c+1, r+1
                while (getCell(currC + 1, currR + 1) === "\\") {
                    currC++;
                    currR++;
                    chain.push([currC, currR]);
                }
                if (chain.length < 2) continue; // lone '\': horizontal pass below
                chain.forEach(([cc, rr]) => visitedRampsDown.add(`${cc},${rr}`));

                let [cStart, rStart] = chain[0]; // Top-left visually
                let [cEnd, rEnd] = chain[chain.length - 1]; // Bottom-right visually

                let width = (cEnd - cStart + 1) * X_STEP;
                let height = (rEnd - rStart + 1) * Y_STEP;
                let start_x = cStart * X_STEP - (X_STEP / 2.0);
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

    // 3b. Horizontal runs of remaining '\': one ramp falling one row over the run
    for (let r = 0; r < gridHeight; r++) {
        let c = 0;
        while (c < gridWidth) {
            if (getCell(c, r) === "\\" && !visitedRampsDown.has(`${c},${r}`)) {
                let cStart = c;
                while (c < gridWidth && getCell(c, r) === "\\" && !visitedRampsDown.has(`${c},${r}`)) {
                    visitedRampsDown.add(`${c},${r}`);
                    c++;
                }
                let cEnd = c - 1;
                let width = (cEnd - cStart + 1) * X_STEP;
                let start_x = cStart * X_STEP - (X_STEP / 2.0);
                let start_y = (gridHeight - 1 - r) * Y_STEP + 0.5;
                ramps_down.push({
                    x: parseFloat(start_x.toFixed(2)),
                    y: parseFloat(start_y.toFixed(2)),
                    width: parseFloat(width.toFixed(2)),
                    height: parseFloat(Y_STEP.toFixed(2))
                });
            } else {
                c++;
            }
        }
    }

    // 4. Parse Items
    for (let r = 0; r < gridHeight; r++) {
        for (let c = 0; c < gridWidth; c++) {
            const char = grid[c][r];
            const xCoord = c * X_STEP;
            
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
        theme: levelTheme,
        xstep: X_STEP,
        ystep: Y_STEP,
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

    return jsonObj;
}

function generateJSONExport() {
    document.getElementById("json-output").value = JSON.stringify(buildStructuredMap(), null, 2);
}

// --- Dynamic Text Updates ---

function updateDynamicTexts() {
    document.querySelectorAll(".dynamic-level-id").forEach(el => el.innerText = levelId);
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
    if (grid.length) pushHistory();
    levelName = data.name || "Imported Level";
    // Keep the file's ID so recompiling updates the same level; renaming
    // re-derives it.
    levelId = data.level || slugifyLevelName(levelName);
    setLevelTheme(data.theme || "forest");

    document.getElementById("level-name").value = levelName;
    
    // Find limits to establish canvas size
    let maxX = 50; // default min width
    let maxY = 12; // default min height
    
    // Detect import Y_STEP automatically
    let import_Y_STEP = data.ystep || data.y_step;
    if (!import_Y_STEP) {
        import_Y_STEP = 4.0;
        if (data.level === "01" || (data.platforms && data.platforms.some(p => p.y % 4 !== 0))) {
            import_Y_STEP = 1.0;
        }
    }
    let import_X_STEP = data.xstep || data.x_step || 2.0;
    
    Y_STEP = import_Y_STEP;
    X_STEP = import_X_STEP;
    
    const xStepInput = document.getElementById("x-step");
    if (xStepInput) xStepInput.value = X_STEP.toFixed(1);
    const yStepInput = document.getElementById("y-step");
    if (yStepInput) yStepInput.value = Y_STEP.toFixed(1);
    
    // Scan coordinates to set grid size
    const checkCoords = (x, y) => {
        const c = Math.round(x / import_X_STEP);
        const r = Math.round(y / import_Y_STEP);
        if (c > maxX) maxX = c;
        if (r > maxY) maxY = r;
    };
    
    // Adjust y coordinates scan helper
    if (data.spawn) checkCoords(data.spawn[0], data.spawn[1]);
    if (data.platforms) {
        data.platforms.forEach(p => {
            const colWidth = p.width / import_X_STEP;
            const colCenter = p.x / import_X_STEP;
            const cEnd = Math.round(colCenter + colWidth / 2.0 - 0.5);
            if (cEnd > maxX) maxX = cEnd;
            checkCoords(p.x, p.y);
        });
    }
    if (data.ramps_up) {
        data.ramps_up.forEach(r => {
            const cEnd = Math.round((r.x + r.width) / import_X_STEP);
            if (cEnd > maxX) maxX = cEnd;
            checkCoords(r.x, r.y);
            checkCoords(r.x + r.width, r.y + r.height);
        });
    }
    if (data.ramps_down) {
        data.ramps_down.forEach(r => {
            const cEnd = Math.round((r.x + r.width) / import_X_STEP);
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
        const c = Math.round(x / import_X_STEP);
        const r_visual = gridHeight - 1 - r;
        if (c >= 0 && c < gridWidth && r_visual >= 0 && r_visual < gridHeight) {
            grid[c][r_visual] = char;
        }
    };
    
    // Populate platforms
    if (data.platforms) {
        data.platforms.forEach(p => {
            const colWidth = Math.round(p.width / import_X_STEP);
            const colCenter = p.x / import_X_STEP;
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
            const colWidth = Math.round(ramp.width / import_X_STEP);
            const cStart = Math.round((ramp.x + (import_X_STEP / 2.0)) / import_X_STEP);
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
            const colWidth = Math.round(ramp.width / import_X_STEP);
            const cStart = Math.round((ramp.x + (import_X_STEP / 2.0)) / import_X_STEP);
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
    if (grid.length) pushHistory();
    const lines = text.split(/\r?\n/);
    let inGrid = false;
    let gridLines = [];
    
    // Reset steps/theme to standard defaults before parsing header
    X_STEP = 2.0;
    Y_STEP = 3.0;
    setLevelTheme("forest");

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
                } else if (key === "name") {
                    levelName = val;
                    document.getElementById("level-name").value = val;
                } else if (key === "theme") {
                    setLevelTheme(val.toLowerCase());
                } else if (key === "ystep" || key === "y_step") {
                    Y_STEP = parseFloat(val);
                } else if (key === "xstep" || key === "x_step") {
                    X_STEP = parseFloat(val);
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
    
    const xStepInput = document.getElementById("x-step");
    if (xStepInput) xStepInput.value = X_STEP.toFixed(1);
    const yStepInput = document.getElementById("y-step");
    if (yStepInput) yStepInput.value = Y_STEP.toFixed(1);
    
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


// --- Saved maps (persistence) ---

// Maps are stored in the browser (localStorage) — no server needed. Each entry
// keeps the ASCII source so it round-trips back into the editor exactly.
const MAPS_STORE_KEY = "pacoca_maps";

function readMapsStore() {
    try {
        return JSON.parse(localStorage.getItem(MAPS_STORE_KEY) || "{}") || {};
    } catch (e) {
        return {};
    }
}

function writeMapsStore(store) {
    localStorage.setItem(MAPS_STORE_KEY, JSON.stringify(store));
}

function openMaps() {
    const modal = document.getElementById("maps-modal");
    modal.hidden = false;
    lucide.createIcons();
    const hint = document.getElementById("maps-savehint");
    hint.textContent = levelId
        ? `Salvo no navegador como "${levelName}".`
        : "Dê um nome à fase para salvar.";
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

function refreshMapsList() {
    const list = document.getElementById("maps-list");
    const store = readMapsStore();
    const ids = Object.keys(store).sort((a, b) => (store[b].mtime || 0) - (store[a].mtime || 0));
    if (!ids.length) {
        list.innerHTML = '<p class="tab-note">Nenhuma fase salva ainda. Desenhe e clique em "Salvar fase".</p>';
        return;
    }
    list.innerHTML = "";
    ids.forEach(id => {
        const m = store[id];
        const row = document.createElement("div");
        row.className = "map-row";
        const name = m.name ? m.name : "(sem nome)";
        row.innerHTML = `
            <div class="map-meta">
                <span class="map-badge">${escapeHtml(m.theme || "forest").slice(0, 3)}</span>
                <div class="map-text">
                    <span class="map-name">${escapeHtml(name)}</span>
                    <span class="map-sub">${formatMtime((m.mtime || 0) / 1000)}</span>
                </div>
            </div>
            <div class="map-actions">
                <button class="btn btn-sm btn-secondary" title="Abrir para editar"><i data-lucide="pencil"></i> Editar</button>
                <button class="btn btn-sm btn-danger-outline" title="Excluir"><i data-lucide="trash-2"></i></button>
            </div>
        `;
        const [editBtn, delBtn] = row.querySelectorAll("button");
        editBtn.onclick = () => openMap(id);
        delBtn.onclick = () => deleteMap(id, name);
        list.appendChild(row);
    });
    lucide.createIcons();
}

function saveCurrentMap() {
    if (!levelId) { showToast("Dê um nome à fase primeiro!", "alert-triangle"); return; }
    const store = readMapsStore();
    store[levelId] = {
        name: levelName,
        theme: levelTheme,
        format: "txt",
        content: document.getElementById("ascii-output").value,
        mtime: Date.now()
    };
    try {
        writeMapsStore(store);
        showToast(`Fase "${levelName}" salva no navegador`, "save");
        refreshMapsList();
    } catch (err) {
        showToast("Não foi possível salvar (armazenamento cheio?)", "alert-triangle");
    }
}

function openMap(id) {
    const store = readMapsStore();
    const m = store[id];
    if (!m) { showToast("Fase não encontrada", "alert-triangle"); return; }
    if (m.format === "json") {
        importJSON(typeof m.content === "string" ? JSON.parse(m.content) : m.content);
    } else {
        importASCII(m.content);
    }
    closeMaps();
    showToast(`Fase "${m.name || id}" carregada`, "pencil");
}

function deleteMap(id, name) {
    if (!confirm(`Excluir a fase${name ? ` "${name}"` : ""}? Esta ação não pode ser desfeita.`)) return;
    const store = readMapsStore();
    delete store[id];
    writeMapsStore(store);
    showToast(`Fase excluída`, "trash-2");
    refreshMapsList();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

// --- Online play & publish -------------------------------------------------
//
// Fully client-side: no Python server. "Testar" hands the current drawing to the
// WebAssembly game via localStorage (same origin); "Publicar" posts the
// structured level to the community backend (/api/levels). The game and editor
// deploy as sibling folders (../play/ and ../editor/) on the same origin.

const TEST_MAP_KEY = "pacoca_test_map";   // shared with the WASM game (game_settings.gd)
const GAME_URL = "../play/";              // exported Godot WASM build
const API_BASE = "/api";                  // community levels Worker

// Builds the level, checks it has the essentials, and returns it (or null after
// showing a toast). `soft` downgrades the missing-goal error to a warning.
function prepareLevelForPlay() {
    if (!levelId) { showToast("Dê um nome à fase primeiro!", "alert-triangle"); return null; }
    const map = buildStructuredMap();
    const hasTerrain = (map.platforms.length + map.ramps_up.length + map.ramps_down.length) > 0;
    if (!hasTerrain) { showToast("Desenhe ao menos uma plataforma", "alert-triangle"); return null; }
    if (!map.goals.length) showToast("Aviso: a fase não tem chegada (G)", "alert-triangle");
    return map;
}

// "Testar" — open the WASM game straight into the current drawing.
function testLevel() {
    const map = prepareLevelForPlay();
    if (!map) return;
    try {
        localStorage.setItem(TEST_MAP_KEY, JSON.stringify(map));
    } catch (err) {
        showToast("Não foi possível preparar o teste (armazenamento cheio?)", "alert-triangle");
        return;
    }
    showToast("Abrindo a fase no navegador…", "gamepad-2");
    window.open(GAME_URL + "?custom=1", "_blank");
}

// "Jogar" — open the game's main menu.
function runGame() {
    window.open(GAME_URL, "_blank");
}

// "Publicar" — submit the level to the community backend.
async function publishLevel() {
    const map = prepareLevelForPlay();
    if (!map) return;

    const btn = document.getElementById("btn-publish");
    const author = (localStorage.getItem("pacoca_author") || "").trim();
    if (btn) btn.disabled = true;
    showToast("Publicando…", "upload-cloud");
    try {
        const resp = await fetch(`${API_BASE}/levels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: levelName,
                theme: levelTheme,
                map: map,
                author_name: author || undefined
            })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.id) {
            showToast(`Publicada! Fase #${data.id} na comunidade`, "check");
        } else {
            showToast(data.error || `Falha ao publicar (HTTP ${resp.status})`, "alert-triangle");
        }
    } catch (err) {
        showToast("Backend da comunidade indisponível", "alert-triangle");
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Removed with the Python server (native compile/run/telemetry). Kept as no-ops
// so any stray references stay harmless.
function stopGame() {}
function setStopButtonState() {}
function startLiveView() {}
function stopLiveView() {}
function toggleLiveView() {}

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

// --- Level theme ----------------------------------------------------------- //

const LEVEL_THEMES = ["forest", "glacial", "cidade", "caverna"];

function setLevelTheme(theme) {
    levelTheme = LEVEL_THEMES.includes(theme) ? theme : "forest";
    const sel = document.getElementById("level-theme");
    if (sel) sel.value = levelTheme;
}

// --- Preview minimap ------------------------------------------------------- //
// Renders the whole level scaled to fit under the canvas: terrain with the
// theme colors, objects as dots, plus a rectangle showing the visible portion
// of the editing grid. Clicking navigates the grid horizontally.

const THEME_PREVIEW_COLORS = {
    forest: { top: "#4ade80", body: "#8b5e3c" },
    glacial: { top: "#eef4ff", body: "#93bfe3" },
    cidade: { top: "#4b4e55", body: "#909298" },
    caverna: { top: "#7a8a63", body: "#5d5049" },
};

const OBJECT_PREVIEW_COLORS = {
    "o": "#fbbf24", "V": "#ef4444", "F": "#f97316", "D": "#06b6d4",
    "E": "#a855f7", "C": "#22c55e", "S": "#94a3b8", "P": "#3b82f6", "G": "#facc15",
};

function togglePreview() {
    const strip = document.getElementById("preview-strip");
    const btn = document.getElementById("btn-toggle-preview");
    strip.classList.toggle("hidden");
    const visible = !strip.classList.contains("hidden");
    if (btn) btn.classList.toggle("active", visible);
    if (visible) renderPreview();
}

function previewMetrics(strip) {
    const pad = 6;
    const w = strip.clientWidth, h = strip.clientHeight;
    const s = Math.min((w - pad * 2) / gridWidth, (h - pad * 2) / gridHeight);
    return { w, h, s, ox: pad, oy: h - pad - s * gridHeight };
}

function renderPreview() {
    const strip = document.getElementById("preview-strip");
    const canvas = document.getElementById("preview-canvas");
    if (!strip || !canvas || strip.classList.contains("hidden")) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h, s, ox, oy } = previewMetrics(strip);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bg = getComputedStyle(document.documentElement)
        .getPropertyValue("--bg-statusbar").trim() || "#0b1020";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const theme = THEME_PREVIEW_COLORS[levelTheme] || THEME_PREVIEW_COLORS.forest;

    for (let c = 0; c < gridWidth; c++) {
        for (let r = 0; r < gridHeight; r++) {
            const char = grid[c][r];
            if (char === " ") continue;
            const x = ox + c * s, y = oy + r * s;

            if (char === "#") {
                ctx.fillStyle = theme.body;
                ctx.fillRect(x, y, s, s);
                const exposed = r === 0 || grid[c][r - 1] !== "#";
                if (exposed) {
                    ctx.fillStyle = theme.top;
                    ctx.fillRect(x, y, s, Math.max(1, s * 0.35));
                }
            } else if (char === "/") {
                ctx.fillStyle = theme.top;
                ctx.beginPath();
                ctx.moveTo(x, y + s);
                ctx.lineTo(x + s, y);
                ctx.lineTo(x + s, y + s);
                ctx.closePath();
                ctx.fill();
            } else if (char === "\\") {
                ctx.fillStyle = theme.top;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + s, y + s);
                ctx.lineTo(x, y + s);
                ctx.closePath();
                ctx.fill();
            } else if (OBJECT_PREVIEW_COLORS[char]) {
                ctx.fillStyle = OBJECT_PREVIEW_COLORS[char];
                const radius = Math.max(1.2, s * (char === "G" || char === "P" ? 0.5 : 0.35));
                ctx.beginPath();
                ctx.arc(x + s / 2, y + s / 2, radius, 0, Math.PI * 2);
                ctx.fill();
                if (char === "G" || char === "P") {
                    ctx.strokeStyle = "#ffffff";
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    // Visible-viewport indicator
    const container = document.getElementById("grid-container");
    if (container) {
        const cellPx = getCellSize() * zoomLevel;
        const viewC0 = container.scrollLeft / cellPx;
        const viewCols = container.clientWidth / cellPx;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox + viewC0 * s, oy, Math.min(viewCols, gridWidth) * s, gridHeight * s);
    }
}

function onPreviewClick(e) {
    const strip = document.getElementById("preview-strip");
    const container = document.getElementById("grid-container");
    if (!strip || !container) return;
    const { s, ox } = previewMetrics(strip);
    const rect = strip.getBoundingClientRect();
    const c = (e.clientX - rect.left - ox) / s;
    const cellPx = getCellSize() * zoomLevel;
    container.scrollLeft = c * cellPx - container.clientWidth / 2;
    renderPreview();
}

// Cell size in px (used by the preview minimap navigation and scrolling).
function getCellSize() {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--grid-cell-size");
    const n = parseFloat(v);
    return isNaN(n) ? 38 : n;
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
