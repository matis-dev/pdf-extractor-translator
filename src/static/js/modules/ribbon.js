
import { renderLanguageDropdown } from './language_manager.js';
import { updateShapeSettings } from './shapeAnnotations.js';

const ribbonConfig = {
    'home': [
        {
            group: 'File',
            className: 'separator-full',
            tools: [
                { id: 'save-btn', icon: 'bi-floppy', label: 'Save', action: 'globalAction', function: 'saveChanges', testId: 'save-btn' },
                { id: 'save-cloud-btn', icon: 'bi-cloud-upload', label: 'Save to Cloud', action: 'globalAction', function: 'openSaveToCloud', testId: 'save-cloud-btn' },
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
            group: 'History',
            tools: [
                { id: 'undo-btn', icon: 'bi-arrow-counterclockwise', label: 'Undo', action: 'globalAction', function: 'undo' },
                { id: 'redo-btn', icon: 'bi-arrow-clockwise', label: 'Redo', action: 'globalAction', function: 'redo' }
            ]
        },
        {
            group: 'Text',
            tools: [
                { id: 'add-text', icon: 'bi-fonts', label: 'Add Text', action: 'toggleMode', mode: 'text' }
            ]
        },
        {
            group: 'Text Style',
            tools: [
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <select id="font-family-select" class="form-select form-select-sm p-0 ps-2" style="width:110px; height: 30px; font-size: 0.8rem;" onchange="updateTextSettings('fontFamily', this.value)">
                            <option value="Helvetica">Helvetica</option>
                            <option value="Times Roman">Times Roman</option>
                            <option value="Courier">Courier</option>
                        </select>
                        <span class="small">Font</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input id="font-size-input" type="number" class="form-control form-control-sm p-1" value="16" min="8" max="72" style="width: 50px; height: 30px;" onchange="updateTextSettings('fontSize', parseInt(this.value))">
                        <span class="small">Size</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <div class="d-flex gap-1">
                            <button id="btn-text-bold" class="btn btn-outline-secondary btn-sm p-0 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;" onclick="toggleTextProperty('bold')" title="Bold"><i class="bi bi-type-bold"></i></button>
                            <button id="btn-text-italic" class="btn btn-outline-secondary btn-sm p-0 d-flex align-items-center justify-content-center" style="width: 30px; height: 30px;" onclick="toggleTextProperty('italic')" title="Italic"><i class="bi bi-type-italic"></i></button>
                        </div>
                        <span class="small">Style</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="color" class="form-control form-control-color form-control-sm p-1" value="#000000" title="Text Color" onchange="updateTextSettings('color', this.value)" style="width: 38px; height: 30px;">
                        <span class="small">Color</span>
                    </div>`
                }
            ]
        },
        {
            group: 'Background',
            className: 'separator-full',
            tools: [
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1 align-items-center">
                        <input id="bg-color-picker" type="color" class="form-control form-control-color form-control-sm p-1"
                               value="#ffffff" title="Background Color"
                               onchange="updateTextBackgroundSettings('backgroundColor', this.value)"
                               onclick="updateTextBackgroundSettings('wakeUp', null)"
                               style="width: 38px; height: 30px;">
                        <span class="small">Fill</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1 align-items-center">
                        <button id="bg-transparent-btn" class="btn btn-outline-secondary btn-sm p-0 d-flex align-items-center justify-content-center" 
                                style="width: 30px; height: 30px;" 
                                onclick="toggleTextBackgroundTransparency()" 
                                title="No Fill">
                           <i class="bi bi-slash-circle"></i>
                        </button>
                        <span class="small">No Fill</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1 align-items-center">
                        <input id="bg-opacity-slider" type="range" class="form-range m-0" min="0" max="1" step="0.1" value="1" 
                               style="width: 60px; height: 30px;" title="Opacity"
                               oninput="updateTextBackgroundSettings('backgroundAlpha', parseFloat(this.value))">
                        <span class="small">Opacity</span>
                    </div>`
                }
            ]
        },
        {
            group: 'Image',
            tools: [
                { id: 'add-image', icon: 'bi-image', label: 'Add Image', action: 'triggerUpload', inputId: 'image-upload' }
            ]
        },

    ],
    'comment': [
        {
            group: 'Highlighter',
            tools: [
                { id: 'highlight', icon: 'bi-pencil-fill', label: 'Highlight', action: 'setMode', value: 'highlight' },
                { type: 'html', html: '<div class="vr mx-2" style="height: 24px;"></div>' },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="color" class="form-control form-control-color form-control-sm"
                               id="highlight-color" value="#ffeb3b" title="Highlight Color"
                               onchange="updateHighlightSettings('strokeColor', this.value)">
                        <span class="small">Color</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="number" class="form-control form-control-sm"
                               id="highlight-width" value="20" min="5" max="50"
                               style="width: 50px" title="Thickness"
                               onchange="updateHighlightSettings('strokeWidth', parseInt(this.value))">
                        <span class="small">Width</span>
                    </div>`
                }
            ]
        },
        {
            group: 'Notes',
            tools: [
                { id: 'note', icon: 'bi-sticky', label: 'Add Note', action: 'setMode', value: 'note' },
                { type: 'html', html: '<div class="vr mx-2" style="height: 24px;"></div>' },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="color" class="form-control form-control-color form-control-sm" 
                               value="#fff9c4" title="Note Background" 
                               onchange="updateNoteSettings('color', this.value)">
                        <span class="small">Fill</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="color" class="form-control form-control-color form-control-sm" 
                               value="#333333" title="Text Color" 
                               onchange="updateNoteSettings('textColor', this.value)">
                        <span class="small">Text</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="number" class="form-control form-control-sm" 
                               value="12" min="8" max="24" style="width: 50px" 
                               title="Font Size" 
                               onchange="updateNoteSettings('fontSize', parseInt(this.value))">
                        <span class="small">Size</span>
                    </div>`
                },

            ]
        },
        {
            group: 'Shapes',
            tools: [
                { id: 'shape-rect', icon: 'bi-square', label: 'Rectangle', action: 'setShape', value: 'rect' },
                { id: 'shape-ellipse', icon: 'bi-circle', label: 'Ellipse', action: 'setShape', value: 'ellipse' },
                { id: 'shape-line', icon: 'bi-slash-lg', label: 'Line', action: 'setShape', value: 'line' },
                { id: 'shape-arrow', icon: 'bi-arrow-right', label: 'Arrow', action: 'setShape', value: 'arrow' },
                { type: 'html', html: '<div class="vr mx-2" style="height: 24px;"></div>' },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="color" class="form-control form-control-sm form-control-color" 
                               value="#ff0000" 
                               id="shape-stroke-color"
                               title="Stroke Color"
                               onchange="window.updateShapeSettings('strokeColor', this.value)">
                        <span class="small">Color</span>
                    </div>`
                },
                {
                    type: 'html', html: `
                    <div class="d-flex flex-column gap-1">
                        <input type="number" class="form-control form-control-sm" 
                               value="2" min="1" max="20" style="width: 50px;" 
                               id="shape-stroke-width"
                               title="Stroke Width"
                               onchange="window.updateShapeSettings('strokeWidth', parseInt(this.value))">
                        <span class="small">Width</span>
                    </div>`
                }
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
                { id: 'apply-redactions-btn', icon: 'bi-check-circle-fill', label: 'Apply Redactions', action: 'globalAction', function: 'applyRedactions' },
                { id: 'watermark', icon: 'bi-water', label: 'Watermark', action: 'globalAction', function: 'openWatermarkModal' },
                { id: 'manage-security', icon: 'bi-shield-lock', label: 'Security', action: 'globalAction', function: 'manageSecurity' },
                { id: 'sign', icon: 'bi-pen', label: 'Sign', action: 'globalAction', function: 'openSignatureModal' },
                { id: 'pdfa', icon: 'bi-file-earmark-pdf', label: 'PDF/A', action: 'globalAction', function: 'openPdfAModal' }
            ]
        }
    ],
    'tools': [
        {
            group: 'AI Tools',
            tools: [
                { id: 'translate-doc', icon: 'bi-translate', label: 'Translate', action: 'globalAction', function: 'openTranslateModal' },
                { id: 'ocr-doc', icon: 'bi-eye', label: 'OCR', action: 'globalAction', function: 'openOCRModal' },
                { id: 'summarize-doc', icon: 'bi-file-earmark-text', label: 'Summarize', action: 'globalAction', function: 'summarizeDocument' }
            ]
        },
        {
            group: 'Pages',
            tools: [
                { id: 'crop-tool', icon: 'bi-crop', label: 'Crop', action: 'setMode', value: 'crop' },
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
        if (group.className) {
            groupDiv.classList.add(group.className);
        }

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
                if (tool.testId) btn.setAttribute('data-testid', tool.testId);

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
        if (tool.value === 'crop') window.toggleCropMode();
        else if (tool.value === 'text') window.toggleTextMode();
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

    // Export for window access (so inline HTML onchange works)
    window.updateShapeSettings = updateShapeSettings;
    // Actually, we can just set the values in the hidden form if it exists, or create a formData object.

    const form = document.getElementById('process-form');
    if (form) {
        form.querySelector('[name="extraction_type"]').value = type;
        form.querySelector('[name="target_lang"]').value = targetLang;
        window.submitProcessing();
    }
};
