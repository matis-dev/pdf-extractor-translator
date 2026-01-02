
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
 * Submits the translation request by leveraging the existing extraction/processing flow.
 * It simulates a request to the backend with type='word' (DOCX) and the selected target language.
 */
export async function submitTranslation() {
    const sourceLang = document.getElementById('translate-source-lang').value;
    const targetLang = document.getElementById('translate-target-lang').value;

    if (!targetLang || targetLang === 'none') {
        alert("Please select a target language.");
        return;
    }

    // Check availability and prompt download if needed
    if (sourceLang !== 'auto' && sourceLang !== 'multilingual') {
        const langs = await fetchLanguages();
        // Check if specific pair exists
        const pair = langs.find(l => l.from_code === sourceLang && l.to_code === targetLang);

        if (pair && !pair.installed) {
            console.log(`Language pair ${sourceLang}->${targetLang} not installed. Prompting download.`);
            const success = await ensureLanguageInstalled(sourceLang, targetLang);
            if (!success) {
                // User cancelled or download failed
                return;
            }
        }
    }

    // Close modal
    const modalEl = document.getElementById('translateDocumentModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    // Show processing toast via existing UI util if available, or just rely on the processing callback
    if (window.showToast) window.showToast("Starting translation...", "info");

    // We can reuse the existing submitProcessing logic (from sidebar/main) if we can set the values
    // Or we can manually trigger the fetch.
    // The existing submitProcessing function (in utils.js or main.js sidebar logic) typically reads from the form.
    // Let's manually invoke the fetch for cleaner isolation, or inject into the hidden form.

    // OPTION 1: Reuse window.submitProcessing by updating the hidden form
    const form = document.getElementById('process-form');
    if (form) {
        // Set hidden inputs
        // We force extraction_type to 'word' because that's what our backend supports for translation currently
        const typeInput = form.querySelector('[name="extraction_type"]');
        if (typeInput) typeInput.value = 'word';

        const targetInput = form.querySelector('[name="target_lang"]');
        if (targetInput) targetInput.value = targetLang;

        const sourceInput = document.createElement('input');
        sourceInput.type = 'hidden';
        sourceInput.name = 'source_lang';
        sourceInput.value = sourceLang;
        form.appendChild(sourceInput);

        console.log(`Submitting translation: DOCX from ${sourceLang} to ${targetLang}`);

        // Call global submit (defined in index.html usually or main.js)
        if (window.submitProcessing) {
            window.submitProcessing();
        } else {
            console.error("window.submitProcessing not found");
        }

        // Clean up source input after a moment? 
        setTimeout(() => { if (sourceInput.parentNode) sourceInput.parentNode.removeChild(sourceInput); }, 1000);
    } else {
        console.error("Process form not found");
    }
}
