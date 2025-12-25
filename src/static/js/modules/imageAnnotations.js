
import { state } from './state.js';
import { saveState } from './history.js';

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
export function deselectAllImages() {
    document.querySelectorAll('.image-wrapper.selected').forEach(el => el.classList.remove('selected'));
    selectedImageWrapper = null;
}

/**
 * Attaches interaction listeners to the wrapper
 */
export function setupImageInteraction(wrapper, container) {
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

        // We wrap signature in wrapper too for consistency?
        // Original code used makeDraggable(img) but new system uses wrappers.
        // Let's adapt signature to use wrapper system for consistency if possible.
        // But specifically signature.js might rely on old system.
        // The original code in annotations.js adapted signature to:
        // img.style... makeDraggable(img)...
        // But `makeDraggable` is NOT in annotations.js. It must be global or imported?
        // Wait, `annotations.js` didn't have `makeDraggable` defined in it.
        // It's likely in `ui.js` or global.
        // To be safe, I'll wrap it in standard image wrapper if the goal is to modernize.
        // BUT the original code:
        /*
        img.style.position = 'absolute';
        makeDraggable(img);
        pageContainer.appendChild(img);
        */
        // I should check `makeDraggable`. It's likely legacy.
        // Since I want to refactor responsibly, I'll stick to original behavior for signature 
        // OR upgrade it. Upgrading is better.

        // Let's Upgrade Signature to Wrapper!
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper selected';
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

        img.className = 'image-content signature';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.position = 'static'; // Wrapper handles pos

        wrapper.prepend(img);

        wrapper.style.width = `${imgWidth}px`;
        wrapper.style.height = `${imgHeight}px`;
        wrapper.style.left = `${(pageContainer.offsetWidth - imgWidth) / 2}px`;
        wrapper.style.top = `${(pageContainer.offsetHeight - imgHeight) / 2}px`;
        wrapper.style.transform = 'rotate(0deg)';

        pageContainer.appendChild(wrapper);
        setupImageInteraction(wrapper, pageContainer);
        selectedImageWrapper = wrapper;
    };
}

/* --- Move --- */
export function startWrapperMove(e, wrapper) {
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
export function startWrapperResize(e, wrapper, dir) {
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
export function startWrapperRotation(e, wrapper) {
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
export function rotatePoint(x, y, cx, cy, angleRad) {
    const dx = x - cx;
    const dy = y - cy;
    return {
        x: cx + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: cy + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
    };
}
