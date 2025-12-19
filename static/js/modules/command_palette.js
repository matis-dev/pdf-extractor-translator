
const commands = [];
let paletteModal = null;
let searchInput = null;
let resultsContainer = null;
let selectedIndex = 0;

export function initCommandPalette() {
    // Inject Modal HTML if not present (or we can assume it's in editor.html)
    // Let's assume we'll add it to editor.html for cleaner separation, 
    // but verifying it exists is good.

    const modalEl = document.getElementById('command-palette-modal');
    if (!modalEl) {
        console.error("Command Palette modal not found in DOM");
        return;
    }

    paletteModal = new bootstrap.Modal(modalEl);
    searchInput = document.getElementById('cmd-search');
    resultsContainer = document.getElementById('cmd-results');

    // Global Shortcut
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openPalette();
        }
    });

    // Input handling
    searchInput.addEventListener('input', () => {
        renderResults(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
        const items = resultsContainer.querySelectorAll('.cmd-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelection(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (items.length > 0) {
                const cmdId = items[selectedIndex].dataset.id;
                executeCommand(cmdId);
            }
        }
    });

    // Reset selection on open
    modalEl.addEventListener('shown.bs.modal', () => {
        searchInput.value = '';
        searchInput.focus();
        renderResults('');
    });
}

export function registerCommand(id, name, action, icon = 'bi-gear') {
    commands.push({ id, name, action, icon });
}

function openPalette() {
    paletteModal.show();
}

function closePalette() {
    paletteModal.hide();
}

function renderResults(query) {
    resultsContainer.innerHTML = '';
    const q = query.toLowerCase();

    // Filter
    const matches = commands.filter(c => c.name.toLowerCase().includes(q));

    // Check if empty
    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="p-3 text-muted text-center">No commands found</div>';
        return;
    }

    matches.forEach((cmd, index) => {
        const div = document.createElement('div');
        div.className = 'cmd-item list-group-item list-group-item-action d-flex align-items-center gap-2';
        div.dataset.id = cmd.id;
        div.innerHTML = `<i class="bi ${cmd.icon}"></i> <span>${cmd.name}</span>`;
        div.onclick = () => executeCommand(cmd.id);

        if (index === 0) {
            div.classList.add('active');
            selectedIndex = 0;
        }

        resultsContainer.appendChild(div);
    });
}

function updateSelection(items) {
    items.forEach((item, index) => {
        if (index === selectedIndex) item.classList.add('active');
        else item.classList.remove('active');
    });
    // Ensure visible
    if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
}

function executeCommand(id) {
    const cmd = commands.find(c => c.id === id);
    if (cmd) {
        closePalette();
        cmd.action();
    }
}
