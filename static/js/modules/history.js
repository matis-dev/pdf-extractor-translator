
import { state, history } from './state.js';
import { commitAnnotations } from './annotations.js';
import { loadPdf } from './viewer.js';
import { updateHistoryButtons, updateUnsavedIndicator } from './ui.js';

export async function saveState(shouldCommit = true) {
    if (shouldCommit) {
        try {
            await commitAnnotations();
            state.hasUnsavedChanges = true;
            updateUnsavedIndicator(true);
        } catch (e) {
            handleApiError(e, "Error committing annotations");
        }
    }

    const currentBytes = await state.pdfDoc.save();
    history.undoStack.push(currentBytes);
    if (history.undoStack.length > state.MAX_HISTORY) history.undoStack.shift();

    history.redoStack.length = 0;
    updateHistoryButtons(history.undoStack, history.redoStack);
}

export async function undo() {
    if (history.undoStack.length === 0) return;

    try {
        await commitAnnotations();
    } catch (e) {
        // ignore or handle
    }
    const currentBytes = await state.pdfDoc.save();
    history.redoStack.push(currentBytes);

    const prevBytes = history.undoStack.pop();
    await loadPdf(prevBytes);
    updateHistoryButtons(history.undoStack, history.redoStack);
}

export async function redo() {
    if (history.redoStack.length === 0) return;

    try {
        await commitAnnotations();
    } catch (e) { }
    const currentBytes = await state.pdfDoc.save();
    history.undoStack.push(currentBytes);

    const nextBytes = history.redoStack.pop();
    await loadPdf(nextBytes);
    updateHistoryButtons(history.undoStack, history.redoStack);
}
