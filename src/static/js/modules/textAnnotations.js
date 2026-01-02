
import { state } from './state.js';
import { saveState, recordAction, ActionType } from './history.js';
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
            backgroundColor: '#ffffff',
            backgroundAlpha: 1.0,
            isTransparent: false
        };
    }
}

export function getTextState(wrapper) {
    const pageContainer = wrapper.closest('.page-container');
    const pageIndex = parseInt(pageContainer.dataset.pageIndex);
    const content = wrapper.querySelector('.text-content');
    return {
        id: wrapper.id,
        pageIndex,
        x: wrapper.style.left,
        y: wrapper.style.top,
        width: wrapper.style.width,
        height: wrapper.style.height,
        transform: wrapper.style.transform || 'none',
        text: content.innerText,
        styles: {
            fontFamily: content.style.fontFamily,
            fontSize: content.style.fontSize,
            color: content.style.color,
            fontWeight: content.style.fontWeight,
            fontStyle: content.style.fontStyle,
            backgroundColor: content.style.backgroundColor,
        },
        metadata: {
            bgColor: content.dataset.bgColor,
            bgAlpha: content.dataset.bgAlpha,
            isTransparent: content.dataset.isTransparent
        },
        domElement: wrapper
    };
}

export function restoreTextAnnotation(data) {
    let wrapper = document.getElementById(data.id);
    if (!wrapper) {
        // Create it
        const pageContainer = document.querySelectorAll('.page-container')[data.pageIndex];
        if (!pageContainer) return;

        wrapper = document.createElement('div');
        wrapper.className = 'text-wrapper'; // Default logic
        wrapper.id = data.id;

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

        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        textContent.contentEditable = true;
        // Text/Styles applied below

        wrapper.prepend(textContent);
        pageContainer.appendChild(wrapper);
        setupTextWrapperInteraction(wrapper, pageContainer);

        // Listeners for modifications
        let startContent = data.text;
        textContent.addEventListener('focus', () => { startContent = textContent.innerText; });
        textContent.addEventListener('blur', () => {
            const currentContent = textContent.innerText;
            if (currentContent !== startContent) {
                // Record content change
                const oldState = { ...getTextState(wrapper), text: startContent };
                const newState = getTextState(wrapper);
                recordAction(ActionType.MODIFY, { oldState, newState }, restoreTextAnnotation);
                startContent = currentContent;
                if (!currentContent.trim()) {
                    // Empty text handling if needed
                }
            }
        });
    }

    // Apply State
    Object.assign(wrapper.style, {
        left: data.x, top: data.y, width: data.width, height: data.height, transform: data.transform
    });

    // Safety check for content
    const content = wrapper.querySelector('.text-content');
    if (content) {
        content.innerText = data.text;
        Object.assign(content.style, data.styles);
        Object.assign(content.dataset, data.metadata);
    }

    return wrapper;
}


export async function addTextAnnotation(e, pageIndex) {
    const existingSelected = document.querySelectorAll('.text-wrapper.selected');
    if (existingSelected.length > 0) {
        if (!e.target.closest('.text-wrapper.selected')) {
            existingSelected.forEach(el => el.classList.remove('selected'));
            // Continue to create new text
        }
    }

    if (e.target.closest('.text-wrapper') || e.target.closest('.resize-handle') || e.target.closest('.delete-handle')) return;

    ensureTextSettings();
    // No saveState(false) - using Action

    const pageContainer = document.querySelectorAll('.page-container')[pageIndex];
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Create via restore logic or manually? 
    // Manual creation to match event context, then stick listeners.
    const wrapper = document.createElement('div');
    wrapper.className = 'text-wrapper selected';
    wrapper.id = `text-annot-${Date.now()}`;

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

    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.contentEditable = true;
    textContent.innerText = "Type here";

    Object.assign(textContent.style, {
        fontFamily: state.textSettings?.fontFamily || 'Helvetica',
        fontSize: `${state.textSettings?.fontSize || 16}px`,
        color: state.textSettings?.color || '#000000',
        fontWeight: state.textSettings?.isBold ? 'bold' : 'normal',
        fontStyle: state.textSettings?.isItalic ? 'italic' : 'normal',
        backgroundColor: state.textSettings?.isTransparent ? 'transparent' :
            hexToRgba(state.textSettings.backgroundColor, state.textSettings.backgroundAlpha)
    });

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

    // Modify Listeners
    let startContent = textContent.innerText;
    textContent.addEventListener('focus', () => { startContent = textContent.innerText; });
    textContent.addEventListener('blur', () => {
        const current = textContent.innerText;
        if (current !== startContent) {
            const oldState = { ...getTextState(wrapper), text: startContent };
            const newState = getTextState(wrapper);
            recordAction(ActionType.MODIFY, { oldState, newState }, restoreTextAnnotation);
            startContent = current;
        }
        if (!current.trim()) {
            // Optional empty clean up
        }
    });

    textContent.focus();

    const range = document.createRange();
    range.selectNodeContents(textContent);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Record Addition
    recordAction(ActionType.ADD, getTextState(wrapper), restoreTextAnnotation);

    state.modes.text = true;
    if (window.updateButtonStates) window.updateButtonStates();
}

