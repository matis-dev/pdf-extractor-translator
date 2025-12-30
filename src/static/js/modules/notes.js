
import { state } from './state.js';
import { saveState } from './history.js';

let selectedNote = null;
let isDragging = false;
let isResizing = false;
let dragStartX, dragStartY;
let initialLeft, initialTop;
let initialWidth, initialHeight;

/**
 * Handles a click on the PDF page in 'Note' mode to create a new note.
 * @param {Event} e - Click event
 * @param {number} pageIndex - Index of the page clicked
 * @param {number} x - Relative X coordinate (0-1)
 * @param {number} y - Relative Y coordinate (0-1)
 * @param {HTMLElement} container - The page container element
 */
export async function handleNoteClick(e, pageIndex, x, y, container) {
    // Only create if we are NOT clicking on an existing note
    if (e.target.closest('.note-annotation')) return;

    // Create a new note
    const noteConfig = {
        pageIndex: pageIndex,
        x: x,       // Relative
        y: y,       // Relative
        width: 200, // Default pixels
        height: 150,// Default pixels
        text: '',
        color: state.noteSettings.color,
        textColor: state.noteSettings.textColor,
        fontSize: state.noteSettings.fontSize,
        collapsed: state.noteSettings.defaultCollapsed,
        id: 'note-' + Date.now()
    };

    createNoteElement(noteConfig, container);

    // Save state (new annotation)
    await saveState();
}

/**
 * Creates the DOM element for a note annotation.
 * @param {Object} config - Note configuration object
 * @param {HTMLElement} container - Container to append to
 */
export function createNoteElement(config, container) {
    const noteEl = document.createElement('div');
    noteEl.className = 'note-annotation';
    noteEl.id = config.id || 'note-' + Date.now();
    noteEl.dataset.pageIndex = config.pageIndex;

    // Force critical styles inline to ensure visibility
    noteEl.style.position = 'absolute';
    noteEl.style.zIndex = '1000';
    noteEl.style.display = 'flex';
    noteEl.style.flexDirection = 'column';
    noteEl.style.backgroundColor = config.color;
    noteEl.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    noteEl.style.borderRadius = '4px';

    // Apply color var for children
    noteEl.style.setProperty('--note-color', config.color);
    noteEl.style.setProperty('--note-text-color', config.textColor);

    // Position (Relative 0-1 to %)
    noteEl.style.left = (config.x * 100) + '%';
    noteEl.style.top = (config.y * 100) + '%';

    // Size
    noteEl.style.width = config.width + 'px';
    noteEl.style.height = config.height + 'px';

    const iconClass = 'bi-sticky-fill';

    noteEl.innerHTML = `
        <div class="note-icon" style="display:none;">
            <i class="bi ${iconClass}"></i>
        </div>
        
        <div class="note-header" style="height:28px; background:rgba(0,0,0,0.05); display:flex; align-items:center; justify-content:space-between; padding:0 8px; cursor:move;">
            <span class="note-title" style="font-size:11px; font-weight:600; opacity:0.5; user-select:none;">NOTE</span>
            <div class="note-actions" style="display:flex; gap:4px;">
                <button class="note-btn btn-collapse-note" title="Minimize" style="border:none; bg:transparent; cursor:pointer;">
                    <i class="bi bi-dash-lg"></i>
                </button>
                <button class="note-btn btn-close-note" title="Delete" style="border:none; bg:transparent; cursor:pointer;">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
        </div>
        
        <div class="note-content-wrapper" style="flex:1; display:flex; flex-direction:column; padding:8px; position:relative;">
            <textarea class="note-textarea" placeholder="Type a note..." style="width:100%; height:100%; border:none; background:transparent; resize:none; outline:none; font-family:sans-serif; font-size:${config.fontSize}px; color:${config.textColor};"></textarea>
            <div class="note-resize-handle" style="position:absolute; bottom:0; right:0; width:15px; height:15px; cursor:nwse-resize;"></div>
        </div>
    `;

    const textarea = noteEl.querySelector('textarea');
    textarea.value = config.text || '';

    // Bind Interactions
    setupNoteInteraction(noteEl, container);

    // Event Listeners
    textarea.addEventListener('change', () => {
        saveState(false);
    });

    container.appendChild(noteEl);

    if (!config.collapsed) {
        setTimeout(() => textarea.focus(), 50);
    }

    return noteEl;
}

/**
 * Sets up event listeners for move, resize, select, delete.
 */
