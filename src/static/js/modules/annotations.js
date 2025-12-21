import { state } from './state.js';
import { saveState } from './history.js'; // Circular
import { refreshView } from './viewer.js'; // Circular
import { toggleTextMode } from './ui.js';

// Helper to ensure settings exist
function ensureTextSettings() {
    if (!state.textSettings) {
        state.textSettings = {
            fontFamily: 'Helvetica',
            fontSize: 16,
            color: '#000000',
            isBold: false,
            isItalic: false,
            // Background defaults (Opaque White, per user request)
            backgroundColor: '#ffffff',
            backgroundAlpha: 1.0,
            isTransparent: false
        };
    }
}



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
            handleSelectionClick(e, container);
            return;
        }

        if (isCommitting) return; // Prevent interaction while processing

        const { modes } = state;
        if (!modes.redact && !modes.highlight && !modes.extract && !modes.shape) {
            return;
        }
        if (e.target.classList.contains('text-annotation')) {
            // Enable selection/move even if in Text/Shape mode
            handleSelectionClick(e, container);
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
                left: `${startX} px`, top: `${startY} px`, width: '0px', height: '0px',
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

            currentRect.style.width = `${Math.abs(width)} px`;
            currentRect.style.height = `${Math.abs(height)} px`;
            currentRect.style.left = `${width < 0 ? currentX : startX} px`;
            currentRect.style.top = `${height < 0 ? currentY : startY} px`;
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

        // Import dynamically or assuming performExtraction is available globally? 
        // Better to import. 
        // Circular: extraction -> history? No.
        // I will dynamically import or pass it?
        // Let's import { performExtraction } from './extraction.js';
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
        handleApiError(e, "Error committing annotations");
    } finally {
        await refreshView();
        isCommitting = false;
    }
}

export async function addTextAnnotation(e, pageIndex) {
    if (e.target.classList.contains('text-annotation')) return;

    // Check if there is an active selection
    const activeSelection = document.querySelector('.text-annotation.selected') || document.querySelector('.text-annotation[contenteditable="true"]');

    if (activeSelection) {
        // If there's an active text field, clicking outside should JUST deselect/deactivate it.
        // It should NOT create a new text field immediately.
        activeSelection.classList.remove('selected');
        // Force blur if editing
        if (activeSelection.isContentEditable) {
            activeSelection.blur();
        }
        return; // CONSUME the click. Do not create new active.
    }

    ensureTextSettings();
    await saveState(false);

    const pageContainer = document.querySelectorAll('.page-container')[pageIndex];
    if (!pageContainer) return; // Guard

    // Position relative to page container
    const rect = pageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const input = document.createElement('div');
    input.id = `text-annot-${Date.now()}`;
    input.className = 'text-annotation';
    input.contentEditable = false; // Start inactive
    input.innerText = "Type here";

    Object.assign(input.style, {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        zIndex: '100',
        minWidth: '50px',
        // Apply current settings
        fontFamily: state.textSettings?.fontFamily || 'Helvetica',
        fontSize: `${state.textSettings?.fontSize || 16}px`,
        color: state.textSettings?.color || '#000000',
        fontWeight: state.textSettings?.isBold ? 'bold' : 'normal',
        fontStyle: state.textSettings?.isItalic ? 'italic' : 'normal',
        backgroundColor: state.textSettings?.isTransparent ? 'transparent' :
            hexToRgba(state.textSettings.backgroundColor, state.textSettings.backgroundAlpha)
    });

    // Store settings in dataset for commit/persistence
    input.dataset.bgColor = state.textSettings.backgroundColor;
    input.dataset.bgAlpha = state.textSettings.backgroundAlpha;
    input.dataset.isTransparent = state.textSettings.isTransparent;

    // Attach Interaction Logic
    setupTextInteraction(input, pageContainer);

    // Manual Selection Logic
    // Deselect others
    document.querySelectorAll('.text-annotation.selected').forEach(el => el.classList.remove('selected'));
    input.classList.add('selected');

    input.addEventListener('mousedown', (ev) => {
        // e.stopPropagation() is handled in setupTextInteraction but we need this to run
        // setupTextInteraction uses mousedown too. Multiple listeners are fine.
        document.querySelectorAll('.text-annotation.selected').forEach(el => el.classList.remove('selected'));
        input.classList.add('selected');

        // Optional: Load this element's styles into global state/ribbon? 
        // For now, we assume global state dictates new styles, 
        // but selecting existing should probably NOT overwrite global state unless we implement a "pick style" feature.
    });

    pageContainer.appendChild(input);

    // Note: We do NOT focus or select immediately. User must interact.
    // Or do we want to allow typing immediately upon creation? 
    // User request: "start from the beginning with 'Add Test' functionality... click outside... non-active". 
    // Usually new text should terminate in edit mode for convenience.
    // Let's force edit mode once initially.
    activateTextEdit(input);

    // Ensure Text Mode stays active
    state.modes.text = true;
    if (window.updateButtonStates) window.updateButtonStates();
}

