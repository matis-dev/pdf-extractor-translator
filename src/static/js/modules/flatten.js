
// Imports from utils (loaded globally via main.js) or via direct import if needed.
// For now, we rely on window.showToast and window.showProcessingOverlay as defined in utils.js

export function openFlattenModal() {
    // Check if modal exists
    let modalEl = document.getElementById('flattenModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    } else {
        console.error("Flatten modal not found");
    }
}

export async function submitFlatten() {
    // Hide modal
    const modalEl = document.getElementById('flattenModal');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    showProcessingOverlay("Flattening PDF...");

    try {
        const formData = new FormData();
        formData.append('filename', window.filename);

        const response = await fetch('/api/flatten', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Flatten failed');
        }

        const result = await response.json();

        document.getElementById('processing-overlay').style.display = 'none';

        showToast("PDF Flattened Successfully!", "success");

        // Initiate download
        if (result.url) {
            const link = document.createElement('a');
            link.href = result.url;
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

    } catch (e) {
        document.getElementById('processing-overlay').style.display = 'none';
        showToast(e.message, "error");
        console.error(e);
    }
}

// Global expose
window.openFlattenModal = openFlattenModal;
window.submitFlatten = submitFlatten;
