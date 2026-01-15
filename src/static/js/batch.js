
async function processBatch() {
    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.value);

    if (selectedFiles.length === 0) {
        showToast("Please select at least one file.", 'warning');
        return;
    }

    const extractionType = document.getElementById('batch-extraction-type').value;
    const sourceLang = document.getElementById('batch-source-lang').value;
    const targetLang = document.getElementById('batch-target-lang').value;

    // UI Setup
    const progressContainer = document.getElementById('batch-progress-container');
    progressContainer.innerHTML = '';
    progressContainer.style.display = 'block';

    document.getElementById('batch-download-btn').style.display = 'none';

    const tasks = [];

    // Initiate Requests
    for (const filename of selectedFiles) {
        // Create Progress Item
        const progressItem = document.createElement('div');
        progressItem.className = 'mb-3';
        progressItem.innerHTML = `
            <div class="d-flex justify-content-between mb-1">
                <span>${filename}</span>
                <span class="status-badge badge bg-secondary">Starting...</span>
            </div>
            <div class="progress">
                <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 0%"></div>
            </div>
        `;
        progressContainer.appendChild(progressItem);

        // Send Request
        const formData = new FormData();
        formData.append('filename', filename);
        formData.append('extraction_type', extractionType);
        formData.append('source_lang', sourceLang);
        formData.append('target_lang', targetLang);

        try {
            const res = await fetch('/process_request', { method: 'POST', body: formData });
            const data = await res.json();

            if (data.task_id) {
                tasks.push({
                    filename,
                    taskId: data.task_id,
                    element: progressItem
                });
            } else {
                updateStatus(progressItem, 'Failed to start', 'danger');
            }
        } catch (e) {
            updateStatus(progressItem, 'Error starting task', 'danger');
            handleApiError(e, `Failed to start processing for ${filename}`);
        }
    }

    // Start Polling
    pollBatchStatus(tasks);
}

function updateStatus(element, text, colorClass, percent = 100) {
    const badge = element.querySelector('.status-badge');
    badge.innerText = text;
    badge.className = `status-badge badge bg-${colorClass}`;

    const bar = element.querySelector('.progress-bar');
    bar.style.width = `${percent}%`;
    if (percent === 100) {
        bar.classList.remove('progress-bar-animated', 'progress-bar-striped');
    }
}

async function pollBatchStatus(tasks) {
    const activeTasks = [...tasks];
    const completedFiles = [];

    const interval = setInterval(async () => {
        if (activeTasks.length === 0) {
            clearInterval(interval);
            onBatchComplete(completedFiles);
            return;
        }

        for (let i = activeTasks.length - 1; i >= 0; i--) {
            const task = activeTasks[i];

            try {
                const res = await fetch(`/status/${task.taskId}`);
                const data = await res.json();

                if (data.state === 'SUCCESS') {
                    updateStatus(task.element, 'Completed', 'success', 100);
                    completedFiles.push(data.result_file);
                    activeTasks.splice(i, 1);
                } else if (data.state === 'FAILURE') {
                    updateStatus(task.element, 'Failed', 'danger', 100);
                    activeTasks.splice(i, 1);
                } else {
                    // Update progress
                    const percent = data.current || 0;
                    updateStatus(task.element, data.status || 'Processing...', 'info', percent);
                }
            } catch (e) {
                console.error(e);
            }
        }
    }, 2000);
}

function onBatchComplete(completedFiles) {
    if (completedFiles.length > 0) {
        const downloadBtn = document.getElementById('batch-download-btn');
        downloadBtn.style.display = 'inline-block';
        downloadBtn.onclick = () => downloadZip(completedFiles);
    }
}

async function downloadZip(filenames) {
    try {
        const res = await fetch('/create_zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames })
        });

        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'batch_results.zip';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } else {
            showToast("Failed to create ZIP archive", 'danger');
        }
    } catch (e) {
        handleApiError(e, "Error downloading ZIP");
    }
}

async function mergeSelectedFiles() {
    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.value);

    if (selectedFiles.length < 2) {
        showToast("Please select at least two files to merge.", 'warning');
        return;
    }

    // UI Feedback
    const progressContainer = document.getElementById('batch-progress-container');
    progressContainer.innerHTML = `
        <div class="alert alert-info">
            <div class="spinner-border spinner-border-sm" role="status"></div> Merging ${selectedFiles.length} files...
        </div>
    `;
    progressContainer.style.display = 'block';

    try {
        const res = await fetch('/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: selectedFiles })
        });

        const data = await res.json();

        if (res.ok) {
            showToast("Merge successful!", 'success');
            progressContainer.innerHTML = `
                <div class="alert alert-success d-flex justify-content-between align-items-center">
                    <span>Merged file created: <strong>${data.filename}</strong></span>
                    <a href="${data.url}" class="btn btn-primary btn-sm"><i class="bi bi-download"></i> Download</a>
                </div>
            `;
            // Add a reload button? Or just let user reload manually to see it in list.
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            showToast(data.error || "Merge failed", 'danger');
            progressContainer.style.display = 'none';
        }
    } catch (e) {
        handleApiError(e, "Error merging files");
        progressContainer.style.display = 'none';
    }
}

