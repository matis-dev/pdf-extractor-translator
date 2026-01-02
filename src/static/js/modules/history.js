import { state, history } from './state.js';
import { commitAnnotations } from './commitAnnotations.js';
import { updateHistoryButtons, updateUnsavedIndicator } from './ui.js';

let pdfLoader = null;
let annotationCapturer = null;
let annotationRestorer = null;

export function setLoader(fn) {
    pdfLoader = fn;
}

export function setAnnotationHandlers(capture, restore) {
    annotationCapturer = capture;
    annotationRestorer = restore;
}

export const ActionType = {
    SNAPSHOT: 'snapshot',
    ADD: 'add',
    DELETE: 'delete',
    MOVE: 'move',
    RESIZE: 'resize',
    MODIFY: 'modify'
};

/**
 * Saves a full snapshot of the PDF state. 
 * Used for major changes (Rotate Page, Delete Page, Flatten).
 */
export async function saveState(shouldCommit = true) {
    if (shouldCommit) {
        try {
            await commitAnnotations();
            state.hasUnsavedChanges = true;
            updateUnsavedIndicator(true);
        } catch (e) {
            console.error(e);
            if (window.handleApiError) window.handleApiError(e, "Error committing annotations");
        }
    }

    const currentBytes = await state.pdfDoc.save();
    const sidecarAnnotations = (!shouldCommit && annotationCapturer) ? annotationCapturer() : null;

    history.undoStack.push({
        type: ActionType.SNAPSHOT,
        data: {
            pdfBytes: currentBytes,
            annotations: sidecarAnnotations
        }
    });

    if (history.undoStack.length > state.MAX_HISTORY) history.undoStack.shift();

    history.redoStack.length = 0;
    updateHistoryButtons(history.undoStack, history.redoStack);
}

/**
 * Records a granular action.
 * @param {string} type - ActionType
 * @param {object} data - { id, oldState, newState } or simple State object
 * @param {function} restoreFunc - Function to restore the element from state
 */
export function recordAction(type, data, restoreFunc) {
    history.undoStack.push({
        type: type,
        data: data,
        restoreFunc: restoreFunc
    });

    if (history.undoStack.length > state.MAX_HISTORY) history.undoStack.shift();
    history.redoStack.length = 0;

    state.hasUnsavedChanges = true;
    updateUnsavedIndicator(true);
    updateHistoryButtons(history.undoStack, history.redoStack);
}

export async function undo() {
    if (history.undoStack.length === 0) return;

    const item = history.undoStack.pop();

    if (item.type === ActionType.SNAPSHOT) {
        const currentBytes = await state.pdfDoc.save();
        const sidecar = annotationCapturer ? annotationCapturer() : null;

        history.redoStack.push({
            type: ActionType.SNAPSHOT,
            data: {
                pdfBytes: currentBytes,
                annotations: sidecar
            }
        });

        const bytes = item.data.pdfBytes || item.data;
        if (pdfLoader) await pdfLoader(bytes);
        if (annotationRestorer && item.data.annotations) {
            annotationRestorer(item.data.annotations);
        }

    } else {
        revertAction(item);
        history.redoStack.push(item);
    }

    updateHistoryButtons(history.undoStack, history.redoStack);
}

export async function redo() {
    if (history.redoStack.length === 0) return;

    const item = history.redoStack.pop();

    if (item.type === ActionType.SNAPSHOT) {
        const currentBytes = await state.pdfDoc.save();
        const sidecar = annotationCapturer ? annotationCapturer() : null;

        history.undoStack.push({
            type: ActionType.SNAPSHOT,
            data: {
                pdfBytes: currentBytes,
                annotations: sidecar
            }
        });

        const bytes = item.data.pdfBytes || item.data;
        if (pdfLoader) await pdfLoader(bytes);
        if (annotationRestorer && item.data.annotations) {
            annotationRestorer(item.data.annotations);
        }
    } else {
        applyAction(item);
        history.undoStack.push(item);
    }

    updateHistoryButtons(history.undoStack, history.redoStack);
}

function revertAction(action) {
    const { type, data, restoreFunc } = action;
    const id = data.id || (data.oldState ? data.oldState.id : null) || (data.newState ? data.newState.id : null);
    const el = document.getElementById(id);

    if (restoreFunc) {
        switch (type) {
            case ActionType.ADD:
                if (el) el.remove();
                break;
            case ActionType.DELETE:
                restoreFunc(data);
                break;
            case ActionType.MOVE:
            case ActionType.RESIZE:
            case ActionType.MODIFY:
                if (data.oldState) restoreFunc(data.oldState);
                break;
        }
        return;
    }
    console.warn("No restoreFunc for action:", action);
}

function applyAction(action) {
    const { type, data, restoreFunc } = action;
    const id = data.id || (data.newState ? data.newState.id : null);
    const el = document.getElementById(id);

    if (restoreFunc) {
        switch (type) {
            case ActionType.ADD:
                restoreFunc(data);
                break;
            case ActionType.DELETE:
                if (el) el.remove();
                break;
            case ActionType.MOVE:
            case ActionType.RESIZE:
            case ActionType.MODIFY:
                if (data.newState) restoreFunc(data.newState);
                break;
        }
        return;
    }
}
