
import { state } from './state.js';

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

        // Highlights (Refactored)
        container.querySelectorAll('.highlight-annotation').forEach(svg => {
            const path = svg.querySelector('path');
            if (!path) return;

            const d = path.getAttribute('d');
            const strokeColor = path.getAttribute('stroke') || '#ffeb3b';
            const strokeWidth = parseFloat(path.getAttribute('stroke-width')) || 20;
            const strokeOpacity = parseFloat(path.getAttribute('stroke-opacity')) || 0.4;

            // Parse color
            let r = 1, g = 0.92, b = 0.23; // Yellow default
            if (strokeColor.startsWith('#')) {
                r = parseInt(strokeColor.substr(1, 2), 16) / 255;
                g = parseInt(strokeColor.substr(3, 2), 16) / 255;
                b = parseInt(strokeColor.substr(5, 2), 16) / 255;
            } else if (strokeColor.startsWith('rgb')) {
                const parts = strokeColor.match(/\d+/g);
                if (parts) {
                    r = parseInt(parts[0]) / 255;
                    g = parseInt(parts[1]) / 255;
                    b = parseInt(parts[2]) / 255;
                }
            }

            // Convert path coordinates
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
                borderColor: PDFLib.rgb(r, g, b),
                borderWidth: strokeWidth,
                borderOpacity: strokeOpacity,
                borderLineCap: PDFLib.LineCapStyle.Round
            });
        });

        // Shapes (Wrapper-based)
        const shapeWrappers = container.querySelectorAll('.shape-wrapper');
        shapeWrappers.forEach(wrapper => {
            const type = wrapper.dataset.type;
            const svgElement = wrapper.querySelector('.shape-content rect, .shape-content ellipse, .shape-content line, .shape-content g');

            // Geometry from Wrapper
            let x = parseFloat(wrapper.style.left);
            let y = parseFloat(wrapper.style.top);
            let w = parseFloat(wrapper.style.width);
            let h = parseFloat(wrapper.style.height);

            // Rotation
            const match = wrapper.style.transform.match(/rotate\(([-\d.]+)deg\)/);
            const rotationDeg = match ? parseFloat(match[1]) : 0;
            // PDF-Lib rotation logic?
            // If shape is rotated, we must draw it rotated around its center.
            // Center in PDF coords:
            const cx = x + w / 2;
            const cy = height - (y + h / 2);

            // Styles from SVG element
            // Note: We used to store stroke in dataset, but wrapper.dataset.strokeColor is also valid
            // Let's rely on wrapper dataset which we update on change
            let strokeColor = wrapper.dataset.strokeColor || '#ff0000';
            const strokeWidth = parseInt(wrapper.dataset.strokeWidth || '2');

            // Parse color
            const r = parseInt(strokeColor.substr(1, 2), 16) / 255;
            const g = parseInt(strokeColor.substr(3, 2), 16) / 255;
            const b = parseInt(strokeColor.substr(5, 2), 16) / 255;
            const color = PDFLib.rgb(r, g, b);

            // Shape Specifics
            if (type === 'rect') {
                page.drawRectangle({
                    x, y: height - y - h, width: w, height: h,
                    borderColor: color, borderWidth: strokeWidth, color: undefined,
                    rotate: PDFLib.degrees(rotationDeg),
                    xSkew: PDFLib.degrees(0), ySkew: PDFLib.degrees(0) // No skew
                    // Note: drawRectangle rotation is around center by default? No, around anchor (bottom-left).
                    // PDF-Lib docs say: 'rotate' option rotates around the center of the rectangle?
                    // "The rotation is performed around the center of the rectangle." -> YES
                    // So we just pass x,y (bottom-left) and rotate.
                });
            } else if (type === 'ellipse') {
                page.drawEllipse({
                    x: cx, y: height - (y + h / 2), // Center
                    xScale: w / 2, yScale: h / 2,
                    borderColor: color, borderWidth: strokeWidth, color: undefined,
                    rotate: PDFLib.degrees(rotationDeg)
                });
            } else if (type === 'line') {
                // Line cannot be easily rotated with a param in drawLine?
                // drawLine does NOT support 'rotate'.
                // We must calculate endpoints manually if rotated.

                // wrapper x,y is bounding box.
                // internal line coords: x1, y1, x2, y2 relative to wrapper?
                // we stored normalized 0->100% or similar in wrapper.
                // Let's re-calculate logic.

                const lineEl = wrapper.querySelector('line');
                // Read current attributes (they might be % or px)
                // If they are % we need to convert to px relative to w,h

                let lx1 = lineEl.getAttribute('x1');
                let ly1 = lineEl.getAttribute('y1');
                let lx2 = lineEl.getAttribute('x2');
                let ly2 = lineEl.getAttribute('y2');

                // Convert % to px
                const parseCoord = (val, max) => val.endsWith('%') ? (parseFloat(val) / 100) * max : parseFloat(val);

                let px1 = parseCoord(lx1, w);
                let py1 = parseCoord(ly1, h);
                let px2 = parseCoord(lx2, w);
                let py2 = parseCoord(ly2, h);

                // Rotated Points
                // Center of wrapper (0,0 relative) is w/2, h/2
                // Rotate (px, py) around (w/2, h/2) by rotationDeg
                const rad = rotationDeg * (Math.PI / 180);
                const rot = (x_loc, y_loc) => {
                    const cx_loc = w / 2;
                    const cy_loc = h / 2;
                    // Translate to center
                    const tx = x_loc - cx_loc;
                    const ty = y_loc - cy_loc;
                    // Rotate
                    const rx = tx * Math.cos(rad) - ty * Math.sin(rad);
                    const ry = tx * Math.sin(rad) + ty * Math.cos(rad);
                    // Translate back + global offset
                    return {
                        x: x + cx_loc + rx,
                        y: y + cy_loc + ry
                    };
                };

                const p1 = rot(px1, py1);
                const p2 = rot(px2, py2);

                page.drawLine({
                    start: { x: p1.x, y: height - p1.y },
                    end: { x: p2.x, y: height - p2.y },
                    thickness: strokeWidth, color
                });

            } else if (type === 'arrow') {
                // Arrow logic similar to line - need to rotate 2 lines + head
                // We don't have easy access to the internal arrow HEAD geometry since we might have just scaled it.
                // But wait, our Arrow SVG has: Line + Path (Head)
                // We can traverse them and rotate points.
                // OR simplify: Just draw a line and re-calculate head like before?
                // Since we support rotation now, the head orientation matters.

                // Same logic as line for the main shaft:
                const lineEl = wrapper.querySelector('line');
                let lx1 = lineEl.getAttribute('x1');
                let ly1 = lineEl.getAttribute('y1');
                let lx2 = lineEl.getAttribute('x2');
                let ly2 = lineEl.getAttribute('y2');

                const parseCoord = (val, max) => val.endsWith('%') ? (parseFloat(val) / 100) * max : parseFloat(val);
                let px1 = parseCoord(lx1, w);
                let py1 = parseCoord(ly1, h);
                let px2 = parseCoord(lx2, w);
                let py2 = parseCoord(ly2, h);

                const rad = rotationDeg * (Math.PI / 180);
                const rot = (x_loc, y_loc) => {
                    const cx_loc = w / 2;
                    const cy_loc = h / 2;
                    const tx = x_loc - cx_loc;
                    const ty = y_loc - cy_loc;
                    const rx = tx * Math.cos(rad) - ty * Math.sin(rad);
                    const ry = tx * Math.sin(rad) + ty * Math.cos(rad);
                    return { x: x + cx_loc + rx, y: y + cy_loc + ry };
                };

                const start = rot(px1, py1);
                const end = rot(px2, py2);

                // Draw Shaft
                page.drawLine({
                    start: { x: start.x, y: height - start.y },
                    end: { x: end.x, y: height - end.y },
                    thickness: strokeWidth, color
                });

                // Draw Head
                // Calculate angle of the *rotated* line
                const dx = end.x - start.x;
                const dy = end.y - start.y; // Screen coords (y down)
                const angle = Math.atan2(dy, dx);
                // Note: PDF y is up, but our math for head points is in screen coords then converted

                const headLen = 15;
                const headAngle = Math.PI / 6;

                const h1x = end.x - headLen * Math.cos(angle - headAngle);
                const h1y = end.y - headLen * Math.sin(angle - headAngle);
                const h2x = end.x - headLen * Math.cos(angle + headAngle);
                const h2y = end.y - headLen * Math.sin(angle + headAngle);

                page.drawLine({
                    start: { x: end.x, y: height - end.y },
                    end: { x: h1x, y: height - h1y },
                    thickness: strokeWidth, color
                });

                page.drawLine({
                    start: { x: end.x, y: height - end.y },
                    end: { x: h2x, y: height - h2y },
                    thickness: strokeWidth, color
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
            }

            // Draw Text
            // Adjust Y for PDF-Lib
            const pY = height - y;

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


        // Form Fields (New)
        const formWrappers = container.querySelectorAll('.form-field-wrapper');
        if (formWrappers.length > 0) {
            const form = pdfDoc.getForm();
            for (const wrapper of formWrappers) {
                const type = wrapper.dataset.type;

                // Geometry
                let x = parseFloat(wrapper.style.left);
                let y = parseFloat(wrapper.style.top);
                let w = parseFloat(wrapper.style.width);
                let h = parseFloat(wrapper.style.height);

                if (isNaN(x)) x = wrapper.offsetLeft;
                if (isNaN(y)) y = wrapper.offsetTop;
                if (isNaN(w)) w = wrapper.offsetWidth;
                if (isNaN(h)) h = wrapper.offsetHeight;

                // PDF Coordinates
                const pdfX = x;
                const pdfY = height - y - h;

                // Styles
                const fontSize = parseInt(wrapper.dataset.fontSize || '12');
                const textColorHex = wrapper.dataset.textColor || '#000000';
                const bgColorHex = wrapper.dataset.bgColor || '#ffffff';
                const borderColorHex = wrapper.dataset.borderColor || '#000000';

                // Construct styles
                const r = parseInt(textColorHex.substr(1, 2), 16) / 255;
                const g = parseInt(textColorHex.substr(3, 2), 16) / 255;
                const b = parseInt(textColorHex.substr(5, 2), 16) / 255;
                const textColor = PDFLib.rgb(r, g, b);

                const bgR = parseInt(bgColorHex.substr(1, 2), 16) / 255;
                const bgG = parseInt(bgColorHex.substr(3, 2), 16) / 255;
                const bgB = parseInt(bgColorHex.substr(5, 2), 16) / 255;
                const backgroundColor = PDFLib.rgb(bgR, bgG, bgB);

                const borderR = parseInt(borderColorHex.substr(1, 2), 16) / 255;
                const borderG = parseInt(borderColorHex.substr(3, 2), 16) / 255;
                const borderB = parseInt(borderColorHex.substr(5, 2), 16) / 255;
                const borderColor = PDFLib.rgb(borderR, borderG, borderB);

                try {
                    if (type === 'textfield') {
                        const field = form.createTextField(`textfield_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
                        field.addToPage(page, {
                            x: pdfX, y: pdfY, width: w, height: h,
                            textColor, backgroundColor, borderColor, borderWidth: 1
                        });
                        field.setFontSize(fontSize);
                    }
                    else if (type === 'checkbox') {
                        const field = form.createCheckBox(`checkbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
                        field.addToPage(page, {
                            x: pdfX, y: pdfY, width: w, height: h,
                            textColor, backgroundColor, borderColor, borderWidth: 1
                        });
                    }
                    else if (type === 'radio') {
                        const groupName = `radio_group_${Date.now()}`;
                        const field = form.createRadioGroup(groupName);
                        field.addOptionToPage(`option_${Math.random().toString(36).substr(2, 5)}`, page, {
                            x: pdfX, y: pdfY, width: w, height: h,
                            textColor, backgroundColor, borderColor, borderWidth: 1
                        });
                    }
                    else if (type === 'dropdown') {
                        const field = form.createDropdown(`dropdown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
                        field.addToPage(page, {
                            x: pdfX, y: pdfY, width: w, height: h,
                            textColor, backgroundColor, borderColor, borderWidth: 1
                        });
                        field.setOptions(['Option 1', 'Option 2', 'Option 3']);
                        field.setFontSize(fontSize);
                    }
                    else if (type === 'signature') {
                        const field = form.createTextField(`sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
                        field.addToPage(page, {
                            x: pdfX, y: pdfY, width: w, height: h,
                            textColor, backgroundColor: PDFLib.rgb(0.9, 0.9, 0.9), borderColor, borderWidth: 1
                        });
                    }
                } catch (e) {
                    console.error("Error creating form field", e);
                }
            }
        }

    }

    // Remove existing annotations including text (EXCLUDING note-annotation)
    document.querySelectorAll('.text-annotation, .annotation-rect, .image-annotation, .image-wrapper, .drawing-annotation, .highlight-annotation, .shape-annotation, .shape-wrapper, .watermark-annotation, .text-wrapper, .form-field-wrapper').forEach(el => el.remove());
}
