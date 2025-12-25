
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


export function setShapeMode(mode) {
    if (state.modes.shape === mode) {
        state.modes.shape = null;
    } else {
        state.modes.shape = mode;
        // Turn off others
        state.modes.hand = false;
        state.modes.select = false;
        state.modes.zoomIn = false;
        state.modes.zoomOut = false;
        state.modes.text = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.extract = false;
    }
    updateButtonStates();
}

export function updateShapeSettings(key, value) {
    state.shapeSettings[key] = value;
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
    updateBtn('tool-select', state.modes.select);
    updateBtn('tool-hand', state.modes.hand);
    updateBtn('zoom-in', state.modes.zoomIn);
    updateBtn('zoom-out', state.modes.zoomOut);
    // extract mode might not have a ribbon button yet, skipping

    // Shape buttons
    updateBtn('shape-rect', state.modes.shape === 'rect');
    updateBtn('shape-ellipse', state.modes.shape === 'ellipse');
    updateBtn('shape-line', state.modes.shape === 'line');
    updateBtn('shape-arrow', state.modes.shape === 'arrow');
    updateBtn('note', state.modes.note);

    const container = document.getElementById('main-preview');
    if (container) container.style.cursor = ''; // Reset container cursor

    const anyMode = state.modes.redact || state.modes.highlight || state.modes.text || state.modes.shape || state.modes.note;
    document.body.style.cursor = anyMode ? 'crosshair' : 'default';
    if (state.modes.text) document.body.style.cursor = 'text';
    if (state.modes.note) document.body.style.cursor = 'copy';
    if (state.modes.select) document.body.style.cursor = 'default';
    if (state.modes.hand) {
        document.body.style.cursor = 'grab';
        if (container) container.style.cursor = 'grab';
    }
    if (state.modes.zoomIn) document.body.style.cursor = 'zoom-in';
    if (state.modes.zoomOut) document.body.style.cursor = 'zoom-out';
}

export function toggleZoomInMode() {
    state.modes.zoomIn = !state.modes.zoomIn;
    if (state.modes.zoomIn) {
        state.modes.zoomOut = false;
        state.modes.hand = false;
        state.modes.select = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.text = false;
        state.modes.extract = false;
        state.modes.note = false;
        state.modes.shape = null;
    }
    updateButtonStates();
}

export function toggleZoomOutMode() {
    state.modes.zoomOut = !state.modes.zoomOut;
    if (state.modes.zoomOut) {
        state.modes.zoomIn = false;
        state.modes.hand = false;
        state.modes.select = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.text = false;
        state.modes.extract = false;
        state.modes.note = false;
        state.modes.shape = null;
    }
    updateButtonStates();
}

export function toggleHandMode() {
    state.modes.hand = !state.modes.hand;
    if (state.modes.hand) {
        state.modes.zoomIn = false;
        state.modes.zoomOut = false;
        state.modes.select = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.text = false;
        state.modes.extract = false;
        state.modes.note = false;
        state.modes.shape = null;
    }
    updateButtonStates();
}

export function toggleSelectMode() {
    state.modes.select = !state.modes.select;
    if (state.modes.select) {
        state.modes.zoomIn = false;
        state.modes.zoomOut = false;
        state.modes.hand = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.text = false;
        state.modes.extract = false;
        state.modes.note = false;
        state.modes.shape = null;
    }
    updateButtonStates();
}

export function toggleRedactMode() {
    state.modes.redact = !state.modes.redact;
    state.modes.zoomIn = false;
    state.modes.zoomOut = false;
    state.modes.hand = false;
    state.modes.select = false;
    state.modes.text = false;
    state.modes.highlight = false;
    state.modes.extract = false;
    state.modes.note = false;
    state.modes.shape = null;
    updateButtonStates();
}

export function toggleHighlightMode() {
    state.modes.highlight = !state.modes.highlight;
    state.modes.zoomIn = false;
    state.modes.zoomOut = false;
    state.modes.hand = false;
    state.modes.select = false;
    state.modes.text = false;
    state.modes.redact = false;
    state.modes.extract = false;
    state.modes.note = false;
    state.modes.shape = null;
    updateButtonStates();
}

export function toggleExtractMode() {
    state.modes.extract = !state.modes.extract;
    state.modes.zoomIn = false;
    state.modes.zoomOut = false;
    state.modes.hand = false;
    state.modes.select = false;
    state.modes.text = false;
    state.modes.redact = false;
    state.modes.highlight = false;
    state.modes.note = false;
    state.modes.shape = null;
    updateButtonStates();
}

export function toggleTextMode() {
    state.modes.text = !state.modes.text;
    if (state.modes.text) {
        state.modes.zoomIn = false;
        state.modes.zoomOut = false;
        state.modes.hand = false;
        state.modes.select = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.extract = false;
        state.modes.note = false;
        state.modes.shape = null;
    }
    updateButtonStates();
}

export function toggleNoteMode() {
    state.modes.note = !state.modes.note;
    if (state.modes.note) {
        state.modes.zoomIn = false;
        state.modes.zoomOut = false;
        state.modes.hand = false;
        state.modes.select = false;
        state.modes.text = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.extract = false;
        state.modes.shape = null;
    }
    updateButtonStates();
}

export function resetModes() {
    state.modes.text = false;
    state.modes.zoomIn = false;
    state.modes.zoomOut = false;
    state.modes.hand = false;
    state.modes.select = false; // Or default to true? Usually 'select' is the default neutral state.
    state.modes.redact = false;
    state.modes.highlight = false;
    state.modes.extract = false;
    state.modes.note = false;
    state.modes.shape = null;

    // Set 'select' to true as default neutral state?
    // If we are uploading an image, we probably want to be in 'move/select' mode for the image.
    // The image handler in annotations.js sets 'selectImage(..., move)', so we should probably align with select mode.
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
