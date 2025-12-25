import { state } from './state.js';
import { requestPassword } from './ui.js';
import { initDrawListeners, addTextAnnotation, addFormField } from './annotations.js';
import { rotatePage, movePage, deletePage, extractSinglePage } from './pages.js';
import { updateActiveThumbnail } from './ui.js';

// const PDFLib = window.PDFLib;
// const pdfjsLib = window.pdfjsLib;

let pageObserver = null;


// Redefining proper export to replace logic
export async function zoomIn() {
    state.zoom = Math.min(state.zoom * 1.25, 3.0);
    await refreshView();
}

export async function zoomOut() {
    state.zoom = Math.max(state.zoom * 0.8, 0.5);
    await refreshView();
}

export async function loadPdf(bytes, password = null) {
    try {
        const options = password ? { password } : {};
        console.log("Loading PDF with password:", password ? "***" : "null");
        state.pdfDoc = await window.PDFLib.PDFDocument.load(bytes, options);
    } catch (e) {
        console.log("Load failed:", e.message);
        if (e.message && (e.message.toLowerCase().includes('encrypted') || e.message.toLowerCase().includes('password'))) {
            const pass = await requestPassword("Password required.");
            // Recursively try with new password
            return await loadPdf(bytes, pass);
        }
        console.error("PDF Load Error:", e);
        throw e;
    }

    // Now handle PDF.js for rendering, which also needs password
    await renderPdf(bytes, password);
    await renderThumbnails(bytes, password);
}

export async function renderPdf(bytes, password = null) {
    const container = document.getElementById('pdf-viewer');
    container.innerHTML = '';

    if (pageObserver) pageObserver.disconnect();

    // Clone data to avoid 'detached ArrayBuffer' issues if worker transfers it
    // new Uint8Array(bytes) creates a view if bytes is ArrayBuffer, so we use slice() to copy.
    const dataCopy = new Uint8Array(bytes).slice();

    // PDF.js handling with password
    const params = { data: dataCopy };
    if (password) params.password = password;

    const loadingTask = window.pdfjsLib.getDocument(params);

    loadingTask.onPassword = async (updatePassword, reason) => {
        // This callback is called if pdf.js needs a password
        // reason: 1 (NEED_PASSWORD), 2 (INCORRECT_PASSWORD)
        const msg = reason === 2 ? "Incorrect password." : "Password required.";
        const pass = await requestPassword(msg);
        updatePassword(pass);
    };

    state.pdfJsDoc = await loadingTask.promise;

    pageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageContainer = entry.target;
                const pageIndex = parseInt(pageContainer.dataset.pageIndex);
                if (pageContainer.dataset.loaded !== 'true') {
                    renderPageContent(pageContainer, pageIndex);
                }
            }
        });
    }, { root: null, rootMargin: '200px', threshold: 0.1 });

    for (let i = 1; i <= state.pdfJsDoc.numPages; i++) {
        const page = await state.pdfJsDoc.getPage(i);
        const viewport = page.getViewport({ scale: state.zoom });

        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';
        Object.assign(pageContainer.style, {
            width: `${viewport.width}px`, height: `${viewport.height}px`,
            position: 'relative', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            backgroundColor: '#f8f9fa'
        });
        pageContainer.dataset.pageIndex = i - 1;
        pageContainer.dataset.loaded = 'false';

        pageContainer.onclick = (e) => handlePageClick(e, i - 1);

        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'd-flex justify-content-center align-items-center h-100 text-muted';
        loadingIndicator.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div> Loading...';
        pageContainer.appendChild(loadingIndicator);

        addPageControls(pageContainer, i, state.pdfJsDoc.numPages);

        container.appendChild(pageContainer);
        pageObserver.observe(pageContainer);
    }
}

async function renderPageContent(pageContainer, pageIndex) {
    if (pageContainer.dataset.loaded === 'true') return;
    try {
        const page = await state.pdfJsDoc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: state.zoom });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        pageContainer.innerHTML = '';
        addPageControls(pageContainer, pageIndex + 1, state.pdfJsDoc.numPages);
        pageContainer.appendChild(canvas);

        await page.render({ canvasContext: ctx, viewport }).promise;

        // Render Annotation Layer (Forms, Links)
        const annotations = await page.getAnnotations();
        if (annotations.length > 0) {
            const annotationLayerDiv = document.createElement('div');
            annotationLayerDiv.className = 'annotationLayer';
            Object.assign(annotationLayerDiv.style, {
                left: '0', top: '0',
                height: `${viewport.height}px`, width: `${viewport.width}px`
            });
            pageContainer.appendChild(annotationLayerDiv);

            // PDF.js v3 syntax
            // PDF.js v3 Class-based Rendering
            try {
                if (window.pdfjsLib.AnnotationLayer.prototype && window.pdfjsLib.AnnotationLayer.prototype.render) {
                    new window.pdfjsLib.AnnotationLayer({
                        div: annotationLayerDiv,
                        accessibilityManager: null,
                        annotationCanvasMap: null,
                        page: page,
                        viewport: viewport.clone({ dontFlip: true })
                    }).render({
                        annotations: annotations,
                        div: annotationLayerDiv,
                        viewport: viewport.clone({ dontFlip: true }),
                        renderForms: true,
                        imageResourcesPath: '',
                        linkService: null,
                        downloadManager: null
                    });
                } else {
                    // Fallback to static
                    window.pdfjsLib.AnnotationLayer.render({
                        viewport: viewport.clone({ dontFlip: true }),
                        div: annotationLayerDiv,
                        annotations: annotations,
                        page: page,
                        renderForms: true,
                        imageResourcesPath: ''
                    });
                }
            } catch (err) {
                console.warn("AnnotationLayer render failed:", err);
            }
        }

        initDrawListeners(pageContainer, pageIndex);

        pageContainer.dataset.loaded = 'true';
        pageContainer.style.backgroundColor = 'transparent';
    } catch (e) {
        console.error("Error rendering page " + (pageIndex + 1), e);
        // handleApiError(e, `Error rendering page ${pageIndex + 1}`); // utils not imported?
    }
}

