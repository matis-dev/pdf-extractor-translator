
import { state } from './state.js';

export function toggleDarkMode() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.innerHTML = '<i class="bi bi-moon"></i>';
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.innerHTML = '<i class="bi bi-sun"></i>';
    }
}

export function initTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.innerHTML = '<i class="bi bi-sun"></i>';
    }
}


export function disableAllModes() {
    state.modes.hand = false;
    state.modes.select = false;
    state.modes.zoomIn = false;
    state.modes.zoomOut = false;
    state.modes.text = false;
    state.modes.redact = false;
    state.modes.highlight = false;
    state.modes.extract = false;
    state.modes.formField = false;
    state.modes.note = false; // Ensure note is cleared
    state.modes.shape = null; // Ensure shape is cleared
    state.modes.crop = false;
}


export function setShapeMode(mode) {
    if (state.modes.shape === mode) {
        // Toggle off
        disableAllModes();
        state.modes.select = true; // Revert to select
    } else {
        disableAllModes();
        state.modes.shape = mode;
    }
    updateButtonStates();
}

export function updateShapeSettings(key, value) {
    state.shapeSettings[key] = value;
}

export function updateHighlightSettings(key, value) {
    state.highlightSettings[key] = value;
}

export function updateButtonStates() {
    const updateBtn = (id, isActive) => {
        const btn = document.getElementById(id);
        if (btn) {
            if (isActive) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    };

    updateBtn('redact', state.modes.redact);
    updateBtn('highlight', state.modes.highlight);
    updateBtn('add-text', state.modes.text);
    updateBtn('tool-select', state.modes.select);
    updateBtn('tool-hand', state.modes.hand);
    updateBtn('zoom-in', state.modes.zoomIn);
    updateBtn('zoom-out', state.modes.zoomOut);
    updateBtn('crop-tool', state.modes.crop);


    // Shape buttons
    updateBtn('shape-rect', state.modes.shape === 'rect');
    updateBtn('shape-ellipse', state.modes.shape === 'ellipse');
    updateBtn('shape-line', state.modes.shape === 'line');
    updateBtn('shape-arrow', state.modes.shape === 'arrow');
    updateBtn('note', state.modes.note);

    // Form buttons
    updateBtn('field-text', state.modes.formField && state.formFieldType === 'textfield');
    updateBtn('field-check', state.modes.formField && state.formFieldType === 'checkbox');
    updateBtn('field-radio', state.modes.formField && state.formFieldType === 'radio');
    updateBtn('field-dropdown', state.modes.formField && state.formFieldType === 'dropdown');
    updateBtn('field-signature', state.modes.formField && state.formFieldType === 'signature');

    const container = document.getElementById('main-preview');
    if (container) container.style.cursor = ''; // Reset container cursor

    // Prioritize cursors based on active mode
    if (state.modes.text) document.body.style.cursor = 'text';
    else if (state.modes.note) document.body.style.cursor = 'copy';
    else if (state.modes.hand) {
        document.body.style.cursor = 'grab';
        if (container) container.style.cursor = 'grab';
    }
    else if (state.modes.zoomIn) document.body.style.cursor = 'zoom-in';
    else if (state.modes.zoomOut) document.body.style.cursor = 'zoom-out';
    else if (state.modes.select) document.body.style.cursor = 'default';
    else {
        // Default cursor for drawing/creation tools
        const anyMode = state.modes.redact || state.modes.highlight || state.modes.shape || state.modes.formField;
        document.body.style.cursor = anyMode ? 'crosshair' : 'default';
    }
}

export function toggleZoomInMode() {
    const wasActive = state.modes.zoomIn;
    disableAllModes();
    if (!wasActive) state.modes.zoomIn = true;
    else state.modes.select = true;
    updateButtonStates();
}

export function toggleZoomOutMode() {
    const wasActive = state.modes.zoomOut;
    disableAllModes();
    if (!wasActive) state.modes.zoomOut = true;
    else state.modes.select = true;
    updateButtonStates();
}

export function toggleHandMode() {
    const wasActive = state.modes.hand;
    disableAllModes();
    if (!wasActive) state.modes.hand = true;
    // If turning off hand, default to select? Or just nothing? 
    // Usually toggleSelectMode is the alternative.
    // Let's default to select if Hand is turned off.
    else state.modes.select = true;
    updateButtonStates();
}

export function toggleSelectMode() {
    const wasActive = state.modes.select;
    disableAllModes();
    // If it was active, maybe we toggle it off? But Select is often default.
    // Let's say if we toggle Select, we ensure it's on. 
    // If it was already on, do we turn it off? Usually buttons in ribbon act as radio for tools.
    // But 'toggle' implies on/off.
    // However, if we click 'Select' tool, we want to BE in select mode.
    // If we click it again, staying in select mode is fine.
    // But typically tool buttons are radio buttons.
    // Let's enforce ON if called.
    if (!wasActive) state.modes.select = true;
    else state.modes.select = true; // Keep it on? Or toggle? 
    // If I click Select while in Select, nothing changes.
    updateButtonStates();
}

export function toggleRedactMode() {
    const wasActive = state.modes.redact;
    disableAllModes();
    if (!wasActive) state.modes.redact = true;
    else state.modes.select = true;
    updateButtonStates();
}

export function toggleHighlightMode() {
    const wasActive = state.modes.highlight;
    disableAllModes();
    if (!wasActive) state.modes.highlight = true;
    else state.modes.select = true;
    updateButtonStates();
}

export function toggleExtractMode() {
    const wasActive = state.modes.extract;
    disableAllModes();
    if (!wasActive) state.modes.extract = true;
    else state.modes.select = true;
    updateButtonStates();
}

export function toggleTextMode() {
    const wasActive = state.modes.text;
    disableAllModes();
    if (!wasActive) state.modes.text = true;
    else state.modes.select = true;
    updateButtonStates();
}

export function toggleNoteMode() {
    const wasActive = state.modes.note;
    disableAllModes();
    if (!wasActive) state.modes.note = true;
    else state.modes.select = true;
    updateButtonStates();
}

export function resetModes() {
    disableAllModes();
    state.modes.select = true;
    updateButtonStates();
}

export function closeModal() {
    const el = document.getElementById('extraction-modal');
    const modal = bootstrap.Modal.getInstance(el);
    if (modal) modal.hide();
}

export function closePageExtractionModal() {
    const el = document.getElementById('page-extraction-modal');
    const modal = bootstrap.Modal.getInstance(el);
    if (modal) modal.hide();
}

export function updateHistoryButtons(undoStack, redoStack) {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

export function updateUnsavedIndicator(hasChanges) {
    const titleEl = document.querySelector('.file-name');
    if (!titleEl) return;

    let text = titleEl.innerText;
    if (hasChanges && !text.endsWith('*')) {
        titleEl.innerText = text + '*';
    } else if (!hasChanges && text.endsWith('*')) {
        titleEl.innerText = text.slice(0, -1);
    }
}

// Password & Security Modals
let passwordResolve = null;
let passwordReject = null;

export function requestPassword(errorMessage) {
    return new Promise((resolve, reject) => {
        const modalEl = document.getElementById('password-prompt-modal');
        const errorDiv = document.getElementById('password-error');
        const input = document.getElementById('pdf-open-password');

        input.value = '';
        if (errorMessage) {
            errorDiv.innerText = errorMessage;
            errorDiv.style.display = 'block';
        } else {
            errorDiv.style.display = 'none';
        }

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Focus input after modal is shown
        modalEl.addEventListener('shown.bs.modal', () => {
            input.focus();
        }, { once: true });

        passwordResolve = resolve;
        passwordReject = reject;
    });
}

export function submitPassword() {
    const input = document.getElementById('pdf-open-password');
    const password = input.value;
    if (passwordResolve) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('password-prompt-modal'));
        if (modal) modal.hide();

        passwordResolve(password);
        passwordResolve = null;
        passwordReject = null;
    }
}

