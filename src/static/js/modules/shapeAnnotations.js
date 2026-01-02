
import { state } from './state.js';
import { saveState, recordAction, ActionType } from './history.js';
import { startWrapperMove, startWrapperResize, startWrapperRotation } from './imageAnnotations.js';

/**
 * Shape Wrapper Implementation
 */

export function getShapeState(wrapper) {
    const pageContainer = wrapper.closest('.page-container');
    const pageIndex = parseInt(pageContainer.dataset.pageIndex);
    const svgContent = wrapper.querySelector('.shape-content');
    const shape = svgContent.querySelector('rect, ellipse, line, g');

    return {
        id: wrapper.id,
        pageIndex,
        x: wrapper.style.left,
        y: wrapper.style.top,
        width: wrapper.style.width,
        height: wrapper.style.height,
        transform: wrapper.style.transform || 'rotate(0deg)',
        type: wrapper.dataset.type,
        strokeColor: wrapper.dataset.strokeColor,
        strokeWidth: wrapper.dataset.strokeWidth,
        internalAttrs: getInternalAttrs(shape, wrapper.dataset.type)
    };
}

function getInternalAttrs(shape, type) {
    if (type === 'line') {
        return {
            x1: shape.getAttribute('x1'),
            y1: shape.getAttribute('y1'),
            x2: shape.getAttribute('x2'),
            y2: shape.getAttribute('y2')
        };
    } else if (type === 'arrow') {
        const line = shape.querySelector('line');
        return {
            x1: line.getAttribute('x1'),
            y1: line.getAttribute('y1'),
            x2: line.getAttribute('x2'),
            y2: line.getAttribute('y2')
        };
    }
    return {};
}