function setupTextInteraction(element, container) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    // 1. Drag / Move Logic (MouseDown)
    element.addEventListener('mousedown', (e) => {
        if (element.isContentEditable) return; // Don't drag if editing
        if (e.button !== 0) return; // Only left click

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;

        element.classList.add('dragging');
        e.stopPropagation(); // Prevent page pan or other selections
    });

    // Global drag listeners (handled usually by window but let's be localized if possible, or global for smoothness)
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        element.style.left = `${initialLeft + dx}px`;
        element.style.top = `${initialTop + dy}px`;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.classList.remove('dragging');
            // Optional: Save state here?
        }
    });

    // 2. Edit Logic (Double Click)
    element.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        activateTextEdit(element);
    });
}

function activateTextEdit(element) {
    element.contentEditable = true;
    element.focus();

    // Select all text for easy replacement
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finishEdit = () => {
        element.contentEditable = false;
        element.removeEventListener('blur', finishEdit);
        if (!element.innerText.trim()) {
            element.remove(); // Clean up empty
        }
    };

    element.addEventListener('blur', finishEdit);
}

export async function addTextField() {
    const { pdfDoc, selectedPageIndex } = state;
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPage(selectedPageIndex);
    const { width, height } = page.getSize();

    await saveState();
    const textField = form.createTextField(`text_field_${Date.now()} `);
    textField.setText('Enter text');
    textField.addToPage(page, { x: 50, y: height - 100, width: 200, height: 50 });

    await refreshView();
}

export async function addCheckbox() {
    const { pdfDoc, selectedPageIndex } = state;
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPage(selectedPageIndex);
    const { width, height } = page.getSize();

    await saveState();
    const checkBox = form.createCheckBox(`checkbox_${Date.now()} `);
    checkBox.addToPage(page, { x: 50, y: height - 150, width: 20, height: 20 });

    await refreshView();
}

export async function handleImageUpload(input) {
    const { pdfDoc, selectedPageIndex } = state;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = async function (e) {
            const pageContainer = document.querySelectorAll('.page-container')[selectedPageIndex];
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'image-annotation';

            img.onload = function () {
                let imgWidth = img.naturalWidth;
                let imgHeight = img.naturalHeight;

                if (imgWidth > 200) {
                    const scale = 200 / imgWidth;
                    imgWidth *= scale;
                    imgHeight *= scale;
                }

                img.style.width = `${imgWidth} px`;
                img.style.height = `${imgHeight} px`;
                img.style.left = `${(pageContainer.offsetWidth - imgWidth) / 2} px`;
                img.style.top = `${(pageContainer.offsetHeight - imgHeight) / 2} px`;

                makeDraggable(img);
                pageContainer.appendChild(img);
            };
        };
        reader.readAsDataURL(file);
    }
    input.value = '';
}

function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
        if (state.modes.select) return; // Disable legacy drag in Select Mode
        if (el.classList.contains('text-annotation') && state.modes.text) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseFloat(el.style.left || 0);
        initialTop = parseFloat(el.style.top || 0);
        el.style.zIndex = 100;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = `${initialLeft + dx} px`;
        el.style.top = `${initialTop + dy} px`;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            el.style.zIndex = '';
        }
    });
}

