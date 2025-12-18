
import { state } from './state.js';
import { saveState } from './history.js';
import { refreshView } from './viewer.js';
import { closePageExtractionModal } from './ui.js';

let pageToDelete = -1;

export async function rotatePage(pageIndex) {
    await saveState();
    const page = state.pdfDoc.getPage(pageIndex);
    const rotation = page.getRotation();
    page.setRotation(PDFLib.degrees((rotation.angle + 90) % 360));
    await refreshView();
}

export async function rotateCurrentPage() {
    await rotatePage(state.selectedPageIndex);
}

export function deletePage(pageIndex) {
    if (state.pdfDoc.getPageCount() <= 1) {
        showToast("Cannot delete the last page.", "warning");
        return;
    }
    pageToDelete = pageIndex;
    new bootstrap.Modal(document.getElementById('deleteConfirmModal')).show();
}

export async function confirmDeletePage() {
    const modalEl = document.getElementById('deleteConfirmModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();

    if (pageToDelete === -1) return;

    await saveState();
    state.pdfDoc.removePage(pageToDelete);

    if (state.selectedPageIndex >= state.pdfDoc.getPageCount()) {
        state.selectedPageIndex = state.pdfDoc.getPageCount() - 1;
    }
    await refreshView();
    pageToDelete = -1;
}

export async function deleteCurrentPage() {
    deletePage(state.selectedPageIndex);
}

export async function movePage(pageIndex, direction) {
    const newIndex = pageIndex + direction;
    if (newIndex < 0 || newIndex >= state.pdfDoc.getPageCount()) return;

    await saveState();

    // Copy, remove, insert
    const [page] = await state.pdfDoc.copyPages(state.pdfDoc, [pageIndex]);
    state.pdfDoc.removePage(pageIndex);
    state.pdfDoc.insertPage(newIndex, page);

    await refreshView();
}

export async function movePageUp() {
    if (state.selectedPageIndex <= 0) return;
    const pageCount = state.pdfDoc.getPageCount();
    const newOrder = [];
    for (let i = 0; i < pageCount; i++) newOrder.push(i);

    // Swap
    [newOrder[state.selectedPageIndex], newOrder[state.selectedPageIndex - 1]] = [newOrder[state.selectedPageIndex - 1], newOrder[state.selectedPageIndex]];

    await saveState();
    await reorderPages(newOrder);
    state.selectedPageIndex--;
    await refreshView();
}

export async function movePageDown() {
    if (state.selectedPageIndex >= state.pdfDoc.getPageCount() - 1) return;
    const pageCount = state.pdfDoc.getPageCount();
    const newOrder = [];
    for (let i = 0; i < pageCount; i++) newOrder.push(i);

    [newOrder[state.selectedPageIndex], newOrder[state.selectedPageIndex + 1]] = [newOrder[state.selectedPageIndex + 1], newOrder[state.selectedPageIndex]];

    await saveState();
    await reorderPages(newOrder);
    state.selectedPageIndex++;
    await refreshView();
}

async function reorderPages(newOrder) {
    const newPdf = await PDFLib.PDFDocument.create();
    const copiedPages = await newPdf.copyPages(state.pdfDoc, newOrder);
    copiedPages.forEach(page => newPdf.addPage(page));
    state.pdfDoc = newPdf;
}

export function extractSinglePage(pageIndex) {
    state.pageToExtractIndex = pageIndex;
    document.getElementById('extract-page-number').innerText = pageIndex + 1;
    document.getElementById('page-extraction-modal').style.display = 'block';
}

export async function saveSinglePagePdf() {
    try {
        const newPdf = await PDFLib.PDFDocument.create();
        const [page] = await newPdf.copyPages(state.pdfDoc, [state.pageToExtractIndex]);
        newPdf.addPage(page);
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });

        let baseName = state.filename || "document.pdf";
        if (baseName.toLowerCase().endsWith('.pdf')) baseName = baseName.slice(0, -4);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}-page${state.pageToExtractIndex + 1}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        closePageExtractionModal();
    } catch (e) {
        handleApiError(e, "Error saving PDF page");
    }
}

export async function shardPdf() {
    if (!confirm("This will split the PDF into individual pages and download them as a ZIP file. Continue?")) return;
    document.getElementById('processing-overlay').style.display = 'flex';
    try {
        const zip = new JSZip();
        const pageCount = state.pdfDoc.getPageCount();
        let baseName = state.filename;
        if (baseName.toLowerCase().endsWith('.pdf')) baseName = baseName.slice(0, -4);

        for (let i = 0; i < pageCount; i++) {
            const newPdf = await PDFLib.PDFDocument.create();
            const [page] = await newPdf.copyPages(state.pdfDoc, [i]);
            newPdf.addPage(page);
            const pdfBytes = await newPdf.save();
            zip.file(`${baseName}-page${i + 1}.pdf`, pdfBytes);
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}-sharded.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast("PDF split successfully!", "success");
    } catch (e) {
        handleApiError(e, "Error splitting PDF");
    } finally {
        document.getElementById('processing-overlay').style.display = 'none';
    }
}

export async function handleAppendPdf(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const arrayBuffer = await file.arrayBuffer();

        try {
            await saveState();
            const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
            const copiedPages = await state.pdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());
            copiedPages.forEach((page) => state.pdfDoc.addPage(page));

            await refreshView();
            showToast(`Appended ${copiedPages.length} pages.`, "success");
        } catch (err) {
            handleApiError(err, "Error appending PDF");
        }
    }
    input.value = '';
}

export function openPageNumbersModal() {
    new bootstrap.Modal(document.getElementById('pageNumbersModal')).show();
}

export async function applyPageNumbers() {
    const format = document.getElementById('pn-format').value;
    const position = document.getElementById('pn-position').value;
    const startNum = parseInt(document.getElementById('pn-start').value || '1');
    const fontSize = parseInt(document.getElementById('pn-size').value || '12');

    await saveState(); // Save before modifying

    const pages = state.pdfDoc.getPages();
    const font = await state.pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const total = pages.length;

    pages.forEach((page, index) => {
        const { width, height } = page.getSize();
        const num = startNum + index;
        let text = "";

        if (format === "Page X of Y") text = `Page ${num} of ${total}`;
        else if (format === "Page X") text = `Page ${num}`;
        else if (format === "X of Y") text = `${num} of ${total}`;
        else if (format === "X") text = `${num}`;

        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        let x, y;
        const margin = 20;

        if (position.includes('bottom')) y = margin;
        else y = height - margin - textHeight;

        if (position.includes('left')) x = margin;
        else if (position.includes('right')) x = width - margin - textWidth;
        else x = (width - textWidth) / 2; // center

        page.drawText(text, {
            x: x,
            y: y,
            size: fontSize,
            font: font,
            color: PDFLib.rgb(0, 0, 0),
        });
    });

    bootstrap.Modal.getInstance(document.getElementById('pageNumbersModal')).hide();
    await refreshView();
    showToast("Page numbers added successfully", "success");
}
