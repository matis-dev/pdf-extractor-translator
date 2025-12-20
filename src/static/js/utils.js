
/**
 * Utility functions for user feedback and error handling.
 */

// Toast Container Management
function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1100';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show a toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'danger', 'warning', 'info'.
 */
function showToast(message, type = 'info') {
    const container = getToastContainer();
    const id = 'toast-' + Date.now();

    const iconMap = {
        'success': 'bi-check-circle-fill',
        'danger': 'bi-exclamation-octagon-fill',
        'warning': 'bi-exclamation-triangle-fill',
        'info': 'bi-info-circle-fill'
    };
    const icon = iconMap[type] || iconMap['info'];

    const html = `
        <div id="${id}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi ${icon} me-2"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    // Create element from HTML string
    const template = document.createElement('div');
    template.innerHTML = html.trim();
    const toastEl = template.firstChild;

    container.appendChild(toastEl);

    // Initialize Bootstrap Toast
    const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();

    // Remove from DOM after hidden
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

/**
 * Handle API fetch errors generically.
 * @param {Error} error 
 * @param {string} contextMessage 
 */
function handleApiError(error, contextMessage = "An error occurred") {
    console.error(contextMessage, error);
    showToast(`${contextMessage}: ${error.message}`, 'danger');
}