export function cancelPassword() {
    if (passwordReject) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('password-prompt-modal'));
        if (modal) modal.hide();

        passwordReject(new Error("Password cancelled"));
        passwordResolve = null;
        passwordReject = null;
    }
}

// Security Settings Modal
export function openSecurityModal() {
    new bootstrap.Modal(document.getElementById('security-modal')).show();
    document.getElementById('new-pdf-password').value = '';
    document.getElementById('confirm-pdf-password').value = '';
}

export function closeSecurityModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('security-modal'));
    if (modal) modal.hide();
}

export function saveSecuritySettings() {
    const newPass = document.getElementById('new-pdf-password').value;
    const confirmPass = document.getElementById('confirm-pdf-password').value;

    if (newPass !== confirmPass) {
        alert("Passwords do not match!");
        return;
    }

    // Dispatch custom event to be handled by viewer/main
    const event = new CustomEvent('security-update', { detail: { password: newPass } });
    document.dispatchEvent(event);

    closeSecurityModal();
}

export function updateActiveThumbnail() {
    document.querySelectorAll('.thumbnail-item').forEach((el, i) => {
        if (i === state.selectedPageIndex) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        } else {
            el.classList.remove('active');
        }
    });

    // Also highlight page container
    document.querySelectorAll('.page-container').forEach((el, i) => {
        el.style.outline = i === state.selectedPageIndex ? '3px solid #007bff' : 'none';
    });
}
