// ============================================================================
// Application State
// ============================================================================

// Application state
const app = {
    tracer: new Tracer(),
    selectedFileId: null,
    selectedTraceIds: new Set(), // Set of selected trace identifiers (fileId:traceName)
    lastSelectedIndex: null, // For shift-click range selection
    isDraggingSelection: false // Track if we're drag-selecting
};

// DOM elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const loadButton = document.getElementById('loadButton');
const fileTable = document.getElementById('fileTable');
const fileTableBody = document.getElementById('fileTableBody');
const columnTable = document.getElementById('columnTable');
const columnTableBody = document.getElementById('columnTableBody');
const noFileSelected = document.getElementById('noFileSelected');
const filesTableContainer = document.getElementById('filesTableContainer');
const summaryPlaceholder = document.getElementById('summaryPlaceholder');
const summaryTableContainer = document.getElementById('summaryTableContainer');
const summaryTableHeader = document.getElementById('summaryTableHeader');
const summaryTableBody = document.getElementById('summaryTableBody');
const densityPlaceholder = document.getElementById('densityPlaceholder');
const densityPlotContainer = document.getElementById('densityPlotContainer');

// ============================================================================
// Initialization
// ============================================================================

// Set up draggable dividers
function setupDraggableDividers() {
    // Horizontal divider (between files and columns)
    const horizontalDivider = document.getElementById('horizontalDivider');
    const filesSection = document.getElementById('filesSection');
    const columnsSection = document.getElementById('columnsSection');
    const leftPanel = document.getElementById('leftPanel');
    
    let isDraggingHorizontal = false;
    
    horizontalDivider.addEventListener('mousedown', (e) => {
        isDraggingHorizontal = true;
        e.preventDefault();
    });
    
    // Vertical divider (between left and right panels)
    const verticalDivider = document.getElementById('verticalDivider');
    const rightPanel = document.getElementById('rightPanel');
    
    let isDraggingVertical = false;
    
    verticalDivider.addEventListener('mousedown', (e) => {
        isDraggingVertical = true;
        e.preventDefault();
    });
    
    // Global mouse move handler
    document.addEventListener('mousemove', (e) => {
        if (isDraggingHorizontal) {
            const leftPanelRect = leftPanel.getBoundingClientRect();
            const newFilesHeight = e.clientY - leftPanelRect.top;
            const minHeight = 80; // Minimum height to show at least one row
            const maxHeight = leftPanelRect.height - minHeight - 5; // 5px for divider
            
            if (newFilesHeight >= minHeight && newFilesHeight <= maxHeight) {
                const filesPercent = (newFilesHeight / leftPanelRect.height) * 100;
                const columnsPercent = 100 - filesPercent;
                
                filesSection.style.flex = `0 0 ${filesPercent}%`;
                columnsSection.style.flex = `0 0 ${columnsPercent}%`;
            }
        }
        
        if (isDraggingVertical) {
            const containerRect = document.querySelector('.content-container').getBoundingClientRect();
            const newLeftWidth = e.clientX - containerRect.left;
            const minLeftWidth = 250; // Minimum width for left panel
            const minRightWidth = 300; // Minimum width for right panel
            const maxLeftWidth = containerRect.width - minRightWidth - 5; // 5px for divider
            
            if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
                leftPanel.style.width = `${newLeftWidth}px`;
            }
        }
    });
    
    // Global mouse up handler
    document.addEventListener('mouseup', () => {
        isDraggingHorizontal = false;
        isDraggingVertical = false;
    });
}

// Initialize
function init() {
    setupEventListeners();
    setupDraggableDividers();
}

// ============================================================================
// Event Handlers
// ============================================================================

// Set up event listeners
function setupEventListeners() {
    // Load button
    loadButton.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
        fileInput.value = ''; // Reset input
    });
    
    // Drag and drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling to filesTableContainer
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    // Also allow drop on the entire files table container
    filesTableContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    filesTableContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    });
}

