/**
 * Compare PDFs Module
 * Handles visual comparison of two PDF documents
 */

let compareSecondFilename = null;

/**
 * Opens the comparison modal for selecting a second PDF
 */
export function openCompareModal() {
    const modal = document.getElementById('compareModal');
    if (modal) {
        // Reset state
        compareSecondFilename = null;
        const fileInput = document.getElementById('pdf-compare');
        if (fileInput) fileInput.value = '';
        const status = document.getElementById('compare-status');
        if (status) status.textContent = '';
        const btn = document.getElementById('compare-run-btn');
        if (btn) btn.disabled = true;

        // Show modal using Bootstrap
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}
window.openCompareModal = openCompareModal;

/**
 * Closes the comparison modal
 */
export function closeCompareModal() {
    const modal = document.getElementById('compareModal');
    if (modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    }
}
window.closeCompareModal = closeCompareModal;

/**
 * Handles file selection for comparison
 * @param {Event} event - File input change event
 */
export async function handleCompareFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const status = document.getElementById('compare-status');
    const btn = document.getElementById('compare-run-btn');

    // Upload the file
    status.textContent = 'Uploading...';
    status.className = 'text-muted';

    const formData = new FormData();
    formData.append('pdf_file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (response.redirected) {
            // Upload succeeded, extract filename from redirect URL
            const url = new URL(response.url);
            const match = url.pathname.match(/\/editor\/(.+)$/);
            if (match) {
                compareSecondFilename = decodeURIComponent(match[1]);
            } else {
                // Fallback to secure filename
                compareSecondFilename = file.name;
            }
            status.textContent = `Ready to compare: ${compareSecondFilename}`;
            status.className = 'text-success';
            btn.disabled = false;
        } else {
            throw new Error('Upload failed');
        }
    } catch (error) {
        status.textContent = `Error: ${error.message}`;
        status.className = 'text-danger';
        btn.disabled = true;
    }
}
window.handleCompareFileSelect = handleCompareFileSelect;

/**
 * Runs the comparison between current PDF and selected PDF
 */
export async function runComparison() {
    const status = document.getElementById('compare-status');
    const btn = document.getElementById('compare-run-btn');

    // Get current PDF filename from global
    const currentFilename = window.currentFilename;

    if (!currentFilename || !compareSecondFilename) {
        status.textContent = 'Please select both PDFs';
        status.className = 'text-danger';
        return;
    }

    status.textContent = 'Comparing... This may take a moment.';
    status.className = 'text-muted';
    btn.disabled = true;

    try {
        const response = await fetch('/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename1: currentFilename,
                filename2: compareSecondFilename
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Comparison failed');
        }

        // Show success and download link
        const summary = data.summary;
        const diffCount = summary.total_differences;
        const resultText = diffCount === 0
            ? 'No differences found!'
            : `Found differences on ${diffCount} page(s): ${summary.pages_with_differences.join(', ')}`;

        status.innerHTML = `
            <div class="text-success mb-2">${resultText}</div>
            <a href="${data.url}" class="btn btn-primary btn-sm" download>
                <i class="bi bi-download"></i> Download Comparison Report
            </a>
        `;
        status.className = '';

        // Show toast
        if (window.showToast) {
            window.showToast('Comparison complete!', 'success');
        }

    } catch (error) {
        status.textContent = `Error: ${error.message}`;
        status.className = 'text-danger';
    } finally {
        btn.disabled = false;
    }
}
window.runComparison = runComparison;
