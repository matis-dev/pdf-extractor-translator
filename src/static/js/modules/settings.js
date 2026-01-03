const DEFAULT_SHORTCUTS = {
    'save': 'Ctrl+S',
    'undo': 'Ctrl+Z',
    'redo': 'Ctrl+Y',
    'copy': 'Ctrl+C',
    'paste': 'Ctrl+V',
    'delete': 'Delete',
    'commandPalette': 'Ctrl+K',
    'zoomIn': 'Ctrl++',
    'zoomOut': 'Ctrl+-',
    'toggleDarkMode': 'Ctrl+Shift+D'
};

const DEFAULT_SETTINGS = {
    general: {
        theme: 'light',
        compactMode: false
    },
    shortcuts: { ...DEFAULT_SHORTCUTS },

    pdf: {
        defaultAuthor: '',
        defaultCreator: 'PDF Editor',
        defaultProducer: 'PDF Editor v1.0'
    }
};
import { getCommands } from './command_palette.js';
import { captureKeybind, isValidCombo } from './hotkeyCapture.js';

let currentSettings = { ...DEFAULT_SETTINGS };

export function initSettings() {
    loadSettings();
    initSettingsModal();
}

export function getShortcut(actionId) {
    return currentSettings.shortcuts[actionId] || DEFAULT_SHORTCUTS[actionId];
}

export function setShortcut(actionId, combo) {
    currentSettings.shortcuts[actionId] = combo;
    saveSettings();
}

function loadSettings() {
    const stored = localStorage.getItem('pdf_editor_settings');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
            // Ensure nested objects are merged correctly if needed
            currentSettings.general = { ...DEFAULT_SETTINGS.general, ...parsed.general };
            currentSettings.shortcuts = { ...DEFAULT_SETTINGS.shortcuts, ...parsed.shortcuts };
            currentSettings.pdf = { ...DEFAULT_SETTINGS.pdf, ...parsed.pdf };
        } catch (e) {
            console.error('Failed to parse settings:', e);
        }
    }
    applySettings();
}

function saveSettings() {
    localStorage.setItem('pdf_editor_settings', JSON.stringify(currentSettings));
    applySettings();
    if (window.showToast) window.showToast('Settings saved successfully', 'success');
}

export function getSetting(path) {
    const value = path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, currentSettings);
    return value;
}

function initSettingsModal() {
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            // Collect values

            // Radio buttons
            const selected = document.querySelector('input[name="theme"]:checked');
            if (selected) currentSettings.general.theme = selected.value;

            // Compact
            const compact = document.getElementById('compact-mode');
            if (compact) currentSettings.general.compactMode = compact.checked;


            const pdfAuthor = document.getElementById('setting-pdf-author');
            const pdfCreator = document.getElementById('setting-pdf-creator');
            const pdfProducer = document.getElementById('setting-pdf-producer');

            if (pdfAuthor) currentSettings.pdf.defaultAuthor = pdfAuthor.value;
            if (pdfCreator) currentSettings.pdf.defaultCreator = pdfCreator.value;
            if (pdfProducer) currentSettings.pdf.defaultProducer = pdfProducer.value;

            saveSettings();

            const modalEl = document.getElementById('settingsModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        });
    }

    // Sync UI on open
    const modalEl = document.getElementById('settingsModal');
    if (modalEl) {
        modalEl.addEventListener('show.bs.modal', () => {
            // Set radio
            const rad = document.getElementById(`theme-${currentSettings.general.theme}`);
            if (rad) rad.checked = true;

            const compact = document.getElementById('compact-mode');
            if (compact) compact.checked = currentSettings.general.compactMode;

            const pdfAuthor = document.getElementById('setting-pdf-author');
            const pdfCreator = document.getElementById('setting-pdf-creator');
            const pdfProducer = document.getElementById('setting-pdf-producer');

            if (pdfAuthor) pdfAuthor.value = currentSettings.pdf.defaultAuthor || '';
            if (pdfCreator) pdfCreator.value = currentSettings.pdf.defaultCreator || '';
            if (pdfProducer) pdfProducer.value = currentSettings.pdf.defaultProducer || '';

            renderShortcutsList();
        });
    }

    // Shortcut Search
    const searchInput = document.getElementById('shortcut-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderShortcutsList(e.target.value);
        });
    }
}


