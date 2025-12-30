
import { state } from './state.js';
import { saveState } from './history.js';
import { startWrapperMove, startWrapperResize, startWrapperRotation } from './imageAnnotations.js';

/**
 * Shape Wrapper Implementation
 * Mirrors text-wrapper/image-wrapper logic but for SVGs
 */

export function createShapeWrapper(svgElement, container) {
    // 1. Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'shape-wrapper selected'; // Start selected
    wrapper.id = `shape-annot-${Date.now()}`;

    // Position/Size
    // Initial SVG is usually 0,0 relative to container with width/height 100%
    // but the internal shape (rect/ellipse) has specific coords.
    // We need to extract the "bounding box" of the shape to size the wrapper correctly
    // and then re-position the SVG inside the wrapper relative to 0,0.

    // BUT `drawing.js` creates a full-page SVG overlay for the shape.
    // We want the wrapper to bound the shape exactly.

    const type = svgElement.dataset.type;
    let x, y, w, h;
    let strokeWidth = parseInt(svgElement.dataset.strokeWidth || 2);

    // Extract bbox from internal shape
    const shape = svgElement.querySelector('rect, ellipse, line, g');
    // Note: arrow is a 'g' containing line + path

    if (type === 'rect') {
        x = parseFloat(shape.getAttribute('x'));
        y = parseFloat(shape.getAttribute('y'));
        w = parseFloat(shape.getAttribute('width'));
        h = parseFloat(shape.getAttribute('height'));
    } else if (type === 'ellipse') {
        const cx = parseFloat(shape.getAttribute('cx'));
        const cy = parseFloat(shape.getAttribute('cy'));
        const rx = parseFloat(shape.getAttribute('rx'));
        const ry = parseFloat(shape.getAttribute('ry'));
        x = cx - rx;
        y = cy - ry;
        w = rx * 2;
        h = ry * 2;
    } else if (type === 'line' || type === 'arrow') {
        const line = (type === 'arrow') ? shape.querySelector('line') : shape;
        const x1 = parseFloat(line.getAttribute('x1'));
        const y1 = parseFloat(line.getAttribute('y1'));
        const x2 = parseFloat(line.getAttribute('x2'));
        const y2 = parseFloat(line.getAttribute('y2'));
        x = Math.min(x1, x2);
        y = Math.min(y1, y2);
        w = Math.abs(x2 - x1);
        h = Math.abs(y2 - y1);

        // Ensure non-zero size for clickability
        if (w < 10) w = 10;
        if (h < 10) h = 10;
    }

    // Apply geometry to wrapper
    Object.assign(wrapper.style, {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: '50' // Below text (100) but above basics
    });

    // Re-create SVG inside wrapper
    // We need a new small SVG that fits the wrapper
    const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(newSvg.style, {
        width: '100%',
        height: '100%',
        overflow: 'visible'
    });
    newSvg.classList.add('shape-content');

    // Clone the shape/g and adjust coordinates to be relative to wrapper (0,0)
    const newShape = shape.cloneNode(true);

    if (type === 'rect') {
        newShape.setAttribute('x', 0);
        newShape.setAttribute('y', 0);
        newShape.setAttribute('width', '100%');
        newShape.setAttribute('height', '100%');
        // Keep vector-effect if we want stroke to not scale? 
        // Usually better to let it scale or re-stroke.
        newShape.setAttribute('vector-effect', 'non-scaling-stroke');
    } else if (type === 'ellipse') {
        newShape.setAttribute('cx', '50%');
        newShape.setAttribute('cy', '50%');
        newShape.setAttribute('rx', '50%');
        newShape.setAttribute('ry', '50%');
        newShape.setAttribute('vector-effect', 'non-scaling-stroke');
    } else if (type === 'line') {
        // Line coords are tricky when resizing.
        // Best approach: Use percentage? Or viewBox?
        // Simpler: Just map generic 0,0 to w,h line for now, 
        // but line direction matters (TL-BR vs TR-BL).
        // Check original slope
        const line = shape; // it is the line element
        const x1 = parseFloat(line.getAttribute('x1'));
        const y1 = parseFloat(line.getAttribute('y1'));
        const x2 = parseFloat(line.getAttribute('x2'));
        const y2 = parseFloat(line.getAttribute('y2'));

        let nx1 = 0, ny1 = 0, nx2 = '100%', ny2 = '100%';

        // Determine slope direction relative to bbox (x,y)
        if ((x1 <= x2 && y1 >= y2) || (x1 >= x2 && y1 <= y2)) {
            // Rising slope (BL to TR or TR to BL)
            nx1 = 0; ny1 = '100%'; nx2 = '100%'; ny2 = 0;
        } else {
            // Falling slope (TL to BR)
            nx1 = 0; ny1 = 0; nx2 = '100%'; ny2 = '100%';
        }

        newShape.setAttribute('x1', nx1);
        newShape.setAttribute('y1', ny1);
        newShape.setAttribute('x2', nx2);
        newShape.setAttribute('y2', ny2);
        newShape.setAttribute('vector-effect', 'non-scaling-stroke');
    } else if (type === 'arrow') {
        // Similar to line but group
        // Just recreate arrow based on wrapper size?
        // It's complex to scale 'g' with fixed head size.
        // For MVP: Re-render arrow on resize.
        // For now, let's just clone and hope.
        // We'll need a specific renderer for arrow update.
        newShape.setAttribute('transform', `translate(${-x}, ${-y})`);
        // This translation is static! If we resize wrapper, this breaks.
        // A better way for arrow:
        // Don't use SVG scaling? Or use percentage lines?
        // Let's rely on standard resize logic to update SVG attributes later.
    }

    newSvg.appendChild(newShape);
    wrapper.appendChild(newSvg);

    // Add Controls (Handles)
    wrapper.innerHTML += `
        <div class="resize-handle handle-nw" data-dir="nw"></div>
        <div class="resize-handle handle-n" data-dir="n"></div>
        <div class="resize-handle handle-ne" data-dir="ne"></div>
        <div class="resize-handle handle-e" data-dir="e"></div>
        <div class="resize-handle handle-se" data-dir="se"></div>
        <div class="resize-handle handle-s" data-dir="s"></div>
        <div class="resize-handle handle-sw" data-dir="sw"></div>
        <div class="resize-handle handle-w" data-dir="w"></div>
        <div class="rotate-handle"><i class="bi bi-arrow-repeat"></i></div>
        <div class="delete-handle" title="Delete Shape"><i class="bi bi-x-lg"></i></div>
    `;

    // Metadata
    wrapper.dataset.type = type;
    wrapper.dataset.strokeColor = svgElement.dataset.stroke;
    wrapper.dataset.strokeWidth = strokeWidth;

    container.appendChild(wrapper);
    svgElement.remove(); // Remove old temp SVG

    setupShapeWrapperInteraction(wrapper, container);
    selectShapeWrapper(wrapper);

    return wrapper;
}


