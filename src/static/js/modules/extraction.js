
import { state } from './state.js';
import { commitAnnotations } from './annotations.js';
import { closePageExtractionModal, updateUnsavedIndicator } from './ui.js';
import { clearDraft } from './autosave.js';
import { getSetting } from './settings.js';

export async function performExtraction(pageIndex, x, y, w, h, pageWidth, pageHeight) {
    document.getElementById('processing-overlay').style.display = 'flex';

    const formData = new FormData();
    formData.append('filename', state.filename);
    formData.append('page_index', pageIndex);
    formData.append('x', x);
    formData.append('y', y);
    formData.append('w', w);
    formData.append('h', h);
    formData.append('page_width', pageWidth);
    formData.append('page_height', pageHeight);

    try {
        const response = await fetch('/extract_text_region', { method: 'POST', body: formData });
        const data = await response.json();

        document.getElementById('processing-overlay').style.display = 'none';

        if (data.text) {
            document.getElementById('extracted-text-area').value = data.text;
            new bootstrap.Modal(document.getElementById('extraction-modal')).show();
        } else {
            showToast('No text found in selected area.', 'info');
        }
    } catch (e) {
        document.getElementById('processing-overlay').style.display = 'none';
        handleApiError(e, "Error extracting text");
    }
}

export async function translateExtractedText() {
    const text = document.getElementById('extracted-text-area').value;
    const sourceLang = document.getElementById('source-lang').value;
    const targetLang = document.getElementById('target-lang').value;

    if (!text) return;
    document.getElementById('processing-overlay').style.display = 'flex';

    const formData = new FormData();
    formData.append('text', text);
    formData.append('source_lang', sourceLang);
    formData.append('target_lang', targetLang);

    try {
        const response = await fetch('/translate_content', { method: 'POST', body: formData });
        const data = await response.json();
        document.getElementById('processing-overlay').style.display = 'none';

        if (data.text) {
            document.getElementById('extracted-text-area').value = data.text;
        } else {
            showToast('Translation failed: ' + (data.error || 'Unknown error'), 'warning');
        }
    } catch (e) {
        document.getElementById('processing-overlay').style.display = 'none';
        handleApiError(e, "Error translating text");
    }
}

export function copyExtractedText() {
    const copyText = document.getElementById("extracted-text-area");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    showToast("Copied to clipboard!", "success");
}

export async function submitProcessing() {
    document.getElementById('processing-overlay').style.display = 'flex';
    const form = document.getElementById('process-form');
    const formData = new FormData(form);

    try {
        const response = await fetch('/process_request', { method: 'POST', body: formData });
        const data = await response.json();
        const taskId = data.task_id;
        pollStatus(taskId);
    } catch (e) {
        handleApiError(e, "Error starting process");
        document.getElementById('processing-overlay').style.display = 'none';
    }
}

export function pollStatus(taskId) {
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');

    const interval = setInterval(() => {
        fetch(`/status/${taskId}`)
            .then(res => res.json())
            .then(data => {
                if (data.state === 'SUCCESS') {
                    clearInterval(interval);
                    progressBar.style.width = '100%';
                    progressBar.innerText = '100%';
                    statusText.innerText = 'Complete! Redirecting...';
                    setTimeout(() => {
                        window.location.href = `/results_view/${data.result_file}`;
                    }, 1000);
                } else if (data.state === 'FAILURE') {
                    clearInterval(interval);
                    showToast('Processing failed: ' + data.status, 'danger');
                    document.getElementById('processing-overlay').style.display = 'none';
                } else {
                    const percent = data.current || 0;
                    progressBar.style.width = `${percent}%`;
                    progressBar.innerText = `${percent}%`;
                    statusText.innerText = data.status || 'Processing...';
                }
            })
            .catch(err => {
                handleApiError(err, "Error polling status");
            });
    }, 1000);
}

export async function submitPageExtraction() {
    closePageExtractionModal();
    document.getElementById('processing-overlay').style.display = 'flex';

    try {
        const newPdf = await PDFLib.PDFDocument.create();
        const [page] = await newPdf.copyPages(state.pdfDoc, [state.pageToExtractIndex]);
        newPdf.addPage(page);
        const pdfBytes = await newPdf.save();

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        let baseName = state.filename;
        if (baseName.toLowerCase().endsWith('.pdf')) baseName = baseName.slice(0, -4);
        const singlePageFilename = `${baseName}-page${state.pageToExtractIndex + 1}.pdf`;

        const uploadData = new FormData();
        uploadData.append('pdf_file', blob, singlePageFilename);

        const uploadRes = await fetch('/upload', { method: 'POST', body: uploadData });
        if (!uploadRes.ok) throw new Error("Failed to upload page.");

        const format = document.getElementById('page-extract-format').value;
        const sourceLang = document.getElementById('page-source-lang').value;
        const targetLang = document.getElementById('page-target-lang').value;

        const processData = new FormData();
        processData.append('filename', singlePageFilename);
        processData.append('extraction_type', format);
        processData.append('source_lang', sourceLang);
        processData.append('target_lang', targetLang);

        const processRes = await fetch('/process_request', { method: 'POST', body: processData });
        const data = await processRes.json();

        if (data.task_id) {
            pollStatus(data.task_id);
        } else {
            throw new Error("Failed to start processing task.");
        }
    } catch (e) {
        handleApiError(e, "Page extraction failed");
        document.getElementById('processing-overlay').style.display = 'none';
    }
}

export async function saveChanges() {
    try {
        await commitAnnotations();

        // Apply Metadata from Settings
        const author = getSetting('pdf.defaultAuthor');
        const creator = getSetting('pdf.defaultCreator');
        const producer = getSetting('pdf.defaultProducer');

        if (author !== undefined) state.pdfDoc.setAuthor(author);
        if (creator !== undefined) state.pdfDoc.setCreator(creator);
        if (producer !== undefined) state.pdfDoc.setProducer(producer);
        state.pdfDoc.setModificationDate(new Date());

        const savedBytes = await state.pdfDoc.save();

        const blob = new Blob([savedBytes], { type: 'application/pdf' });
        const formData = new FormData();
        formData.append('pdf_file', blob, state.filename);

        const response = await fetch('/save_pdf', { method: 'POST', body: formData });
        if (!response.ok) {
            throw new Error(`Server returned ${response.status} ${response.statusText}`);
        }

        await clearDraft();

        state.hasUnsavedChanges = false;
        updateUnsavedIndicator(false);
        showToast('Changes saved successfully!', 'success');
        setTimeout(() => location.reload(), 1000);
    } catch (e) {
        console.error("Save failed", e);
        showToast("Error saving file: " + e.message, 'danger');
    }
}
