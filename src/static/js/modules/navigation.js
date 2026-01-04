import { state } from './state.js';
import { zoomIn, zoomOut, setZoom, refreshView } from './viewer.js';

// Logic / Pure Functions (Exported for Testing if needed, or separate module)
export function calculateFitZoom(mode, containerW, containerH, contentW, contentH, padding = 48) {
    if (!contentW || !contentH) return 1.0;

    if (mode === 'fitWidth') {
        return (containerW - padding) / contentW;
    } else if (mode === 'fitPage') {
        const fitW = (containerW - padding) / contentW;
        const fitH = (containerH - padding) / contentH;
        return Math.min(fitW, fitH);
    }
    return 1.0;
}

export function parseZoomInput(inputStr) {
    let val = inputStr.replace('%', '').trim();
    let num = parseInt(val);
    if (isNaN(num)) return null;
    return num / 100;
}

let navDebounceTimer = null;
let resizeDebounceTimer = null;
let idleTimer = null;

export function initNavigation() {
    const navBar = document.getElementById('navigation-bar');
    if (!navBar) return;

    // Fullscreen
    const fsBtn = document.getElementById('nav-fullscreen');
    if (fsBtn) fsBtn.onclick = toggleFullscreen;
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Auto-Hide
    initAutoHide(navBar);

    // Event Listeners
    document.getElementById('nav-zoom-in').onclick = () => {
        zoomIn();
    };
    document.getElementById('nav-zoom-out').onclick = () => {
        zoomOut();
    };

    // Zoom Display / Input
    const zoomDisplay = document.getElementById('nav-zoom-display');
    const zoomDropdown = document.getElementById('zoom-dropdown');

    if (zoomDisplay) {
        zoomDisplay.onclick = (e) => {
            e.stopPropagation();
            toggleZoomDropdown();
        };
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (zoomDropdown && zoomDropdown.style.display === 'block') {
            if (!e.target.closest('.zoom-control')) {
                zoomDropdown.style.display = 'none';
            }
        }
    });

    // Listen for zoom changes from viewer
    document.addEventListener('zoom-changed', () => {
        updateNavigationUI();
        debouncedSaveState();
    });

    // Resize Listener
    window.addEventListener('resize', handleResize);

    document.getElementById('nav-next-page').onclick = () => changePage(1);
    document.getElementById('nav-prev-page').onclick = () => changePage(-1);

    const pageInput = document.getElementById('nav-page-input');
    if (pageInput) {
        pageInput.onchange = (e) => {
            let p = parseInt(e.target.value);
            if (isNaN(p)) p = state.currentPage;
            goToPage(p);
        };
        // Also handle Enter key
        pageInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                pageInput.blur(); // trigger change
            }
        };
    }

    // Initial fetch
    fetchState().then(() => {
        updateNavigationUI();
    });
}

export function onPdfLoaded() {
    // Called when PDF is fully loaded/rendered
    if (state.pdfJsDoc) {
        state.totalPages = state.pdfJsDoc.numPages;
    }

    const navBar = document.getElementById('navigation-bar');
    if (navBar) {
        navBar.style.opacity = '1';
        navBar.classList.remove('nav-hidden');
    }

    updateNavigationUI();

    // Restore position if we have a saved page > 1
    if (state.currentPage > 1) {
        goToPage(state.currentPage);
    }

    renderZoomDropdown();
}

function renderZoomDropdown() {
    const dropdown = document.getElementById('zoom-dropdown');
    if (!dropdown) return;

    const presets = [50, 75, 100, 125, 150, 200];
    let html = presets.map(p =>
        `<div class="zoom-option ${Math.round(state.zoom * 100) === p ? 'active' : ''}" onclick="applyPreset(${p})">${p}%</div>`
    ).join('');

    html += '<div class="zoom-divider"></div>';
    html += `<div class="zoom-option ${state.zoomMode === 'fitWidth' ? 'active' : ''}" onclick="applyFit('fitWidth')">Fit Width</div>`;
    html += `<div class="zoom-option ${state.zoomMode === 'fitPage' ? 'active' : ''}" onclick="applyFit('fitPage')">Fit Page</div>`;

    // Custom Input Option (Hidden by default, shown when clicked?)
    // Actually, user requested clicking display makes it editable. 
    // Let's implement that separately or inside dropdown?
    // Story says: "When I click on the zoom percentage display... Then it becomes an editable input field"
    // But we also need dropdown. 
    // Let's make the display the trigger, but also editable? 
    // Perhaps: Click -> Dropdown. Double Click -> Edit? Or Dropdown has "Custom..."?
    // Let's stick to Dropdown for now as per plan, but add Custom Entry in Dropdown or make the trigger specific.
    // Wait, the plan says "Convert... into a clickable element that transforms into an <input>" IS ONE TASK.
    // AND "Zoom Presets Dropdown" IS ANOTHER.
    // Let's combine: The Text is an input. The arrow/chevron is the dropdown. 
    // Or simpler: Click opens dropdown. Dropdown has "Custom" which focuses an input.
    // Re-reading Plan: "Convert the #nav-zoom-display span into a clickable element that transforms into an <input>"
    // Let's allow clicking the text to edit, and a small arrow for dropdown?
    // Or just make the dropdown items easy, and the display editable.

    dropdown.innerHTML = html;
}

// Global scope for onclicks in HTML string
window.applyPreset = (val) => {
    setZoom(val / 100);
    document.getElementById('zoom-dropdown').style.display = 'none';
};