export function setupShapeWrapperInteraction(wrapper, container) {
    // 1. Move Logic
    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('.resize-handle') ||
            e.target.closest('.rotate-handle') ||
            e.target.closest('.delete-handle')) return;

        e.stopPropagation();
        e.preventDefault();

        // Select
        selectShapeWrapper(wrapper);

        startWrapperMove(e, wrapper);
    });

    // 2. Resize Handles
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dir = handle.dataset.dir;
            startWrapperResize(e, wrapper, dir);
        });
    });

    // 3. Rotation
    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startWrapperRotation(e, wrapper);
        });
    }

    // 4. Delete
    const delHandle = wrapper.querySelector('.delete-handle');
    if (delHandle) {
        delHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteShapeWrapper(wrapper);
        });
        delHandle.addEventListener('mousedown', (e) => e.stopPropagation()); // Prevent drag start
    }
}

export function selectShapeWrapper(wrapper) {
    deselectAllShapes();
    wrapper.classList.add('selected');

    // Update Ribbon UI to match this shape's settings
    const strokeColor = wrapper.dataset.strokeColor;
    const strokeWidth = wrapper.dataset.strokeWidth;

    // We need to find the inputs in ribbon.js. 
    // They usually have IDs or we can call a ribbon update function if exists.
    // For now, let's just update `state.shapeSettings` so next shape uses same.
    if (strokeColor) state.shapeSettings.strokeColor = strokeColor;
    if (strokeWidth) state.shapeSettings.strokeWidth = parseInt(strokeWidth);

    // Update UI inputs if possible (Ribbon might not be listening to state changes directly)
    const colorInput = document.querySelector('#shape-stroke-color');
    const widthInput = document.querySelector('#shape-stroke-width');
    if (colorInput) colorInput.value = strokeColor;
    if (widthInput) widthInput.value = strokeWidth;
}