export function setupTextWrapperInteraction(wrapper, container) {
    wrapper.addEventListener('mousedown', (e) => {
        const content = wrapper.querySelector('.text-content');
        if (content && content.isContentEditable && e.target === content) {
            e.stopPropagation();
            return;
        }

        if (e.target.closest('.resize-handle') ||
            e.target.closest('.rotate-handle') ||
            e.target.closest('.delete-handle')) return;

        e.stopPropagation();
        e.preventDefault();

        document.querySelectorAll('.text-wrapper.selected').forEach(el => el.classList.remove('selected'));
        wrapper.classList.add('selected');

        if (e.detail >= 2) {
            const startState = getTextState(wrapper);
            startWrapperMove(e, wrapper, () => {
                const newState = getTextState(wrapper);
                if (newState.x !== startState.x || newState.y !== startState.y) {
                    recordAction(ActionType.MOVE, { oldState: startState, newState }, restoreTextAnnotation);
                }
            });
        }
    });

    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dir = handle.dataset.dir;
            const startState = getTextState(wrapper);
            startWrapperResize(e, wrapper, dir, () => {
                const newState = getTextState(wrapper);
                recordAction(ActionType.RESIZE, { oldState: startState, newState }, restoreTextAnnotation);
            });
        });
    });

    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startState = getTextState(wrapper);
            startWrapperRotation(e, wrapper, () => {
                const newState = getTextState(wrapper);
                recordAction(ActionType.MODIFY, { oldState: startState, newState }, restoreTextAnnotation);
            });
        });
    }

    const delHandle = wrapper.querySelector('.delete-handle');
    if (delHandle) {
        delHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm("Delete this text field?")) {
                const s = getTextState(wrapper);
                wrapper.remove();
                recordAction(ActionType.DELETE, s, restoreTextAnnotation);
            }
        });
        delHandle.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    wrapper.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const content = wrapper.querySelector('.text-content');
        if (content) {
            content.contentEditable = true;
            content.focus();
        }
    });
}

// Global Text Settings Handlers
export function updateTextSettings(key, value) {
    ensureTextSettings();
    state.textSettings[key] = value;
    const selected = document.querySelector('.text-wrapper.selected .text-content');
    if (selected) {
        const wrapper = selected.closest('.text-wrapper');
        const oldState = getTextState(wrapper);

        if (key === 'fontFamily') selected.style.fontFamily = value;
        else if (key === 'fontSize') selected.style.fontSize = `${value}px`;
        else if (key === 'color') selected.style.color = value;

        const newState = getTextState(wrapper);
        recordAction(ActionType.MODIFY, { oldState, newState }, restoreTextAnnotation);
    }
}

export function toggleTextProperty(prop) {
    ensureTextSettings();
    const selected = document.querySelector('.text-wrapper.selected .text-content');
    let changed = false;
    let oldState = null;
    let wrapper = null;
    if (selected) {
        wrapper = selected.closest('.text-wrapper');
        oldState = getTextState(wrapper);
    }

    if (prop === 'bold') {
        state.textSettings.isBold = !state.textSettings.isBold;
        if (selected) {
            selected.style.fontWeight = state.textSettings.isBold ? 'bold' : 'normal';
            changed = true;
        }
        const btn = document.getElementById('btn-text-bold');
        if (btn) btn.classList.toggle('active');

    } else if (prop === 'italic') {
        state.textSettings.isItalic = !state.textSettings.isItalic;
        if (selected) {
            selected.style.fontStyle = state.textSettings.isItalic ? 'italic' : 'normal';
            changed = true;
        }
        const btn = document.getElementById('btn-text-italic');
        if (btn) btn.classList.toggle('active');
    }

    if (changed && wrapper) {
        const newState = getTextState(wrapper);
        recordAction(ActionType.MODIFY, { oldState, newState }, restoreTextAnnotation);
    }
}

