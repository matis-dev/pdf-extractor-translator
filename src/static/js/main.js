
console.log("Main.js module evaluating...");
try {
    document.body.setAttribute('data-main-evaluating', 'true');
} catch (e) { console.error("Error setting attr", e); }

import { state, history as historyState } from './modules/state.js';
import * as ui from './modules/ui.js';
import { updateUnsavedIndicator } from './modules/ui.js';
import { initRibbon } from './modules/ribbon.js';
import { loadPdf, refreshView, zoomIn, zoomOut, initHandPan } from './modules/viewer.js';
import * as historyModule from './modules/history.js';
import * as pages from './modules/pages.js';
import { openPageNumbersModal, applyPageNumbers } from './modules/pages.js';
import * as annotations from './modules/annotations.js';
import { openWatermarkModal, applyWatermark } from './modules/annotations.js';
import { openSignatureModal, clearSignature, applySignature } from './modules/signature.js';
import * as extraction from './modules/extraction.js';
import { splitPdf } from './modules/split.js';
import * as notes from './modules/notes.js';
import { initAIChat } from './modules/ai_chat.js';
import * as compare from './modules/compare.js';
import { initCommandPalette, registerCommand } from './modules/command_palette.js';

// Expose to window for HTML access
Object.assign(window, {
    state,
    historyState, // Access to stacks
    ...ui,
    appHistory: historyModule, // Access to saveState, undo, redo (avoiding window.history collision)
    ...annotations,
    applySignature,
    ...extraction,
    splitPdf,
    openWatermarkModal,
    applyWatermark,
    updateNoteSettings: notes.updateNoteSettings, // Expose for ribbon
    loadPdf,
    openPageNumbersModal,
    applyPageNumbers,
    openSignatureModal,
    clearSignature,
    refreshView,
    zoomIn,
    zoomOut,
    initRibbon,
    // Page Actions
    rotatePage: pages.rotateCurrentPage,
    deletePage: pages.deleteCurrentPage,
    confirmDeletePage: pages.confirmDeletePage,
    movePageUp: pages.movePageUp,
    movePageDown: pages.movePageDown,
    shardPdf: pages.shardPdf,
    manageSecurity: () => document.getElementById('security-modal').style.display = 'block',
    // Compare PDFs
    openCompareModal: compare.openCompareModal,
    closeCompareModal: compare.closeCompareModal,
    handleCompareFileSelect: compare.handleCompareFileSelect,
    runComparison: compare.runComparison,
    currentFilename: window.filename
});

// Initialize
async function init() {
    try {
        console.log("Init started");
        document.body.setAttribute('data-init-started', 'true');

        ui.initTheme();
        initRibbon();
        initAIChat();
        initHandPan();
        initCommandPalette();
        registerCommands();
        document.body.setAttribute('data-ribbon-called', 'true');

        state.filename = window.filename;

        // Load PDF
        const url = `/uploads/${state.filename}`;
        console.log("Fetching PDF", url);
        const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer());
        console.log("PDF fetched");

        // Initial Load
        await loadPdf(existingPdfBytes);
        console.log("loadPdf done");

        // Initialize history
        historyModule.saveState(false);
        state.hasUnsavedChanges = false;
        updateUnsavedIndicator(false);
        ui.updateHistoryButtons(historyState.undoStack, historyState.redoStack);

        setupContextMenu();
        console.log("setupContextMenu done");
        document.body.setAttribute('data-main-initialized', 'true');
    } catch (e) {
        console.error("Init failed:", e);
        document.body.setAttribute('data-main-error', e.message);
    }
}

function setupContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    const deleteItem = document.getElementById('delete-item');
    const container = document.getElementById('pdf-viewer');
    let targetElement = null;

    document.addEventListener('contextmenu', (e) => {
        if (e.target.classList.contains('text-annotation') ||
            e.target.classList.contains('image-annotation') ||
            e.target.classList.contains('annotation-rect') ||
            e.target.tagName === 'path') {

            e.preventDefault();
            targetElement = e.target.tagName === 'path' ? e.target.closest('svg') : e.target;

            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
        } else {
            contextMenu.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('#context-menu')) return;
        if (contextMenu) contextMenu.style.display = 'none';
    });

    if (container) {
        container.addEventListener('click', (e) => {
            console.log("Main container clicked target:", e.target);
            const i = state.selectedPageIndex || 0;

            if (state.modes.text) {
                const rect = container.getBoundingClientRect();
                // Reusing logic from modules/annotations.js which attaches listeners to page containers
            }
        });
    }

    if (deleteItem) {
        deleteItem.addEventListener('click', async () => {
            if (targetElement) {
                await historyModule.saveState();
                targetElement.remove();
                contextMenu.style.display = 'none';
                targetElement = null;
            }
        });
    }

    // Global listeners
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('mouseup', annotations.handleGlobalMouseUp);

    // Sync form inputs to PDF model
    document.addEventListener('change', (e) => {
        if (e.target.closest('.annotationLayer')) {
            const name = e.target.name;
            const value = e.target.value;
            if (name && state.pdfDoc) {
                try {
                    const form = state.pdfDoc.getForm();
                    // pdf-lib logic: names often match
                    const field = form.getField(name);
                    if (field) {
                        if (e.target.type === 'checkbox') {
                            if (e.target.checked) field.check(); else field.uncheck();
                        } else {
                            field.setText(value);
                        }
                        // Optional: trigger history save on blur? leaving simpler for now.
                    }
                } catch (err) { console.warn("Form sync warning", err); }
            }
        }
    });

    document.addEventListener('security-update', async (e) => {
        const { password } = e.detail;
        if (password) {
            await state.pdfDoc.encrypt({
                userPassword: password,
                ownerPassword: password,
                permissions: {
                    printing: 'highResolution',
                    modifying: true,
                    copying: true,
                    annotating: true,
                    fillingForms: true,
                    contentAccessibility: true,
                    documentAssembly: true,
                }
            });
            ui.showToast("Password set successfully. Please save changes.", "success");
        } else {
            const newDoc = await window.PDFLib.PDFDocument.create();
            const pages = await newDoc.copyPages(state.pdfDoc, state.pdfDoc.getPageIndices());
            pages.forEach(page => newDoc.addPage(page));
            state.pdfDoc = newDoc;
            ui.showToast("Password removed. Please save changes.", "success");
        }
    });
}

function registerCommands() {
    registerCommand('save', 'Save Changes', () => extraction.saveChanges(), 'bi-save');
    registerCommand('undo', 'Undo', () => historyModule.undo(), 'bi-arrow-counterclockwise');
    registerCommand('redo', 'Redo', () => historyModule.redo(), 'bi-arrow-clockwise');
    registerCommand('dark-mode', 'Toggle Dark Mode', () => ui.toggleDarkMode(), 'bi-moon');
    registerCommand('zoom-in', 'Zoom In', () => zoomIn(), 'bi-zoom-in');
    registerCommand('zoom-out', 'Zoom Out', () => zoomOut(), 'bi-zoom-out');

    // Tools
    registerCommand('mode-text', 'Add Text Tool', () => ui.toggleTextMode(), 'bi-fonts');
    registerCommand('mode-note', 'Add Sticky Note', () => ui.toggleNoteMode(), 'bi-sticky');
    registerCommand('mode-redact', 'Redact Tool', () => ui.toggleRedactMode(), 'bi-eraser');
    registerCommand('mode-highlight', 'Highlight Tool', () => ui.toggleHighlightMode(), 'bi-highlighter');
    registerCommand('watermark', 'Add Watermark', () => openWatermarkModal(), 'bi-badge-ad');
    registerCommand('signature', 'Add Signature', () => openSignatureModal(), 'bi-pen-fill'); // Fixed calling function
    registerCommand('page-numbers', 'Add Page Numbers', () => openPageNumbersModal(), 'bi-123');

    // Page Actions
    registerCommand('rotate-page', 'Rotate Current Page', () => pages.rotateCurrentPage(), 'bi-arrow-repeat');
    registerCommand('delete-page', 'Delete Current Page', () => pages.deleteCurrentPage(), 'bi-trash');
    registerCommand('move-up', 'Move Page Up', () => pages.movePageUp(), 'bi-arrow-up');
    registerCommand('move-down', 'Move Page Down', () => pages.movePageDown(), 'bi-arrow-down');
    registerCommand('extract-page', 'Extract Current Page', () => pages.extractSinglePage(state.selectedPageIndex), 'bi-file-earmark-arrow-up');

    // Misc
    registerCommand('split-pdf', 'Split / Burst PDF', () => splitPdf(), 'bi-grid-3x3');
    registerCommand('compare', 'Compare PDFs', () => compare.openCompareModal(), 'bi-columns');
    registerCommand('security', 'Security Settings', () => ui.openSecurityModal(), 'bi-shield-lock');

    // Forms
    registerCommand('field-text', 'Add Form Text Field', () => annotations.toggleFormMode('textfield'), 'bi-input-cursor-text');
    registerCommand('field-check', 'Add Form Checkbox', () => annotations.toggleFormMode('checkbox'), 'bi-check-square');
}

// Start
window.initMain = init;
// Expose Form Logic
window.toggleFormMode = annotations.toggleFormMode;
window.updateFormSettings = annotations.updateFormSettings;
init();
