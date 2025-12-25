
import { state } from './state.js';
import { saveState } from './history.js';
import { refreshView } from './viewer.js';
import { commitAnnotations } from './commitAnnotations.js';

// Drag-to-Draw State
let isDrawing = false;
let isCommitting = false;
let startX, startY;
let currentRect = null;
let currentPath = null;
let currentSvg = null;
let currentShapeElement = null;
let pathPoints = [];

export function initDrawListeners(container, pageIndex) {
    container.addEventListener('mousedown', (e) => {
        if (state.modes.select) {
            // handleSelectionClick(e, container); // Defined elsewhere or missing
            return;
        }

        if (isCommitting) return; // Prevent interaction while processing

        const { modes } = state;
        if (!modes.redact && !modes.highlight && !modes.extract && !modes.shape) {
            return;
        }
        if (e.target.classList.contains('text-annotation')) {
            // Enable selection/move even if in Text/Shape mode
            // handleSelectionClick(e, container);
            return;
        }

        if (e.target.classList.contains('image-annotation') ||
            e.target.classList.contains('selection-handle') || // Don't draw over handles
            e.target.classList.contains('annotation-rect') ||
            e.target.closest('svg')) return;

        isDrawing = true;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (modes.highlight) {
            // Freehand Highlight
            pathPoints = [[x, y]];

            currentSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            Object.assign(currentSvg.style, {
                position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: '5'
            });
            currentSvg.classList.add('drawing-annotation');

            currentPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            currentPath.setAttribute("d", `M ${x} ${y} `);
            currentPath.setAttribute("stroke", "yellow");
            currentPath.setAttribute("stroke-width", "20");
            currentPath.setAttribute("stroke-opacity", "0.4");
            currentPath.setAttribute("fill", "none");
            currentPath.setAttribute("stroke-linecap", "round");
            currentPath.setAttribute("stroke-linejoin", "round");
            currentPath.style.pointerEvents = 'auto';

            currentSvg.appendChild(currentPath);
            container.appendChild(currentSvg);

        } else if (modes.shape) {
            startX = x;
            startY = y;

            currentSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            Object.assign(currentSvg.style, {
                position: 'absolute', left: '0', top: '0', width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: '5'
            });
            currentSvg.classList.add('shape-annotation');
            currentSvg.dataset.type = modes.shape;
            currentSvg.dataset.stroke = state.shapeSettings.strokeColor;
            currentSvg.dataset.strokeWidth = state.shapeSettings.strokeWidth;

            const stroke = state.shapeSettings.strokeColor;
            const strokeWidth = state.shapeSettings.strokeWidth;

            if (modes.shape === 'rect') {
                currentShapeElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                currentShapeElement.setAttribute('x', x);
                currentShapeElement.setAttribute('y', y);
                currentShapeElement.setAttribute('width', 0);
                currentShapeElement.setAttribute('height', 0);
                currentShapeElement.setAttribute('stroke', stroke);
                currentShapeElement.setAttribute('stroke-width', strokeWidth);
                currentShapeElement.setAttribute('fill', 'none'); // Future: state.shapeSettings.fillColor
            } else if (modes.shape === 'ellipse') {
                currentShapeElement = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                currentShapeElement.setAttribute('cx', x);
                currentShapeElement.setAttribute('cy', y);
                currentShapeElement.setAttribute('rx', 0);
                currentShapeElement.setAttribute('ry', 0);
                currentShapeElement.setAttribute('stroke', stroke);
                currentShapeElement.setAttribute('stroke-width', strokeWidth);
                currentShapeElement.setAttribute('fill', 'none');
            } else if (modes.shape === 'line') {
                currentShapeElement = document.createElementNS("http://www.w3.org/2000/svg", "line");
                currentShapeElement.setAttribute('x1', x);
                currentShapeElement.setAttribute('y1', y);
                currentShapeElement.setAttribute('x2', x);
                currentShapeElement.setAttribute('y2', y);
                currentShapeElement.setAttribute('stroke', stroke);
                currentShapeElement.setAttribute('stroke-width', strokeWidth);
            } else if (modes.shape === 'arrow') {
                currentShapeElement = document.createElementNS("http://www.w3.org/2000/svg", "g");

                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute('x1', x);
                line.setAttribute('y1', y);
                line.setAttribute('x2', x);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', stroke);
                line.setAttribute('stroke-width', strokeWidth);

                // Arrowhead (simple triangle)
                const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
                head.setAttribute('fill', stroke);
                head.setAttribute('d', '');

                currentShapeElement.appendChild(line);
                currentShapeElement.appendChild(head);
            }

            currentShapeElement.style.pointerEvents = 'auto'; // Make selectable if we implement selection
            currentSvg.appendChild(currentShapeElement);
            container.appendChild(currentSvg);

        } else {
            // Redact or Extract
            startX = x;
            startY = y;

            currentRect = document.createElement('div');
            currentRect.className = 'annotation-rect';
            Object.assign(currentRect.style, {
                left: `${startX}px`, top: `${startY}px`, width: '0px', height: '0px',
                position: 'absolute', border: '1px solid #ccc'
            });

            if (modes.redact) {
                currentRect.style.backgroundColor = 'white';
                currentRect.style.opacity = '1';
                currentRect.dataset.type = 'redact';
            } else {
                currentRect.style.backgroundColor = 'rgba(0, 123, 255, 0.3)';
                currentRect.style.border = '1px dashed #007bff';
                currentRect.dataset.type = 'extract';
            }
            container.appendChild(currentRect);
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const { modes } = state;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        if (modes.highlight && currentPath) {
            pathPoints.push([currentX, currentY]);
            const d = pathPoints.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]} ` : `L ${p[0]} ${p[1]} `)).join(' ');
            currentPath.setAttribute("d", d);

        } else if (modes.shape && currentShapeElement) {
            const dx = currentX - startX;
            const dy = currentY - startY;

            if (modes.shape === 'rect') {
                currentShapeElement.setAttribute('x', dx < 0 ? currentX : startX);
                currentShapeElement.setAttribute('y', dy < 0 ? currentY : startY);
                currentShapeElement.setAttribute('width', Math.abs(dx));
                currentShapeElement.setAttribute('height', Math.abs(dy));
            } else if (modes.shape === 'ellipse') {
                // Ellipse center is startX + dx/2 ?? No, conventionally drag defines bounding box
                // Let's assume start point is center? Or corner?
                // Standard behavior is corner to corner.
                const rx = Math.abs(dx) / 2;
                const ry = Math.abs(dy) / 2;
                const cx = startX + dx / 2;
                const cy = startY + dy / 2;
                currentShapeElement.setAttribute('cx', cx);
                currentShapeElement.setAttribute('cy', cy);
                currentShapeElement.setAttribute('rx', rx);
                currentShapeElement.setAttribute('ry', ry);
            } else if (modes.shape === 'line') {
                currentShapeElement.setAttribute('x2', currentX);
                currentShapeElement.setAttribute('y2', currentY);
            } else if (modes.shape === 'arrow') {
                const line = currentShapeElement.querySelector('line');
                const head = currentShapeElement.querySelector('path');

                line.setAttribute('x2', currentX);
                line.setAttribute('y2', currentY);

                // Calculate arrowhead
                // Angle of line
                const angle = Math.atan2(currentY - startY, currentX - startX);
                const headLen = 15; // length of head in px
                const headAngle = Math.PI / 6; // 30 degrees

                const x2 = currentX;
                const y2 = currentY;

                const p1x = x2 - headLen * Math.cos(angle - headAngle);
                const p1y = y2 - headLen * Math.sin(angle - headAngle);
                const p2x = x2 - headLen * Math.cos(angle + headAngle);
                const p2y = y2 - headLen * Math.sin(angle + headAngle);

                head.setAttribute('d', `M ${x2} ${y2} L ${p1x} ${p1y} L ${p2x} ${p2y} Z`);
            }

        } else if ((modes.redact || modes.extract) && currentRect) {
            const width = currentX - startX;
            const height = currentY - startY;

            currentRect.style.width = `${Math.abs(width)}px`;
            currentRect.style.height = `${Math.abs(height)}px`;
            currentRect.style.left = `${width < 0 ? currentX : startX}px`;
            currentRect.style.top = `${height < 0 ? currentY : startY}px`;
        }
    });
}

// Global mouseup handler (must be called from main to setup, or exported)
export async function handleGlobalMouseUp() {
    if (!isDrawing) return;
    isDrawing = false;

    let container = null;
    if (currentRect && currentRect.parentElement) container = currentRect.parentElement;
    else if (currentSvg && currentSvg.parentElement) container = currentSvg.parentElement;

    if (!container) {
        if (currentRect) currentRect.remove();
        if (currentSvg) currentSvg.remove();
        currentRect = null; currentPath = null; currentSvg = null;
        return;
    }

    const pageIndex = parseInt(container.dataset.pageIndex);
    const { modes } = state;

    if (modes.extract && currentRect) {
        const x = parseFloat(currentRect.style.left);
        const y = parseFloat(currentRect.style.top);
        const w = parseFloat(currentRect.style.width);
        const h = parseFloat(currentRect.style.height);
        const { width: pageWidth, height: pageHeight } = container.getBoundingClientRect();

        currentRect.remove();
        currentRect = null;

        const { performExtraction } = await import('./extraction.js');
        await performExtraction(pageIndex, x, y, w, h, pageWidth, pageHeight);
        return;
    }

    currentRect = null; currentPath = null; currentSvg = null; currentShapeElement = null;

    isCommitting = true;
    try {
        // Save state
        await saveState(false);
        await commitAnnotations();
    } catch (e) {
        if (typeof handleApiError !== 'undefined') {
            handleApiError(e, "Error committing annotations");
        } else {
            console.error("Error committing annotations", e);
            if (typeof showToast === 'function') showToast("Error saving annotation", "error");
        }
    } finally {
        await refreshView();
        isCommitting = false;
    }
}
