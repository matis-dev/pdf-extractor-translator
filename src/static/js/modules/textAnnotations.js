
import { state } from './state.js';
import { saveState } from './history.js';
import { startWrapperMove, startWrapperResize, startWrapperRotation } from './imageAnnotations.js';
import { refreshView } from './viewer.js';

// Helper to ensure settings exist
export function ensureTextSettings() {
    if (!state.textSettings) {
        state.textSettings = {
            fontFamily: 'Helvetica',
            fontSize: 16,
            color: '#000000',
            isBold: false,
            isItalic: false,
            // Background defaults (Opaque White, per user request)
            backgroundColor: '#ffffff',
            backgroundAlpha: 1.0,
            isTransparent: false
        };
    }
}

export async function addTextAnnotation(e, pageIndex) {
    // 1. Check for Active Selection First
    const existingSelected = document.querySelectorAll('.text-wrapper.selected');
    if (existingSelected.length > 0) {
        // If clicking outside the selected wrapper (handled by e.target check below),
        // we just deselect and return.
        if (!e.target.closest('.text-wrapper.selected')) {
            existingSelected.forEach(el => el.classList.remove('selected'));
            return; // STOP creation
        }
    }

    if (e.target.closest('.text-wrapper') || e.target.closest('.resize-handle') || e.target.closest('.delete-handle')) return;

    ensureTextSettings();
    await saveState(false);

    const pageContainer = document.querySelectorAll('.page-container')[pageIndex];
    if (!pageContainer) return; // Guard

    // Position relative to page container
    const rect = pageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'text-wrapper selected'; // Start selected
    wrapper.id = `text-annot-${Date.now()}`;

    // Minimal HTML for Wrapper + Controls
    wrapper.innerHTML = `
        <div class="resize-handle handle-nw" data-dir="nw"></div>
        <div class="resize-handle handle-n" data-dir="n"></div>
        <div class="resize-handle handle-ne" data-dir="ne"></div>
        <div class="resize-handle handle-e" data-dir="e"></div>
        <div class="resize-handle handle-se" data-dir="se"></div>
        <div class="resize-handle handle-s" data-dir="s"></div>
        <div class="resize-handle handle-sw" data-dir="sw"></div>
        <div class="resize-handle handle-w" data-dir="w"></div>
        <div class="rotate-handle"><i class="bi bi-arrow-repeat"></i></div>
        <div class="delete-handle" title="Delete Text"><i class="bi bi-x-lg"></i></div>
    `;

    // Create Text Content
    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.contentEditable = true; // Start editing
    textContent.innerText = "Type here";

    // Apply Styles
    Object.assign(textContent.style, {
        fontFamily: state.textSettings?.fontFamily || 'Helvetica',
        fontSize: `${state.textSettings?.fontSize || 16}px`,
        color: state.textSettings?.color || '#000000',
        fontWeight: state.textSettings?.isBold ? 'bold' : 'normal',
        fontStyle: state.textSettings?.isItalic ? 'italic' : 'normal',
        backgroundColor: state.textSettings?.isTransparent ? 'transparent' :
            hexToRgba(state.textSettings.backgroundColor, state.textSettings.backgroundAlpha)
    });

    // Metadata for saving
    textContent.dataset.bgColor = state.textSettings.backgroundColor;
    textContent.dataset.bgAlpha = state.textSettings.backgroundAlpha;
    textContent.dataset.isTransparent = state.textSettings.isTransparent;

    wrapper.prepend(textContent);

    Object.assign(wrapper.style, {
        left: `${x}px`,
        top: `${y}px`,
    });

    pageContainer.appendChild(wrapper);

    setupTextWrapperInteraction(wrapper, pageContainer);

    // Handle Edit Mode Focus
    textContent.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textContent);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Listen for blur to cleanup empty
    textContent.addEventListener('blur', () => {
        // Don't remove wrapper immediately on blur, maybe user just clicked handle.
        // Only remove if empty text.
        if (!textContent.innerText.trim()) {
            // wrapper.remove(); // Optional: remove if empty
        }
    });

    // Ensure Text Mode stays active
    state.modes.text = true;
    if (window.updateButtonStates) window.updateButtonStates();
}