function renderShortcutsList(filter = '') {
    const list = document.getElementById('shortcuts-list');
    if (!list) return;

    list.innerHTML = '';
    const commands = getCommands();
    const q = filter.toLowerCase();

    // Sort by name
    const sorted = [...commands].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(cmd => {
        if (!cmd.name.toLowerCase().includes(q)) return;

        const currentKey = getShortcut(cmd.id) || 'None';
        const isDefault = currentKey === DEFAULT_SHORTCUTS[cmd.id];

        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <div>
                <div class="fw-bold">${cmd.name}</div>
                <div class="text-muted small"><kbd>${currentKey}</kbd></div>
            </div>
            <div class="d-flex gap-2">
                ${!isDefault ? `<button class="btn btn-sm btn-outline-secondary reset-shortcut" data-id="${cmd.id}">Reset</button>` : ''}
                <button class="btn btn-sm btn-outline-primary change-shortcut" data-id="${cmd.id}">Change</button>
            </div>
        `;

        list.appendChild(item);
    });

    // Bind buttons
    list.querySelectorAll('.change-shortcut').forEach(btn => {
        btn.addEventListener('click', () => initiateCapture(btn.dataset.id));
    });

    list.querySelectorAll('.reset-shortcut').forEach(btn => {
        btn.addEventListener('click', () => {
            setShortcut(btn.dataset.id, DEFAULT_SHORTCUTS[btn.dataset.id]);
            renderShortcutsList(filter);
        });
    });
}

function initiateCapture(actionId) {
    const overlay = document.getElementById('shortcut-capture-overlay');
    const display = document.getElementById('captured-combo-display');
    const confirmBtn = document.getElementById('confirm-capture-btn');
    const cancelBtn = document.getElementById('cancel-capture-btn');
    const conflictMsg = document.getElementById('capture-conflict-msg');

    if (!overlay) return;

    overlay.classList.remove('d-none');
    overlay.classList.add('d-flex');
    display.innerText = 'Press keys...';
    confirmBtn.disabled = true;
    conflictMsg.innerText = '';

    let captured = null;

    // Capture
    captureKeybind(document.body).then(combo => {
        captured = combo;
        display.innerHTML = `<kbd>${combo}</kbd>`;

        if (!isValidCombo(combo)) {
            conflictMsg.innerText = "Invalid or reserved shortcut.";
            confirmBtn.disabled = true;
            // Retry? user can just press again.
            // Actually captureKeybind resolves once. We need a loop or re-call.
            // For simplicity, let's just say "Press keys..." again implies re-arm?
            // No, the promise resolves. We need to handle this UI flow better for re-try.
            // Let's rely on Cancel to retry for now, or just re-arm if invalid?
        } else {
            // Check Conflict
            const existingOwner = Object.keys(currentSettings.shortcuts).find(k => currentSettings.shortcuts[k] === combo && k !== actionId);
            if (existingOwner) {
                // Get friendly name
                const cmd = getCommands().find(c => c.id === existingOwner);
                const ownerName = cmd ? cmd.name : existingOwner;
                conflictMsg.innerText = `Conflict: Already used by "${ownerName}". Confirming will replace it.`;
            }
            confirmBtn.disabled = false;
        }
    });

    // We only capture ONCE with the current helper. 
    // To allow re-typing before confirm, we might need a persistent listener until confirm/cancel.
    // Let's simple-hack: if they typed wrong, they click cancel and try again. 

    const cleanup = () => {
        overlay.classList.add('d-none');
        overlay.classList.remove('d-flex');
        // Remove listeners if any (helper removes its own)
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    confirmBtn.onclick = () => {
        if (captured) {
            // Clear conflict if exists
            const existingOwner = Object.keys(currentSettings.shortcuts).find(k => currentSettings.shortcuts[k] === captured && k !== actionId);
            if (existingOwner) {
                setShortcut(existingOwner, null); // or just unassign
            }
            setShortcut(actionId, captured);
            renderShortcutsList();
            cleanup();
        }
    };

    cancelBtn.onclick = cleanup;
}

function applySettings() {
    // Apply Theme
    const theme = currentSettings.general.theme;
    if (theme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    } else if (theme === 'auto') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.setAttribute('data-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
        }
    } else {
        document.body.removeAttribute('data-theme');
    }

    // Apply Compact Mode
    if (currentSettings.general.compactMode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }
    // Also update the header button icon if necessary, but that's handled by main.js toggle usually.
    // We might need to sync the toggle state if it exists.
}
