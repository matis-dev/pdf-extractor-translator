
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
    const redactBtn = document.getElementById('redact');
    const highlightBtn = document.getElementById('highlight');
    const extractBtn = document.getElementById('extract'); // Ribbon doesn't have extract button? 'start-process' is there. Wait.
    // 'extract' mode button? In Ribbon 'process' tab, there is 'start-process' (Run).
    // There is no 'extract' mode button in Ribbon config I saw.
    // Check Config:
    // 'edit': add-text, add-image. 'Forms'.
    // 'comment': highlight, note. Shapes.
    // 'protect': redact.
    // There is NO 'extract' tool in Ribbon config for Area Extraction?
    // User requested "Enhance Text Annotation". Extraction was previous.
    // If 'extract' button missing, getting it returns null, safe.

    // I will fix the ones that exist: redact, highlight, add-text.
    const textBtn = document.getElementById('add-text');

    // Shape buttons
    const shapeBtns = {
        rect: document.getElementById('shape-rect'),
        ellipse: document.getElementById('shape-ellipse'),
        line: document.getElementById('shape-line'),
        arrow: document.getElementById('shape-arrow')
    };

    if (redactBtn) redactBtn.className = state.modes.redact ? 'btn btn-danger' : 'btn btn-outline-danger';
    if (highlightBtn) highlightBtn.className = state.modes.highlight ? 'btn btn-warning' : 'btn btn-outline-warning';
    if (extractBtn) extractBtn.className = state.modes.extract ? 'btn btn-info' : 'btn btn-outline-info';
    if (textBtn) textBtn.className = state.modes.text ? 'btn btn-primary' : 'btn btn-outline-primary';

    // Update shape buttons
    for (const [key, btn] of Object.entries(shapeBtns)) {
        if (btn) btn.className = state.modes.shape === key ? 'btn btn-secondary' : 'btn btn-outline-secondary';
    }

    const anyMode = state.modes.redact || state.modes.highlight || state.modes.text || state.modes.extract || state.modes.shape;
    document.body.style.cursor = anyMode ? 'crosshair' : 'default';
    if (state.modes.text) document.body.style.cursor = 'text';
    if (state.modes.note) document.body.style.cursor = 'copy';
}

export function toggleRedactMode() {
    state.modes.redact = !state.modes.redact;
    state.modes.text = false;
    state.modes.highlight = false;
    state.modes.extract = false;
    state.modes.note = false;
    state.modes.shape = null;
    updateButtonStates();
}

export function toggleHighlightMode() {
    state.modes.highlight = !state.modes.highlight;
    state.modes.text = false;
    state.modes.redact = false;
    state.modes.extract = false;
    state.modes.note = false;
    state.modes.shape = null;
    updateButtonStates();
}

export function toggleExtractMode() {
    state.modes.extract = !state.modes.extract;
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
        state.modes.text = false;
        state.modes.redact = false;
        state.modes.highlight = false;
        state.modes.extract = false;
        state.modes.shape = null;
    }
    updateButtonStates();
}

export function closeModal() {
    const modal = document.getElementById('extraction-modal');
    if (modal) modal.style.display = 'none';
}

export function closePageExtractionModal() {
    const modal = document.getElementById('page-extraction-modal');
    if (modal) modal.style.display = 'none';
}

export function updateHistoryButtons(undoStack, redoStack) {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

// Password & Security Modals
let passwordResolve = null;
let passwordReject = null;

export function requestPassword(errorMessage) {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('password-prompt-modal');
        const errorDiv = document.getElementById('password-error');
        const input = document.getElementById('pdf-open-password');

        input.value = '';
        if (errorMessage) {
            errorDiv.innerText = errorMessage;
            errorDiv.style.display = 'block';
        } else {
            errorDiv.style.display = 'none';
        }

        modal.style.display = 'block';
        input.focus();

        passwordResolve = resolve;
        passwordReject = reject;
    });
}

export function submitPassword() {
    const input = document.getElementById('pdf-open-password');
    const password = input.value;
    if (passwordResolve) {
        document.getElementById('password-prompt-modal').style.display = 'none';
        passwordResolve(password);
        passwordResolve = null;
        passwordReject = null;
    }
}

export function cancelPassword() {
    if (passwordReject) {
        document.getElementById('password-prompt-modal').style.display = 'none';
        passwordReject(new Error("Password cancelled"));
        passwordResolve = null;
        passwordReject = null;
    }
}

// Security Settings Modal
export function openSecurityModal() {
    document.getElementById('security-modal').style.display = 'block';
    document.getElementById('new-pdf-password').value = '';
    document.getElementById('confirm-pdf-password').value = '';
}

export function closeSecurityModal() {
    document.getElementById('security-modal').style.display = 'none';
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