// Handle file loading
function handleFiles(files) {
    Array.from(files).forEach(file => {
        // Check if file is CSV, TSV, or LOG
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension === 'csv' || extension === 'tsv' || extension === 'txt' || extension === 'log') {
            loadFile(file);
        } else {
            alert(`File "${file.name}" is not a supported file type (CSV/TSV/LOG).`);
        }
    });
}

// Load and parse a file
function loadFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const content = e.target.result;
        const parsedData = parseFile(content, file.name);
        
        if (parsedData) {
            // Create TraceFile object
            const fileId = Date.now() + Math.random();
            const traceFile = new TraceFile(fileId, file.name, parsedData.stateColumn);
            
            // Set state values
            traceFile.setStates(parsedData.states);
            
            // Create and add Trace objects for each column
            parsedData.columns.forEach(columnData => {
                const trace = new Trace(
                    columnData.name,
                    columnData.values,
                    columnData.type
                );
                traceFile.addTrace(trace);
            });
            
            // Set initial burnin to 10% of max state
            const initialBurnin = Math.floor(traceFile.getMaxState() * 0.1);
            traceFile.setBurnin(initialBurnin);
            
            // Add to tracer
            app.tracer.addTraceFile(traceFile);
            
            // Update UI
            renderFileTable();
            
            // If this is the first file, select it and its first trace
            if (app.tracer.getTraceFileCount() === 1) {
                selectFile(traceFile.getId());
                // Select the first trace
                const firstTrace = traceFile.getTraces()[0];
                if (firstTrace) {
                    const firstTraceId = `${traceFile.getId()}:${firstTrace.getName()}`;
                    app.selectedTraceIds.add(firstTraceId);
                    app.lastSelectedIndex = 0;
                    renderColumnTable();
                }
            }
        }
    };
    
    reader.onerror = () => {
        alert(`Error reading file "${file.name}"`);
    };
    
    reader.readAsText(file);
}

// ============================================================================
// File Parsing
// ============================================================================

// Parse CSV/TSV/LOG file
function parseFile(content, filename) {
    try {
        // Determine delimiter (CSV or TSV)
        const extension = filename.split('.').pop().toLowerCase();
        const delimiter = extension === 'tsv' || extension === 'log' ? '\t' : ',';
        
        // Split into lines and filter out comment lines starting with #
        const allLines = content.trim().split('\n');
        const lines = allLines.filter(line => !line.trim().startsWith('#'));
        if (lines.length < 2) {
            alert(`File "${filename}" must have at least a header and one data row.`);
            return null;
        }
        
        // Parse header
        const headers = lines[0].split(delimiter).map(h => h.trim());
        const stateColumn = headers[0];
        
        // Validate that the first column is named 'state' (case-insensitive)
        if (stateColumn.toLowerCase() !== 'state') {
            alert(`File "${filename}" validation error:\n\nThe first column must be named 'state' (case-insensitive).\nFound: "${stateColumn}"`);
            return null;
        }
        
        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(delimiter).map(v => v.trim());
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }
        
        // Extract state values
        const states = data.map(row => row[stateColumn]);
        
        // Validate state column
        const stateValidation = validateStateColumn(states, filename);
        if (!stateValidation.valid) {
            alert(stateValidation.message);
            return null;
        }
        
        // Process columns (excluding the first column which is the state number)
        const columns = headers.slice(1).map(name => {
            const values = data.map(row => row[name]);
            const type = detectColumnType(values);
            return {
                name: name,
                values: values,
                type: type
            };
        });
        
        return {
            states: states,
            columns: columns,
            stateColumn: stateColumn
        };
    } catch (error) {
        alert(`Error parsing file "${filename}": ${error.message}`);
        return null;
    }
}

