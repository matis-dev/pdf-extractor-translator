
const RESERVED_SHORTCUTS = [
    'Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+Tab',
    'Ctrl+Shift+T', 'Ctrl+Shift+N', 'Alt+F4',
    'F1', 'F5', 'F11', 'F12'
];

export function buildComboString(e) {
    if (e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta') return null;

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let key = e.key;

    // Normalize keys
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === 'ArrowUp') key = 'Up';
    else if (key === 'ArrowDown') key = 'Down';
    else if (key === 'ArrowLeft') key = 'Left';
    else if (key === 'ArrowRight') key = 'Right';
    else if (key === 'Escape') key = 'Esc';

    parts.push(key);
    return parts.join('+');
}

export function isValidCombo(combo) {
    if (!combo) return false;
    if (RESERVED_SHORTCUTS.includes(combo)) return false;
    return true;
}

export function captureKeybind(element) {
    return new Promise((resolve) => {
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();

            const combo = buildComboString(e);
            if (combo) {
                element.removeEventListener('keydown', handler);
                resolve(combo);
            }
        };

        element.addEventListener('keydown', handler);
    });
}
