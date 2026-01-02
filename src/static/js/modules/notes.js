
import { state } from './state.js';
import { recordAction, ActionType } from './history.js';

let selectedNote = null;
let isDragging = false;
let isResizing = false;
let dragStartX, dragStartY;
let initialLeft, initialTop;
let initialWidth, initialHeight;
let startState = null;

export function getNoteState(noteEl) {
    if (!noteEl) return null;
    const textarea = noteEl.querySelector('textarea');
    return {
        id: noteEl.id,
        pageIndex: parseInt(noteEl.dataset.pageIndex),
        x: parseFloat(noteEl.style.left) / 100, // stored as %
        y: parseFloat(noteEl.style.top) / 100,
        width: parseFloat(noteEl.style.width),
        height: parseFloat(noteEl.style.height),
        color: noteEl.style.getPropertyValue('--note-color').trim(),
        textColor: noteEl.style.getPropertyValue('--note-text-color').trim(),
        fontSize: parseInt(textarea ? textarea.style.fontSize : 12) || 12,
        text: textarea ? textarea.value : '',
        collapsed: noteEl.classList.contains('collapsed')
    };
}

export function restoreNote(data) {
    let noteEl = document.getElementById(data.id);

    // Create if missing
    if (!noteEl) {
        const pageContainer = document.querySelector(`.page-container[data-page-index="${data.pageIndex}"]`);
        if (!pageContainer) return;
        noteEl = createNoteElement(data, pageContainer);
    }

    // Update properties
    noteEl.style.left = (data.x * 100) + '%';
    noteEl.style.top = (data.y * 100) + '%';
    noteEl.style.width = data.width + 'px';
    noteEl.style.height = data.height + 'px';

    noteEl.style.setProperty('--note-color', data.color);
    noteEl.style.setProperty('--note-text-color', data.textColor);

    const textarea = noteEl.querySelector('textarea');
    if (textarea) {
        textarea.value = data.text;
        textarea.style.fontSize = data.fontSize + 'px';
        textarea.style.color = data.textColor;
    }

    if (data.collapsed) {
        noteEl.classList.add('collapsed');
        noteEl.classList.remove('expanded');
    } else {
        noteEl.classList.remove('collapsed');
    }

    // Ensure we re-setup interaction if we just created it? 
    // createNoteElement does it. If we updated existing, wrappers are there.
    return noteEl;
}

export async function handleNoteClick(e, pageIndex, x, y, container) {
    if (e.target.closest('.note-annotation')) return;

    const noteConfig = {
        pageIndex: pageIndex,
        x: x,
        y: y,
        width: 200,
        height: 150,
        text: '',
        color: state.noteSettings.color,
        textColor: state.noteSettings.textColor,
        fontSize: state.noteSettings.fontSize,
        collapsed: state.noteSettings.defaultCollapsed,
        id: 'note-' + Date.now()
    };

    const noteEl = createNoteElement(noteConfig, container);

    recordAction(ActionType.ADD, noteConfig, restoreNote);
}

