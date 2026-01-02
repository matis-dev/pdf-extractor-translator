/**
 * Annotations Facade Module
 * Re-exports functionality and manages global state capture/restore for all annotation types.
 */

import * as drawing from './drawing.js';
import * as text from './textAnnotations.js';
import * as image from './imageAnnotations.js';
import * as shape from './shapeAnnotations.js';
import * as watermark from './watermark.js';
import * as commit from './commitAnnotations.js';
import * as forms from './formFields.js';
import * as notes from './notes.js';

export * from './drawing.js';
export * from './textAnnotations.js';
export * from './imageAnnotations.js';
export * from './shapeAnnotations.js';
export * from './watermark.js';
export * from './commitAnnotations.js';
export * from './formFields.js';

/**
 * Captures the current state of all granular annotations (Text, Shape, Image, Note)
 * that exist in the DOM. Used for sidecar persistence during Snapshots.
 */
export function captureAnnotationState() {
    const state = [];

    // Text
    document.querySelectorAll('.text-wrapper').forEach(el => {
        state.push({ type: 'text', data: text.getTextState(el) });
    });

    // Shape
    document.querySelectorAll('.shape-wrapper').forEach(el => {
        state.push({ type: 'shape', data: shape.getShapeState(el) });
    });

    // Image
    document.querySelectorAll('.image-wrapper').forEach(el => {
        state.push({ type: 'image', data: image.getImageState(el) });
    });

    // Notes
    document.querySelectorAll('.note-annotation').forEach(el => {
        state.push({ type: 'note', data: notes.getNoteState(el) });
    });

    return state;
}

/**
 * Restores a list of granular annotations to the DOM.
 */
export function restoreAnnotationState(stateList) {
    if (!stateList || !Array.isArray(stateList)) return;

    stateList.forEach(item => {
        if (!item.data) return;
        try {
            switch (item.type) {
                case 'text': text.restoreTextAnnotation(item.data); break;
                case 'shape': shape.restoreShapeAnnotation(item.data); break;
                case 'image': image.restoreImageAnnotation(item.data); break;
                case 'note': notes.restoreNote(item.data); break;
            }
        } catch (e) {
            console.warn("Failed to restore annotation item:", item, e);
        }
    });
}
