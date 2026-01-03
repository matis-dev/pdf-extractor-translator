
import { state } from './state.js';

function showToast(message, type = 'info') {
    // Check if global showToast exists, otherwise use a fallback or console
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    }
}

export function openPdfAModal() {
    const modalEl = document.getElementById('pdfa-modal');
    if (!modalEl) {
        console.error("PDF/A Modal not found in DOM");
        return;
    }
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

export async function convertToPdfA() {
    const filename = state.filename;
    const levelEl = document.getElementById('pdfa-level');
    const level = levelEl ? levelEl.value : '2b';

    if (!filename) {
        showToast("No active filename found", "error");
        return;
    }

    // Close modal
    const modalEl = document.getElementById('pdfa-modal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    showToast("Starting PDF/A conversion...", "info");

    try {
        const response = await fetch('/pdf-to-pdfa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, level })
        });

        const result = await response.json();

        if (response.ok) {
            showToast("Conversion successful! Downloading...", "success");
            // Trigger download
            const a = document.createElement('a');
            a.href = result.url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            showToast(result.error || "Conversion failed", "error");
        }
    } catch (e) {
        showToast("Error connecting to server", "error");
        console.error(e);
    }
}