export function deselectAllShapes() {
    document.querySelectorAll('.shape-wrapper.selected').forEach(el => el.classList.remove('selected'));
}

export function deleteShapeWrapper(wrapper) {
    if (confirm("Delete this shape?")) {
        wrapper.remove();
        saveState(false);
    }
}

export function updateShapeSettings(key, value) {
    // Update global state
    state.shapeSettings[key] = value;

    // Update currently selected shape if any
    const selected = document.querySelector('.shape-wrapper.selected');
    if (selected) {
        const svgShape = selected.querySelector('rect, ellipse, line, path, g');
        if (!svgShape) return;

        // Update dataset
        if (key === 'strokeColor') {
            selected.dataset.strokeColor = value;
            applyStroke(svgShape, value);
        } else if (key === 'strokeWidth') {
            selected.dataset.strokeWidth = value;
            applyStrokeWidth(svgShape, value);

            // If arrow, we must update the head size
            if (selected.dataset.type === 'arrow') {
                updateArrowHead(svgShape, value);
            }
        }
    }
}

function updateArrowHead(group, strokeWidth) {
    const line = group.querySelector('line');
    const head = group.querySelector('path');
    if (!line || !head) return;

    const x1 = parseFloat(line.getAttribute('x1'));
    const y1 = parseFloat(line.getAttribute('y1'));
    const x2 = parseFloat(line.getAttribute('x2'));
    const y2 = parseFloat(line.getAttribute('y2'));

    // Re-calculate p1, p2
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10 + (strokeWidth * 3);
    const headAngle = Math.PI / 6;

    const p1x = x2 - headLen * Math.cos(angle - headAngle);
    const p1y = y2 - headLen * Math.sin(angle - headAngle);
    const p2x = x2 - headLen * Math.cos(angle + headAngle);
    const p2y = y2 - headLen * Math.sin(angle + headAngle);

    head.setAttribute('d', `M ${x2} ${y2} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`);
}

function applyStroke(element, color) {
    element.setAttribute('stroke', color);
    // If it's a group (arrow), apply to children
    if (element.tagName === 'g') {
        const children = element.querySelectorAll('*');
        children.forEach(c => {
            if (c.getAttribute('stroke')) c.setAttribute('stroke', color);
            if (c.getAttribute('fill') && c.getAttribute('fill') !== 'none') c.setAttribute('fill', color);
        });
    }
}

function applyStrokeWidth(element, width) {
    element.setAttribute('stroke-width', width);
    // If group?
    if (element.tagName === 'g') {
        const children = element.querySelectorAll('*');
        children.forEach(c => {
            if (c.getAttribute('stroke-width')) c.setAttribute('stroke-width', width);
        });
    }
}

// Global click listener to deselect (helper)
export function initShapeGlobalListeners() {
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.shape-wrapper') &&
            !e.target.closest('.ribbon-btn') && // Don't deselect when clicking toolbar
            !e.target.closest('input')) {     // or inputs
            deselectAllShapes();
        }
    });
}
