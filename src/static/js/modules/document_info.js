import { state } from './state.js';
import { getSetting } from './settings.js';

let isInfoPanelOpen = false;

export async function renderDocumentInfo(pdfBytes) {
    const container = document.getElementById('document-info-panel');
    if (!container) return;

    if (!state.pdfJsDoc) {
        container.innerHTML = '<div class="text-muted small">No document loaded</div>';
        return;
    }

    try {
        const metadata = await state.pdfJsDoc.getMetadata();
        const info = metadata.info || {};

        // Defaults
        const defAuthor = getSetting('pdf.defaultAuthor');
        const defCreator = getSetting('pdf.defaultCreator');
        const defProducer = getSetting('pdf.defaultProducer');

        // Resolve values
        const author = info.Author || (defAuthor ? `<span class="text-muted fst-italic" title="From Settings">${defAuthor}</span>` : '-');
        const creator = info.Creator || (defCreator ? `<span class="text-muted fst-italic" title="From Settings">${defCreator}</span>` : '-');
        const producer = info.Producer || (defProducer ? `<span class="text-muted fst-italic" title="From Settings">${defProducer}</span>` : '-');

        // Calculate file size
        const size = formatBytes(pdfBytes ? pdfBytes.byteLength : 0);

        // Get page size from first page
        const page = await state.pdfJsDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });
        const widthCm = (viewport.width / 72 * 2.54).toFixed(1);
        const heightCm = (viewport.height / 72 * 2.54).toFixed(1);
        const dimensions = `${widthCm} x ${heightCm} cm`;

        // Map relevant fields
        const props = [
            { label: 'File Name', value: state.filename },
            { label: 'Size', value: size },
            { label: 'Pages', value: state.pdfJsDoc.numPages },
            { label: 'Dimensions', value: dimensions },
            { label: 'Title', value: info.Title || '-' },
            { label: 'Author', value: author },
            { label: 'Creator', value: creator },
            { label: 'Created', value: formatDate(info.CreationDate) },
            { label: 'Modified', value: formatDate(info.ModDate) },
            { label: 'Producer', value: producer },
        ];

        // State preservation
        const isOpen = isInfoPanelOpen;
        const collapseClass = isOpen ? 'collapse show' : 'collapse';
        const chevronRotation = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';

        let html = `
            <div class="${collapseClass}" id="docInfoCollapse">
                <div class="card border-0 bg-transparent">
                    <div class="card-body px-0 py-0 pb-2">
                        <table class="table table-sm table-borderless small mb-0">
                            <tbody>
        `;

        props.forEach(prop => {
            if (prop.value && prop.value !== '-') {
                html += `
                    <tr>
                        <td class="text-muted pe-2" style="width: 80px;">${prop.label}:</td>
                        <td class="text-break user-select-all">${prop.value}</td>
                    </tr>
                `;
            }
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <button class="btn btn-sm btn-link text-body text-decoration-none w-100 d-flex justify-content-between align-items-center border-0 p-0" 
                    type="button" 
                    id="docInfoToggleBtn">
                <span class="fw-bold small"><i class="bi bi-info-circle me-2"></i>Document Properties</span>
                <i class="bi bi-chevron-up" style="transition: transform 0.2s ease; transform: ${chevronRotation}"></i>
            </button>
        `;

        container.innerHTML = html;

        // Manual Toggle Logic
        const toggleBtn = container.querySelector('#docInfoToggleBtn');
        const collapseEl = document.getElementById('docInfoCollapse');
        const chevron = container.querySelector('.bi-chevron-up');

        if (toggleBtn && collapseEl) {
            toggleBtn.className = 'btn btn-sm btn-link text-body text-decoration-none w-100 d-flex justify-content-between align-items-center border-0 p-0';
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling issues
                const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });

                if (isInfoPanelOpen) {
                    bsCollapse.hide();
                    isInfoPanelOpen = false;
                    chevron.style.transform = 'rotate(0deg)';
                } else {
                    bsCollapse.show();
                    isInfoPanelOpen = true;
                    chevron.style.transform = 'rotate(180deg)';
                }
            });
        }

    } catch (err) {
        console.error("Error rendering document info:", err);
        container.innerHTML = '<div class="text-danger small">Error loading properties</div>';
    }
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    // PDF date format: D:YYYYMMDDHHmmSSOHH'mm'
    // e.g. D:20230101120000+00'00'
    // or sometimes standard date string if processed already

    // Simple check if it looks like PDF date
    if (dateStr.startsWith('D:')) {
        const year = dateStr.slice(2, 6);
        const month = dateStr.slice(6, 8);
        const day = dateStr.slice(8, 10);
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}