export async function commitAnnotations() {
    const { pdfDoc } = state;
    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

    const containers = document.querySelectorAll('.page-container');
    for (let index = 0; index < containers.length; index++) {
        const container = containers[index];
        const page = pages[index];
        const { height } = page.getSize();

        // Text
        // Text
        const textNodes = container.querySelectorAll('.text-annotation');
        for (const note of textNodes) {
            const text = note.innerText;
            const x = parseFloat(note.style.left);
            const y = parseFloat(note.style.top);
            const size = parseFloat(note.style.fontSize) || 16;

            // Font Logic
            let family = (note.style.fontFamily || 'Helvetica').replace(/"/g, '');
            const isBold = note.style.fontWeight === 'bold' || parseInt(note.style.fontWeight) >= 700;
            const isItalic = note.style.fontStyle === 'italic';

            let fontBase = 'Helvetica';
            if (family.includes('Times')) fontBase = 'TimesRoman';
            else if (family.includes('Courier')) fontBase = 'Courier';

            let fontKey = fontBase;
            if (isBold && isItalic) fontKey += 'BoldOblique';
            else if (isBold) fontKey += 'Bold';
            else if (isItalic) fontKey += 'Oblique';

            // Handle TimesRoman vs TimesRomanBold (TimesRomanBoldItalic is correct key?)
            // PDFLib.StandardFonts keys: TimesRoman, TimesRomanBold, TimesRomanItalic, TimesRomanBoldItalic
            // Helvetica, HelveticaBold, HelveticaOblique, HelveticaBoldOblique
            // Courier, CourierBold, CourierOblique, CourierBoldOblique
            // So my logic matches except for TimesRomanOblique -> TimesRomanItalic
            if (fontBase === 'TimesRoman' && isItalic && !isBold) fontKey = 'TimesRomanItalic';
            if (fontBase === 'TimesRoman' && isItalic && isBold) fontKey = 'TimesRomanBoldItalic';

            let pdfFont;
            try {
                pdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts[fontKey]);
            } catch (e) {
                pdfFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
            }

            // Color (Simple Hex or RGB support)
            // Note: input type=color sets Hex. style.color might be rgb().
            let r = 0, g = 0, b = 0;
            const colorStr = note.style.color || '#000000';
            if (colorStr.startsWith('#')) {
                r = parseInt(colorStr.substr(1, 2), 16) / 255;
                g = parseInt(colorStr.substr(3, 2), 16) / 255;
                b = parseInt(colorStr.substr(5, 2), 16) / 255;
            } else if (colorStr.startsWith('rgb')) {
                const parts = colorStr.match(/\d+/g);
                if (parts) {
                    r = parseInt(parts[0]) / 255;
                    g = parseInt(parts[1]) / 255;
                    b = parseInt(parts[2]) / 255;
                }
            }

            page.drawText(text, {
                x,
                y: height - y - (size * 0.8),
                size,
                font: pdfFont,
                color: PDFLib.rgb(r, g, b)
            });
        }

        // Rects
        container.querySelectorAll('.annotation-rect').forEach(rect => {
            const x = parseFloat(rect.style.left);
            const y = parseFloat(rect.style.top);
            const w = parseFloat(rect.style.width);
            const h = parseFloat(rect.style.height);
            const type = rect.dataset.type;
            page.drawRectangle({
                x, y: height - y - h, width: w, height: h,
                color: type === 'redact' ? PDFLib.rgb(1, 1, 1) : PDFLib.rgb(1, 1, 0),
                opacity: type === 'redact' ? 1 : 0.4,
            });
        });

        // Images
        const imagePromises = Array.from(container.querySelectorAll('.image-annotation')).map(async (img) => {
            const x = parseFloat(img.style.left);
            const y = parseFloat(img.style.top);
            const w = parseFloat(img.style.width);
            const h = parseFloat(img.style.height);
            const imageBytes = await fetch(img.src).then(res => res.arrayBuffer());
            let pdfImage;
            try {
                if (img.src.startsWith('data:image/jpeg')) pdfImage = await pdfDoc.embedJpg(imageBytes);
                else pdfImage = await pdfDoc.embedPng(imageBytes);
            } catch (e) {
                try { pdfImage = await pdfDoc.embedPng(imageBytes); } catch (e2) { pdfImage = await pdfDoc.embedJpg(imageBytes); }
            }
            if (pdfImage) page.drawImage(pdfImage, { x, y: height - y - h, width: w, height: h });
        });
        await Promise.all(imagePromises);

        // SVG
        container.querySelectorAll('.drawing-annotation').forEach(svg => {
            const path = svg.querySelector('path');
            if (!path) return;
            const d = path.getAttribute('d');
            const commands = d.split(' ');
            let newD = [];
            for (let i = 0; i < commands.length; i++) {
                const token = commands[i];
                if (token === 'M' || token === 'L') {
                    newD.push(token);
                    newD.push(parseFloat(commands[i + 1]));
                    newD.push(height - parseFloat(commands[i + 2]));
                    i += 2;
                }
            }
            page.drawSvgPath(newD.join(' '), {
                borderColor: PDFLib.rgb(1, 1, 0), borderWidth: 20, borderOpacity: 0.4, borderLineCap: PDFLib.LineCapStyle.Round
            });
        });

        // Shapes (New)
        container.querySelectorAll('.shape-annotation').forEach(svg => {
            const type = svg.dataset.type;
            const hexColor = svg.dataset.stroke || '#ff0000';
            const r = parseInt(hexColor.substr(1, 2), 16) / 255;
            const g = parseInt(hexColor.substr(3, 2), 16) / 255;
            const b = parseInt(hexColor.substr(5, 2), 16) / 255;
            const color = PDFLib.rgb(r, g, b);
            const thickness = parseInt(svg.dataset.strokeWidth || '2');

            if (type === 'rect') {
                const rect = svg.querySelector('rect');
                const x = parseFloat(rect.getAttribute('x'));
                const y = parseFloat(rect.getAttribute('y'));
                const w = parseFloat(rect.getAttribute('width'));
                const h = parseFloat(rect.getAttribute('height'));
                page.drawRectangle({
                    x, y: height - y - h, width: w, height: h,
                    borderColor: color, borderWidth: thickness, color: undefined, // undefined for no fill
                });
            } else if (type === 'ellipse') {
                const ellipse = svg.querySelector('ellipse');
                const cx = parseFloat(ellipse.getAttribute('cx'));
                const cy = parseFloat(ellipse.getAttribute('cy'));
                const rx = parseFloat(ellipse.getAttribute('rx'));
                const ry = parseFloat(ellipse.getAttribute('ry'));
                page.drawEllipse({
                    x: cx, y: height - cy,
                    xScale: rx, yScale: ry,
                    borderColor: color, borderWidth: thickness, color: undefined
                });
            } else if (type === 'line') {
                const line = svg.querySelector('line');
                const x1 = parseFloat(line.getAttribute('x1'));
                const y1 = parseFloat(line.getAttribute('y1'));
                const x2 = parseFloat(line.getAttribute('x2'));
                const y2 = parseFloat(line.getAttribute('y2'));
                page.drawLine({
                    start: { x: x1, y: height - y1 },
                    end: { x: x2, y: height - y2 },
                    thickness, color
                });
            } else if (type === 'arrow') {
                // Draw line and head
                const line = svg.querySelector('line');
                const x1 = parseFloat(line.getAttribute('x1'));
                const y1 = parseFloat(line.getAttribute('y1'));
                const x2 = parseFloat(line.getAttribute('x2'));
                const y2 = parseFloat(line.getAttribute('y2'));

                page.drawLine({
                    start: { x: x1, y: height - y1 },
                    end: { x: x2, y: height - y2 },
                    thickness, color
                });

                // Re-calculate head for PDF
                // PDF-lib works in PDF coords (y inverted)
                // Angle needs to be calculated in PDF coords?
                // y1_pdf = height - y1
                // y2_pdf = height - y2
                const startX = x1;
                const startY = height - y1;
                const endX = x2;
                const endY = height - y2;

                const angle = Math.atan2(endY - startY, endX - startX);
                const headLen = 15;
                const headAngle = Math.PI / 6;

                const p1x = endX - headLen * Math.cos(angle - headAngle);
                const p1y = endY - headLen * Math.sin(angle - headAngle);
                const p2x = endX - headLen * Math.cos(angle + headAngle);
                const p2y = endY - headLen * Math.sin(angle + headAngle);

                // Draw arrow head lines or polygon
                // Line 1
                page.drawLine({
                    start: { x: endX, y: endY },
                    end: { x: p1x, y: p1y },
                    thickness, color
                });
                // Line 2
                page.drawLine({
                    start: { x: endX, y: endY },
                    end: { x: p2x, y: p2y },
                    thickness, color
                });
            }
        });

        // Watermarks (New)
        container.querySelectorAll('.watermark-annotation').forEach(wm => {
            const text = wm.dataset.text;
            const colorHex = wm.dataset.color || '#cccccc';
            const opacity = parseFloat(wm.dataset.opacity || '0.3');
            const fontSize = parseInt(wm.dataset.size || '48');
            const rotation_deg = parseInt(wm.dataset.rotation || '45');

            const r = parseInt(colorHex.substr(1, 2), 16) / 255;
            const g = parseInt(colorHex.substr(3, 2), 16) / 255;
            const b = parseInt(colorHex.substr(5, 2), 16) / 255;

            const width = page.getWidth();
            const height = page.getHeight();

            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const textHeight = font.heightAtSize(fontSize);

            let x = (width - textWidth) / 2;
            let y = (height - textHeight) / 2;

            page.drawText(text, {
                x: x,
                y: y,
                size: fontSize,
                font: font,
                color: PDFLib.rgb(r, g, b),
                opacity: opacity,
                rotate: PDFLib.degrees(rotation_deg),
            });
        });
    }

    // Remove existing annotations including text
    document.querySelectorAll('.text-annotation, .annotation-rect, .image-annotation, .drawing-annotation, .shape-annotation, .watermark-annotation').forEach(el => el.remove());
}

