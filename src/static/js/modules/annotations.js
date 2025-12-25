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
    if (e.target.closest('.text-wrapper') || e.target.closest('.resize-handle')) return;

    ensureTextSettings();
    await saveState(false);

    const pageContainer = document.querySelectorAll('.page-container')[pageIndex];
    if (!pageContainer) return; // Guard

    // Position relative to page container
    const rect = pageContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'text-wrapper selected'; // Start selected
    wrapper.id = `text-annot-${Date.now()}`;

    // Minimal HTML for Wrapper + Controls
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
    `;

    // Create Text Content
    const textContent = document.createElement('div');
    textContent.className = 'text-content';
    textContent.contentEditable = true; // Start editing
    textContent.innerText = "Type here";

    // Apply Styles
    Object.assign(textContent.style, {
        fontFamily: state.textSettings?.fontFamily || 'Helvetica',
        fontSize: `${state.textSettings?.fontSize || 16}px`,
        color: state.textSettings?.color || '#000000',
        fontWeight: state.textSettings?.isBold ? 'bold' : 'normal',
        fontStyle: state.textSettings?.isItalic ? 'italic' : 'normal',
        backgroundColor: state.textSettings?.isTransparent ? 'transparent' :
            hexToRgba(state.textSettings.backgroundColor, state.textSettings.backgroundAlpha)
    });

    // Metadata for saving
    textContent.dataset.bgColor = state.textSettings.backgroundColor;
    textContent.dataset.bgAlpha = state.textSettings.backgroundAlpha;
    textContent.dataset.isTransparent = state.textSettings.isTransparent;

    wrapper.prepend(textContent);

    // Initial Position (Default Size)
    // We let auto-width happen, or set min width.
    // wrapper.style.width = 'auto'; // Logic handles resizing

    Object.assign(wrapper.style, {
        left: `${x}px`,
        top: `${y}px`,
        // Start loose, resize event handles fixed sizes later
    });

    pageContainer.appendChild(wrapper);

    // Init Interaction (Reuse Image Logic? We need to generalize it first or duplicate/adapt)
    // We will call setupTextInteraction but we need to update it to match setupImageInteraction patterns.
    // Actually, we can SHARE setupImageInteraction if we rename it to setupWrapperInteraction?
    // Let's create setupTextWrapperInteraction to be safe.
    setupTextWrapperInteraction(wrapper, pageContainer);

    // Handle Edit Mode Focus
    textContent.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textContent);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Listen for blur to cleanup empty
    textContent.addEventListener('blur', () => {
        // Don't remove wrapper immediately on blur, maybe user just clicked handle.
        // Only remove if empty text.
        if (!textContent.innerText.trim()) {
            // wrapper.remove(); // Optional: remove if empty
        }
    });

    // Ensure Text Mode stays active? Or not?
    // Often you want to click-create-click-create.
    state.modes.text = true;
    if (window.updateButtonStates) window.updateButtonStates();
}

/**
 * Text Wrapper Interaction - Matches Image Wrapper Logic
 */
function setupTextWrapperInteraction(wrapper, container) {
    // 1. Move Logic (MouseDown on wrapper)
    wrapper.addEventListener('mousedown', (e) => {
        // If clicking handle or internal text (while editing), ignore move?
        // If editing text, we want standard text selection.
        const content = wrapper.querySelector('.text-content');
        if (content && content.isContentEditable && e.target === content) {
            e.stopPropagation(); // Allow text interactions
            return;
        }

        if (e.target.closest('.resize-handle') || e.target.closest('.rotate-handle')) return;

        e.stopPropagation();
        e.preventDefault();

        // Select Logic
        document.querySelectorAll('.text-wrapper.selected').forEach(el => el.classList.remove('selected'));
        wrapper.classList.add('selected');

        startWrapperMove(e, wrapper); // Reuse existing wrapper move? It's exported? No. 
        // We need to either export startImageMove/WrapperMove or duplicate it.
        // Since they are in the same file, we can call startWrapperMove from modules/annotations.js if we keep code there.
        // YES: startWrapperMove is defined in annotations.js scope.
        // Wait, addTextAnnotation is inside annotations.js? Yes. So we can call startWrapperMove!
    });

    // Handles
    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dir = handle.dataset.dir;
            startWrapperResize(e, wrapper, dir); // Reuse
        });
    });

    // Rotation
    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startWrapperRotation(e, wrapper); // Reuse
        });
    }

    // Double Click to Edit
    wrapper.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const content = wrapper.querySelector('.text-content');
        if (content) {
            content.contentEditable = true;
            content.focus();
        }
    });
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

            // Create Image to measure natural size
            const tempImg = new Image();
            tempImg.src = e.target.result;

            tempImg.onload = function () {
                let imgWidth = tempImg.naturalWidth;
                let imgHeight = tempImg.naturalHeight;

                if (imgWidth > 200) {
                    const scale = 200 / imgWidth;
                    imgWidth *= scale;
                    imgHeight *= scale;
                }

                // Create Wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'image-wrapper selected'; // Start selected
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
                `;

                // Add Image
                tempImg.className = 'image-content';
                tempImg.style.width = '100%';
                tempImg.style.height = '100%';
                wrapper.prepend(tempImg);

                // Position Wrapper
                wrapper.style.width = `${imgWidth}px`;
                wrapper.style.height = `${imgHeight}px`;
                wrapper.style.left = `${(pageContainer.offsetWidth - imgWidth) / 2}px`;
                wrapper.style.top = `${(pageContainer.offsetHeight - imgHeight) / 2}px`;
                wrapper.style.transform = 'rotate(0deg)';

                pageContainer.appendChild(wrapper);

                // Init Interaction
                setupImageInteraction(wrapper, pageContainer);
                selectedImageWrapper = wrapper;
                saveState(false);
            };
        };
        reader.readAsDataURL(file);
    }
    input.value = '';
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

        // Images (New Wrapper Support)
        const imageWrappers = container.querySelectorAll('.image-wrapper');
        const imagePromises = Array.from(imageWrappers).map(async (wrapper) => {
            const img = wrapper.querySelector('img');
            if (!img) return;

            // Geometry from Wrapper
            let x = parseFloat(wrapper.style.left);
            let y = parseFloat(wrapper.style.top);
            let w = parseFloat(wrapper.style.width);
            let h = parseFloat(wrapper.style.height);

            // Safety
            if (isNaN(x)) x = wrapper.offsetLeft;
            if (isNaN(y)) y = wrapper.offsetTop;
            if (isNaN(w)) w = wrapper.offsetWidth;
            if (isNaN(h)) h = wrapper.offsetHeight;

            // Rotation
            const match = wrapper.style.transform.match(/rotate\(([-\d.]+)deg\)/);
            const rotationDeg = match ? parseFloat(match[1]) : 0;
            const rotationRad = rotationDeg * (Math.PI / 180);

            const imageBytes = await fetch(img.src).then(res => res.arrayBuffer());
            let pdfImage;
            try {
                if (img.src.startsWith('data:image/jpeg')) pdfImage = await pdfDoc.embedJpg(imageBytes);
                else pdfImage = await pdfDoc.embedPng(imageBytes);
            } catch (e) {
                try { pdfImage = await pdfDoc.embedPng(imageBytes); } catch (e2) { pdfImage = await pdfDoc.embedJpg(imageBytes); }
            }

            if (pdfImage) {
                // DOM (Top-Left) -> PDF (Bottom-Left)
                // DOM Center: cx = x + w/2, cy = y + h/2
                // PDF Y is inverted: y_pdf = height - y_dom
                // So PDF Center: Cx = x + w/2, Cy = height - (y + h/2)

                const Cx = x + w / 2;
                const Cy = height - (y + h / 2);

                // PDF-Lib draws at (drawX, drawY) and rotates around (drawX, drawY).
                // We want the resulting center to be (Cx, Cy).
                // Local center relative to drawX, drawY is (w/2, h/2).
                // Rotated local center:
                // C_rel_x = (w/2)*cos(R) - (h/2)*sin(R)
                // C_rel_y = (w/2)*sin(R) + (h/2)*cos(R)
                // So: Cx = drawX + C_rel_x  =>  drawX = Cx - C_rel_x
                //     Cy = drawY + C_rel_y  =>  drawY = Cy - C_rel_y

                const cRelX = (w / 2) * Math.cos(rotationRad) - (h / 2) * Math.sin(rotationRad);
                const cRelY = (w / 2) * Math.sin(rotationRad) + (h / 2) * Math.cos(rotationRad);

                const drawX = Cx - cRelX;
                const drawY = Cy - cRelY;

                page.drawImage(pdfImage, {
                    x: drawX,
                    y: drawY,
                    width: w,
                    height: h,
                    rotate: PDFLib.degrees(rotationDeg)
                });
            }
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

        // Text Annotations (Wrapper-based)
        const textWrappers = container.querySelectorAll('.text-wrapper');
        const textPromises = Array.from(textWrappers).map(async (wrapper) => {
            const content = wrapper.querySelector('.text-content');
            if (!content) return;
            const text = content.innerText;
            if (!text.trim()) return;

            // Geometry
            let x = parseFloat(wrapper.style.left);
            let y = parseFloat(wrapper.style.top);
            let w = parseFloat(wrapper.style.width); // Can be 'auto' or unset yet
            if (isNaN(w)) w = wrapper.offsetWidth;

            // Safety
            if (isNaN(x)) x = wrapper.offsetLeft;
            if (isNaN(y)) y = wrapper.offsetTop;

            // Styles
            const fontSize = parseFloat(content.style.fontSize);
            const r = parseInt(getComputedStyle(content).color.slice(4, -1).split(',')[0]) / 255;
            const g = parseInt(getComputedStyle(content).color.slice(4, -1).split(',')[1]) / 255;
            const b = parseInt(getComputedStyle(content).color.slice(4, -1).split(',')[2]) / 255;

            // Rotation
            const match = wrapper.style.transform.match(/rotate\(([-\d.]+)deg\)/);
            const rotationDeg = match ? parseFloat(match[1]) : 0;

            // Background
            const bgColorHex = content.dataset.bgColor;
            const bgAlpha = parseFloat(content.dataset.bgAlpha || '1.0');
            const isTransparent = content.dataset.isTransparent === 'true';

            // Draw Background Rect (if not transparent)
            if (!isTransparent && bgColorHex) {
                const bgR = parseInt(bgColorHex.slice(1, 3), 16) / 255;
                const bgG = parseInt(bgColorHex.slice(3, 5), 16) / 255;
                const bgB = parseInt(bgColorHex.slice(5, 7), 16) / 255;

                // We need Height for rect background. wrapper.offsetHeight includes padding.
                const h = wrapper.offsetHeight;

                // Rect Position - Bottom Left for PDF
                // Logic similar to image: Center rotation logic or just simple if no rotation?
                // The text is drawn at x,y. The rect should be drawn at x,y.
                // For rotated text, we treat it as an object.

                const pX = x;
                const pY = height - y - h; // PDF Y is bottom-up
                // Wait, for rotated text, `drawText` handles rotation around origin? No, update to `drawText`.
                // PDF-Lib drawText `rotate` parameter rotates around the text origin (bottom-left of text baseline usually).
                // Our wrapper rotation is around center.
                // This is complex for text.
                // Simplification: For now, draw text at top-left position (x,y) unrotated.
                // If rotation is needed, we must adjust coordinates.
                // Let's implement basic text drawing first.

                /*
                page.drawRectangle({
                   x: pX, y: pY, width: w, height: h,
                   color: PDFLib.rgb(bgR, bgG, bgB),
                   opacity: bgAlpha,
                   rotate: PDFLib.degrees(rotationDeg) // Creates sync issue if centers differ
                });
                */
            }

            // Draw Text
            // Adjust Y for PDF-Lib (drawText y is baseline? or bottom-left?)
            // Usually bottom-left of the first line.
            // DOM Y is top-left.
            // PDF Y = height - y - fontSize (approx).
            // A more accurate way: PDF Y = height - y - heightOfText

            const pY = height - y; // - approx height?

            // Note: PDF-Lib standard font does not support unicode properly sometimes. 
            // We use standard 'Helvetica' here which is limited.
            // Custom fonts require embedding.

            page.drawText(text, {
                x: x + 5, // Padding
                y: height - y - fontSize - 5, // Approximate alignment
                size: fontSize,
                font: font,
                color: PDFLib.rgb(r, g, b),
                rotate: PDFLib.degrees(rotationDeg),
            });
        });
        await Promise.all(textPromises);




    }

    // Remove existing annotations including text
    document.querySelectorAll('.text-annotation, .annotation-rect, .image-annotation, .image-wrapper, .drawing-annotation, .shape-annotation, .watermark-annotation').forEach(el => el.remove());
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

        img.style.width = `${imgWidth}px`;
        img.style.height = `${imgHeight}px`;
        img.style.left = `${(pageContainer.offsetWidth - imgWidth) / 2}px`;
        img.style.top = `${(pageContainer.offsetHeight - imgHeight) / 2}px`;
        img.style.position = 'absolute';

        makeDraggable(img);
        pageContainer.appendChild(img);
    };
}