async function compressSelectedFiles() {
    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.value);

    if (selectedFiles.length === 0) {
        showToast("Please select at least one file to compress.", 'warning');
        return;
    }

    const modal = new bootstrap.Modal(document.getElementById('compressionModal'));
    modal.show();
}

window.confirmCompression = async function () {
    const modalEl = document.getElementById('compressionModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.value);
    const quality = document.querySelector('input[name="compressionQuality"]:checked').value;

    const progressContainer = document.getElementById('batch-progress-container');
    progressContainer.innerHTML = '';
    progressContainer.style.display = 'block';

    for (const filename of selectedFiles) {
        const progressItem = document.createElement('div');
        progressItem.className = 'alert alert-info d-flex justify-content-between align-items-center mb-2';
        progressItem.innerHTML = `
            <span>Compressing <strong>${filename}</strong>...</span>
            <div class="spinner-border spinner-border-sm" role="status"></div>
        `;
        progressContainer.appendChild(progressItem);

        try {
            const res = await fetch('/compress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, quality })
            });
            const data = await res.json();

            if (res.ok) {
                const toMB = (b) => (b / (1024 * 1024)).toFixed(2);
                let saved = 'No reduction';
                if (data.reduction_percent > 0) {
                    saved = `Reduced by ${data.reduction_percent}%`;
                }

                progressItem.className = 'alert alert-success d-flex justify-content-between align-items-center mb-2';
                progressItem.innerHTML = `
                    <div>
                        <i class="bi bi-check-circle-fill me-2"></i>
                        <span><strong>${data.filename}</strong></span>
                        <div class="small text-muted">${toMB(data.original_size)}MB &rarr; ${toMB(data.compressed_size)}MB (${saved})</div>
                    </div>
                    <a href="${data.url}" class="btn btn-primary btn-sm"><i class="bi bi-download"></i></a>
                 `;
            } else {
                progressItem.className = 'alert alert-danger mb-2';
                progressItem.innerText = `Error processing ${filename}: ${data.error}`;
            }
        } catch (e) {
            progressItem.className = 'alert alert-danger mb-2';
            progressItem.innerText = `Error processing ${filename}: ${e.message}`;
        }
    }
    // Refresh list shortly after
    setTimeout(() => {
        window.location.reload();
    }, 4000);
}

async function compareSelectedFiles() {
    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.value);

    if (selectedFiles.length !== 2) {
        showToast("Please select exactly two files to compare.", 'warning');
        return;
    }

    const progressContainer = document.getElementById('batch-progress-container');
    progressContainer.innerHTML = `
        <div class="alert alert-info">
            <div class="spinner-border spinner-border-sm" role="status"></div> Comparing ${selectedFiles[0]} and ${selectedFiles[1]}...
        </div>
    `;
    progressContainer.style.display = 'block';

    try {
        const res = await fetch('/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename1: selectedFiles[0],
                filename2: selectedFiles[1]
            })
        });

        const data = await res.json();

        if (res.ok) {
            showToast("Comparison successful!", 'success');
            // Format differences text
            let diffText = 'No differences found.';
            if (data.summary && data.summary.total_differences > 0) {
                diffText = `Found ${data.summary.total_differences} page(s) with differences.`;
            }

            progressContainer.innerHTML = `
                <div class="alert alert-success">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong>Comparison Complete!</strong>
                        <a href="${data.url}" class="btn btn-primary btn-sm"><i class="bi bi-download"></i> Download Report</a>
                    </div>
                    <small>${diffText}</small>
                </div>
            `;
        } else {
            showToast(data.error || "Comparison failed", 'danger');
            progressContainer.innerHTML = `<div class="alert alert-danger">Error: ${data.error}</div>`;
        }
    } catch (e) {
        handleApiError(e, "Error comparing files");
        progressContainer.style.display = 'none';
    }
}