export function updateTextBackground() {
    ensureTextSettings();
    const { backgroundColor, backgroundAlpha, isTransparent } = state.textSettings;
    const color = isTransparent ? 'transparent' : hexToRgba(backgroundColor, backgroundAlpha);
    const selected = document.querySelector('.text-wrapper.selected .text-content') || document.querySelector('.text-content[contenteditable="true"]');

    if (selected) {
        const wrapper = selected.closest('.text-wrapper');
        const oldState = getTextState(wrapper);

        selected.style.backgroundColor = color;
        selected.dataset.bgColor = backgroundColor;
        selected.dataset.bgAlpha = backgroundAlpha;
        selected.dataset.isTransparent = isTransparent;

        const newState = getTextState(wrapper);
        // Only record if changed? Metadata change is change.
        // But this function might be called repeatedly during slider move?
        // Ideally we record on change End.
        // But for buttons it's instant.
        // For now, record it.
        recordAction(ActionType.MODIFY, { oldState, newState }, restoreTextAnnotation);
    }
}

// Background Setters wrap updateTextBackground, so we might duplicate history if we are not careful.
// updateTextBackgroundSettings calls updateTextBackground.
// recordAction should likely be in updateTextBackground? 
// Yes, I put it there.

export function updateTextBackgroundSettings(key, value) {
    ensureTextSettings();

    // Wake up action
    if (key === 'wakeUp') {
        if (state.textSettings.isTransparent) {
            state.textSettings.isTransparent = false;
            if (state.textSettings.backgroundAlpha === 0) {
                state.textSettings.backgroundAlpha = 1;
            }
            updateBackgroundUIState();
            updateTextBackground();
        }
        return;
    }

    state.textSettings[key] = value;

    if (key === 'backgroundAlpha') {
        if (value === 0) {
            state.textSettings.isTransparent = true;
        } else {
            if (state.textSettings.isTransparent) {
                state.textSettings.isTransparent = false;
            }
        }
    }

    if (key === 'backgroundColor') {
        if (state.textSettings.isTransparent) {
            state.textSettings.isTransparent = false;
            if (state.textSettings.backgroundAlpha === 0) {
                state.textSettings.backgroundAlpha = 1;
            }
        }
    }

    updateBackgroundUIState();
    updateTextBackground();
}

export function toggleTextBackgroundTransparency() {
    ensureTextSettings();
    const current = state.textSettings.isTransparent;
    state.textSettings.isTransparent = !current;
    if (!current === false) {
        if (state.textSettings.backgroundAlpha === 0) {
            state.textSettings.backgroundAlpha = 1;
        }
    }

    updateBackgroundUIState();
    updateTextBackground();
}

function updateBackgroundUIState() {
    // ... existing UI logic ...
    const isTransparent = state.textSettings.isTransparent;
    const alpha = state.textSettings.backgroundAlpha;
    const btn = document.getElementById('bg-transparent-btn');
    const slider = document.getElementById('bg-opacity-slider');
    const colorPicker = document.getElementById('bg-color-picker');

    if (btn) {
        if (isTransparent) {
            btn.classList.add('active', 'btn-secondary');
            btn.classList.remove('btn-outline-secondary');
        } else {
            btn.classList.remove('active', 'btn-secondary');
            btn.classList.add('btn-outline-secondary');
        }
    }
    if (slider) {
        if (isTransparent) slider.style.opacity = '0.5';
        else { slider.style.opacity = '1'; slider.value = alpha; }
    }
    if (colorPicker) {
        if (isTransparent) colorPicker.style.opacity = '0.5';
        else colorPicker.style.opacity = '1';
    }
}

export function hexToRgba(hex, alpha) {
    if (!hex) hex = '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