// Helper to re-attach listeners after undo/redo or load
// This logic should ideally be called when loading from PDF, BUT 
// current commitAnnotations burns text into PDF canvas/stream. 
// So text annotations become part of the PDF content and rely on PDF.js rendering.
// Changes are destructive (burned in). 
// The user flow describes editing "before" burning? 
// Or does the app support editable annotations?
// Based on current code:
// commitAnnotations() -> draws text onto PDF bytes -> reload PDF.
// So once saved/committed, they are no longer DOM elements but pixels/vectors in PDF.
// This refactor affects the "pre-commit" stage (DOM overlay).
// IMPORTANT: We need to ensure that loaded annotations (if any) are just PDF content, 
// OR if we want them editable, we shouldn't burn them yet.
// Current architecture seems to be "edit overlay -> generic save -> burn".
// So this logic logic applies to the overlay elements only.

export function openWatermarkModal() {
    new bootstrap.Modal(document.getElementById('watermarkModal')).show();
}

export function applyWatermark() {
    const text = document.getElementById('watermark-text').value;
    const color = document.getElementById('watermark-color').value;
    const opacity = document.getElementById('watermark-opacity').value;
    const size = document.getElementById('watermark-size').value;
    const rotation = document.getElementById('watermark-rotation').value;

    if (!text) return;

    // Add watermark element to ALL page containers
    const containers = document.querySelectorAll('.page-container');
    containers.forEach(container => {
        // Remove existing watermarks first? Usually yes to avoid dupes
        container.querySelectorAll('.watermark-annotation').forEach(el => el.remove());

        const wm = document.createElement('div');
        wm.className = 'watermark-annotation';
        wm.dataset.text = text;
        wm.dataset.color = color;
        wm.dataset.opacity = opacity;
        wm.dataset.size = size;
        wm.dataset.rotation = rotation;

        // Visual representation in editor
        wm.innerText = text;
        Object.assign(wm.style, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            color: color,
            opacity: opacity,
            fontSize: `${size}px`,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontFamily: 'Helvetica, sans-serif'
        });

        container.appendChild(wm);
    });

    bootstrap.Modal.getInstance(document.getElementById('watermarkModal')).hide();
    saveState(false); // Save state but don't commit yet
}

