
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

    // Remove existing annotations including text
    document.querySelectorAll('.text-annotation, .annotation-rect, .image-annotation, .image-wrapper, .drawing-annotation, .shape-annotation, .watermark-annotation, .text-wrapper, .form-field-wrapper').forEach(el => el.remove());
}