// Validate state column values
function validateStateColumn(states, filename) {
    // Check that we have at least 2 values to determine interval
    if (states.length < 2) {
        return {
            valid: false,
            message: `File "${filename}" validation error:\n\nNeed at least 2 data rows to validate state column.`
        };
    }
    
    // Check that all values are integers
    const stateNumbers = [];
    for (let i = 0; i < states.length; i++) {
        const value = states[i];
        const num = parseFloat(value);
        
        // Check if it's a valid number
        if (isNaN(num)) {
            return {
                valid: false,
                message: `File "${filename}" validation error:\n\nState column must contain only integer values.\nFound non-numeric value "${value}" at line ${i + 2} (data row ${i + 1}).`
            };
        }
        
        // Check if it's an integer
        if (!Number.isInteger(num)) {
            return {
                valid: false,
                message: `File "${filename}" validation error:\n\nState column must contain only integer values.\nFound non-integer value "${value}" at line ${i + 2} (data row ${i + 1}).`
            };
        }
        
        stateNumbers.push(num);
    }
    
    // Determine the expected interval from the first two values
    const expectedInterval = stateNumbers[1] - stateNumbers[0];
    
    // Check that interval is positive
    if (expectedInterval <= 0) {
        return {
            valid: false,
            message: `File "${filename}" validation error:\n\nState values must increase.\nFound state ${stateNumbers[0]} followed by ${stateNumbers[1]} at line 3 (data row 2).`
        };
    }
    
    // Validate that all subsequent values maintain this interval
    for (let i = 1; i < stateNumbers.length; i++) {
        const expectedValue = stateNumbers[0] + (i * expectedInterval);
        const actualValue = stateNumbers[i];
        
        if (actualValue !== expectedValue) {
            return {
                valid: false,
                message: `File "${filename}" validation error:\n\nState values must increase by a fixed interval of ${expectedInterval}.\nExpected state ${expectedValue} but found ${actualValue} at line ${i + 2} (data row ${i + 1}).`
            };
        }
    }
    
    return { valid: true };
}

// Detect column type (continuous, integer, or discrete)
function detectColumnType(values) {
    const filteredValues = values.filter(v => v !== '' && v !== null && v !== undefined);
    
    if (filteredValues.length === 0) return 'unknown';
    
    // Check if all values are numeric
    const numericValues = filteredValues.filter(v => !isNaN(parseFloat(v)));
    
    if (numericValues.length === 0) {
        return 'discrete';
    }
    
    if (numericValues.length < filteredValues.length * 0.9) {
        return 'discrete';
    }
    
    // Check if all numeric values are integers
    const integers = numericValues.filter(v => {
        const num = parseFloat(v);
        return Number.isInteger(num);
    });
    
    if (integers.length === numericValues.length) {
        // Check if there are only a few unique values (likely discrete)
        const uniqueValues = new Set(integers);
        if (uniqueValues.size < 20) {
            return 'discrete';
        }
        return 'integer';
    }
    
    return 'continuous';
}

// ============================================================================
// UI Rendering
// ============================================================================

// Render the file table
function renderFileTable() {
    const traceFiles = app.tracer.getTraceFiles();
    
    if (traceFiles.length === 0) {
        dropZone.classList.remove('d-none');
        fileTable.classList.add('d-none');
        return;
    }
    
    dropZone.classList.add('d-none');
    fileTable.classList.remove('d-none');
    
    fileTableBody.innerHTML = '';
    
    traceFiles.forEach(traceFile => {
        const row = document.createElement('tr');
        row.dataset.fileId = traceFile.getId();
        
        if (traceFile.getId() === app.selectedFileId) {
            row.classList.add('selected');
        }
        
        row.innerHTML = `
            <td>${traceFile.getName()}</td>
            <td class="text-end">${traceFile.getMaxState()}</td>
            <td class="text-end">${traceFile.getRowCount()}</td>
            <td class="text-end"><input type="number" class="burnin-input" value="${traceFile.getBurnin()}" min="0" max="${traceFile.getMaxState()}" step="1" data-file-id="${traceFile.getId()}"></td>
        `;
        
        row.addEventListener('click', () => {
            selectFile(traceFile.getId());
        });
        
        fileTableBody.appendChild(row);
    });
    
    // Add event listeners for burnin inputs (using event delegation)
    fileTableBody.querySelectorAll('.burnin-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const fileId = parseFloat(e.target.dataset.fileId);
            const burninValue = parseInt(e.target.value, 10);
            const traceFile = app.tracer.getTraceFile(fileId);
            
            if (traceFile) {
                // Validate and clamp value
                const maxState = traceFile.getMaxState();
                const clampedValue = Math.max(0, Math.min(burninValue, maxState));
                
                // Update if different from input
                if (clampedValue !== burninValue) {
                    e.target.value = clampedValue;
                }
                
                // Set burnin in TraceFile (which propagates to all traces)
                traceFile.setBurnin(clampedValue);
            }
        });
        
        // Prevent clicking on input from selecting the row
        input.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