/* ==========================================================================
   IMAGE ANNOTATION SYSTEM (Robust Wrapper-Based)
   ========================================================================== */

let selectedImageWrapper = null;
let activeWrapperOperation = null; // 'move', 'resize', 'rotate'

// Deselect on outside click
document.addEventListener('mousedown', (e) => {
    if (activeWrapperOperation) return;
    if (e.target.closest('.image-wrapper') || e.target.closest('.text-wrapper') || e.target.closest('.resize-handle') || e.target.closest('.rotate-handle')) return;

    // Deselect Image
    deselectAllImages();

    // Deselect Text
    document.querySelectorAll('.text-wrapper.selected').forEach(el => el.classList.remove('selected'));
});

// Global mouseup handler (must be called from main to setup, or exported)
function deselectAllImages() {
    document.querySelectorAll('.image-wrapper.selected').forEach(el => el.classList.remove('selected'));
    selectedImageWrapper = null;
}

/**
 * Attaches interaction listeners to the wrapper
 */
function setupImageInteraction(wrapper, container) {

    // 1. Move Logic (MouseDown on the wrapper body)
    wrapper.addEventListener('mousedown', (e) => {
        // If clicking a handle, don't trigger move
        if (e.target.closest('.resize-handle') || e.target.closest('.rotate-handle')) return;

        e.stopPropagation(); // Don't trigger page drag
        e.preventDefault();  // Don't trigger image drag

        // Select this one
        if (selectedImageWrapper !== wrapper) {
            deselectAllImages();
            wrapper.classList.add('selected');
            selectedImageWrapper = wrapper;
        }

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

    // 3. Rotation Handle
    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startWrapperRotation(e, wrapper);
        });
    }
}