export function restoreShapeAnnotation(data) {
    let wrapper = document.getElementById(data.id);
    if (!wrapper) {
        // Create
        const pageContainer = document.querySelectorAll('.page-container')[data.pageIndex];
        if (!pageContainer) return;

        wrapper = document.createElement('div');
        wrapper.className = 'shape-wrapper selected';
        wrapper.id = data.id;
        wrapper.dataset.type = data.type;

        wrapper.innerHTML = `
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

        const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        Object.assign(newSvg.style, { width: '100%', height: '100%', overflow: 'visible' });
        newSvg.classList.add('shape-content');

        let newShape;
        if (data.type === 'rect') {
            newShape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            newShape.setAttribute('x', 0); newShape.setAttribute('y', 0);
            newShape.setAttribute('width', '100%'); newShape.setAttribute('height', '100%');
            newShape.setAttribute('vector-effect', 'non-scaling-stroke');
            newShape.setAttribute('fill', 'none');
        } else if (data.type === 'ellipse') {
            newShape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
            newShape.setAttribute('cx', '50%'); newShape.setAttribute('cy', '50%');
            newShape.setAttribute('rx', '50%'); newShape.setAttribute('ry', '50%');
            newShape.setAttribute('vector-effect', 'non-scaling-stroke');
            newShape.setAttribute('fill', 'none');
        } else if (data.type === 'line') {
            newShape = document.createElementNS("http://www.w3.org/2000/svg", "line");
            newShape.setAttribute('x1', data.internalAttrs.x1);
            newShape.setAttribute('y1', data.internalAttrs.y1);
            newShape.setAttribute('x2', data.internalAttrs.x2);
            newShape.setAttribute('y2', data.internalAttrs.y2);
            newShape.setAttribute('vector-effect', 'non-scaling-stroke');
        } else if (data.type === 'arrow') {
            newShape = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute('x1', data.internalAttrs.x1);
            line.setAttribute('y1', data.internalAttrs.y1);
            line.setAttribute('x2', data.internalAttrs.x2);
            line.setAttribute('y2', data.internalAttrs.y2);
            line.setAttribute('vector-effect', 'non-scaling-stroke');
            line.setAttribute('stroke', data.strokeColor);
            line.setAttribute('stroke-width', data.strokeWidth);
            newShape.appendChild(line);

            const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
            head.setAttribute('fill', data.strokeColor);
            newShape.appendChild(head);
            // Head path updated by updateArrowHead later
        }

        if (newShape) {
            applyStroke(newShape, data.strokeColor);
            applyStrokeWidth(newShape, data.strokeWidth);
            newSvg.appendChild(newShape);

            if (data.type === 'arrow') updateArrowHead(newShape, data.strokeWidth);
        }

        wrapper.appendChild(newSvg);
        pageContainer.appendChild(wrapper);
        setupShapeWrapperInteraction(wrapper, pageContainer);
    }

    // Apply State
    Object.assign(wrapper.style, {
        left: data.x, top: data.y, width: data.width, height: data.height, transform: data.transform
    });

    wrapper.dataset.strokeColor = data.strokeColor;
    wrapper.dataset.strokeWidth = data.strokeWidth;

    // If arrow, head might need update if width changed
    if (data.type === 'arrow') {
        const svgContent = wrapper.querySelector('.shape-content');
        const shape = svgContent.querySelector('g');
        if (shape) updateArrowHead(shape, data.strokeWidth);
    }

    return wrapper;
}


export function createShapeWrapper(svgElement, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'shape-wrapper selected';
    wrapper.id = `shape-annot-${Date.now()}`;

    const type = svgElement.dataset.type;
    let x, y, w, h;
    let strokeWidth = parseInt(svgElement.dataset.strokeWidth || 2);

    const shape = svgElement.querySelector('rect, ellipse, line, g');

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
        x = cx - rx; y = cy - ry; w = rx * 2; h = ry * 2;
    } else if (type === 'line' || type === 'arrow') {
        const line = (type === 'arrow') ? shape.querySelector('line') : shape;
        const x1 = parseFloat(line.getAttribute('x1'));
        const y1 = parseFloat(line.getAttribute('y1'));
        const x2 = parseFloat(line.getAttribute('x2'));
        const y2 = parseFloat(line.getAttribute('y2'));
        x = Math.min(x1, x2); y = Math.min(y1, y2);
        w = Math.abs(x2 - x1); h = Math.abs(y2 - y1);
        if (w < 10) w = 10; if (h < 10) h = 10;
    }

    Object.assign(wrapper.style, {
        position: 'absolute',
        left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, zIndex: '50'
    });

    const newSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(newSvg.style, { width: '100%', height: '100%', overflow: 'visible' });
    newSvg.classList.add('shape-content');

    const newShape = shape.cloneNode(true);

    if (type === 'rect') {
        newShape.setAttribute('x', 0); newShape.setAttribute('y', 0);
        newShape.setAttribute('width', '100%'); newShape.setAttribute('height', '100%');
        newShape.setAttribute('vector-effect', 'non-scaling-stroke');
    } else if (type === 'ellipse') {
        newShape.setAttribute('cx', '50%'); newShape.setAttribute('cy', '50%');
        newShape.setAttribute('rx', '50%'); newShape.setAttribute('ry', '50%');
        newShape.setAttribute('vector-effect', 'non-scaling-stroke');
    } else if (type === 'line') {
        const line = shape;
        const x1 = parseFloat(line.getAttribute('x1'));
        const y1 = parseFloat(line.getAttribute('y1'));
        const x2 = parseFloat(line.getAttribute('x2'));
        const y2 = parseFloat(line.getAttribute('y2'));
        let nx1 = 0, ny1 = 0, nx2 = '100%', ny2 = '100%';
        if ((x1 <= x2 && y1 >= y2) || (x1 >= x2 && y1 <= y2)) { nx1 = 0; ny1 = '100%'; nx2 = '100%'; ny2 = 0; }
        else { nx1 = 0; ny1 = 0; nx2 = '100%'; ny2 = '100%'; }
        newShape.setAttribute('x1', nx1); newShape.setAttribute('y1', ny1);
        newShape.setAttribute('x2', nx2); newShape.setAttribute('y2', ny2);
        newShape.setAttribute('vector-effect', 'non-scaling-stroke');
    } else if (type === 'arrow') {
        newShape.setAttribute('transform', `translate(${-x}, ${-y})`);
    }

    newSvg.appendChild(newShape);
    wrapper.appendChild(newSvg);

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

    wrapper.dataset.type = type;
    wrapper.dataset.strokeColor = svgElement.dataset.stroke;
    wrapper.dataset.strokeWidth = strokeWidth;

    container.appendChild(wrapper);
    svgElement.remove();

    setupShapeWrapperInteraction(wrapper, container);
    selectShapeWrapper(wrapper);

    // Record Action
    recordAction(ActionType.ADD, getShapeState(wrapper), restoreShapeAnnotation);

    return wrapper;
}

export function setupShapeWrapperInteraction(wrapper, container) {
    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('.resize-handle') ||
            e.target.closest('.rotate-handle') ||
            e.target.closest('.delete-handle')) return;

        e.stopPropagation();
        e.preventDefault();

        selectShapeWrapper(wrapper);

        const startState = getShapeState(wrapper);
        startWrapperMove(e, wrapper, () => {
            const newState = getShapeState(wrapper);
            if (newState.x !== startState.x || newState.y !== startState.y) {
                recordAction(ActionType.MOVE, { oldState: startState, newState }, restoreShapeAnnotation);
            }
        });
    });

    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dir = handle.dataset.dir;
            const startState = getShapeState(wrapper);
            startWrapperResize(e, wrapper, dir, () => {
                const newState = getShapeState(wrapper);
                recordAction(ActionType.RESIZE, { oldState: startState, newState }, restoreShapeAnnotation);
            });
        });
    });

    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startState = getShapeState(wrapper);
            startWrapperRotation(e, wrapper, () => {
                const newState = getShapeState(wrapper);
                recordAction(ActionType.MODIFY, { oldState: startState, newState }, restoreShapeAnnotation);
            });
        });
    }

    const delHandle = wrapper.querySelector('.delete-handle');
    if (delHandle) {
        delHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteShapeWrapper(wrapper);
        });
        delHandle.addEventListener('mousedown', (e) => e.stopPropagation());
    }
}

export function selectShapeWrapper(wrapper) {
    deselectAllShapes();
    wrapper.classList.add('selected');
    const strokeColor = wrapper.dataset.strokeColor;
    const strokeWidth = wrapper.dataset.strokeWidth;
    if (strokeColor) state.shapeSettings.strokeColor = strokeColor;
    if (strokeWidth) state.shapeSettings.strokeWidth = parseInt(strokeWidth);

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
        const s = getShapeState(wrapper);
        wrapper.remove();
        recordAction(ActionType.DELETE, s, restoreShapeAnnotation);
    }
}

export function updateShapeSettings(key, value) {
    state.shapeSettings[key] = value;
    const selected = document.querySelector('.shape-wrapper.selected');
    if (selected) {
        const svgShape = selected.querySelector('rect, ellipse, line, path, g');
        if (!svgShape) return;

        const oldState = getShapeState(selected);

        if (key === 'strokeColor') {
            selected.dataset.strokeColor = value;
            applyStroke(svgShape, value);
        } else if (key === 'strokeWidth') {
            selected.dataset.strokeWidth = value;
            applyStrokeWidth(svgShape, value);
            if (selected.dataset.type === 'arrow') {
                updateArrowHead(svgShape, value);
            }
        }

        const newState = getShapeState(selected);
        recordAction(ActionType.MODIFY, { oldState, newState }, restoreShapeAnnotation);
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

    // Note: This needs proper coordinate space check
    // If x1/y1 are percentages?
    // In Arrow implementation above, they are 0/100%. 
    // We need pixel values to calculate head?
    // But SVG uses percent?
    // If we use '100%', then `parseFloat` returns 100.
    // We need wrapper width/height to get pixels if we want to calc angle correctly using pixels?
    // OR we use the SVG coordinates system. 
    // If we set 0/100%, we are using that.
    // Wait, updateArrowHead logic uses Math.atan2. 
    // If x1=0, x2=100 (which means 100 user units in current coord system).
    // If viewBox is not set, 100 means 100px.
    // If wrapper size is different, the arrow might look skewed?
    // Wrapper uses `vector-effect=non-scaling-stroke`, so coordinate system scales with wrapper.
    // So if x2=100 (and w=100%), it maps to wrapper width.
    // But wait, 100 != 100%.
    // In `createShapeWrapper` for Line: I set `nx1 = '100%'`.
    // SVG attributes `x1="100%"` are valid.
    // But `parseFloat("100%")` is 100.
    // So math uses 100.
    // If the arrow line is drawn from 0 to 100 (units), the Head math will use 10 units length.
    // 10 units relative to 100 units is 10%.
    // So head size scales with wrapper!
    // This is GOOD for resizing (head grows).
    // But usually stroke width stays constant (non-scaling-stroke).
    // Head size should probably correlate to stroke width, not wrapper size?
    // If wrapper is huge, head shouldn't be massive?
    // `headLen = 10 + strokeWidth*3`.
    // If 10 is "units", and Units scale...
    // We might want Units to be Pixels (via viewBox or just using wrapper size as pixel units).
    // But we didn't set viewBox.
    // So 1 unit = 1 pixel (if width/height="100%" and wrapper has size).
    // Actually, if we set width="100%", the coordinate system depends on parent size.
    // If we want fixed Head size, we need to know the pixel size.
    // `wrapper.offsetWidth`.

    // Improved updateArrowHead:
    // Convert % to pixels.
    // Use wrapper clientWidth/Height?
    // `group` is inside `svg` inside `wrapper`.
    // `wrapper` (passed to this func? No, `group` is passed).
    const wrapper = group.closest('.shape-wrapper');
    const w = wrapper.offsetWidth;
    const h = wrapper.offsetHeight;

    const parse = (val, max) => val.endsWith('%') ? (parseFloat(val) / 100) * max : parseFloat(val);

    const px1 = parse(line.getAttribute('x1'), w);
    const py1 = parse(line.getAttribute('y1'), h);
    const px2 = parse(line.getAttribute('x2'), w);
    const py2 = parse(line.getAttribute('y2'), h);

    const angle = Math.atan2(py2 - py1, px2 - px1);
    const headLen = 10 + (parseInt(strokeWidth) * 3);
    const headAngle = Math.PI / 6;

    const p1x = px2 - headLen * Math.cos(angle - headAngle);
    const p1y = py2 - headLen * Math.sin(angle - headAngle);
    const p2x = px2 - headLen * Math.cos(angle + headAngle);
    const p2y = py2 - headLen * Math.sin(angle + headAngle);

    // We need to set 'd' using values that match the coordinate system.
    // If System is %, we need to convert back? 
    // Or just use pixels?
    // If we use pixels in 'd', it works IF SVG assumes user units == pixels.
    // It does if no viewBox.
    // BUT we have `x1="100%"` (percent).
    // Mixing Percent and Pixels (in path d) is valid? Path data must be numbers.
    // So Path data is interpreted as user units.
    // If x1="100%", user units for line are resolved at render time.
    // But `path d="M ..."` numbers are user units.
    // If SVG width=100%, user units = pixels (usually).
    // So using calculated pixels for head path is correct.

    head.setAttribute('d', `M ${px2} ${py2} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`);
}

function applyStroke(element, color) {
    element.setAttribute('stroke', color);
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
    if (element.tagName === 'g') {
        const children = element.querySelectorAll('*');
        children.forEach(c => {
            if (c.getAttribute('stroke-width')) c.setAttribute('stroke-width', width);
        });
    }
}

export function initShapeGlobalListeners() {
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.shape-wrapper') &&
            !e.target.closest('.ribbon-btn') &&
            !e.target.closest('input')) {
            deselectAllShapes();
        }
    });
}
