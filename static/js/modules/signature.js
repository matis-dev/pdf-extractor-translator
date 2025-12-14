

import { addSignatureAnnotation } from './annotations.js';
// import { showToast } from '../utils.js';

let signaturePad = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

export function openSignatureModal() {
    new bootstrap.Modal(document.getElementById('signatureModal')).show();

    // Initialize canvas after modal is shown (needs layout)
    document.getElementById('signatureModal').addEventListener('shown.bs.modal', function () {
        initSignatureCanvas();
    });
}

function initSignatureCanvas() {
    const canvas = document.getElementById('signature-canvas');
    if (!canvas) return;

    // Resize canvas to fit container
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth;
    canvas.height = 200; // Fixed height

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';

    // Attach listeners if not already attached (check flag or remove first)
    // Simpler: just overwrite properties
    canvas.onmousedown = (e) => {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
    };

    canvas.onmousemove = (e) => {
        if (!isDrawing) return;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        [lastX, lastY] = [e.offsetX, e.offsetY];
    };

    canvas.onmouseup = () => isDrawing = false;
    canvas.onmouseout = () => isDrawing = false;
}

export function clearSignature() {
    const canvas = document.getElementById('signature-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function applySignature() {
    const activeTab = document.querySelector('#signatureModal .nav-link.active').id;
    let dataUrl = null;

    if (activeTab === 'tab-draw') {
        const canvas = document.getElementById('signature-canvas');
        // Check if empty?
        dataUrl = canvas.toDataURL('image/png');
        // Basic check if empty: check byte size or pixel data? 
        // Assuming user drew something.
    } else if (activeTab === 'tab-type') {
        const text = document.getElementById('sig-type-input').value;
        if (!text) {
            showToast("Please enter text", "warning");
            return;
        }
        // Convert text to image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const font = "48px 'Dancing Script', cursive"; // Using Google Font if available, else cursive fallback

        ctx.font = font;
        const width = ctx.measureText(text).width + 20;
        canvas.width = width;
        canvas.height = 100;

        // Transparent BG
        ctx.clearRect(0, 0, width, 100);
        ctx.font = font;
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 10, 50);

        dataUrl = canvas.toDataURL('image/png');
    } else if (activeTab === 'tab-upload') {
        const fileInput = document.getElementById('sig-upload-input');
        if (fileInput.files && fileInput.files[0]) {
            // File logic is async, we need to handle it.
            // We can't synchronously return dataUrl.
            // We'll read it here.
            const reader = new FileReader();
            reader.onload = function (e) {
                addSignatureAnnotation(e.target.result);
                bootstrap.Modal.getInstance(document.getElementById('signatureModal')).hide();
            };
            reader.readAsDataURL(fileInput.files[0]);
            return;
        }
    }

    if (dataUrl) {
        addSignatureAnnotation(dataUrl);
        bootstrap.Modal.getInstance(document.getElementById('signatureModal')).hide();
    }
}