function addPageControls(pageContainer, i, totalPages) {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'page-controls';

    const createBtn = (cls, html, title, onclick) => {
        const btn = document.createElement('button');
        btn.className = `page-control-btn ${cls}`;
        btn.innerHTML = html;
        btn.title = title;
        btn.onclick = (e) => { e.stopPropagation(); onclick(); };
        controlsDiv.appendChild(btn);
    };

    createBtn('btn-rotate', '<i class="bi bi-arrow-clockwise"></i>', 'Rotate', () => rotatePage(i - 1));

    if (i > 1) {
        createBtn('btn-up', '<i class="bi bi-arrow-up"></i>', 'Move Up', () => movePage(i - 1, -1));
    }
    if (i < totalPages) {
        createBtn('btn-down', '<i class="bi bi-arrow-down"></i>', 'Move Down', () => movePage(i - 1, 1));
    }

    createBtn('btn-extract', '<i class="bi bi-file-earmark-arrow-down"></i>', 'Extract Page', () => extractSinglePage(i - 1));
    createBtn('btn-delete', '<i class="bi bi-trash"></i>', 'Delete Page', () => deletePage(i - 1));

    pageContainer.appendChild(controlsDiv);
}

export function initHandPan() {
    const container = document.getElementById('main-preview');
    if (!container) return;

    let isPanning = false;
    let startX, startY, scrollLeft, scrollTop;

    container.addEventListener('mousedown', (e) => {
        if (!state.modes.hand) return;
        isPanning = true;
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
        container.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
    });

    container.addEventListener('mouseleave', () => {
        if (state.modes.hand) {
            isPanning = false;
            container.style.cursor = 'grab';
            document.body.style.cursor = 'grab';
        }
    });

    container.addEventListener('mouseup', () => {
        if (state.modes.hand) {
            isPanning = false;
            container.style.cursor = 'grab';
            document.body.style.cursor = 'grab';
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        if (!state.modes.hand) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const y = e.pageY - container.offsetTop;
        const walkX = (x - startX) * 1.5; // Scroll speed multiplier
        const walkY = (y - startY) * 1.5;
        container.scrollLeft = scrollLeft - walkX;
        container.scrollTop = scrollTop - walkY;
    });
}

export async function renderThumbnails(bytes, password = null) {
    const container = document.getElementById('thumbnails-container');
    container.innerHTML = '';

    const dataCopy = new Uint8Array(bytes).slice();
    const params = { data: dataCopy };
    if (password) params.password = password;

    // We can handle password callback here too, but usually renderPdf handles it first and we reuse?
    // Actually renderPdf and renderThumbnails are independent. 
    // If we passed password, fine. If not, it might trigger callback again.
    // Let's attach same logic.
    const loadingTask = window.pdfjsLib.getDocument(params);
    loadingTask.onPassword = async (updatePassword, reason) => {
        // If we are here, likely the user already provided password to loadPdf or renderPdf,
        // but maybe multiple requests happen. 
        // For simplicity, we assume password is correct if passed, else prompt.
        const msg = reason === 2 ? "Incorrect password." : "Password required.";
        const pass = await requestPassword(msg);
        updatePassword(pass);
    };

    const pdf = await loadingTask.promise;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });

        const thumbItem = document.createElement('div');
        thumbItem.className = 'thumbnail-item';
        thumbItem.dataset.pageIndex = i - 1;
        thumbItem.onclick = () => {
            const target = document.querySelectorAll('.page-container')[i - 1];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
                handlePageClick(null, i - 1);
            }
        };

        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        thumbItem.appendChild(canvas);
        const label = document.createElement('div');
        label.className = 'thumbnail-label';
        label.innerText = `Page ${i}`;
        thumbItem.appendChild(label);

        container.appendChild(thumbItem);
    }
    updateActiveThumbnail();
}

export function handlePageClick(e, index) {
    if (e) e.stopPropagation(); // prevent bubbling if needed, though usually fine

    if (state.modes.zoomIn) {
        zoomIn();
        return;
    }
    if (state.modes.zoomOut) {
        zoomOut();
        return;
    }

    // Ignore clicks on existing annotations or overlays
    if (e.target.closest('.text-annotation') || e.target.closest('.selection-overlay') || e.target.closest('.shape-annotation') || e.target.closest('.selection-handle')) {
        return;
    }

    state.selectedPageIndex = index;
    updateActiveThumbnail();

    if (state.modes.text) {
        addTextAnnotation(e, index);
    }
    if (state.modes.formField) {
        addFormField(e, index, state.formFieldType);
    }
}

export async function refreshView() {
    const bytes = await state.pdfDoc.save();
    // Update global state bytes?
    // In editor.js we had pdfBytes variable but didn't seem to use it much except for saveState.
    // Here we pass bytes to render.
    await renderPdf(bytes);
    await renderThumbnails(bytes);
}
