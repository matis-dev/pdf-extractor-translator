/**
 * conversion_modal.js
 * Logic for the Conversion Modal (Shared between Editor and Dashboard).
 */

const ConversionState = {
    selectedFormat: null,
    filename: null,
    isProcessing: false,
    taskId: null,
    formatsLoaded: false
};

// --- Options Configuration ---
// Defines what options are available for each format
const FORMAT_OPTIONS = {
    'png': ['dpi'],
    'jpg': ['dpi'],
    'tiff': ['dpi', 'multipage'],
    'webp': ['quality'],
    'txt': ['page_separator', 'encoding'],
    'docx': ['target_lang'],
    'odt': ['target_lang']
};

const OPTION_DEFINITIONS = {
    'target_lang': {
        type: 'select',
        label: 'Translate To',
        id: 'opt_target_lang',
        options: [
            { value: 'none', label: 'None (Original)', selected: true },
            { value: 'es', label: 'Spanish' },
            { value: 'fr', label: 'French' },
            { value: 'de', label: 'German' },
            { value: 'it', label: 'Italian' },
            { value: 'pt', label: 'Portuguese' }
        ]
    },
    'dpi': {
        type: 'select',
        label: 'Resolution (DPI)',
        id: 'opt_dpi',
        options: [
            { value: 72, label: '72 DPI (Screen)' },
            { value: 150, label: '150 DPI (Ebook)', selected: true },
            { value: 300, label: '300 DPI (Print)' },
            { value: 600, label: '600 DPI (High Quality)' }
        ]
    },
    'quality': {
        type: 'range',
        label: 'Quality (1-100)',
        id: 'opt_quality',
        min: 1,
        max: 100,
        value: 85,
        displayValue: true
    },
    'multipage': {
        type: 'checkbox',
        label: 'Combine into single file (Multi-page)',
        id: 'opt_multipage',
        checked: false
    },
    'page_separator': {
        type: 'checkbox',
        label: 'Insert Page Separators',
        id: 'opt_separator',
        checked: true
    },
    'encoding': {
        type: 'select',
        label: 'Encoding',
        id: 'opt_encoding',
        options: [
            { value: 'utf-8', label: 'UTF-8 (Universal)', selected: true },
            { value: 'ascii', label: 'ASCII' }
        ]
    }
};

// Exposed globally
export async function selectConversionFormat(format) {
    if (ConversionState.isProcessing) return;

    ConversionState.selectedFormat = format;

    // UI Update
    document.querySelectorAll('#conversionFormatGrid .format-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.format === format) {
            card.classList.add('selected');
        }
    });

    renderOptions(format);

    const btn = document.getElementById('startConversionBtn');
    if (btn) btn.disabled = false;
};

