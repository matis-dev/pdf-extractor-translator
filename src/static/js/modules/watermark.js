
import { saveState } from './history.js';

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
