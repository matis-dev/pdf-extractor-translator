
import { state } from './state.js';
import * as ui from './ui.js';
import { saveState } from './history.js';

let isDragging = false;
let isResizing = false;
let resizeHandle = null;
let startX = 0;
let startY = 0;
let startLeft = 0;
let startTop = 0;
let startWidth = 0;
let startHeight = 0;
let currentCropBox = null;
let applyButton = null;

export function initCropListeners() {
    const container = document.getElementById('pdf-viewer');
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

export function toggleCropMode() {
    // defined in main or state, but here we can manage clean up
    if (state.modes.crop) {
        // Turning off: handled by main? 
        // We should assume state.modes.crop is already set true/false by toggle caller
        // But usually toggle functions in modules set the state.
        // Let's rely on window.toggleCropMode calling this setup/teardown
    }
}

// Window global to toggle
window.toggleCropMode = function () {
    if (state.modes.crop) {
        // Disable
        state.modes.crop = false;
        document.body.classList.remove('crop-mode');
        clearCrop();
        if (applyButton) applyButton.remove();
        applyButton = null;
    } else {
        // Enable
        // Reset other modes
        if (window.resetModes) window.resetModes();
        state.modes.crop = true;
        document.body.classList.add('crop-mode');
        if (window.showToast) window.showToast("Crop Mode: Drag to select area", "info");
    }
    if (window.updateButtonStates) window.updateButtonStates();
};

function handleMouseDown(e) {
    if (!state.modes.crop) return;

    // Check if clicking existing crop box or handles
    if (e.target.closest('.crop-handle')) {
        isResizing = true;
        resizeHandle = e.target.closest('.crop-handle').dataset.handle;

        currentCropBox = e.target.closest('.crop-box');
        const scale = state.scale || 1.0;

        // Record start positions
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseFloat(currentCropBox.style.left);
        startTop = parseFloat(currentCropBox.style.top);
        startWidth = parseFloat(currentCropBox.style.width);
        startHeight = parseFloat(currentCropBox.style.height);

        e.preventDefault();
        e.stopPropagation();
        return;
    }

    if (e.target.closest('.crop-box')) {
        isDragging = true;
        currentCropBox = e.target.closest('.crop-box');

        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseFloat(currentCropBox.style.left);
        startTop = parseFloat(currentCropBox.style.top);

        e.preventDefault();
        e.stopPropagation();
        return;
    }

    // Start new crop
    const pageContainer = e.target.closest('.page-container');
    if (!pageContainer) return;

    // Clear existing crop if on another page or we want only one active crop
    // Let's support only one active crop for simplicity of "Apply"
    clearCrop();

    isResizing = true; // Treating creation as resizing SE handle
    resizeHandle = 'se'; // effectively

    const rect = pageContainer.getBoundingClientRect();
    const scale = state.scale || 1.0;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    currentCropBox = createCropBox(pageContainer, x, y);

    // Initial size 0
    startLeft = x * scale;
    startTop = y * scale;
    startWidth = 0;
    startHeight = 0;
    startX = e.clientX;
    startY = e.clientY;

    e.preventDefault();
    e.stopPropagation();
}

function handleMouseMove(e) {
    if (!state.modes.crop) return;

    const scale = state.scale || 1.0;

    if (isDragging && currentCropBox) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        currentCropBox.style.left = `${startLeft + dx}px`;
        currentCropBox.style.top = `${startTop + dy}px`;

        updateApplyButtonPos();
        e.preventDefault();
    } else if (isResizing && currentCropBox) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Basic logic for handles
        // Handle coordinates are in DOM pixels

        let newLeft = startLeft;
        let newTop = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;

        // Depending on handle
        if (resizeHandle.includes('e')) newWidth = startWidth + dx;
        if (resizeHandle.includes('s')) newHeight = startHeight + dy;
        if (resizeHandle.includes('w')) {
            newWidth = startWidth - dx;
            newLeft = startLeft + dx;
        }
        if (resizeHandle.includes('n')) {
            newHeight = startHeight - dy;
            newTop = startTop + dy;
        }

        // Normalize (no negative width/height)
        if (newWidth < 0) {
            newWidth = Math.abs(newWidth);
            newLeft -= newWidth;
            // logic gets complex if crossing over origin. 
            // Simplified: don't allow negative for now or swap handles?
            // Let's just clamp min size
            if (newWidth < 10) newWidth = 10;
        }
        if (newHeight < 0) {
            newHeight = Math.abs(newHeight);
            newTop -= newHeight;
            if (newHeight < 10) newHeight = 10;
        }

        currentCropBox.style.left = `${newLeft}px`;
        currentCropBox.style.top = `${newTop}px`;
        currentCropBox.style.width = `${newWidth}px`;
        currentCropBox.style.height = `${newHeight}px`;

        updateApplyButtonPos();
        e.preventDefault();
    }
}