export function createNoteElement(config, container) {
    const noteEl = document.createElement('div');
    noteEl.className = 'note-annotation';
    noteEl.id = config.id || 'note-' + Date.now();
    noteEl.dataset.pageIndex = config.pageIndex;

    noteEl.style.position = 'absolute';
    noteEl.style.zIndex = '1000';
    noteEl.style.display = 'flex';
    noteEl.style.flexDirection = 'column';
    noteEl.style.backgroundColor = config.color;
    noteEl.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    noteEl.style.borderRadius = '4px';

    noteEl.style.setProperty('--note-color', config.color);
    noteEl.style.setProperty('--note-text-color', config.textColor);

    // Initial position
    if (config.x <= 1) noteEl.style.left = (config.x * 100) + '%';
    else noteEl.style.left = config.x + 'px'; // Fallback for pixel values

    if (config.y <= 1) noteEl.style.top = (config.y * 100) + '%';
    else noteEl.style.top = config.y + 'px';

    noteEl.style.width = config.width + 'px';
    noteEl.style.height = config.height + 'px';

    const iconClass = 'bi-sticky-fill';

    noteEl.innerHTML = `
        <div class="note-header" style="height:28px; background:rgba(0,0,0,0.05); display:flex; align-items:center; justify-content:space-between; padding:0 8px; cursor:move;">
            <span class="note-title" style="font-size:11px; font-weight:600; opacity:0.5; user-select:none;">NOTE</span>
            <div class="note-actions" style="display:flex; gap:4px;">
                <button class="note-btn btn-collapse-note" title="Minimize" style="border:none; background:transparent; cursor:pointer;">
                    <i class="bi bi-dash-lg"></i>
                </button>
                <button class="note-btn btn-close-note" title="Delete" style="border:none; background:transparent; cursor:pointer;">
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

    setupNoteInteraction(noteEl, container);

    textarea.addEventListener('focus', () => {
        startState = getNoteState(noteEl);
    });

    textarea.addEventListener('change', () => {
        const newState = getNoteState(noteEl);
        if (startState && newState.text !== startState.text) {
            recordAction(ActionType.MODIFY, {
                id: noteEl.id,
                oldState: startState,
                newState: newState
            }, restoreNote); // Pass restoreNote
        }
    });

    container.appendChild(noteEl);

    if (config.collapsed) noteEl.classList.add('collapsed');

    if (!config.collapsed) {
        setTimeout(() => textarea.focus(), 50);
    }

    return noteEl;
}

function setupNoteInteraction(noteEl, container) {
    const resizeHandle = noteEl.querySelector('.note-resize-handle');
    const closeBtn = noteEl.querySelector('.btn-close-note');
    const collapseBtn = noteEl.querySelector('.btn-collapse-note');
    const textarea = noteEl.querySelector('textarea');

    // Selection
    noteEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('.note-actions') || e.target.closest('.note-resize-handle')) return;
        if (e.target === textarea && !noteEl.classList.contains('collapsed')) return;

        e.stopPropagation();
        selectNote(noteEl);
    });

    noteEl.addEventListener('dblclick', (e) => {
        if (e.target.closest('.note-actions') || e.target.closest('.note-resize-handle')) return;
        e.stopPropagation();
        toggleNoteCollapse(noteEl);
    });

    // Drag
    noteEl.addEventListener('mousedown', (e) => {
        const isCollapsed = noteEl.classList.contains('collapsed');
        const isHeader = e.target.closest('.note-header');
        if (!isCollapsed && !isHeader) return;
        if (e.target.closest('.note-actions')) return;

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialLeft = noteEl.offsetLeft;
        initialTop = noteEl.offsetTop;
        startState = getNoteState(noteEl);

        e.preventDefault();
        e.stopPropagation();
        selectNote(noteEl);

        const onMouseMove = (ev) => {
            if (!isDragging) return;
            const dx = ev.clientX - dragStartX;
            const dy = ev.clientY - dragStartY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;
            if (newLeft + noteEl.offsetWidth > container.offsetWidth) newLeft = container.offsetWidth - noteEl.offsetWidth;
            if (newTop + noteEl.offsetHeight > container.offsetHeight) newTop = container.offsetHeight - noteEl.offsetHeight;

            noteEl.style.left = newLeft + 'px';
            noteEl.style.top = newTop + 'px';
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const pctX = noteEl.offsetLeft / container.offsetWidth;
            const pctY = noteEl.offsetTop / container.offsetHeight;
            noteEl.style.left = (pctX * 100) + '%';
            noteEl.style.top = (pctY * 100) + '%';

            const newState = getNoteState(noteEl);
            if (startState && (newState.x !== startState.x || newState.y !== startState.y)) {
                recordAction(ActionType.MOVE, {
                    id: noteEl.id,
                    oldState: startState,
                    newState: newState
                }, restoreNote); // Pass restoreNote
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Resize
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isResizing = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            initialWidth = noteEl.offsetWidth;
            initialHeight = noteEl.offsetHeight;
            startState = getNoteState(noteEl);

            const onMouseMove = (ev) => {
                if (!isResizing) return;
                const dx = ev.clientX - dragStartX;
                const dy = ev.clientY - dragStartY;
                const newW = Math.max(100, initialWidth + dx);
                const newH = Math.max(80, initialHeight + dy);
                noteEl.style.width = newW + 'px';
                noteEl.style.height = newH + 'px';
            };

            const onMouseUp = () => {
                if (!isResizing) return;
                isResizing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                const newState = getNoteState(noteEl);
                if (startState && (newState.width !== startState.width || newState.height !== startState.height)) {
                    recordAction(ActionType.RESIZE, {
                        id: noteEl.id,
                        oldState: startState,
                        newState: newState
                    }, restoreNote); // Pass restoreNote
                }
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // Controls
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
    noteEl.style.zIndex = '210';
    noteEl.style.outline = '2px solid #2196f3';
    noteEl.style.outlineOffset = '2px';
}

export function deselectAllNotes() {
    if (selectedNote) {
        selectedNote.classList.remove('selected');
        selectedNote.style.zIndex = '';
        selectedNote.style.outline = 'none';
        selectedNote = null;
    }
}

export function getSelectedNote() {
    return selectedNote;
}

export function deleteNote(noteEl) {
    if (!noteEl) return;
    const currentState = getNoteState(noteEl);
    noteEl.remove();
    if (selectedNote === noteEl) selectedNote = null;

    recordAction(ActionType.DELETE, currentState, restoreNote); // Pass restoreNote
}

export function deleteSelectedNote() {
    if (selectedNote) deleteNote(selectedNote);
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
}

export function updateNoteSettings(key, value) {
    state.noteSettings[key] = value;
    if (selectedNote) {
        startState = getNoteState(selectedNote);
        if (key === 'color') {
            selectedNote.style.setProperty('--note-color', value);
        } else if (key === 'textColor') {
            selectedNote.style.setProperty('--note-text-color', value);
        } else if (key === 'fontSize') {
            const ta = selectedNote.querySelector('textarea');
            if (ta) ta.style.fontSize = value + 'px';
        }

        recordAction(ActionType.MODIFY, {
            id: selectedNote.id,
            oldState: startState,
            newState: getNoteState(selectedNote)
        }, restoreNote); // Pass restoreNote
    }
}
