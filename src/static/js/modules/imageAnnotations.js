
import { state } from './state.js';
import { saveState, recordAction, ActionType } from './history.js';

/* ==========================================================================
   IMAGE ANNOTATION SYSTEM (Robust Wrapper-Based)
   ========================================================================== */

let selectedImageWrapper = null;
let activeWrapperOperation = null; // 'move', 'resize', 'rotate'

// Deselect on outside click
document.addEventListener('mousedown', (e) => {
    if (activeWrapperOperation) return;
    if (e.target.closest('.image-wrapper') || e.target.closest('.text-wrapper') || e.target.closest('.resize-handle') || e.target.closest('.rotate-handle')) return;

    deselectAllImages();

    if (!state.modes.text) {
        document.querySelectorAll('.text-wrapper.selected').forEach(el => el.classList.remove('selected'));
    }
});

export function deselectAllImages() {
    document.querySelectorAll('.image-wrapper.selected').forEach(el => el.classList.remove('selected'));
    selectedImageWrapper = null;
}

export function getImageState(wrapper) {
    const pageContainer = wrapper.closest('.page-container');
    const pageIndex = parseInt(pageContainer.dataset.pageIndex);
    const content = wrapper.querySelector('img.image-content');
    return {
        id: wrapper.id,
        pageIndex,
        x: wrapper.style.left,
        y: wrapper.style.top,
        width: wrapper.style.width,
        height: wrapper.style.height,
        transform: wrapper.style.transform || 'rotate(0deg)',
        src: content.src,
        isSignature: content.classList.contains('signature')
    };
}

export function restoreImageAnnotation(data) {
    let wrapper = document.getElementById(data.id);
    if (!wrapper) {
        const pageContainer = document.querySelectorAll('.page-container')[data.pageIndex];
        if (!pageContainer) return;

        wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper selected';
        wrapper.id = data.id;

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
            <div class="delete-handle" title="Delete Image"><i class="bi bi-x-lg"></i></div>
        `;

        const img = document.createElement('img');
        img.className = 'image-content';
        if (data.isSignature) img.classList.add('signature');
        img.src = data.src;
        img.style.width = '100%';
        img.style.height = '100%';

        wrapper.prepend(img);
        pageContainer.appendChild(wrapper);
        setupImageInteraction(wrapper, pageContainer);
        selectedImageWrapper = wrapper;
    }

    Object.assign(wrapper.style, {
        left: data.x, top: data.y, width: data.width, height: data.height, transform: data.transform
    });

    return wrapper;
}

export function setupImageInteraction(wrapper, container) {
    wrapper.addEventListener('mousedown', (e) => {
        if (e.target.closest('.resize-handle') ||
            e.target.closest('.rotate-handle') ||
            e.target.closest('.delete-handle')) return;

        e.stopPropagation();
        e.preventDefault();

        if (selectedImageWrapper !== wrapper) {
            deselectAllImages();
            wrapper.classList.add('selected');
            selectedImageWrapper = wrapper;
        }

        const startState = getImageState(wrapper);
        startWrapperMove(e, wrapper, () => {
            const newState = getImageState(wrapper);
            if (newState.x !== startState.x || newState.y !== startState.y) {
                recordAction(ActionType.MOVE, { oldState: startState, newState }, restoreImageAnnotation);
            }
        });
    });

    wrapper.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const dir = handle.dataset.dir;
            const startState = getImageState(wrapper);
            startWrapperResize(e, wrapper, dir, () => {
                const newState = getImageState(wrapper);
                recordAction(ActionType.RESIZE, { oldState: startState, newState }, restoreImageAnnotation);
            });
        });
    });

    const rotHandle = wrapper.querySelector('.rotate-handle');
    if (rotHandle) {
        rotHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const startState = getImageState(wrapper);
            startWrapperRotation(e, wrapper, () => {
                const newState = getImageState(wrapper);
                recordAction(ActionType.MODIFY, { oldState: startState, newState }, restoreImageAnnotation);
            });
        });
    }

    const delHandle = wrapper.querySelector('.delete-handle');
    if (delHandle) {
        delHandle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm("Delete this image?")) {
                const s = getImageState(wrapper);
                wrapper.remove();
                selectedImageWrapper = null;
                recordAction(ActionType.DELETE, s, restoreImageAnnotation);
            }
        });
        delHandle.addEventListener('mousedown', (e) => e.stopPropagation());
    }
}

export async function handleImageUpload(input) {
    const { pdfDoc, selectedPageIndex } = state;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = async function (e) {
            const pageContainer = document.querySelectorAll('.page-container')[selectedPageIndex];

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

                const wrapper = document.createElement('div');
                wrapper.className = 'image-wrapper selected';
                wrapper.id = `image-annot-${Date.now()}`;

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
                    <div class="delete-handle" title="Delete Image"><i class="bi bi-x-lg"></i></div>
                `;

                tempImg.className = 'image-content';
                tempImg.style.width = '100%';
                tempImg.style.height = '100%';
                wrapper.prepend(tempImg);

                wrapper.style.width = `${imgWidth}px`;
                wrapper.style.height = `${imgHeight}px`;
                wrapper.style.left = `${(pageContainer.offsetWidth - imgWidth) / 2}px`;
                wrapper.style.top = `${(pageContainer.offsetHeight - imgHeight) / 2}px`;
                wrapper.style.transform = 'rotate(0deg)';

                pageContainer.appendChild(wrapper);

                setupImageInteraction(wrapper, pageContainer);
                selectedImageWrapper = wrapper;

                // Record Action
                recordAction(ActionType.ADD, getImageState(wrapper), restoreImageAnnotation);
            };
        };
        reader.readAsDataURL(file);
    }
    input.value = '';
}