/**
 * Text Wrapper Interaction - Matches Image Wrapper Logic
 */
export function setupTextWrapperInteraction(wrapper, container) {
    // 1. Move Logic (MouseDown on wrapper)
    wrapper.addEventListener('mousedown', (e) => {
        // If clicking handle or internal text (while editing), ignore move?
        // If editing text, we want standard text selection.
        const content = wrapper.querySelector('.text-content');
        if (content && content.isContentEditable && e.target === content) {
            e.stopPropagation(); // Allow text interactions
            return;
        }

        if (e.target.closest('.resize-handle') ||
            e.target.closest('.rotate-handle') ||
            e.target.closest('.delete-handle')) return;

        e.stopPropagation();
        e.preventDefault();

        // Select Logic
        document.querySelectorAll('.text-wrapper.selected').forEach(el => el.classList.remove('selected'));
        wrapper.classList.add('selected');

        // Move only on Double Click Hold (e.detail >= 2)
        // User requested: "click double on the text field and hold ... move"
        if (e.detail >= 2) {
            startWrapperMove(e, wrapper);
        }
    });

    // Handles
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dir = handle.dataset.dir;
            startWrapperResize(e, wrapper, dir);
        });
    });

    // Rotation
    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startWrapperRotation(e, wrapper);
        });
    }

    // Delete
    const delHandle = wrapper.querySelector('.delete-handle');
    if (delHandle) {
        delHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm("Delete this text field?")) {
                wrapper.remove();
                saveState(false);
            }
        });
        delHandle.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // Double Click to Edit
    wrapper.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const content = wrapper.querySelector('.text-content');
        if (content) {
            // If we were moving, we might prevent edit? 
            // Usually dblclick fires after mouseup of 2nd click.
            // If movement happened, maybe we don't want to edit?
            // But let's allow it for now or check if moved.
            content.contentEditable = true;
            content.focus();
        }
    });
}





// Global Text Settings Handlers (exposed for Ribbon)
export function updateTextSettings(key, value) {
    ensureTextSettings();
    state.textSettings[key] = value;

    // Apply to selected element if any
    // Fix: Selector must target content inside wrapper
    const selected = document.querySelector('.text-wrapper.selected .text-content');
    if (selected) {
        if (key === 'fontFamily') selected.style.fontFamily = value;
        else if (key === 'fontSize') selected.style.fontSize = `${value}px`;
        else if (key === 'color') selected.style.color = value;
    }
}

export function toggleTextProperty(prop) {
    ensureTextSettings();
    if (prop === 'bold') {
        state.textSettings.isBold = !state.textSettings.isBold;
        const selected = document.querySelector('.text-wrapper.selected .text-content');
        if (selected) selected.style.fontWeight = state.textSettings.isBold ? 'bold' : 'normal';
    } else if (prop === 'italic') {
        state.textSettings.isItalic = !state.textSettings.isItalic;
        const selected = document.querySelector('.text-wrapper.selected .text-content');
        if (selected) selected.style.fontStyle = state.textSettings.isItalic ? 'italic' : 'normal';
    }
}

export function updateTextBackground() {
    ensureTextSettings();
    const { backgroundColor, backgroundAlpha, isTransparent } = state.textSettings;
    const color = isTransparent ? 'transparent' : hexToRgba(backgroundColor, backgroundAlpha);

    // Update selected or all active editing?
    // addTextAnnotation handles selection logic now.
    const selected = document.querySelector('.text-wrapper.selected .text-content') || document.querySelector('.text-content[contenteditable="true"]');
    if (selected) {
        selected.style.backgroundColor = color;
        selected.dataset.bgColor = backgroundColor;
        selected.dataset.bgAlpha = backgroundAlpha;
        selected.dataset.isTransparent = isTransparent;
    }
}

export function updateTextBackgroundSettings(key, value) {
    ensureTextSettings();
    state.textSettings[key] = value;
    updateTextBackground();
}

export function hexToRgba(hex, alpha) {
    if (!hex) hex = '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
