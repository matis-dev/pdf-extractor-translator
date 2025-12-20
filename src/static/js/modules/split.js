import { state } from './state.js';
import { loadPdf } from './viewer.js';
// import { showToast, handleApiError } from '../utils.js';

export async function splitPdf() {
    const modalHtml = `
        <div class="modal fade" id="splitModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Split PDF</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted small">Enter page ranges separated by commas (e.g., "1-3, 5, 7-10").</p>
                        <div class="mb-3">
                            <label class="form-label">Page Ranges</label>
                            <input type="text" class="form-control" id="split-ranges" placeholder="1-3, 5, 7-10">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="confirmSplit()">Split</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Append modal if not exists
    if (!document.getElementById('splitModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    const modal = new bootstrap.Modal(document.getElementById('splitModal'));
    modal.show();

    window.confirmSplit = async () => {
        const rangesInput = document.getElementById('split-ranges').value;
        if (!rangesInput) {
            showToast("Please enter at least one range", "warning");
            return;
        }

        // Parse ranges to array
        const ranges = rangesInput.split(',').map(r => r.trim()).filter(r => r.length > 0);

        try {
            const btn = document.querySelector('#splitModal .btn-primary');
            const originalText = btn.innerText;
            btn.innerText = "Splitting...";
            btn.disabled = true;

            const res = await fetch('/split', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: state.filename,
                    ranges: ranges
                })
            });

            const data = await res.json();

            if (res.ok) {
                modal.hide();
                showToast("PDF Split Successfully!", "success");

                // Show download link
                const downloadHtml = `
                    <div class="alert alert-success mt-3 alert-dismissible fade show" role="alert">
                         Split complete! <a href="${data.url}" class="fw-bold">Download ZIP</a>
                         <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                `;
                // Add to sidebar or top of page? Top of page is safer.
                const container = document.querySelector('.container-fluid');
                container.insertAdjacentHTML('afterbegin', downloadHtml);

            } else {
                showToast(data.error || "Split failed", "danger");
            }

            btn.innerText = originalText;
            btn.disabled = false;

        } catch (e) {
            handleApiError(e, "Error splitting PDF");
        }
    };
}
