/**
 * conversion_modal.js
 * Logic for the Conversion Modal (Shared between Editor and Dashboard).
 */

const ConversionState = {
    selectedFormat: null,
    filename: null,
    isProcessing: false,
    taskId: null
};

// Exposed globally
export function selectConversionFormat(format) {
    if (ConversionState.isProcessing) return;

    ConversionState.selectedFormat = format;

    // UI Update
    document.querySelectorAll('#conversionFormatGrid .format-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.format === format) {
            card.classList.add('selected');
        }
    });

    const btn = document.getElementById('startConversionBtn');
    if (btn) btn.disabled = false;
};

export function openConversionModal(filename) {
    ConversionState.filename = filename;
    ConversionState.selectedFormat = null;
    ConversionState.isProcessing = false;

    // Reset UI
    document.querySelectorAll('#conversionFormatGrid .format-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('startConversionBtn').disabled = true;
    document.getElementById('conversionProgressSection').classList.add('d-none');
    document.getElementById('conversion-file-label').textContent = filename ? `(${filename})` : '';

    const modal = new bootstrap.Modal(document.getElementById('conversionModal'));
    modal.show();
};

export async function startConversionTransaction() {
    if (!ConversionState.filename || !ConversionState.selectedFormat) return;

    const btn = document.getElementById('startConversionBtn');
    const progressSection = document.getElementById('conversionProgressSection');
    const progressBar = document.getElementById('conversionProgressBar');
    const statusText = document.getElementById('conversionStatusText');

    ConversionState.isProcessing = true;
    btn.disabled = true;
    progressSection.classList.remove('d-none');
    progressBar.style.width = '5%';
    statusText.textContent = 'Initiating conversion...';

    try {
        const formData = new FormData();
        // The API we built earlier expects JSON for /api/convert
        // Let's use that one as it's cleaner.

        const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: ConversionState.filename,
                target_format: ConversionState.selectedFormat
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
