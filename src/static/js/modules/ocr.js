
import { renderLanguageDropdown } from './language_manager.js';

export function openOCRModal() {
    const modalElement = document.getElementById('ocrModal');
    const modal = new bootstrap.Modal(modalElement);

    // Initialize dropdown
    // We reuse language manager. Note: Tesseract language codes might differ slightly from Argos 
    // but usually 3-letter (eng, deu) vs 2-letter (en, de).
    // language_manager uses 2-letter codes. ocrmypdf expects 3-letter usually but can handle 2-letter if mapping exists?
    // ocrmypdf uses tesseract codes (eng, fra, deu).
    // Our language_manager provides 'en', 'es'.
    // We might need a mapper or just hope Tesseract handles 2-letter or our manager provides 2 letter.
    // For now, let's assume standard codes.

    renderLanguageDropdown('ocr-language', 'en', false, null, true);

    modal.show();
}

export async function runOCR() {
    const language = document.getElementById('ocr-language').value;
    // Map 2-letter to 3-letter if needed? 
    // Tesseract often needs 'eng', 'spa', 'fra', 'deu'. 
    // 'en' -> 'eng'.

    let langCode = language;
    const langMap = {
        'en': 'eng', 'es': 'spa', 'fr': 'fra', 'de': 'deu', 'it': 'ita', 'pt': 'por'
    };
    if (langMap[language]) langCode = langMap[language];

    const filename = window.filename;

    // Close modal
    const modalEl = document.getElementById('ocrModal');
    bootstrap.Modal.getInstance(modalEl).hide();

    // Show overlay
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.style.display = 'flex';

    const statusText = document.getElementById('status-text');
    if (statusText) statusText.innerText = 'Initializing OCR...';

    const formData = new FormData();
    formData.append('filename', filename);
    formData.append('language', langCode);

    try {
        const response = await fetch('/api/ocr_pdf', { method: 'POST', body: formData });
        const data = await response.json();

        if (data.task_id) {
            pollOCRStatus(data.task_id);
        } else {
            throw new Error(data.error || "Failed to start OCR");
        }
    } catch (e) {
        if (overlay) overlay.style.display = 'none';
        if (window.handleApiError) window.window.handleApiError(e, "OCR Failed");
        else alert("OCR Failed: " + e.message);
    }
}

function pollOCRStatus(taskId) {
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const overlay = document.getElementById('processing-overlay');

    const interval = setInterval(() => {
        fetch(`/status/${taskId}`)
            .then(res => res.json())
            .then(data => {
                if (data.state === 'SUCCESS') {
                    clearInterval(interval);
                    if (progressBar) progressBar.style.width = '100%';
                    if (statusText) statusText.innerText = 'OCR Complete! Reloading...';

                    // Redirect to editor using the new file
                    setTimeout(() => {
                        window.location.href = `/editor/${data.result_file}`;
                    }, 1000);

                } else if (data.state === 'FAILURE') {
                    clearInterval(interval);
                    if (overlay) overlay.style.display = 'none';
                    if (window.showToast) window.showToast('OCR Failed: ' + data.status, 'danger');
                } else {
                    const percent = data.current || 0;
                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (statusText) statusText.innerText = data.status || 'Processing...';
                }
            })
            .catch(err => {
                console.error(err);
                // Don't clear interval immediately on transient net error, but maybe warn?
            });
    }, 1000);
}