// Select a file
function selectFile(fileId) {
    app.selectedFileId = fileId;
    app.selectedTraceIds.clear(); // Clear trace selections when switching files
    app.lastSelectedIndex = null;
    renderFileTable();
    renderColumnTable();
}

// Render the column table
function renderColumnTable() {
    if (app.selectedFileId === null) {
        noFileSelected.classList.remove('d-none');
        columnTable.classList.add('d-none');
        return;
    }
    
    const traceFile = app.tracer.getTraceFile(app.selectedFileId);
    if (!traceFile) return;
    
    noFileSelected.classList.add('d-none');
    columnTable.classList.remove('d-none');
    
    columnTableBody.innerHTML = '';
    
    const traces = traceFile.getTraces();
    traces.forEach((trace, index) => {
        const row = document.createElement('tr');
        const traceId = `${app.selectedFileId}:${trace.getName()}`;
        
        // Mark as selected if in the set
        if (app.selectedTraceIds.has(traceId)) {
            row.classList.add('selected');
            console.log('Adding selected class to:', trace.getName());
        }
        
        row.dataset.traceId = traceId;
        row.dataset.traceIndex = index;
        
        // Type badge color
        let badgeClass = 'bg-secondary';
        const type = trace.getType();
        if (type === 'continuous') badgeClass = 'bg-primary';
        else if (type === 'integer') badgeClass = 'bg-success';
        else if (type === 'discrete') badgeClass = 'bg-warning';
        
        row.innerHTML = `
            <td>${trace.getName()}</td>
            <td><span class="badge ${badgeClass}">${type}</span></td>
        `;
        
        // Mouse down - start selection
        row.addEventListener('mousedown', (e) => {
            handleTraceMouseDown(e, traceId, index, traces);
        });
        
        // Mouse enter - for drag selection
        row.addEventListener('mouseenter', (e) => {
            if (app.isDraggingSelection) {
                handleTraceDragSelect(traceId);
            }
        });
        
        columnTableBody.appendChild(row);
    });
    
    // Add mouse up listener to document to end drag selection
    document.addEventListener('mouseup', () => {
        app.isDraggingSelection = false;
    });
}

// ============================================================================
// Start Application
// ============================================================================

// Handle trace selection with mouse down
function handleTraceMouseDown(e, traceId, index, traces) {
    e.preventDefault();
    
    console.log('Trace clicked:', traceId, 'Selected IDs before:', Array.from(app.selectedTraceIds));
    
    if (e.metaKey || e.ctrlKey) {
        // Cmd/Ctrl-click: toggle selection
        if (app.selectedTraceIds.has(traceId)) {
            app.selectedTraceIds.delete(traceId);
        } else {
            app.selectedTraceIds.add(traceId);
        }
        app.lastSelectedIndex = index;
    } else if (e.shiftKey && app.lastSelectedIndex !== null) {
        // Shift-click: extend selection
        const start = Math.min(app.lastSelectedIndex, index);
        const end = Math.max(app.lastSelectedIndex, index);
        
        for (let i = start; i <= end; i++) {
            const trace = traces[i];
            const id = `${app.selectedFileId}:${trace.getName()}`;
            app.selectedTraceIds.add(id);
        }
    } else {
        // Regular click: clear and select one
        app.selectedTraceIds.clear();
        app.selectedTraceIds.add(traceId);
        app.lastSelectedIndex = index;
        app.isDraggingSelection = true; // Start drag selection
    }
    
    console.log('Selected IDs after:', Array.from(app.selectedTraceIds));
    renderColumnTable();
    renderSummaryTable();
    renderDensityPlot();
}

