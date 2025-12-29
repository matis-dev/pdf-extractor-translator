
import { state } from './state.js';
import { saveState } from './history.js';

let selectedHighlight = null;
let lastClickTime = 0;
let lastClickTarget = null;

export function initHighlightInteraction(container) {
    container.addEventListener('mousedown', (e) => {
        // Check if we clicked a highlight
        // The event target might be the path inside the SVG
        const path = e.target.closest('path');
        const svg = e.target.closest('.highlight-annotation');

        if (state.modes.highlight) {
            // Special handling for Double Click in Highlight Mode
            if (svg && path) {
                const now = Date.now();
                if (lastClickTarget === svg && (now - lastClickTime < 300)) {
                    // Double Click detected!
                    e.stopPropagation();
                    e.preventDefault();
                    selectHighlight(svg);
                    startHighlightDrag(e, svg, container, true); // Force drag
                    lastClickTime = 0;
                    return;
                }
                lastClickTime = now;
                lastClickTarget = svg;
                return; // Normal drawing behavior (blocked by drawing.js usually) or nothing
            }

        }

        // If we are in Select or Hand mode (or maybe just Select?), we can select highlights.
        // The user requirement says "I should be able to select them and to move them around and remove them when selected".
        // Usually selection happens in 'Select' mode.

        if (svg && path) {
            e.stopPropagation(); // Prevent starting a selection box or other tool
            selectHighlight(svg);
            startHighlightDrag(e, svg, container);
        } else {
            // Clicked empty space or something else -> deselect
            // Even in highlight mode, clicking empty space (starting to draw) should deselect.

            // If we are not clicking another annotation type...
            if (!e.target.closest('.text-annotation') && !e.target.closest('.image-annotation') && !e.target.closest('.form-field-wrapper')) {
                deselectAllHighlights();
            }
        }
    });

    // Global KeyDown for Deletion (handled in main usually, but we can check here or export a handler)
    // We'll rely on global keydown listener calling deleteSelectedHighlight()
}

export function selectHighlight(svg) {
    deselectAllHighlights();
    selectedHighlight = svg;
    svg.classList.add('selected');

    // Optional: Bring to front?
    svg.style.zIndex = '100';
}

export function deselectAllHighlights() {
    if (selectedHighlight) {
        selectedHighlight.classList.remove('selected');
        selectedHighlight.style.zIndex = '5'; // Reset Z-index
        selectedHighlight = null;
    }
}

export function deleteSelectedHighlight() {
    if (selectedHighlight) {
        selectedHighlight.remove();
        saveState(false); // Save after deleting (commits others)
        selectedHighlight = null;
    }
}

// Drag Logic
let isDragging = false;
let dragStartX, dragStartY;
let originalPathD = '';

function startHighlightDrag(e, svg, container, force = false) {
    if (!state.modes.select && !force) return; // Only move in select mode or if forced
    // User said "move them around", implying drag.

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const path = svg.querySelector('path');
    originalPathD = path.getAttribute('d');

    const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - dragStartX;
        const dy = ev.clientY - dragStartY;

        // We need to translate the path points.
        // SVGs created in drawing.js are "width=100% height=100% absolute top=0 left=0".
        // The path d attribute has absolute coordinates.
        // To move, we can transform the path commands.
        // Parsing 'd' string: "M x y L x y ..."

        // Optimize: Maybe just use CSS transform on the SVG element if it's full page?
        // No, SVG is full page. If we translate the SVG, we move the viewbox? 
        // Wait, the SVG IS full page. If we use CSS transform translate, it moves the whole full-page SVG layer.
        // This works if the specific highlight has its own SVG container that is NOT full width/height but bounded.
        // But currently `drawing.js` creates a full-width SVG for EACH highlight (absolute 0,0).
        // This is inefficient but makes coordinate mapping easy.

        // If we translate the SVG element using CSS:
        // svg.style.transform = `translate(${ dx }px, ${ dy }px)`;
        // This is fast. But we need to commit the change to the 'd' attribute on mouseup, OR keep the transform.
        // If we keep the transform, `commitAnnotations.js` needs to be aware of it.
        // `commitAnnotations` does NOT check for SVG transform currently. It parses 'd'.

        // Alternative: Re-calculate 'd' on every move (expensive?) or just on mouseup?
        // For visual feedback, CSS transform is best.

        svg.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const onMouseUp = async () => {
        if (!isDragging) return;
        isDragging = false;

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Apply transform to 'd' attribute effectively or handle it in commit
        // Let's bake it into 'd' so commitAnnotations works without change (mostly).

        const transform = svg.style.transform; // "translate(10px, 20px)"
        const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        if (match) {
            const dx = parseFloat(match[1]);
            const dy = parseFloat(match[2]);

            // Re-write d
            if (originalPathD) {
                const commands = originalPathD.trim().split(/\s+/);
                let newCommands = [];
                for (let i = 0; i < commands.length; i++) {
                    const token = commands[i];
                    if (token === 'M' || token === 'L') {
                        newCommands.push(token);
                        const x = parseFloat(commands[i + 1]);
                        const y = parseFloat(commands[i + 2]);
                        newCommands.push(x + dx);
                        newCommands.push(y + dy);
                        i += 2;
                    } else {
                        newCommands.push(token);
                    }
                }
                path.setAttribute('d', newCommands.join(' '));
            }
        }

        // Reset transform
        svg.style.transform = 'none';

        // Save state after move
        await saveState(false); // Is this too heavy on every move? Maybe.
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// Global Listener for Delete
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = document.activeElement;
        const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

        if (!isInput) {
            deleteSelectedHighlight();
        }
    }
});
