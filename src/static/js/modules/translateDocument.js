
import * as ui from './ui.js';
import { renderLanguageDropdown, fetchLanguages, ensureLanguageInstalled } from './language_manager.js';

export async function openTranslateModal() {
    const modal = new bootstrap.Modal(document.getElementById('translateDocumentModal'));

    // Initialize dropdowns
    // Source: Mode 'source', includes 'auto'
    await renderLanguageDropdown('translate-source-lang', 'auto', true, null, false, 'source');

    // Target: Mode 'target', default 'es', but depends on source. 
    // Initially assume 'auto' source -> show all unique targets? Or default filter?
    // Let's show all valid targets for 'auto' (which effectively means any target that is part of ANY pair)
    // Actually, if we pick 'auto', we rely on backend to detect. 
    // And backend likely translates Source detected -> Target. 
    // Checks if pair (Detected)->(Target) exists.
    // So distinct list of ALL `to_code` is safe.
    await renderLanguageDropdown('translate-target-lang', 'es', false, null, true, 'target');

    // Add listener to update target based on source
    const sourceSelect = document.getElementById('translate-source-lang');
    sourceSelect.onchange = async () => {
        const sourceVal = sourceSelect.value;
        const currentTarget = document.getElementById('translate-target-lang').value;

        // If auto/multilingual, we show all targets (filterSource=null)
        // If specific source, we filter targets by that source
        const filter = (sourceVal === 'multilingual' || sourceVal === 'auto') ? null : sourceVal;

        await renderLanguageDropdown('translate-target-lang', currentTarget, false, filter, true, 'target');
    };

    modal.show();
}

/**
 * Submits the translation request to the dedicated endpoint.
 */
export async function submitTranslation() {
    const sourceLang = document.getElementById('translate-source-lang').value;
    const targetLang = document.getElementById('translate-target-lang').value;

    if (!targetLang || targetLang === 'none') {
        alert("Please select a target language.");
        return;
    }

    // Check availability (existing logic)
    if (sourceLang !== 'auto' && sourceLang !== 'multilingual') {
        const langs = await fetchLanguages();
        const pair = langs.find(l => l.from_code === sourceLang && l.to_code === targetLang);
        if (pair && !pair.installed) {
            const success = await ensureLanguageInstalled(sourceLang, targetLang);
            if (!success) return;
        }
    }

    // Close modal
    const modalEl = document.getElementById('translateDocumentModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    if (window.showToast) window.showToast("Requesting translation...", "info");

    const formData = new FormData();
    formData.append('filename', window.state.filename);
    formData.append('source_lang', sourceLang);
    formData.append('target_lang', targetLang);

    try {
        const response = await fetch('/api/translate-document', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Translation request failed');
        }

        const data = await response.json();
        pollTranslationStatus(data.task_id);

    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast(`Error: ${e.message}`, "error");
    }
}

async function pollTranslationStatus(taskId) {
    const statusUrl = `/status/${taskId}`;
    const interval = setInterval(async () => {
        try {
            const res = await fetch(statusUrl);
            const data = await res.json();

            if (data.state === 'SUCCESS') {
                clearInterval(interval);
                if (window.showToast) window.showToast("Translation completed!", "success");

                // Result file name
                const resultFile = data.result_file;

                // Construct URL
                const fileUrl = `/outputs/${resultFile}`;

                // Option: Download
                // const link = document.createElement('a');
                // link.href = fileUrl;
                // link.download = resultFile;
                // link.click();

                // Option: Preview (Reload Viewer)
                // We ask the user or just do it? 
                // AC3 says "Export", AC4 says "Preview".
                // Let's load it into the viewer for "In-Place" feel.
                // And offer a download button (already in Ribbon).

                // We need to load this "Output" file. 
                // The viewer usually loads from /uploads/. 
                // We can fetch bytes and load.

                const pdfBytes = await fetch(fileUrl).then(r => r.arrayBuffer());
                await window.loadPdf(pdfBytes);

                // Update filename in state so subsequent saves might work?
                // But this file is in 'outputs', not 'uploads'. 
                // Saving might fail if backend expects file in 'uploads'.
                // Ideally we should move it to uploads or handle "Save As".
                // For now, visual preview is key.

            } else if (data.state === 'FAILURE') {
                clearInterval(interval);
                if (window.showToast) window.showToast(`Translation failed: ${data.status}`, "error");
            } else {
                // Update progress?
                if (window.showToast && Math.random() > 0.8) {
                    // Don't spam toasts, maybe update a status bar if we had one.
                    window.showToast(`Translating: ${data.status}`, "info");
                }
            }
        } catch (e) {
            clearInterval(interval);
            console.error("Polling error", e);
            if (window.showToast) window.showToast("Error checking status", "error");
        }
    }, 2000);
}