function renderOptions(format) {
    const container = document.getElementById('conversionOptionsContainer');
    const panel = document.getElementById('conversionOptionsPanel');
    container.innerHTML = '';

    const neededOptions = FORMAT_OPTIONS[format] || [];

    if (neededOptions.length === 0) {
        panel.classList.add('d-none');
        return;
    }

    panel.classList.remove('d-none');

    neededOptions.forEach(optKey => {
        const def = OPTION_DEFINITIONS[optKey];
        if (!def) return;

        let html = '';
        if (def.type === 'select') {
            html = `
                <div class="mb-3">
                    <label class="form-label text-muted small fw-bold text-uppercase">${def.label}</label>
                    <select class="form-select" id="${def.id}">
                        ${def.options.map(o => `<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (def.type === 'range') {
            html = `
                <div class="mb-3">
                    <label class="form-label text-muted small fw-bold text-uppercase d-flex justify-content-between">
                        ${def.label} <span id="${def.id}_val">${def.value}</span>
                    </label>
                    <input type="range" class="form-range" id="${def.id}" min="${def.min}" max="${def.max}" value="${def.value}" 
                           oninput="document.getElementById('${def.id}_val').textContent = this.value">
                </div>
            `;
        } else if (def.type === 'checkbox') {
            html = `
                <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="${def.id}" ${def.checked ? 'checked' : ''}>
                    <label class="form-check-label" for="${def.id}">${def.label}</label>
                </div>
            `;
        }

        container.insertAdjacentHTML('beforeend', html);
    });
}

function getOptionsValues() {
    const format = ConversionState.selectedFormat;
    const neededOptions = FORMAT_OPTIONS[format] || [];
    const values = {};

    neededOptions.forEach(optKey => {
        const def = OPTION_DEFINITIONS[optKey];
        const el = document.getElementById(def.id);
        if (!el) return;

        if (def.type === 'checkbox') {
            values[optKey] = el.checked;
        } else if (def.type === 'select') {
            values[optKey] = el.value;
        } else if (def.type === 'range') {
            values[optKey] = parseInt(el.value, 10);
        }
    });

    return values;
}

export async function loadFormats() {
    if (ConversionState.formatsLoaded) return;

    const grid = document.getElementById('conversionFormatGrid');
    try {
        const res = await fetch('/api/convert/formats');
        const data = await res.json();

        grid.innerHTML = '';
        data.formats.forEach(f => {
            const card = document.createElement('div');
            card.className = 'format-card p-3 text-center';
            card.dataset.format = f.id;
            card.onclick = () => selectConversionFormat(f.id);
            card.innerHTML = `
                <i class="bi bi-check-circle-fill check-mark"></i>
                <div class="icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">${f.icon}</div>
                <h6 class="fw-bold mb-1">${f.label}</h6>
            `;
            grid.appendChild(card);
        });

        ConversionState.formatsLoaded = true;
    } catch (e) {
        grid.innerHTML = '<div class="text-danger">Failed to load formats</div>';
        console.error(e);
    }
}

export function openConversionModal(filename) {
    ConversionState.filename = filename;
    ConversionState.selectedFormat = null;
    ConversionState.isProcessing = false;

    // Reset UI
    document.getElementById('startConversionBtn').disabled = true;
    document.getElementById('conversionProgressSection').classList.add('d-none');
    document.getElementById('conversionOptionsPanel').classList.add('d-none');
    document.getElementById('conversion-file-label').textContent = filename ? `(${filename})` : '';

    loadFormats();

    const modal = new bootstrap.Modal(document.getElementById('conversionModal'));
    modal.show();
};

export async function startConversionTransaction() {
    if (!ConversionState.filename || !ConversionState.selectedFormat) return;

    const btn = document.getElementById('startConversionBtn');
    const progressSection = document.getElementById('conversionProgressSection');
    const progressBar = document.getElementById('conversionProgressBar');
    const statusText = document.getElementById('conversionStatusText');
    const options = getOptionsValues();

    ConversionState.isProcessing = true;
    btn.disabled = true;
    progressSection.classList.remove('d-none');
    progressBar.style.width = '5%';
    statusText.textContent = 'Initiating conversion...';

    try {
        const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: ConversionState.filename,
                target_format: ConversionState.selectedFormat,
                options: options
            })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Conversion start failed');

        if (data.status === 'completed') {
            // Sync success
            completeProcess(data.output_url);
        } else if (data.status === 'queued' || data.status === 'processing') {
            // Async poll
            pollConversionStatus(data.job_id);
        } else { // Failed immediately
            throw new Error(data.error || 'Unknown status');
        }

    } catch (e) {
        handleConversionError(e.message);
    }
};

async function pollConversionStatus(jobId) {
    const progressBar = document.getElementById('conversionProgressBar');
    const statusText = document.getElementById('conversionStatusText');

    const interval = setInterval(async () => {
        try {
            const res = await fetch(`/status/${jobId}`);
            if (res.status === 404) {
                clearInterval(interval);
                handleConversionError('Task lost connection.');
                return;
            }

            const data = await res.json();

            if (data.current && data.total) {
                const pct = Math.round((data.current / data.total) * 100);
                progressBar.style.width = `${pct}%`;
                statusText.textContent = data.status || 'Processing...';
            }

            if (data.state === 'SUCCESS') {
                clearInterval(interval);
                completeProcess(`/outputs/${data.result_file}`);
            } else if (data.state === 'FAILURE') {
                clearInterval(interval);
                handleConversionError(data.status || 'Task failed');
            }

        } catch (e) {
            clearInterval(interval);
            handleConversionError(e.message);
        }
    }, 1000);
}

function completeProcess(url) {
    const progressBar = document.getElementById('conversionProgressBar');
    const statusText = document.getElementById('conversionStatusText');

    progressBar.style.width = '100%';
    statusText.textContent = 'Conversion Complete!';
    progressBar.classList.remove('progress-bar-animated');
    progressBar.classList.add('bg-success');

    // Trigger download
    setTimeout(() => {
        window.location.href = url;
        // Optionally close modal after delay
        setTimeout(() => {
            const el = document.getElementById('conversionModal');
            const modal = bootstrap.Modal.getInstance(el);
            modal.hide();
        }, 2000);
    }, 800);
}

function handleConversionError(msg) {
    ConversionState.isProcessing = false;
    document.getElementById('startConversionBtn').disabled = false;
    alert(`Error: ${msg}`); // Simple alert for now or use toast if available
}

// Preserve Window assignments for direct HTML onClick handling if needed
window.selectConversionFormat = selectConversionFormat;
window.openConversionModal = openConversionModal;
window.startConversionTransaction = startConversionTransaction;