// Global Text Settings Handlers (exposed for Ribbon)
window.updateTextSettings = function (key, value) {
    ensureTextSettings();
    state.textSettings[key] = value;

    // Apply to selected element if any
    const selected = document.querySelector('.text-annotation.selected');
    if (selected) {
        if (key === 'fontFamily') selected.style.fontFamily = value;
        else if (key === 'fontSize') selected.style.fontSize = `${value}px`;
        else if (key === 'color') selected.style.color = value;
    }
};

window.toggleTextProperty = function (prop) {
    ensureTextSettings();
    if (prop === 'bold') {
        state.textSettings.isBold = !state.textSettings.isBold;
        const selected = document.querySelector('.text-annotation.selected');
        if (selected) selected.style.fontWeight = state.textSettings.isBold ? 'bold' : 'normal';
    } else if (prop === 'italic') {
        state.textSettings.isItalic = !state.textSettings.isItalic;
        const selected = document.querySelector('.text-annotation.selected');
        if (selected) selected.style.fontStyle = state.textSettings.isItalic ? 'italic' : 'normal';
    }
};



export async function addSignatureAnnotation(dataUrl) {
    const { selectedPageIndex } = state;
    const pageContainer = document.querySelectorAll('.page-container')[selectedPageIndex];
    if (!pageContainer) {
        // Fallback to first page if no selection (though usually 0 is selected)
        return;
    }

    await saveState();

    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'image-annotation signature'; // tag as signature for styling if needed

    img.onload = function () {
        let imgWidth = img.naturalWidth;
        let imgHeight = img.naturalHeight;

        // Resize if too big (signatures usually smaller)
        if (imgWidth > 150) {
            const scale = 150 / imgWidth;
            imgWidth *= scale;
            imgHeight *= scale;
        }

        img.style.width = `${imgWidth} px`;
        img.style.height = `${imgHeight} px`;
        img.style.left = `${(pageContainer.offsetWidth - imgWidth) / 2} px`;
        img.style.top = `${(pageContainer.offsetHeight - imgHeight) / 2} px`;
        img.style.position = 'absolute';

        makeDraggable(img);
        pageContainer.appendChild(img);
    };
}

