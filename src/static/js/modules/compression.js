
import { showToast } from '../utils.js';

export function openCompressionModal() {
    const modalEl = document.getElementById('compressionModal');
    if (!modalEl) {
        console.error("Compression modal not found");
        return;
    }

    // Reset Modal State if needed
    resetCompressionModal(modalEl);

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

function resetCompressionModal(modalEl) {
    const modalBody = modalEl.querySelector('.modal-body');
    const modalFooter = modalEl.querySelector('.modal-footer');

    // Restore initial footer buttons
    modalFooter.style.display = 'flex';
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary" onclick="window.confirmEditorCompression()">
            <i class="bi bi-arrows-collapse me-1"></i> Compress
        </button>
    `;

    // Restore body content (radio buttons)
    // We'll store the initial HTML in a data attribute or just reconstruct it
    // For simplicity, we reconstructed it here as it's static
    modalBody.innerHTML = `
        <p class="small text-muted mb-3">Select a quality preset to balance file size and visual fidelity.</p>
        
        <div class="list-group">
            <label class="list-group-item d-flex gap-3">
                <input class="form-check-input flex-shrink-0" type="radio" name="editorCompressionQuality" value="screen" style="font-size: 1.375em;">
                <span class="pt-1 form-checked-content">
                    <strong>Screen (72 DPI)</strong>
                    <small class="d-block text-muted">Smallest file size. Best for email or viewing on screens.</small>
                </span>
            </label>
            <label class="list-group-item d-flex gap-3">
                <input class="form-check-input flex-shrink-0" type="radio" name="editorCompressionQuality" value="ebook" checked style="font-size: 1.375em;">
                <span class="pt-1 form-checked-content">
                    <strong>eBook (150 DPI)</strong>
                    <small class="d-block text-muted">Balanced quality and size. Recommended for most documents.</small>
                </span>
            </label>
            <label class="list-group-item d-flex gap-3">
                <input class="form-check-input flex-shrink-0" type="radio" name="editorCompressionQuality" value="printer" style="font-size: 1.375em;">
                <span class="pt-1 form-checked-content">
                    <strong>Printer (300 DPI)</strong>
                    <small class="d-block text-muted">High quality. Suitable for home or office printing.</small>
                </span>
            </label>
            <label class="list-group-item d-flex gap-3">
                <input class="form-check-input flex-shrink-0" type="radio" name="editorCompressionQuality" value="prepress" style="font-size: 1.375em;">
                <span class="pt-1 form-checked-content">
                    <strong>Prepress (300 DPI+)</strong>
                    <small class="d-block text-muted">Maximum quality. Preserves color accuracy for professional printing.</small>
                </span>
            </label>
        </div>
    `;
}

export async function confirmEditorCompression() {
    const modalEl = document.getElementById('compressionModal');
    const qualityInput = document.querySelector('input[name="editorCompressionQuality"]:checked');

    if (!qualityInput) return;
    const quality = qualityInput.value;
    const filename = window.filename;

    const modalBody = modalEl.querySelector('.modal-body');
    const modalFooter = modalEl.querySelector('.modal-footer');

    // Show Progress
    modalBody.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary mb-3" role="status"></div>
            <h5>Compressing...</h5>
            <p class="text-muted">Please wait while we reduce the file size.</p>
        </div>
    `;
    modalFooter.style.display = 'none';

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

            modalBody.innerHTML = `
                <div class="text-center py-4">
                    <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem;"></i>
                    <h5 class="mt-3">Compression Complete!</h5>
                    <div class="card bg-light border-0 mt-3 p-3">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Original Size:</span>
                            <strong>${toMB(data.original_size)} MB</strong>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span>Compressed Size:</span>
                            <strong>${toMB(data.compressed_size)} MB</strong>
                        </div>
                        <div class="d-flex justify-content-between text-success">
                            <span>Reduction:</span>
                            <strong>${saved}</strong>
                        </div>
                    </div>
                </div>
            `;
            modalFooter.style.display = 'flex';
            modalFooter.innerHTML = `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <a href="${data.url}" class="btn btn-primary" target="_blank"><i class="bi bi-download me-1"></i> Download</a>
            `;

        } else {
            throw new Error(data.error || 'Compression failed');
        }
    } catch (e) {
        modalBody.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-x-circle-fill text-danger" style="font-size: 3rem;"></i>
                <h5 class="mt-3">Compression Failed</h5>
                <p class="text-muted">${e.message}</p>
            </div>
        `;
        modalFooter.style.display = 'flex';
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-outline-primary" onclick="window.openCompressionModal()">Try Again</button>
        `;
    }
}

// Attach to window for the onclick handler
window.openCompressionModal = openCompressionModal;
window.confirmEditorCompression = confirmEditorCompression;
