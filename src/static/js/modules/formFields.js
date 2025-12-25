
import { state } from './state.js';
import { saveState } from './history.js';
import { startWrapperMove, startWrapperResize, startWrapperRotation } from './imageAnnotations.js';
import { refreshView } from './viewer.js';

// Helper to ensure form settings exist
export function ensureFormSettings() {
    if (!state.formSettings) {
        state.formSettings = {
            fontFamily: 'Helvetica',
            fontSize: 12,
            textColor: '#000000',
            backgroundColor: '#ffffff',
            backgroundAlpha: 1.0,
            borderColor: '#000000',
            borderWidth: 1,
            textAlign: 'left'
        };
    }
}

// Map field types to display names
const FIELD_TYPES = {
    'textfield': 'Text Field',
    'checkbox': 'Checkbox',
    'radio': 'Radio Group',
    'dropdown': 'Dropdown',
    'signature': 'Signature Field'
};

/**
 * Add a new form field to the page
 */
export async function addFormField(e, pageIndex, type) {
    if (e.target.closest('.form-field-wrapper') || e.target.closest('.resize-handle')) return;

    ensureFormSettings();
    await saveState(false);

    const pageContainer = document.querySelectorAll('.page-container')[pageIndex];
    if (!pageContainer) return;

    // Position relative to page container
    const rect = pageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Default sizes per type
    let w = 150, h = 30;
    if (type === 'checkbox') { w = 20; h = 20; }
    if (type === 'radio') { w = 20; h = 20; }
    if (type === 'dropdown') { w = 120; h = 30; }
    if (type === 'signature') { w = 150; h = 60; }

    // Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field-wrapper selected';
    wrapper.id = `form-field-${Date.now()}`;
    wrapper.dataset.type = type;

    // Shared handles HTML
    const handlesHtml = `
        <div class="resize-handle handle-nw" data-dir="nw"></div>
        <div class="resize-handle handle-n" data-dir="n"></div>
        <div class="resize-handle handle-ne" data-dir="ne"></div>
        <div class="resize-handle handle-e" data-dir="e"></div>
        <div class="resize-handle handle-se" data-dir="se"></div>
        <div class="resize-handle handle-s" data-dir="s"></div>
        <div class="resize-handle handle-sw" data-dir="sw"></div>
        <div class="resize-handle handle-w" data-dir="w"></div>
        <div class="rotate-handle"><i class="bi bi-arrow-repeat"></i></div>
    `;

    // Create Inner Content based on type
    const content = document.createElement('div');
    content.className = 'form-field-content';
    content.style.width = '100%';
    content.style.height = '100%';
    content.style.overflow = 'hidden';
    content.style.display = 'flex';
    content.style.alignItems = 'center';
    content.style.padding = '2px';
    content.style.boxSizing = 'border-box';

    // Apply initial styles from state
    applyStylesToContent(content);

    // Specific Content Logic
    if (type === 'textfield') {
        content.innerText = 'Text Field';
        content.style.backgroundColor = '#e8f0fe'; // Light blue hint
        content.style.border = '1px solid #999';
    } else if (type === 'checkbox') {
        content.innerHTML = '<i class="bi bi-check-lg" style="opacity: 0.5;"></i>';
        content.style.justifyContent = 'center';
        content.style.border = '1px solid #000';
    } else if (type === 'radio') {
        content.style.borderRadius = '50%';
        content.style.border = '1px solid #000';
        content.innerHTML = '<div style="width: 60%; height: 60%; background: #000; border-radius: 50%; opacity: 0.3;"></div>';
        content.style.justifyContent = 'center';
    } else if (type === 'dropdown') {
        content.innerHTML = '<span>Select...</span><i class="bi bi-caret-down-fill ms-auto" style="font-size: 0.8em;"></i>';
        content.style.border = '1px solid #999';
        content.style.backgroundColor = '#fff';
        content.style.padding = '0 5px';
    } else if (type === 'signature') {
        content.innerHTML = '<span class="text-muted small">Sign Here</span>';
        content.style.borderBottom = '1px solid #000';
        content.style.backgroundColor = 'rgba(255, 255, 0, 0.1)';
        content.style.justifyContent = 'center';
    }

    wrapper.innerHTML = handlesHtml;
    wrapper.prepend(content);

    // Initial positioning
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
    wrapper.style.width = `${w}px`;
    wrapper.style.height = `${h}px`;

    // Metadata
    updateWrapperMetadata(wrapper);

    pageContainer.appendChild(wrapper);

    setupFormFieldInteraction(wrapper, pageContainer);

    // Reset mode unless shift held? For now standard flow: one click = one item.
    // Ideally we might keep mode active for multiple placements.
    // For consistency with text mode, let's keep it active?
    // User often wants to place multiple checkboxes.
    // Let's keep state.modes.formField active.
}

function applyStylesToContent(contentElement) {
    const s = state.formSettings;
    // Base styles
    contentElement.style.fontFamily = s.fontFamily;
    contentElement.style.fontSize = `${s.fontSize}px`;
    contentElement.style.color = s.textColor;

    // Only apply bg/border if relevant to type? 
    // Handled in creation logic somewhat, strictly we should use settings.
    // For now we use the creation logic defaults for structure.
}

function updateWrapperMetadata(wrapper) {
    const s = state.formSettings;
    wrapper.dataset.fontFamily = s.fontFamily;
    wrapper.dataset.fontSize = s.fontSize;
    wrapper.dataset.textColor = s.textColor;
    wrapper.dataset.bgColor = s.backgroundColor;
    wrapper.dataset.bgAlpha = s.backgroundAlpha;
    wrapper.dataset.borderColor = s.borderColor;
    wrapper.dataset.borderWidth = s.borderWidth;
    wrapper.dataset.textAlign = s.textAlign;
}

/**
 * Interaction Logic (Reusing imageAnnotation helpers where possible)
 */
export function setupFormFieldInteraction(wrapper, container) {
    // Move
    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('.resize-handle') || e.target.closest('.rotate-handle')) return;

        e.stopPropagation();
        e.preventDefault();

        // Select
        document.querySelectorAll('.form-field-wrapper.selected').forEach(el => el.classList.remove('selected'));
        wrapper.classList.add('selected');

        // Sync settings to state from this wrapper?
        // Ideally yes, to show correct values in ribbon.
        // syncStateFromWrapper(wrapper); 

        startWrapperMove(e, wrapper);
    });

    // Resize
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dir = handle.dataset.dir;
            startWrapperResize(e, wrapper, dir);
        });
    });

    // Rotate
    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startWrapperRotation(e, wrapper);
        });
    }

    // Double click to edit properties?
    wrapper.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        // Open property modal? Or just focus?
        // For now, nothing special.
    });
}

// Global Setting Updates
export function updateFormSettings(key, value) {
    ensureFormSettings();
    state.formSettings[key] = value;

    // Update selected
    const selected = document.querySelector('.form-field-wrapper.selected');
    if (selected) {
        updateWrapperMetadata(selected);
        const content = selected.querySelector('.form-field-content');
        if (content) {
            if (key === 'fontFamily') content.style.fontFamily = value;
            if (key === 'fontSize') content.style.fontSize = `${value}px`;
            if (key === 'textColor') content.style.color = value;
            // bg/border updates might need specific handling per type
        }
    }
}

export function toggleFormMode(type) {
    // Reset other modes
    if (window.resetModes) window.resetModes();

    state.modes.formField = true;
    state.formFieldType = type;

    // Visual feedback handled by updateButtonStates in ui.js usually
    // We might need to ensure ui.js knows about this mode.
    document.body.style.cursor = 'crosshair';
}