/* Selection & Resize Logic */
let selectedOverlay = null;

function handleSelectionClick(e, container) {
    if (e.target.closest('.selection-handle')) return; // Allow handle drag

    const svg = e.target.closest('.shape-annotation');
    const text = e.target.closest('.text-annotation');

    if (text) {
        // Text interaction is handled directly by its own listeners now.
        // We might just want to prevent bubbling to page click.
        e.stopPropagation();
        return;
    }

    if (svg) {
        // Only select if it matches supported types (rect for now)
        if (svg.dataset.type === 'rect') {
            selectShape(svg, container, e);
            e.stopPropagation(); // prevent other listeners
        }
    } else {
        // If click is not on a shape, deselect (unless we clicked an existing handle, covered above)
        deselectAll();
    }
}

function deselectAll() {
    if (selectedOverlay) {
        selectedOverlay.remove();
        selectedOverlay = null;
    }
    // Also ensure no text is currently being edited if we deselect? 
    // Or we leave it editable if user clicked inside? 
    // If we deselect, we should probably blur and make non-editable.
    document.querySelectorAll('.text-annotation[contenteditable="true"]').forEach(el => {
        // el.contentEditable = false; // Only if not focused?
        // Actually, if we deselect, we imply we are done editing?
        // Let's rely on standard blur for now.
    });
}