function handleMouseUp(e) {
    if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
        resizeHandle = null;

        if (currentCropBox) {
            // Ensure bounds?
            // Show Apply Button
            showApplyButton();
        }
    }
}

function createCropBox(pageContainer, x, y) {
    const scale = state.scale || 1.0;

    const box = document.createElement('div');
    box.className = 'crop-box';
    box.style.position = 'absolute';
    box.style.left = `${x * scale}px`;
    box.style.top = `${y * scale}px`;
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.border = '2px dashed #fff';
    box.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.5)';
    box.style.zIndex = '1000';
    box.style.cursor = 'move';
    box.setAttribute('data-page-index', pageContainer.dataset.pageIndex);

    // Create handles
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    handles.forEach(h => {
        const handle = document.createElement('div');
        handle.className = 'crop-handle';
        handle.dataset.handle = h;
        // Styles should be in CSS, but inline for now
        Object.assign(handle.style, {
            position: 'absolute',
            width: '10px',
            height: '10px',
            background: '#fff',
            border: '1px solid #000',
            zIndex: '1001'
        });

        // Positioning
        if (h.includes('n')) handle.style.top = '-5px';
        if (h.includes('s')) handle.style.bottom = '-5px';
        if (h === 'w' || h === 'e') handle.style.top = 'calc(50% - 5px)';

        if (h.includes('w')) handle.style.left = '-5px';
        if (h.includes('e')) handle.style.right = '-5px';
        if (h === 'n' || h === 's') handle.style.left = 'calc(50% - 5px)';

        // Cursors
        if (h === 'nw' || h === 'se') handle.style.cursor = 'nwse-resize';
        if (h === 'ne' || h === 'sw') handle.style.cursor = 'nesw-resize';
        if (h === 'n' || h === 's') handle.style.cursor = 'ns-resize';
        if (h === 'e' || h === 'w') handle.style.cursor = 'ew-resize';

        box.appendChild(handle);
    });

    // Add to specific layer or straight to page container
    // If specific layer exists (annotationLayer?), use it. But simple append works.
    pageContainer.appendChild(box);

    // Ensure overflow hidden on page container to contain shadow
    // pageContainer.style.overflow = 'hidden'; 
    // Wait, overflow hidden might clip other things like tooltips?
    // Usually page container is the bounding box of the page image.
    // It should be fine.
    // But let's check class list.
    if (!pageContainer.classList.contains('crop-active')) {
        pageContainer.classList.add('crop-active');
        pageContainer.style.overflow = 'hidden';
    }

    return box;
}

function clearCrop() {
    document.querySelectorAll('.crop-box').forEach(el => el.remove());
    document.querySelectorAll('.page-container').forEach(el => {
        el.style.overflow = '';
        el.classList.remove('crop-active');
    });
    currentCropBox = null;
    hideApplyButton();
}