function setupNoteInteraction(noteEl, container) {
    const resizeHandle = noteEl.querySelector('.note-resize-handle');
    const closeBtn = noteEl.querySelector('.btn-close-note');
    const collapseBtn = noteEl.querySelector('.btn-collapse-note');
    const textarea = noteEl.querySelector('textarea');

    // 1. Selection & Toggle Collapse from Icon
    noteEl.addEventListener('mousedown', (e) => {
        // If clicking resize handle or controls, don't trigger selection logic immediately override
        if (e.target.closest('.note-actions') || e.target.closest('.note-resize-handle')) return;

        // If collapsed, clicking anywhere expands it
        if (noteEl.classList.contains('collapsed')) {
            e.stopPropagation(); // Don't trigger page click
            selectNote(noteEl);
        } else {
            // Expanded
            if (e.target === textarea) {
                // Clicking text area, just focus.
                return;
            }
            e.stopPropagation();
            selectNote(noteEl);
        }
    });

    noteEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.note-actions') || e.target.closest('.note-resize-handle')) return;

        e.stopPropagation();
        toggleNoteCollapse(noteEl);
    });

    // 2. Drag to Move (Only via Header if expanded, or anywhere if collapsed)
    noteEl.addEventListener('mousedown', (e) => {
        const isCollapsed = noteEl.classList.contains('collapsed');
        const isHeader = e.target.closest('.note-header');

        if (!isCollapsed && !isHeader) return; // Expanded notes only draggable by header
        if (e.target.closest('.note-actions')) return; // Don't drag if clicking buttons

        // Start Drag
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = noteEl.offsetLeft;
        initialTop = noteEl.offsetTop;

        e.preventDefault(); // Prevent text selection
        e.stopPropagation();

        selectNote(noteEl);

        const onMouseMove = (ev) => {
            if (!isDragging) return;
            const dx = ev.clientX - dragStartX;
            const dy = ev.clientY - dragStartY;

            // Constrain to container
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            // Bounds check
            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + noteEl.offsetWidth > container.offsetWidth) newLeft = container.offsetWidth - noteEl.offsetWidth;
            if (newTop + noteEl.offsetHeight > container.offsetHeight) newTop = container.offsetHeight - noteEl.offsetHeight;

            noteEl.style.left = newLeft + 'px';
            noteEl.style.top = newTop + 'px';
        };

        const onMouseUp = async () => {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Re-normalize to %
            const pctX = noteEl.offsetLeft / container.offsetWidth;
            const pctY = noteEl.offsetTop / container.offsetHeight;

            noteEl.style.left = (pctX * 100) + '%';
            noteEl.style.top = (pctY * 100) + '%';

            await saveState(false);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // 3. Resize
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            initialWidth = noteEl.offsetWidth;
            initialHeight = noteEl.offsetHeight;

            const onMouseMove = (ev) => {
                if (!isResizing) return;
                const dx = ev.clientX - dragStartX;
                const dy = ev.clientY - dragStartY;

                let newW = initialWidth + dx;
                let newH = initialHeight + dy;

                if (newW < 100) newW = 100;
                if (newH < 80) newH = 80;

                noteEl.style.width = newW + 'px';
                noteEl.style.height = newH + 'px';
            };

            const onMouseUp = async () => {
                if (!isResizing) return;
                isResizing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                await saveState(false);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // 4. Buttons
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNote(noteEl);
    });

    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNoteCollapse(noteEl);
    });
}

export function selectNote(noteEl) {
    deselectAllNotes();
    selectedNote = noteEl;
    noteEl.classList.add('selected');
    noteEl.style.zIndex = '210'; // Bring to front
    // Visual feedback
    noteEl.style.outline = '2px solid #2196f3';
    noteEl.style.outlineOffset = '2px';
}

export function deselectAllNotes() {
    if (selectedNote) {
        selectedNote.classList.remove('selected');
        selectedNote.style.zIndex = '';
        selectedNote.style.outline = 'none'; // Remove visual feedback
        selectedNote = null;
    }
}

export function getSelectedNote() {
    return selectedNote;
}

export function deleteNote(noteEl) {
    if (!noteEl) return;
    noteEl.remove();
    if (selectedNote === noteEl) selectedNote = null;
    saveState(false);
}

export function deleteSelectedNote() {
    if (selectedNote) {
        deleteNote(selectedNote);
    }
}

export function toggleNoteCollapse(noteEl) {
    const isCollapsed = noteEl.classList.contains('collapsed');
    if (isCollapsed) {
        noteEl.classList.remove('collapsed');
        noteEl.classList.add('expanded');
    } else {
        noteEl.classList.remove('expanded');
        noteEl.classList.add('collapsed');
    }
    saveState(false);
}

// Ribbon Settings Updates
export function updateNoteSettings(key, value) {
    state.noteSettings[key] = value;

    // If a note is selected, update it immediately
    if (selectedNote) {
        if (key === 'color') {
            selectedNote.style.setProperty('--note-color', value);
        } else if (key === 'textColor') {
            selectedNote.style.setProperty('--note-text-color', value);
        } else if (key === 'fontSize') {
            const ta = selectedNote.querySelector('textarea');
            if (ta) ta.style.fontSize = value + 'px';
        }
        saveState(false);
    }
}