/* --- Move --- */
function startWrapperMove(e, wrapper) {
    activeWrapperOperation = 'move';
    const startX = e.clientX;
    const startY = e.clientY;

    // Use offset for safer "current pos" reading than style
    let startLeft = wrapper.offsetLeft;
    let startTop = wrapper.offsetTop;

    const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        wrapper.style.left = `${startLeft + dx}px`;
        wrapper.style.top = `${startTop + dy}px`;
    };

    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        activeWrapperOperation = null;
        saveState(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

/* --- Resize (Vector-based with Rotation support) --- */
function startWrapperResize(e, wrapper, dir) {
    activeWrapperOperation = 'resize';

    const startRect = {
        left: wrapper.offsetLeft,
        top: wrapper.offsetTop,
        width: wrapper.offsetWidth,
        height: wrapper.offsetHeight
    };

    // Rotation Angle
    const match = wrapper.style.transform.match(/rotate\(([-\d.]+)deg\)/);
    const angleDeg = match ? parseFloat(match[1]) : 0;
    const angleRad = angleDeg * (Math.PI / 180);

    // Center
    const cx = startRect.left + startRect.width / 2;
    const cy = startRect.top + startRect.height / 2;

    // Helper: Handle Coordinates (0 to 1)
    const handleMap = {
        'nw': [0, 0], 'n': [0.5, 0], 'ne': [1, 0],
        'w': [0, 0.5], 'e': [1, 0.5],
        'sw': [0, 1], 's': [0.5, 1], 'se': [1, 1]
    };
    const [hx, hy] = handleMap[dir];

    // Anchor Point (Opposite side)
    const ax = 1 - hx;
    const ay = 1 - hy;

    // Calculate global anchor point
    // Local Anchor:
    const localAnchorX = startRect.left + startRect.width * ax;
    const localAnchorY = startRect.top + startRect.height * ay;

    // Rotate Local Anchor around Center
    // rotPoint = C + rotate(P - C)
    const anchorGlobal = rotatePoint(localAnchorX, localAnchorY, cx, cy, angleRad);

    const onMove = (ev) => {
        ev.preventDefault();

        // Mouse in Global
        const mx = ev.clientX; // This is screen relative? No, clientX/Y.
        // We need coordinates relative to the page-container!
        // The wrapper left/top are relative to page-container.
        const container = wrapper.parentElement;
        const cRect = container.getBoundingClientRect();

        const mouseX = ev.clientX - cRect.left; // Relative to container
        const mouseY = ev.clientY - cRect.top;

        // Vector from Global Anchor to Mouse
        const dx = mouseX - anchorGlobal.x;
        const dy = mouseY - anchorGlobal.y;

        // Rotate this vector BACK by (-angle) to align with element axes
        // local = rotate(global, -angle)
        const localDx = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
        const localDy = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);

        let newW = startRect.width;
        let newH = startRect.height;

        // Calculate new dimensions based on handle direction
        // If handle is on the right (hx=1), width grows by localDx.
        // If handle is on the left (hx=0), width grows by -localDx.

        if (dir.includes('e') || dir.includes('w')) {
            newW = localDx * (hx === 0 ? -1 : 1);
        }
        if (dir.includes('n') || dir.includes('s')) {
            newH = localDy * (hy === 0 ? -1 : 1);
        }

        // Min Size
        newW = Math.max(20, newW);
        newH = Math.max(20, newH);

        // Aspect Ratio Lock (Shift Key)
        if (ev.shiftKey && dir.length === 2) {
            const ratio = startRect.width / startRect.height;
            if (newW / newH > ratio) newH = newW / ratio;
            else newW = newH * ratio;
        }

        // Calculate New Center
        // The anchor point (ax, ay) stays fixed.
        // The new center moves relative to the anchor point.
        // Center is always at (0.5, 0.5) relative to the box.
        // Vector from Anchor(ax, ay) to Center(0.5, 0.5) is now scaled to new dimensions.
        const vecToCenterX = (0.5 - ax) * newW;
        const vecToCenterY = (0.5 - ay) * newH;

        // Rotate this vector forward by (angle)
        const rotVecX = vecToCenterX * Math.cos(angleRad) - vecToCenterY * Math.sin(angleRad);
        const rotVecY = vecToCenterX * Math.sin(angleRad) + vecToCenterY * Math.cos(angleRad);

        const newCx = anchorGlobal.x + rotVecX;
        const newCy = anchorGlobal.y + rotVecY;

        // Final Top/Left
        const newLeft = newCx - newW / 2;
        const newTop = newCy - newH / 2;

        wrapper.style.width = `${newW}px`;
        wrapper.style.height = `${newH}px`;
        wrapper.style.left = `${newLeft}px`;
        wrapper.style.top = `${newTop}px`;
    };

    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        activeWrapperOperation = null;
        saveState(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

/* --- Rotation --- */
function startWrapperRotation(e, wrapper) {
    activeWrapperOperation = 'rotate';
    e.stopPropagation();

    const container = wrapper.parentElement;
    const cRect = container.getBoundingClientRect();

    // Center of wrapper relative to container
    const cx = wrapper.offsetLeft + wrapper.offsetWidth / 2;
    const cy = wrapper.offsetTop + wrapper.offsetHeight / 2;

    const getAngle = (ev) => {
        const mx = ev.clientX - cRect.left;
        const my = ev.clientY - cRect.top;
        return Math.atan2(my - cy, mx - cx);
    };

    const startMouseAngle = getAngle(e);
    const match = wrapper.style.transform.match(/rotate\(([-\d.]+)deg\)/);
    const startImgAngle = match ? parseFloat(match[1]) : 0;
    const startImgRad = startImgAngle * (Math.PI / 180);

    const onMove = (ev) => {
        const currMouseAngle = getAngle(ev);
        const delta = currMouseAngle - startMouseAngle;
        const newRad = startImgRad + delta;
        const newDeg = newRad * (180 / Math.PI);

        // Snap to 15 deg if shift
        const finalDeg = ev.shiftKey ? Math.round(newDeg / 15) * 15 : newDeg;
        wrapper.style.transform = `rotate(${finalDeg}deg)`;
    };

    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        activeWrapperOperation = null;
        saveState(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}


/* Helper */
function rotatePoint(x, y, cx, cy, angleRad) {
    const dx = x - cx;
    const dy = y - cy;
    return {
        x: cx + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: cy + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
    };
}

// Global Exports?
// selectImage is replaced by internal logic, but if external modules call it...
// We can alias it or just ignore. The Ribon creates images which calls handleImageUpload which handles selection.
// If Ribbon has a 'Select' tool, it just sets mode.
// We should ensure selectImage doesn't break things if called.
window.selectImage = function (img) { /* Deprecated/No-op */ };

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
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
window.updateTextBackgroundSettings = updateTextBackgroundSettings;