function showApplyButton() {
    if (!currentCropBox) return;

    if (!applyButton) {
        applyButton = document.createElement('div');
        applyButton.className = 'crop-actions';
        applyButton.style.position = 'absolute';
        applyButton.style.zIndex = '2000';
        applyButton.style.display = 'flex';
        applyButton.style.gap = '5px';
        applyButton.style.padding = '5px';
        applyButton.style.background = '#fff';
        applyButton.style.borderRadius = '4px';
        applyButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

        const btnApply = document.createElement('button');
        btnApply.className = 'btn btn-sm btn-primary';
        btnApply.innerHTML = '<i class="bi bi-check-lg"></i> Apply';
        btnApply.onclick = () => applyCrop(false);

        const btnAll = document.createElement('button');
        btnAll.className = 'btn btn-sm btn-outline-secondary';
        btnAll.innerHTML = '<i class="bi bi-layers"></i> All Pages';
        btnAll.title = "Apply to all pages";
        btnAll.onclick = () => applyCrop(true);

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn btn-sm btn-danger';
        btnCancel.innerHTML = '<i class="bi bi-x-lg"></i>';
        btnCancel.onclick = () => clearCrop();

        applyButton.appendChild(btnApply);
        applyButton.appendChild(btnAll);
        applyButton.appendChild(btnCancel);

        document.body.appendChild(applyButton);
    }

    updateApplyButtonPos();
}

function hideApplyButton() {
    if (applyButton) {
        applyButton.remove();
        applyButton = null;
    }
}

function updateApplyButtonPos() {
    if (!currentCropBox || !applyButton) return;

    const rect = currentCropBox.getBoundingClientRect();
    // Position below the box, centered
    applyButton.style.top = `${rect.bottom + 10}px`;
    applyButton.style.left = `${rect.left + (rect.width / 2) - (applyButton.offsetWidth / 2)}px`;
}

async function applyCrop(allPages) {
    if (!currentCropBox) return;

    const scale = state.scale || 1.0;
    const pageIndex = parseInt(currentCropBox.getAttribute('data-page-index'));

    // DOM Units (relative to page)
    const x = parseFloat(currentCropBox.style.left) / scale;
    const y = parseFloat(currentCropBox.style.top) / scale;
    const width = parseFloat(currentCropBox.style.width) / scale;
    const height = parseFloat(currentCropBox.style.height) / scale;

    const crops = [];

    if (allPages) {
        // If all pages, we should get total pages.
        // But we can just send "all pages" flag to backend?
        // Or cleaner: Iterate all pages in frontend?
        // Backend doesn't support "apply_to_all" flag yet, I implemented explicit mapping.
        // So I'll just gather all page indices.
        // Wait, I don't know total pages easily here without checking DOM or global state.
        // `state.pdfDoc.numPages` (from PDF.js)

        if (window.pdfDoc) {
            for (let i = 0; i < window.pdfDoc.numPages; i++) {
                crops.push({ pageIndex: i, x, y, width, height });
            }
        }
    } else {
        crops.push({ pageIndex, x, y, width, height });
    }

    try {
        if (window.showToast) window.showToast("Applying crop...", "info");

        const response = await fetch('/api/crop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: state.filename,
                crops: crops
            })
        });

        if (!response.ok) throw new Error("Failed to crop");

        const data = await response.json();

        // Support Undo: Save current state
        await saveState(true);

        if (data.download_url && window.loadPdf) {
            const newBytes = await fetch(data.download_url).then(res => res.arrayBuffer());
            await window.loadPdf(newBytes);

            if (data.filename) {
                state.filename = data.filename;
                window.filename = data.filename;
                const newUrl = `/editor/${data.filename}`;
                window.history.pushState({ path: newUrl }, '', newUrl);
            }
            if (window.showToast) window.showToast("Crop applied!", "success");

            clearCrop();
        } else {
            // Fallback
            window.location.reload();
        }

    } catch (e) {
        console.error(e);
        alert("Error cropping: " + e.message);
    }
}
