
import { state } from './state.js';
import { refreshView as renderAllPages, refreshView as renderPage } from './viewer.js';

// const PDFLib = window.PDFLib;


export function handleNoteClick(e, pageIndex, x, y) {
    // Open a prompt or modal to get note text
    // For simplicity, we can use a custom modal
    document.getElementById('note-modal-page-index').value = pageIndex;
    document.getElementById('note-modal-x').value = x;
    document.getElementById('note-modal-y').value = y;
    document.getElementById('note-text').value = '';

    const modal = new bootstrap.Modal(document.getElementById('noteModal'));
    modal.show();
}

export async function addNoteAnnotation(pageIndex, x, y, text) {
    if (!text) return;

    const page = state.pdfDoc.getPages()[pageIndex];
    const { width, height } = page.getSize();

    // "Burn" the note into the PDF
    // We'll draw a yellow rectangle and some text
    // A standard sticky note is often just a visual icon or a text box
    // Let's make it a yellow text box

    // Scale: The x,y from frontend are 0-1 relative. Convert to points.
    // PDF coordinates: origin is bottom-left. Frontend usually top-left.
    // Our click handler provides relative x,y (0-1) where y is from top.

    const pdfX = x * width;
    const pdfY = (1 - y) * height; // Invert Y

    const boxWidth = 150;
    const boxHeight = 100;

    // Draw yellow box
    page.drawRectangle({
        x: pdfX,
        y: pdfY - boxHeight,
        width: boxWidth,
        height: boxHeight,
        color: window.PDFLib.rgb(1, 1, 0.6), // Light yellow
        borderColor: window.PDFLib.rgb(0.8, 0.8, 0),
        borderWidth: 1,
    });

    // Draw Text
    // Simple text wrapping is complex in pdf-lib/standard fonts, 
    // we'll just draw it and let it clip/overflow for MVP or basic wrapping
    const font = await state.pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
    const size = 10;

    page.drawText(text, {
        x: pdfX + 5,
        y: pdfY - 15,
        size: size,
        font: font,
        color: window.PDFLib.rgb(0, 0, 0),
        maxWidth: boxWidth - 10,
        lineHeight: 12,
    });

    state.pdfBytes = await state.pdfDoc.save();

    // Re-render
    await renderPage(pageIndex + 1);

    // Add visual indicator to DOM for immediate feedback (optional, but renderPage does it via canvas)
    // Actually renderPage redraws the canvas from PDF bytes, so it should appear.
}

export async function applyNote() {
    const pageIndex = parseInt(document.getElementById('note-modal-page-index').value);
    const x = parseFloat(document.getElementById('note-modal-x').value);
    const y = parseFloat(document.getElementById('note-modal-y').value);
    const text = document.getElementById('note-text').value;

    await addNoteAnnotation(pageIndex, x, y, text);

    // Close modal
    const modalEl = document.getElementById('noteModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
}