export async function addSignatureAnnotation(dataUrl) {
    const { selectedPageIndex } = state;
    const pageContainer = document.querySelectorAll('.page-container')[selectedPageIndex];
    if (!pageContainer) return;

    // Signature logic
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'image-content signature';

    img.onload = function () {
        let imgWidth = img.naturalWidth;
        let imgHeight = img.naturalHeight;

        if (imgWidth > 150) {
            const scale = 150 / imgWidth;
            imgWidth *= scale;
            imgHeight *= scale;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper selected';
        wrapper.id = `signature-annot-${Date.now()}`;

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
            <div class="delete-handle" title="Delete Image"><i class="bi bi-x-lg"></i></div>
        `;

        img.style.width = '100%';
        img.style.height = '100%';
        wrapper.prepend(img);

        wrapper.style.width = `${imgWidth}px`;
        wrapper.style.height = `${imgHeight}px`;
        wrapper.style.left = `${(pageContainer.offsetWidth - imgWidth) / 2}px`;
        wrapper.style.top = `${(pageContainer.offsetHeight - imgHeight) / 2}px`;
        wrapper.style.transform = 'rotate(0deg)';

        pageContainer.appendChild(wrapper);
        setupImageInteraction(wrapper, pageContainer);
        selectedImageWrapper = wrapper;

        recordAction(ActionType.ADD, getImageState(wrapper), restoreImageAnnotation);
    };
}

/* --- Move --- */
export function startWrapperMove(e, wrapper, onEnd) {
    activeWrapperOperation = 'move';
    const startX = e.clientX;
    const startY = e.clientY;
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
        if (onEnd) onEnd();
        else saveState(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

/* --- Resize --- */
export function startWrapperResize(e, wrapper, dir, onEnd) {
    activeWrapperOperation = 'resize';

    const startRect = {
        left: wrapper.offsetLeft,
        top: wrapper.offsetTop,
        width: wrapper.offsetWidth,
        height: wrapper.offsetHeight
    };

    // ... logic same as before ...
    const match = wrapper.style.transform.match(/rotate\(([-\d.]+)deg\)/);
    const angleDeg = match ? parseFloat(match[1]) : 0;
    const angleRad = angleDeg * (Math.PI / 180);
    const cx = startRect.left + startRect.width / 2;
    const cy = startRect.top + startRect.height / 2;
    const handleMap = {
        'nw': [0, 0], 'n': [0.5, 0], 'ne': [1, 0],
        'w': [0, 0.5], 'e': [1, 0.5],
        'sw': [0, 1], 's': [0.5, 1], 'se': [1, 1]
    };
    const [hx, hy] = handleMap[dir];
    const ax = 1 - hx;
    const ay = 1 - hy;
    const localAnchorX = startRect.left + startRect.width * ax;
    const localAnchorY = startRect.top + startRect.height * ay;
    const anchorGlobal = rotatePoint(localAnchorX, localAnchorY, cx, cy, angleRad);

    const onMove = (ev) => {
        ev.preventDefault();
        const container = wrapper.parentElement;
        const cRect = container.getBoundingClientRect();
        const mouseX = ev.clientX - cRect.left;
        const mouseY = ev.clientY - cRect.top;
        const dx = mouseX - anchorGlobal.x;
        const dy = mouseY - anchorGlobal.y;
        const localDx = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
        const localDy = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);
        let newW = startRect.width;
        let newH = startRect.height;

        if (dir.includes('e') || dir.includes('w')) {
            newW = localDx * (hx === 0 ? -1 : 1);
        }
        if (dir.includes('n') || dir.includes('s')) {
            newH = localDy * (hy === 0 ? -1 : 1);
        }
        newW = Math.max(20, newW);
        newH = Math.max(20, newH);

        if (ev.shiftKey && dir.length === 2) {
            const ratio = startRect.width / startRect.height;
            if (newW / newH > ratio) newH = newW / ratio;
            else newW = newH * ratio;
        }

        const vecToCenterX = (0.5 - ax) * newW;
        const vecToCenterY = (0.5 - ay) * newH;
        const rotVecX = vecToCenterX * Math.cos(angleRad) - vecToCenterY * Math.sin(angleRad);
        const rotVecY = vecToCenterX * Math.sin(angleRad) + vecToCenterY * Math.cos(angleRad);
        const newCx = anchorGlobal.x + rotVecX;
        const newCy = anchorGlobal.y + rotVecY;
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
        if (onEnd) onEnd();
        else saveState(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

/* --- Rotation --- */
export function startWrapperRotation(e, wrapper, onEnd) {
    activeWrapperOperation = 'rotate';
    e.stopPropagation();

    const container = wrapper.parentElement;
    const cRect = container.getBoundingClientRect();
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
        const finalDeg = ev.shiftKey ? Math.round(newDeg / 15) * 15 : newDeg;
        wrapper.style.transform = `rotate(${finalDeg}deg)`;
    };

    const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        activeWrapperOperation = null;
        if (onEnd) onEnd();
        else saveState(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
}

export function rotatePoint(x, y, cx, cy, angleRad) {
    const dx = x - cx;
    const dy = y - cy;
    return {
        x: cx + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
        y: cy + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
    };
}
