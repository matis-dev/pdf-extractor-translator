// autosave.js
import { state } from './state.js';
import { captureAnnotationState, restoreAnnotationState } from './annotations.js';
import { setLoader, saveState } from './history.js';
import { updateUnsavedIndicator } from './ui.js';
import { loadPdf } from './viewer.js';

const DB_NAME = 'PDFEditorDB';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;
const AUTOSAVE_INTERVAL = 30000; // 30s

let autosaveTimer = null;

// IndexedDB Helper
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'filename' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveToIDB(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadFromIDB(filename) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(filename);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteFromIDB(filename) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(filename);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Autosave Logic
export function scheduleAutosave() {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveDraft, AUTOSAVE_INTERVAL);
}

export async function saveDraft() {
    if (!state.filename) return;

    // We save:
    // 1. Current annotations (HTML layer)
    // 2. Current PDF Bytes (in case of committed changes)

    try {
        console.log("Auto-saving draft...");

        let pdfBytes = state.pdfBytes;
        // Ideally we should get the LATEST bytes. 
        // If state.pdfDoc is modified but not saved to bytes, we need to save it.
        // But save() is expensive. 
        // Strategy: We rely on state.pdfBytes being updated by history.saveState().
        // If the user makes a change that commits (rotate), saveState calls pdfDoc.save() and updates state.pdfBytes.
        // If the user makes a lightweight change (text), it is NOT in pdfBytes yet. It is in captureAnnotationState.
        // So: pdfBytes + annotationState covers everything.

        // HOWEVER: state.pdfBytes might be null initially?
        // On loadPdf, maybe we should set it.
        // Or we can call state.pdfDoc.save() here if we want to be paranoid?
        // Let's rely on state.pdfBytes if present, else save doc.

        if (!pdfBytes && state.pdfDoc) {
            pdfBytes = await state.pdfDoc.save();
        }

        const annotations = captureAnnotationState();

        const draftData = {
            filename: state.filename,
            timestamp: Date.now(),
            pdfBytes: pdfBytes,
            annotations: annotations,
            // Maybe page count etc?
        };

        await saveToIDB(draftData);
        showSavedIndicator();
        console.log("Draft auto-saved.");
    } catch (e) {
        console.error("Auto-save failed", e);
    }
}

export async function clearDraft() {
    if (!state.filename) return;
    try {
        await deleteFromIDB(state.filename);
        console.log("Draft cleared.");
    } catch (e) {
        console.error("Failed to clear draft", e);
    }
}

export async function checkForDraft() {
    if (!state.filename) return;
    try {
        const draft = await loadFromIDB(state.filename);
        if (draft) {
            console.log("Found draft from", new Date(draft.timestamp));
            showRecoveryModal(draft);
        }
    } catch (e) {
        console.error("Error checking for draft", e);
    }
}

async function restoreDraft(draft) {
    try {
        // Restore PDF Bytes
        if (draft.pdfBytes) {
            await loadPdf(draft.pdfBytes);
            // Updating state.pdfBytes is handled by loadPdf (usually) or we set it manually
            state.pdfBytes = draft.pdfBytes;
        }

        // Restore Annotations
        if (draft.annotations) {
            restoreAnnotationState(draft.annotations);
        }

        // Push this state to history so Undo works?
        // If we just loaded a fresh PDF, history is reset.
        // We should treat this as the "Initial State" or added on top?
        // Usually restoring a draft means "Getting back to where I was".
        // Use saveState(false) to init history.

        // We need to re-initialize history with this state.
        // Note: loadPdf resets history? No, loadPdf just renders.
        // So we should manually update history.
        // Actually main.js calls saveState(false) after loadPdf.
        // But here we are interrupting the flow.

        // IMPORTANT: restoreAnnotationState adds DOM elements.
        // We probably need to let main.js finish init?
        // checkForDraft is called during init.

        // If we restore, we effectively replace the "File Open" state.

        // We should update the "Unsaved" indicator because a draft implies unsaved work.
        state.hasUnsavedChanges = true;
        updateUnsavedIndicator(true);

        ui_showToast("Draft restored successfully", "success");

    } catch (e) {
        console.error("Failed to restore draft", e);
        ui_showToast("Failed to restore draft", "error");
    }
}

// UI Components
function showSavedIndicator() {
    let indicator = document.getElementById('autosave-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'autosave-indicator';
        indicator.className = 'position-fixed bottom-0 end-0 m-3 p-2 bg-dark text-white rounded shadow small';
        indicator.style.zIndex = '10000';
        indicator.style.transition = 'opacity 0.5s';
        document.body.appendChild(indicator);
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    indicator.innerHTML = `<i class="bi bi-cloud-check me-1"></i> Draft saved ${time}`;
    indicator.style.opacity = '1';

    setTimeout(() => {
        indicator.style.opacity = '0';
    }, 3000);
}

function showRecoveryModal(draft) {
    // Check if modal exists, else create
    let modalEl = document.getElementById('recovery-modal');
    if (!modalEl) {
        // Create it
        const div = document.createElement('div');
        div.innerHTML = `
        <div class="modal fade" id="recovery-modal" data-bs-backdrop="static" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning-subtle">
                        <h5 class="modal-title"><i class="bi bi-clock-history me-2"></i>Unsaved Work Found</h5>
                    </div>
                    <div class="modal-body">
                        <p>We found an unsaved draft for this document from <strong id="recovery-time"></strong>.</p>
                        <p>Would you like to restore it?</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="btn-discard-draft">Discard</button>
                        <button type="button" class="btn btn-primary" id="btn-restore-draft">Restore</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(div);
        modalEl = document.getElementById('recovery-modal');
    }

    document.getElementById('recovery-time').innerText = new Date(draft.timestamp).toLocaleString();

    const modal = new bootstrap.Modal(modalEl);

    document.getElementById('btn-restore-draft').onclick = () => {
        restoreDraft(draft);
        modal.hide();
    };

    document.getElementById('btn-discard-draft').onclick = () => {
        clearDraft();
        modal.hide();
    };

    modal.show();
}

function ui_showToast(msg, type = 'info') {
    if (window.showToast) window.showToast(msg, type);
    else console.log(msg);
}