function selectShape(element, container, initialEvent = null) {
    deselectAll();

    let x, y, w, h, rectEl;

    if (element.classList.contains('text-annotation')) {
        // Text is now handled by its own listeners. 
        // We should not create an overlay for it.
        return;
    } else {
        // SVG
        rectEl = element.querySelector('rect');
        if (!rectEl) return;
        x = parseFloat(rectEl.getAttribute('x'));
        y = parseFloat(rectEl.getAttribute('y'));
        w = parseFloat(rectEl.getAttribute('width'));
        h = parseFloat(rectEl.getAttribute('height'));
    }

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.className = 'selection-overlay';
    Object.assign(overlay.style, {
        left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`,
        pointerEvents: 'auto', // Enable interaction with overlay for move
        cursor: 'move'
    });

    // Store reference
    overlay.dataset.targetId = element.id || 'annot-' + Date.now();

    // Move Handler on Overlay body
    overlay.onmousedown = (e) => startSelectionDrag(e, null, overlay, element, container);

    // Add handles (only for shapes now)
    const directions = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    directions.forEach(dir => {
        const handle = document.createElement('div');
        handle.className = `selection-handle handle-${dir}`;
        handle.onmousedown = (e) => startSelectionDrag(e, dir, overlay, element, container);
        overlay.appendChild(handle);
    });

    container.appendChild(overlay);
    selectedOverlay = overlay;

    if (initialEvent) {
        startSelectionDrag(initialEvent, null, overlay, element, container);
    }
}

function startSelectionDrag(e, dir, overlay, element, container) {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection

    const startX = e.clientX;
    const startY = e.clientY;

    // Parse starting values
    const startLeft = parseFloat(overlay.style.left);
    const startTop = parseFloat(overlay.style.top);
    const startW = parseFloat(overlay.style.width);
    const startH = parseFloat(overlay.style.height);

    const onMove = (ev) => {
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let newLeft = startLeft;
        let newTop = startTop;
        let newW = startW;
        let newH = startH;

        if (!dir) {
            // MOVE
            newLeft = startLeft + dx;
            newTop = startTop + dy;

            // Boundary checks could go here
        } else {
            // RESIZE (Only shapes reach here for now)
            // Horizontal
            if (dir.includes('e')) {
                newW = Math.max(5, startW + dx); // Min width 5
            }
            if (dir.includes('w')) {
                const potentialW = startW - dx;
                if (potentialW >= 5) {
                    newW = potentialW;
                    newLeft = startLeft + dx;
                } else {
                    newW = 5;
                    newLeft = startLeft + (startW - 5);
                }
            }

            // Vertical
            if (dir.includes('s')) {
                newH = Math.max(5, startH + dy);
            }
            if (dir.includes('n')) {
                const potentialH = startH - dy;
                if (potentialH >= 5) {
                    newH = potentialH;
                    newTop = startTop + dy;
                } else {
                    newH = 5;
                    newTop = startTop + (startH - 5);
                }
            }
        }

        // Apply to Overlay
        overlay.style.left = `${newLeft}px`;
        overlay.style.top = `${newTop}px`;
        overlay.style.width = `${newW}px`;
        overlay.style.height = `${newH}px`;

        // Apply to Target Element
        // Only Shapes for now
        const rectEl = element.querySelector('rect');
        if (rectEl) {
            rectEl.setAttribute('x', newLeft);
            rectEl.setAttribute('y', newTop);
            rectEl.setAttribute('width', newW);
            rectEl.setAttribute('height', newH);
        }
    };

    const onUp = async () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        await saveState(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

export function updateTextBackground() {
    ensureTextSettings();
    const { backgroundColor, backgroundAlpha, isTransparent } = state.textSettings;
    const color = isTransparent ? 'transparent' : hexToRgba(backgroundColor, backgroundAlpha);
    
    // Update selected or all active editing?
    // Usually we update the *selected* annotation (if any) or the *editing* one.
    // addTextAnnotation handles selection logic now.
    const selected = document.querySelector('.text-annotation.selected') || document.querySelector('.text-annotation[contenteditable="true"]');
    if (selected) {
        selected.style.backgroundColor = color;
        selected.dataset.bgColor = backgroundColor;
        selected.dataset.bgAlpha = backgroundAlpha;
        selected.dataset.isTransparent = isTransparent;
    }
}

export function updateTextBackgroundSettings(key, value) {
    ensureTextSettings();
    state.textSettings[key] = value;
    updateTextBackground();
}

function hexToRgba(hex, alpha) {
    if (!hex) hex = '#ffffff';
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
window.updateTextBackgroundSettings = updateTextBackgroundSettings;