async function batchConvert() {
    const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.value);

    if (selectedFiles.length === 0) {
        showToast("Please select at least one file to convert.", 'warning');
        return;
    }

    // For now, modal handles one file best. But we can adapt it or just pick the first one 
    // or iterate. The user asked for "modal like compression". 
    // Compression modal applies same settings to ALL files.
    // Conversion modal selects FORMAT.
    // So we should open the modal, let user select format, then iterate all files.

    // We need to override the modal's "Start" button to call a batch function instead of single
    // OR we modify openConversionModal to accept a callback or check context.

    // Let's hook into the existing modal.
    if (window.openConversionModal) {
        // We set a global flag or modify state
        // Actually, openConversionModal sets 'ConversionState.filename'.
        // If we set it to null or a special value, or just hook the start function.

        // Let's modify conversion_modal.js to handle list of files?
        // Or simpler: We open the modal, and when user clicks "Convert", we intercept it if we are in batch mode.
        // But the modal is in a module scope.

        // Quick fix: Just convert the first one for now? No, that's bad UX.
        // Better: We iterate. But we need the FORMAT.
        // We can expose a "Batch Conversion" mode in the modal.

        // Let's show the modal for the first file, or generic text.
        const modalLabel = document.getElementById('conversion-file-label');
        if (modalLabel) modalLabel.innerText = `(${selectedFiles.length} files selected)`;

        // We need to override the button action.
        // This requires access to the button in the shared modal.
        const btn = document.getElementById('startConversionBtn');
        // Remove old listeners? It uses onclick="window.startConversionTransaction()" in HTML.
        // We can override that global function temporarily?

        const originalFn = window.startConversionTransaction;
        window.startConversionTransaction = async function () {
            // READ selected format from DOM or State (since State is in module, we might not reach it easily unless exposed)
            // But 'window.selectConversionFormat' updates 'ConversionState' inside module.
            // We can't easily read 'ConversionState' from here unless we export it or use the DOM.

            // The DOM has 'selected' class on format-card.
            const selected = document.querySelector('.format-card.selected');
            if (!selected) return;
            const format = selected.dataset.format;

            // Hide modal
            const el = document.getElementById('conversionModal');
            const modal = bootstrap.Modal.getInstance(el);
            modal.hide();

            // Start Batch Loop
            const progressContainer = document.getElementById('batch-progress-container');
            progressContainer.innerHTML = '';
            progressContainer.style.display = 'block';

            for (const filename of selectedFiles) {
                const progressItem = document.createElement('div');
                progressItem.className = 'alert alert-info d-flex justify-content-between align-items-center mb-2';
                progressItem.innerHTML = `
                    <span>Converting <strong>${filename}</strong> to ${format}...</span>
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                `;
                progressContainer.appendChild(progressItem);

                try {
                    const res = await fetch('/api/convert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: filename,
                            target_format: format
                        })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        // Assuming Sync for now or Async handling similar to batch extraction
                        // If Async, we need to poll. 
                        // Simplified: Just show 'Started' if async.
                        if (data.status === 'completed') {
                            progressItem.className = 'alert alert-success mb-2';
                            progressItem.innerHTML = `
                                <i class="bi bi-check-circle-fill me-2"></i> ${filename} converted.
                                <a href="${data.output_url}" class="btn btn-primary btn-sm ms-2"><i class="bi bi-download"></i></a>
                            `;
                        } else {
                            progressItem.innerHTML += ' (Queued)';
                            // TODO: Add polling for full batch experience
                        }
                    } else {
                        progressItem.className = 'alert alert-danger mb-2';
                        progressItem.innerText = `Error: ${data.error}`;
                    }
                } catch (e) {
                    progressItem.className = 'alert alert-danger mb-2';
                    progressItem.innerText = `Error: ${e.message}`;
                }
            }

            // Restore original function
            window.startConversionTransaction = originalFn;
        };

        const modal = new bootstrap.Modal(document.getElementById('conversionModal'));
        modal.show();

        // Ensure we listen for modal close to restore function in case they cancel?
        el.addEventListener('hidden.bs.modal', function () {
            window.startConversionTransaction = originalFn;
        }, { once: true });
    }
}

function updateBatchUI() {
    const checked = document.querySelectorAll('.file-checkbox:checked').length > 0;
    const container = document.getElementById('batch-actions-container');
    if (container) {
        if (checked) {
            container.classList.remove('d-none');
        } else {
            container.classList.add('d-none');
        }
    }
}

document.addEventListener('change', (e) => {
    // Handle "Select All" logic here to ensure events are synced
    if (e.target.id === 'check-all') {
        const checkboxes = document.querySelectorAll('.file-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBatchUI();
    }
    // Handle individual checkboxes
    else if (e.target.classList.contains('file-checkbox')) {
        updateBatchUI();
    }
});

document.addEventListener('DOMContentLoaded', updateBatchUI);