// Handle drag selection
function handleTraceDragSelect(traceId) {
    if (!app.selectedTraceIds.has(traceId)) {
        app.selectedTraceIds.add(traceId);
        renderColumnTable();
        renderSummaryTable();
        renderDensityPlot();
    }
}

// Render the summary statistics table
function renderSummaryTable() {
    // Get selected traces
    const selectedTraces = [];
    
    app.selectedTraceIds.forEach(traceId => {
        const idx = traceId.indexOf(':');
        const fileId = traceId.substring(0, idx);
        const traceName = traceId.substring(idx + 1);
        const traceFile = app.tracer.getTraceFile(parseFloat(fileId));
        if (traceFile) {
            const trace = traceFile.getTrace(traceName);
            if (trace) {
                selectedTraces.push({
                    fileId: fileId,
                    fileName: traceFile.getName(),
                    trace: trace
                });
            }
        }
    });
    
    // Show placeholder if no traces selected
    if (selectedTraces.length === 0) {
        summaryPlaceholder.classList.remove('d-none');
        summaryTableContainer.classList.add('d-none');
        return;
    }
    
    summaryPlaceholder.classList.add('d-none');
    summaryTableContainer.classList.remove('d-none');
    
    // Build header row
    summaryTableHeader.innerHTML = '<th>Statistic</th>';
    const multipleFiles = new Set(selectedTraces.map(t => t.fileId)).size > 1;
    
    selectedTraces.forEach(item => {
        const th = document.createElement('th');
        if (multipleFiles) {
            th.textContent = `${item.fileName} : ${item.trace.getName()}`;
        } else {
            th.textContent = item.trace.getName();
        }
        summaryTableHeader.appendChild(th);
    });
    
    // Build data rows
    const stats = [
        { label: 'Mean', getter: t => t.getMean() },
        { label: 'Std Error', getter: t => t.getStdErr() },
        { label: 'Std Dev', getter: t => t.getStdDev() },
        { label: 'Variance', getter: t => t.getVariance() },
        { label: 'Median', getter: t => t.getMedian() },
        { label: 'Range', getter: t => t.getRange() },
        { label: 'Min', getter: t => t.getMin() },
        { label: 'Max', getter: t => t.getMax() },
        { label: '95% HPD Lower', getter: t => t.getHPD95Lower() },
        { label: '95% HPD Upper', getter: t => t.getHPD95Upper() },
        { label: 'ACT', getter: t => t.getACT() },
        { label: 'ESS', getter: t => t.getESS() },
        { label: 'Samples', getter: t => t.getSampleCount() }
    ];
    
    summaryTableBody.innerHTML = '';
    
    stats.forEach(stat => {
        const row = document.createElement('tr');
        const labelCell = document.createElement('td');
        labelCell.textContent = stat.label;
        row.appendChild(labelCell);
        
        selectedTraces.forEach(item => {
            const valueCell = document.createElement('td');
            const value = stat.getter(item.trace);
            if (value === null) {
                valueCell.textContent = 'N/A';
            } else if (stat.label === 'Samples') {
                valueCell.textContent = value.toFixed(0);
            } else if (stat.label === 'ACT' || stat.label === 'ESS') {
                valueCell.textContent = value.toFixed(2);
            } else {
                valueCell.textContent = value.toFixed(4);
            }
            row.appendChild(valueCell);
        });
        
        summaryTableBody.appendChild(row);
    });
}

// ============================================================================
// Visualization Functions
// ============================================================================