window.applyFit = (mode) => {
    state.zoomMode = mode;
    recalculateFit();
    document.getElementById('zoom-dropdown').style.display = 'none';
};

function toggleZoomDropdown() {
    const dropdown = document.getElementById('zoom-dropdown');
    if (!dropdown) return;

    // Refresh content to show active state
    renderZoomDropdown();

    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
}

export function updateNavigationUI() {
    // Update Zoom
    const zoomDisp = document.getElementById('nav-zoom-display');
    if (zoomDisp) {
        // If we are editing, don't overwrite
        if (document.activeElement !== zoomDisp) {
            zoomDisp.innerText = Math.round(state.zoom * 100) + '%';
        }
    }

    // Update Page
    const pageInput = document.getElementById('nav-page-input');
    const totalSpan = document.getElementById('nav-total-pages');

    if (pageInput && document.activeElement !== pageInput) {
        pageInput.value = state.currentPage;
    }
    if (totalSpan) totalSpan.innerText = state.totalPages;
}

export function updateCurrentPage(pageIndex) {
    // Called by IntersectionObserver
    // pageIndex is 0-indexed
    const newPage = pageIndex + 1;
    if (state.currentPage === newPage) return;

    state.currentPage = newPage;
    updateNavigationUI();
    debouncedSaveState();
}

export function goToPage(pageNum) {
    // Clamp
    if (!state.totalPages) return;
    if (pageNum < 1) pageNum = 1;
    if (pageNum > state.totalPages) pageNum = state.totalPages;

    // Update State
    state.currentPage = pageNum;

    // Scroll
    const target = document.querySelector(`.page-container[data-page-index="${pageNum - 1}"]`);
    if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    updateNavigationUI();
    saveState();
}

function handleResize() {
    if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer);
    resizeDebounceTimer = setTimeout(() => {
        if (state.zoomMode !== 'custom') {
            recalculateFit();
        }
    }, 200);
}

function recalculateFit() {
    const container = document.getElementById('main-preview');
    // Find any page container to get natural size
    const page = document.querySelector('.page-container');
    if (!page || !page.dataset.naturalWidth) return;

    const naturalW = parseFloat(page.dataset.naturalWidth);
    const naturalH = parseFloat(page.dataset.naturalHeight);

    let newZoom = calculateFitZoom(state.zoomMode, container.clientWidth, container.clientHeight, naturalW, naturalH);

    state.zoom = newZoom;
    refreshView(); // Use refreshView directly to avoid setting mode to 'custom' via setZoom
    updateNavigationUI();
}

function changePage(delta) {
    goToPage(state.currentPage + delta);
}

// Fullscreen Logic
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function onFullscreenChange() {
    const isFS = !!document.fullscreenElement;
    const btn = document.getElementById('nav-fullscreen');
    if (isFS) {
        document.body.classList.add('app-fullscreen');
        if (btn) btn.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
    } else {
        document.body.classList.remove('app-fullscreen');
        if (btn) btn.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
    }
}

// Auto-Hide Logic
function initAutoHide(navBar) {
    const show = () => {
        navBar.classList.remove('nav-hidden');
    };

    const hide = () => {
        // Don't hide if dropdown is open
        const dropdown = document.getElementById('zoom-dropdown');
        if (dropdown && dropdown.style.display === 'block') return;

        // Don't hide if hovering
        if (navBar.matches(':hover')) return;

        navBar.classList.add('nav-hidden');
    };

    const resetTimer = () => {
        show();
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(hide, 3000);
    };

    // Listeners
    document.addEventListener('mousemove', resetTimer);
    document.addEventListener('keydown', resetTimer);
    document.addEventListener('wheel', resetTimer);
    document.addEventListener('touchstart', resetTimer);

    // Initial start
    resetTimer();
}

// API Calls
async function fetchState() {
    if (!window.filename) return;
    try {
        const res = await fetch(`/api/state/${window.filename}`);
        if (res.ok) {
            const data = await res.json();
            // Apply zoom
            if (data.zoom_level && data.zoom_level > 0.1) {
                state.zoom = data.zoom_level;
            }
            if (data.current_page && data.current_page > 0) {
                state.currentPage = data.current_page;
            }
        }
    } catch (e) {
        console.error("Failed to fetch state", e);
    }
}

function debouncedSaveState() {
    if (navDebounceTimer) clearTimeout(navDebounceTimer);
    navDebounceTimer = setTimeout(saveState, 1000);
}

async function saveState() {
    if (!window.filename) return;
    try {
        await fetch(`/api/state/${window.filename}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_page: state.currentPage,
                zoom_level: state.zoom
            })
        });
    } catch (e) {
        console.error("Failed to save state", e);
    }
}

// Setup Editable Zoom
function setupEditableZoom() {
    const zoomDisp = document.getElementById('nav-zoom-display');

    zoomDisp.contentEditable = true;

    zoomDisp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            zoomDisp.blur();
        }
    });

    zoomDisp.addEventListener('focus', () => {
        setTimeout(() => {
            const range = document.createRange();
            range.selectNodeContents(zoomDisp);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }, 0);
    });

    zoomDisp.addEventListener('blur', () => {
        const newZoom = parseZoomInput(zoomDisp.innerText);

        if (newZoom === null) {
            updateNavigationUI();
        } else {
            setZoom(newZoom);
        }
        window.getSelection().removeAllRanges();
    });
}

document.addEventListener('DOMContentLoaded', setupEditableZoom);

