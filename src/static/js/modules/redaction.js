
import { state } from './state.js';
import * as ui from './ui.js';

let isDrawing = false;
let startX = 0;
let startY = 0;
let currentRedactionEl = null;

// Track redactions per page? 
// Actually we can just query DOM '.redaction-box'

export function initRedactionListeners() {
    const container = document.getElementById('pdf-viewer');
    if (!container) return;

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseDown(e) {
    if (!state.modes.redact) return;

    // Ensure we are on a page
    const pageContainer = e.target.closest('.page-container');
    if (!pageContainer) return;

    // Prevent drawing if clicking on existing annotation wrapper (unless we want overlapping)
    // Generally redaction goes over everything.

    isDrawing = true;
    const rect = pageContainer.getBoundingClientRect();
    const scale = state.scale || 1.0;

    // Relative coordinates
    startX = (e.clientX - rect.left) / scale;
    startY = (e.clientY - rect.top) / scale;

    // Create element
    currentRedactionEl = document.createElement('div');
    currentRedactionEl.className = 'redaction-box';
    currentRedactionEl.style.position = 'absolute';
    currentRedactionEl.style.left = `${startX * scale}px`;
    currentRedactionEl.style.top = `${startY * scale}px`;
    currentRedactionEl.style.width = '0px';
    currentRedactionEl.style.height = '0px';
    currentRedactionEl.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black preview
    currentRedactionEl.style.border = '2px solid red';
    currentRedactionEl.style.zIndex = '100'; // Above most things
    currentRedactionEl.setAttribute('data-page-index', pageContainer.dataset.pageIndex);

    // Label
    const label = document.createElement('span');
    label.innerText = 'REDACT';
    label.style.position = 'absolute';
    label.style.top = '50%';
    label.style.left = '50%';
    label.style.transform = 'translate(-50%, -50%)';
    label.style.color = 'red';
    label.style.fontWeight = 'bold';
    label.style.fontSize = '12px';
    label.style.pointerEvents = 'none';
    currentRedactionEl.appendChild(label);

    // Delete button (visible on hover or always?)
    // Let's implement interaction later (resize/delete). 
    // Ideally use a wrapper pattern like Shapes, but simpler first.

    // Append to annotation layer
    const layer = pageContainer.querySelector('.annotationLayer');
    if (layer) layer.appendChild(currentRedactionEl);

    e.preventDefault();
    e.stopPropagation();
}

function handleMouseMove(e) {
    if (!isDrawing || !currentRedactionEl) return;

    const pageContainer = currentRedactionEl.closest('.page-container');
    if (!pageContainer) return;

    const rect = pageContainer.getBoundingClientRect();
    const scale = state.scale || 1.0;

    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);

    currentRedactionEl.style.width = `${width * scale}px`;
    currentRedactionEl.style.height = `${height * scale}px`;
    currentRedactionEl.style.left = `${left * scale}px`;
    currentRedactionEl.style.top = `${top * scale}px`;
}

function handleMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentRedactionEl) {
        // If too small, remove
        if (parseFloat(currentRedactionEl.style.width) < 5 || parseFloat(currentRedactionEl.style.height) < 5) {
            currentRedactionEl.remove();
        } else {
            // Finalize
            makeRedactionInteractive(currentRedactionEl);
            updateApplyButton();
        }
        currentRedactionEl = null;
    }
}

function makeRedactionInteractive(el) {
    // Add close button
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '-10px';
    closeBtn.style.right = '-10px';
    closeBtn.style.background = 'red';
    closeBtn.style.color = 'white';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.width = '20px';
    closeBtn.style.height = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent re-selection or other events
        el.remove();
        updateApplyButton();
    };
    el.appendChild(closeBtn);
}

function updateApplyButton() {
    // Check if any redactions exist
    const count = document.querySelectorAll('.redaction-box').length;
    // We should enable/show an "Apply" button in the UI.
    // For now, let's look for an ID #apply-redactions-btn (we need to add this to ribbon?)
    // Or maybe we show a toast with action?

    const btn = document.getElementById('apply-redactions-btn');
    if (btn) {
        btn.disabled = count === 0;
        btn.style.display = count > 0 ? 'inline-block' : 'none'; // Or just disabled
    }
}

export async function applyRedactions() {
    const marks = [];
    document.querySelectorAll('.redaction-box').forEach(el => {
        const pageIndex = parseInt(el.getAttribute('data-page-index'));
        const scale = state.scale || 1.0;
        marks.push({
            pageIndex: pageIndex,
            x: parseFloat(el.style.left) / scale,
            y: parseFloat(el.style.top) / scale,
            width: parseFloat(el.style.width) / scale,
            height: parseFloat(el.style.height) / scale
        });
    });

    if (marks.length === 0) {
        alert("No redactions marked.");
        return;
    }

    if (!confirm(`Permanently redact ${marks.length} areas? This cannot be undone.`)) return;

    // Send to backend
    try {
        if (window.showToast) window.showToast("Applying redactions...", "info");

        const response = await fetch('/api/apply_redactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: state.filename,
                redactions: marks
            })
        });

        if (!response.ok) throw new Error("Failed to apply redactions");

        const data = await response.json();

        // Reload PDF (since content changed permanently)
        // We might get a new filename or overwrite?
        // Ideally backend returns new filename or same if overwritten.

        if (data.download_url) {
            // Ideally reload the viewer with new file
            // window.location.reload(); or loadPdf()
            // If filename changed, update state.filename
            if (window.showToast) window.showToast("Redaction applied successfully!", "success");

            // Simple reload for safety?
            setTimeout(() => window.location.reload(), 1000);
        }

    } catch (e) {
        console.error(e);
        alert("Error applying redactions: " + e.message);
    }
}