// Calculate Kernel Density Estimation (KDE) using Gaussian kernel
function calculateKDE(data, bandwidth = null) {
    if (data.length === 0) return { x: [], y: [] };
    
    // Auto-select bandwidth using Silverman's rule of thumb if not provided
    if (bandwidth === null) {
        const n = data.length;
        const sorted = [...data].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(n * 0.25)];
        const q3 = sorted[Math.floor(n * 0.75)];
        const iqr = q3 - q1;
        const stdDev = Math.sqrt(data.reduce((sum, x) => sum + Math.pow(x - data.reduce((a, b) => a + b, 0) / n, 2), 0) / n);
        bandwidth = 0.9 * Math.min(stdDev, iqr / 1.34) * Math.pow(n, -0.2);
    }
    
    // Create evaluation points
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const padding = range * 0.1;
    const numPoints = 200;
    const step = (range + 2 * padding) / numPoints;
    
    const x = [];
    const y = [];
    
    // Gaussian kernel function
    const gaussian = (u) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
    
    // Evaluate KDE at each point
    for (let i = 0; i <= numPoints; i++) {
        const xi = min - padding + i * step;
        let density = 0;
        
        for (let j = 0; j < data.length; j++) {
            const u = (xi - data[j]) / bandwidth;
            density += gaussian(u);
        }
        
        density /= (data.length * bandwidth);
        
        x.push(xi);
        y.push(density);
    }
    
    return { x, y };
}

// Render the density plot
function renderDensityPlot() {
    // Get selected traces
    const selectedTraces = [];
    
    app.selectedTraceIds.forEach(traceId => {
        const idx = traceId.indexOf(':');
        const fileId = traceId.substring(0, idx);
        const traceName = traceId.substring(idx + 1);
        const traceFile = app.tracer.getTraceFile(parseFloat(fileId));
        if (traceFile) {
            const trace = traceFile.getTrace(traceName);
            if (trace) {
                selectedTraces.push({
                    fileId: fileId,
                    fileName: traceFile.getName(),
                    trace: trace
                });
            }
        }
    });
    
    // Show placeholder if no traces selected
    if (selectedTraces.length === 0) {
        densityPlaceholder.classList.remove('d-none');
        densityPlotContainer.classList.add('d-none');
        return;
    }
    
    densityPlaceholder.classList.add('d-none');
    densityPlotContainer.classList.remove('d-none');
    
    // Check if multiple files
    const multipleFiles = new Set(selectedTraces.map(t => t.fileId)).size > 1;
    
    // Create traces for Plotly
    const plotData = [];
    
    selectedTraces.forEach(item => {
        // Get values after applying burnin
        const trace = item.trace;
        const allValues = trace.getValues().map(v => parseFloat(v)).filter(v => !isNaN(v));
        const burninSamples = Math.min(trace.getBurnin(), allValues.length - 1);
        const values = burninSamples > 0 ? allValues.slice(burninSamples) : allValues;
        
        if (values.length === 0) return;
        
        // Calculate KDE
        const kde = calculateKDE(values);
        
        // Create trace name
        const traceName = multipleFiles 
            ? `${item.fileName} : ${trace.getName()}`
            : trace.getName();
        
        plotData.push({
            x: kde.x,
            y: kde.y,
            type: 'scatter',
            mode: 'lines',
            name: traceName,
            line: { width: 2 }
        });
    });
    
    // Layout configuration
    const layout = {
        title: 'Density Distribution',
        xaxis: {
            title: 'Value',
            showgrid: true,
            zeroline: false
        },
        yaxis: {
            title: 'Density',
            showgrid: true,
            zeroline: false
        },
        hovermode: 'closest',
        showlegend: true,
        legend: {
            x: 1.05,
            y: 1,
            xanchor: 'left',
            yanchor: 'top'
        },
        margin: {
            l: 60,
            r: 150,
            t: 60,
            b: 60
        }
    };
    
    // Plot configuration
    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };
    
    // Create the plot
    Plotly.newPlot(densityPlotContainer, plotData, layout, config);
}

// Initialize the application when DOM is ready
init();
