
import { renderLanguageDropdown } from './language_manager.js';

const ribbonConfig = {
    'home': [
        {
            group: 'File',
            tools: [
                { id: 'save-btn', icon: 'bi-floppy', label: 'Save', action: 'globalAction', function: 'saveChanges' },
                { id: 'undo-btn', icon: 'bi-arrow-counterclockwise', label: 'Undo', action: 'globalAction', function: 'undoAction' },
                { id: 'redo-btn', icon: 'bi-arrow-clockwise', label: 'Redo', action: 'globalAction', function: 'redoAction' }
            ]
        },
        {
            group: 'View',
            tools: [
                { id: 'tool-hand', icon: 'bi-hand-index-thumb', label: 'Hand', action: 'setMode', value: 'hand' },
                { id: 'tool-select', icon: 'bi-cursor', label: 'Select', action: 'setMode', value: 'select' },
                { id: 'zoom-in', icon: 'bi-zoom-in', label: 'Zoom In', action: 'setMode', value: 'zoomIn' },
                { id: 'zoom-out', icon: 'bi-zoom-out', label: 'Zoom Out', action: 'setMode', value: 'zoomOut' }
            ]
        }
    ],
    'edit': [
        {
            group: 'Content',
            tools: [
                { id: 'add-text', icon: 'bi-type', label: 'Add Text', action: 'setMode', value: 'text' },
                { id: 'add-image', icon: 'bi-image', label: 'Add Image', action: 'triggerUpload', inputId: 'image-upload' }
            ]
        },
        {
            group: 'Font',
            tools: [
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <select id="font-family-select" class="form-select form-select-sm" style="width:110px; font-size: 0.8rem;" onchange="updateTextSettings('fontFamily', this.value)">
                            <option value="Helvetica">Helvetica</option>
                            <option value="Times Roman">Times Roman</option>
                            <option value="Courier">Courier</option>
                        </select>
                        <span class="small text-muted">Font</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input id="font-size-input" type="number" class="form-control form-control-sm" value="16" min="8" max="72" style="width: 60px" onchange="updateTextSettings('fontSize', parseInt(this.value))">
                        <span class="small text-muted">Size</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <div class="d-flex gap-2 align-items-center">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-secondary p-0 px-2" onclick="toggleTextProperty('bold')" title="Bold"><i class="bi bi-type-bold"></i></button>
                                <button class="btn btn-outline-secondary p-0 px-2" onclick="toggleTextProperty('italic')" title="Italic"><i class="bi bi-type-italic"></i></button>
                            </div>
                            <div style="width: 28px; height: 28px; overflow: hidden; border-radius: 6px; border: 1px solid #ced4da;">
                                <input type="color" class="form-control form-control-color border-0 p-0" value="#000000" title="Text Color" onchange="updateTextSettings('color', this.value)" style="width: 100%; height: 100%;">
                            </div>
                        </div>
                        <span class="small text-muted">Style</span>
                    </div>`
                }
            ]
        },
        {
            group: 'Background',
            tools: [
                {
                    type: 'html', html: `
                    <div class="d-flex align-items-center gap-3 px-1 h-100">
                        <div class="d-flex flex-column align-items-center justify-content-center">
                            <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 2px solid white; outline: 1px solid #ced4da;" title="Background Color">
                               <input type="color" class="form-control form-control-color border-0 p-0" value="#ffffff" onchange="updateTextBackgroundSettings('backgroundColor', this.value)" style="width: 100%; height: 100%; cursor: pointer;">
                            </div>
                            <span class="small text-muted mt-1" style="font-size: 10px;">Fill</span>
                        </div>
                        <div class="vr" style="height: 100%; opacity: 0.2;"></div>
                        <div class="d-flex flex-column justify-content-center gap-2">
                            <div class="d-flex align-items-center gap-2" title="Opacity">
                                <i class="bi bi-circle-half text-muted" style="font-size: 10px;"></i>
                                <input type="range" class="form-range" min="0" max="1" step="0.1" value="1" id="bg-alpha-slider" onchange="updateTextBackgroundSettings('backgroundAlpha', parseFloat(this.value))" style="width: 80px; height: 4px;">
                            </div>
                            <div class="d-flex align-items-center gap-2" title="Transparent Background">
                                <div class="form-check form-switch m-0 min-h-0 d-flex align-items-center ps-0">
                                    <input class="form-check-input m-0" type="checkbox" role="switch" id="bg-transparent-check" onchange="updateTextBackgroundSettings('isTransparent', this.checked)" style="width: 30px; height: 16px;">
                                </div>
                                <label class="small text-muted mb-0" for="bg-transparent-check" style="font-size: 10px; cursor: pointer;">Transparent</label>
                            </div>
                        </div>
                    </div>`
                }
            ]
        },

    ],
    'comment': [
        {
            group: 'Annotations',
            tools: [
                { id: 'highlight', icon: 'bi-pencil-fill', label: 'Highlight', action: 'setMode', value: 'highlight' },
                { id: 'note', icon: 'bi-sticky', label: 'Note', action: 'setMode', value: 'note' }
            ]
        },
        {
            group: 'Shapes',
            tools: [
                { id: 'shape-rect', icon: 'bi-square', label: 'Rectangle', action: 'setShape', value: 'rect' },
                { id: 'shape-ellipse', icon: 'bi-circle', label: 'Ellipse', action: 'setShape', value: 'ellipse' },
                { id: 'shape-line', icon: 'bi-slash-lg', label: 'Line', action: 'setShape', value: 'line' },
                { id: 'shape-arrow', icon: 'bi-arrow-right', label: 'Arrow', action: 'setShape', value: 'arrow' }
            ]
        },
        {
            group: 'Style',
            tools: [
                { type: 'html', html: `<div class="d-flex flex-column gap-1"><input type="color" class="form-control form-control-color form-control-sm" value="#ff0000" title="Color" onchange="updateShapeSettings('strokeColor', this.value)"><span class="small">Color</span></div>` },
                { type: 'html', html: `<div class="d-flex flex-column gap-1"><input type="number" class="form-control form-control-sm" value="2" min="1" max="20" title="Width" style="width: 50px" onchange="updateShapeSettings('strokeWidth', parseInt(this.value))"><span class="small">Width</span></div>` }
            ]
        }
    ],
    'forms': [
        {
            group: 'Fields',
            tools: [
                { id: 'field-text', icon: 'bi-input-cursor-text', label: 'Text Field', action: 'custom', function: () => window.toggleFormMode('textfield') },
                { id: 'field-check', icon: 'bi-check-square', label: 'Checkbox', action: 'custom', function: () => window.toggleFormMode('checkbox') },
                { id: 'field-radio', icon: 'bi-ui-radios', label: 'Radio', action: 'custom', function: () => window.toggleFormMode('radio') },
                { id: 'field-dropdown', icon: 'bi-menu-button-wide', label: 'Dropdown', action: 'custom', function: () => window.toggleFormMode('dropdown') },
                { id: 'field-signature', icon: 'bi-pen', label: 'Signature', action: 'custom', function: () => window.toggleFormMode('signature') }
            ]
        },
        {
            group: 'Appearance',
            tools: [
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <select class="form-select form-select-sm" style="width:110px; font-size: 0.8rem;" onchange="updateFormSettings('fontFamily', this.value)">
                            <option value="Helvetica">Helvetica</option>
                            <option value="Times Roman">Times Roman</option>
                            <option value="Courier">Courier</option>
                        </select>
                        <span class="small text-muted">Font</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="number" class="form-control form-control-sm" value="12" min="6" max="72" style="width: 60px" onchange="updateFormSettings('fontSize', parseInt(this.value))">
                        <span class="small text-muted">Size</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <div class="d-flex gap-1 align-items-center">
                            <input type="color" class="form-control form-control-color form-control-sm" value="#000000" title="Text Color" onchange="updateFormSettings('textColor', this.value)">
                            <input type="color" class="form-control form-control-color form-control-sm" value="#ffffff" title="Background Color" onchange="updateFormSettings('backgroundColor', this.value)">
                        </div>
                        <span class="small text-muted">Colors</span>
                    </div>`
                }
            ]
        }
    ],
    'protect': [
        {
            group: 'Security',
            tools: [
                { id: 'redact', icon: 'bi-eraser-fill', label: 'Redact', action: 'setMode', value: 'redact' },
                { id: 'watermark', icon: 'bi-water', label: 'Watermark', action: 'globalAction', function: 'openWatermarkModal' },
                { id: 'manage-security', icon: 'bi-shield-lock', label: 'Security', action: 'globalAction', function: 'manageSecurity' },
                { id: 'sign', icon: 'bi-pen', label: 'Sign', action: 'globalAction', function: 'openSignatureModal' }
            ]
        }
    ],
    'tools': [
        {
            group: 'Pages',
            tools: [
                { id: 'page-numbers', icon: 'bi-123', label: 'Page #', action: 'globalAction', function: 'openPageNumbersModal' }
            ]
        },
        {
            group: 'File',
            tools: [
                { id: 'split', icon: 'bi-scissors', label: 'Split', action: 'globalAction', function: 'splitPdf' },
                { id: 'sharding', icon: 'bi-grid-3x3', label: 'Split All Pages', action: 'globalAction', function: 'shardPdf' },
                { id: 'merge', icon: 'bi-files', label: 'Append', action: 'triggerUpload', inputId: 'pdf-append' },
            ]
        },
        {
            group: 'Compare',
            tools: [
                { id: 'compare-pdf', icon: 'bi-file-diff', label: 'Compare', action: 'globalAction', function: 'openCompareModal' }
            ]
        }
    ],
    'process': [
        {
            group: 'Extraction',
            tools: [
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <select id="ribbon-extract-type" class="form-select form-select-sm" style="width:180px; font-size: 0.8rem;">
                            <option value="word">Word (.docx)</option>
                            <option value="odt">OpenDocument (.odt)</option>
                            <option value="csv">Tables (.csv)</option>
                        </select>
                        <span class="small text-muted">Format</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <select id="ribbon-target-lang" class="form-select form-select-sm" style="width:180px; font-size: 0.8rem;">
                            <option value="none">No Trans.</option>
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                        </select>
                         <span class="small text-muted">Translation</span>
                    </div>`
                },
                { id: 'start-process', icon: 'bi-play-circle', label: 'Run', action: 'custom', function: () => submitRibbonProcessing() }
            ]
        }
    ]
};

export function initRibbon() {
    console.log("Initializing Ribbon...");
    const container = document.getElementById('ribbon-content');
    const tabContainer = document.getElementById('tab-bar');

    if (!container || !tabContainer) {
        console.error("Ribbon containers not found!", container, tabContainer);
        return;
    }

    console.log("Ribbon containers found. Rendering tabs...");

    // Find or create a wrapper for tabs to avoid wiping static content
    let tabsWrapper = document.getElementById('ribbon-tabs-wrapper');
    if (!tabsWrapper) {
        tabsWrapper = document.createElement('div');
        tabsWrapper.id = 'ribbon-tabs-wrapper';
        tabsWrapper.className = 'd-flex gap-1';
        // Insert after the first child (Back/Filename group)
        if (tabContainer.firstChild) {
            tabContainer.insertBefore(tabsWrapper, tabContainer.children[1] || null);
        } else {
            tabContainer.appendChild(tabsWrapper);
        }
    }

    // Render Tabs into wrapper
    tabsWrapper.innerHTML = '';
    Object.keys(ribbonConfig).forEach(tabKey => {
        const btn = document.createElement('button');
        btn.className = 'tab-btn';
        btn.textContent = tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
        btn.onclick = () => switchTab(tabKey);
        tabsWrapper.appendChild(btn);
    });

    // Default to Home
    switchTab('home');
    document.body.setAttribute('data-ribbon-initialized', 'true');
    console.log("Ribbon initialized!");
}
window.initRibbon = initRibbon;

function switchTab(tabName) {
    const container = document.getElementById('ribbon-content');
    container.innerHTML = '';

    // Update Active Tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.textContent.toLowerCase() === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    const groups = ribbonConfig[tabName];
    if (!groups) return;

    groups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'ribbon-group';

        // Group Content
        const toolsDiv = document.createElement('div');
        toolsDiv.className = 'ribbon-tools';

        group.tools.forEach(tool => {
            if (tool.type === 'html') {
                const wrapper = document.createElement('div');
                wrapper.className = 'ribbon-custom h-100';
                wrapper.innerHTML = tool.html;
                toolsDiv.appendChild(wrapper);
            } else {
                const btn = document.createElement('button');
                btn.className = 'ribbon-btn';
                btn.innerHTML = `<i class="bi ${tool.icon}"></i><span>${tool.label}</span>`;
                btn.id = tool.id;

                if (tool.action) {
                    btn.onclick = () => handleAction(tool);
                }
                toolsDiv.appendChild(btn);
            }
        });

        groupDiv.appendChild(toolsDiv);

        // Group Label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'ribbon-group-label';
        labelDiv.textContent = group.group;
        groupDiv.appendChild(labelDiv);


        container.appendChild(groupDiv);
    });

    // Language Dropdown Hook
    if (tabName === 'process') {
        setTimeout(() => {
            renderLanguageDropdown('ribbon-target-lang', 'none', false, null, true);
            // We could also add a source lang dropdown here if we want to modify the ribbonConfig to include it
        }, 0);
    }
}


function handleAction(tool) {
    if (tool.action === 'setMode') {
        if (tool.value === 'text') window.toggleTextMode();
        else if (tool.value === 'select') window.toggleSelectMode();
        else if (tool.value === 'highlight') window.toggleHighlightMode();
        else if (tool.value === 'redact') window.toggleRedactMode();
        else if (tool.value === 'note') window.toggleNoteMode();
        else if (tool.value === 'hand') {
            window.toggleHandMode();
        } else if (tool.value === 'zoomIn') {
            window.toggleZoomInMode();
        } else if (tool.value === 'zoomOut') {
            window.toggleZoomOutMode();
        }
    } else if (tool.action === 'setShape') {
        window.setShapeMode(tool.value);
    } else if (tool.action === 'triggerUpload') {
        if (window.resetModes) window.resetModes();
        document.getElementById(tool.inputId).click();
    } else if (tool.action === 'globalAction') {
        if (window[tool.function]) window[tool.function]();
    } else if (tool.action === 'custom') {
        if (typeof tool.function === 'function') tool.function();
    }
}

// Global wrappers for history
window.undoAction = () => window.appHistory && window.appHistory.undo();
window.redoAction = () => window.appHistory && window.appHistory.redo();

// Helper to submit processing from ribbon inputs
window.submitRibbonProcessing = function () {
    const type = document.getElementById('ribbon-extract-type').value;
    const targetLang = document.getElementById('ribbon-target-lang').value;

    // We need to inject these into the hidden form or call the submit function with these values
    // The existing submitProcessing() reads from the big form in sidebar.
    // Let's manually populate that form's hidden inputs if possible, or just create a new request object.

    // Direct call to endpoint? Or leverage existing form submission function?
    // Let's try to reuse submitProcessing if we can map values.

    // For now, let's just log or alert
    // Actually, we can just set the values in the hidden form if it exists, or create a formData object.

    const form = document.getElementById('process-form');
    if (form) {
        form.querySelector('[name="extraction_type"]').value = type;
        form.querySelector('[name="target_lang"]').value = targetLang;
        window.submitProcessing();
    }
};
