
import { showToast, showProcessingOverlay, hideProcessingOverlay } from '../utils.js';

let pipelineSteps = [];

const availableOps = [
    { id: 'sanitize', label: 'Sanitize (Remove JS)', icon: 'bi-bandaid' },
    { id: 'flatten', label: 'Flatten Annotations', icon: 'bi-layers-half' },
    { id: 'compress', label: 'Compress PDF', icon: 'bi-file-earmark-zip' }
];

export function openPipelineModal() {
    const modalEl = document.getElementById('pipelineModal');
    if (modalEl) {
        renderPipelineBuilder();
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function renderPipelineBuilder() {
    const container = document.getElementById('pipeline-builder-container');
    if (!container) return;

    container.innerHTML = `
        <div class="row h-100">
            <div class="col-md-4 border-end">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h6 class="m-0">Operations</h6>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                            Presets
                        </button>
                        <ul class="dropdown-menu" id="pipeline-presets-menu">
                            <li><a class="dropdown-item" href="#" onclick="window.savePipelinePreset()">Save Current...</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <!-- Presets -->
                        </ul>
                    </div>
                </div>
                
                <div class="list-group mb-3">
                    ${availableOps.map(op => `
                        <button class="list-group-item list-group-item-action d-flex align-items-center" onclick="window.addPipelineStep('${op.id}')">
                            <i class="bi ${op.icon} me-2"></i> ${op.label}
                            <i class="bi bi-plus ms-auto"></i>
                        </button>
                    `).join('')}
                </div>
            </div>
            <div class="col-md-8">
                <h6 class="mb-3">Pipeline Sequence</h6>
                <div id="pipeline-steps-list" class="list-group list-group-flush border rounded" style="min-height: 200px; background: #fff;">
                    ${pipelineSteps.length === 0 ? '<div class="text-muted p-4 text-center">No steps added.<br>Click operations on the left to add them.</div>' : ''}
                    ${pipelineSteps.map((step, index) => renderStepItem(step, index)).join('')}
                </div>
            </div>
        </div>
    `;

    updatePresetsMenu();
}

function updatePresetsMenu() {
    const list = document.getElementById('pipeline-presets-menu');
    if (!list) return;

    // Clear existing presets (keep first 2 items)
    while (list.children.length > 2) {
        list.removeChild(list.lastChild);
    }

    const presets = JSON.parse(localStorage.getItem('pipeline_presets') || '{}');
    if (Object.keys(presets).length === 0) {
        list.insertAdjacentHTML('beforeend', '<li><span class="dropdown-item text-muted">No saved presets</span></li>');
    } else {
        Object.keys(presets).forEach(name => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="d-flex justify-content-between align-items-center px-3 py-1 dropdown-item-text">
                    <a href="#" class="text-decoration-none text-dark flex-grow-1" onclick="window.loadPipelinePreset('${name}')">${name}</a>
                    <i class="bi bi-trash text-danger cursor-pointer ms-2" onclick="window.deletePipelinePreset('${name}')"></i>
                </div>
            `;
            list.appendChild(li);
        });
    }
}

export function savePipelinePreset() {
    if (pipelineSteps.length === 0) {
        showToast("Cannot save empty pipeline", "warning");
        return;
    }
    const name = prompt("Enter a name for this pipeline preset:");
    if (name) {
        const presets = JSON.parse(localStorage.getItem('pipeline_presets') || '{}');
        presets[name] = pipelineSteps;
        localStorage.setItem('pipeline_presets', JSON.stringify(presets));
        updatePresetsMenu();
        showToast(`Pipeline "${name}" saved!`, 'success');
    }
}

export function loadPipelinePreset(name) {
    const presets = JSON.parse(localStorage.getItem('pipeline_presets') || '{}');
    if (presets[name]) {
        pipelineSteps = [...presets[name]]; // Clone
        renderPipelineBuilder();
        showToast(`Pipeline "${name}" loaded`, 'info');
    }
}

export function deletePipelinePreset(name) {
    if (confirm(`Delete preset "${name}"?`)) {
        const presets = JSON.parse(localStorage.getItem('pipeline_presets') || '{}');
        delete presets[name];
        localStorage.setItem('pipeline_presets', JSON.stringify(presets));
        updatePresetsMenu();
    }
}

// Global expose
window.savePipelinePreset = savePipelinePreset;
window.loadPipelinePreset = loadPipelinePreset;
window.deletePipelinePreset = deletePipelinePreset;

function renderStepItem(stepId, index) {
    const op = availableOps.find(o => o.id === stepId);
    if (!op) return '';
    return `
        <div class="list-group-item d-flex align-items-center justify-content-between">
            <div>
                <span class="badge bg-secondary me-2">${index + 1}</span>
                <i class="bi ${op.icon} me-2"></i> ${op.label}
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.movePipelineStep(${index}, -1)" ${index === 0 ? 'disabled' : ''}><i class="bi bi-arrow-up"></i></button>
                <button class="btn btn-sm btn-outline-secondary" onclick="window.movePipelineStep(${index}, 1)" ${index === pipelineSteps.length - 1 ? 'disabled' : ''}><i class="bi bi-arrow-down"></i></button>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="window.removePipelineStep(${index})"><i class="bi bi-trash"></i></button>
            </div>
        </div>
    `;
}

export function addPipelineStep(opId) {
    pipelineSteps.push(opId);
    renderPipelineBuilder();
}

export function removePipelineStep(index) {
    pipelineSteps.splice(index, 1);
    renderPipelineBuilder();
}

export function movePipelineStep(index, direction) {
    if (index + direction < 0 || index + direction >= pipelineSteps.length) return;
    const temp = pipelineSteps[index];
    pipelineSteps[index] = pipelineSteps[index + direction];
    pipelineSteps[index + direction] = temp;
    renderPipelineBuilder();
}

export async function runPipeline() {
    if (pipelineSteps.length === 0) {
        showToast("Please add at least one step", "warning");
        return;
    }

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('pipelineModal')).hide();

    // Show overlay
    showProcessingOverlay("Initializing Pipeline...");

    const stepsData = pipelineSteps.map(op => ({ op: op, params: {} }));

    try {
        const response = await fetch('/api/pipeline/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: window.filename,
                steps: stepsData
            })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    if (!dataStr.trim()) continue;

                    try {
                        const update = JSON.parse(dataStr);
                        handlePipelineUpdate(update);
                    } catch (e) {
                        console.error("Parse error", e);
                    }
                }
            }
        }

    } catch (e) {
        hideProcessingOverlay();
        showToast("Pipeline Error: " + e.message, "error");
    }
}

function handlePipelineUpdate(update) {
    if (update.status === 'start') {
        showProcessingOverlay(`Starting Pipeline (${update.total_steps} steps)...`);
    } else if (update.status === 'progress') {
        showProcessingOverlay(`Step ${update.step_index + 1}: ${update.message}`);
    } else if (update.status === 'complete') {
        hideProcessingOverlay();
        showToast("Pipeline Completed Successfully!", "success");
        if (update.download_url) {
            const link = document.createElement('a');
            link.href = update.download_url;
            link.download = ''; // Browser handles filename
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    } else if (update.status === 'error') {
        hideProcessingOverlay();
        showToast("Pipeline Failed: " + update.message, "error");
    }
}

// Global expose
window.openPipelineModal = openPipelineModal;
window.addPipelineStep = addPipelineStep;
window.removePipelineStep = removePipelineStep;
window.movePipelineStep = movePipelineStep;
window.runPipeline = runPipeline;
