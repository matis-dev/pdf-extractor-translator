
import { state } from './state.js';
import { AIService } from '../api/aiService.js';

export async function summarizeDocument(mode = 'brief') {
    // Globals from utils.js
    const handleApiError = window.handleApiError || console.error;
    const showToast = window.showToast || console.log;

    // Show loading overlay
    const overlay = document.getElementById('processing-overlay');
    const statusText = document.getElementById('status-text');
    if (overlay) {
        overlay.style.display = 'flex';
        statusText.innerText = 'Analyzing document...';
    }

    try {
        // Ensure index first
        if (statusText) statusText.innerText = 'Indexing content...';
        // Ensure index first
        if (statusText) statusText.innerText = 'Indexing content...';
        await AIService.indexPDF(state.filename);

        // Ask for summary
        if (statusText) statusText.innerText = `Generating ${mode} summary...`;

        const data = await AIService.summarize(mode);

        if (overlay) overlay.style.display = 'none';

        if (data.summary) {
            showSummaryModal(data.summary, mode);
        } else {
            throw new Error(data.error || "No summary returned");
        }

    } catch (e) {
        if (overlay) overlay.style.display = 'none';
        handleApiError(e, "Summarization Failed");
    }
}

function showSummaryModal(summaryText, currentMode) {
    // 1. Process Page References: [Page X] -> clickable link
    // We regex replace to a span with data attribute
    const processedText = summaryText.replace(/\[Page (\d+)\]/g, (match, pageNum) => {
        return `<a href="#" class="page-ref badge bg-light text-primary text-decoration-none border" data-page="${pageNum}" onclick="event.preventDefault(); window.navigateToPage(${pageNum})"><i class="bi bi-cursor-fill me-1" style="font-size:0.7em"></i>Page ${pageNum}</a>`;
    });

    // 2. Parse Markdown
    let content = processedText;
    if (window.marked) {
        content = window.marked.parse(processedText);
    }

    // 3. Inject into Modal
    const container = document.getElementById('summary-content');

    // Add Controls if not present
    // Using a more structured toolbar with premium feel (Bootstrap utility classes)
    const toolbar = `
        <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary ${currentMode === 'brief' ? 'active' : ''}" onclick="window.summarizeDocument('brief')">
                    <i class="bi bi-list-ul me-1"></i>Executive
                </button>
                <button class="btn btn-outline-primary ${currentMode === 'detailed' ? 'active' : ''}" onclick="window.summarizeDocument('detailed')">
                    <i class="bi bi-file-text me-1"></i>Detailed
                </button>
            </div>
            
            <div class="btn-group btn-group-sm ms-2">
                <button class="btn btn-outline-secondary" onclick="window.copySummaryToClipboard()" title="Copy to Clipboard">
                    <i class="bi bi-clipboard me-1"></i>Copy
                </button>
                <button class="btn btn-outline-secondary" onclick="window.downloadSummaryAsFile()" title="Export as Markdown">
                    <i class="bi bi-download me-1"></i>Export
                </button>
            </div>

            <div class="text-muted small ms-auto d-none d-sm-block">
                <i class="bi bi-stars text-warning me-1"></i>AI Generated
            </div>
        </div>
    `;

    // Store raw text for copy/export
    window._lastSummaryText = summaryText;

    container.innerHTML = toolbar + `<div class="summary-body text-break">${content}</div>`;

    // 4. Show Modal
    const modalEl = document.getElementById('summaryModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

// Global helper functions
window.copySummaryToClipboard = async function () {
    if (!window._lastSummaryText) return;
    try {
        await navigator.clipboard.writeText(window._lastSummaryText);
        // Show temporary success feedback on the button
        const btn = document.querySelector('button[onclick="window.copySummaryToClipboard()"]');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check me-1"></i>Copied!';
            btn.classList.remove('btn-outline-secondary');
            btn.classList.add('btn-success');
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('btn-success');
                btn.classList.add('btn-outline-secondary');
            }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Failed to copy to clipboard');
    }
};

window.downloadSummaryAsFile = function () {
    if (!window._lastSummaryText) return;
    const blob = new Blob([window._lastSummaryText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary_${state.filename || 'document'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Global expose for button onclicks
window.summarizeDocument = summarizeDocument;
window.navigateToPage = function (pageNum) {
    if (window.PDFViewerApplication) {
        window.PDFViewerApplication.page = parseInt(pageNum);
        // Scroll to view
        // Hide modal so user can see the page. 
        // Logic: User can reopen summary to see it again (state is preserved if not re-run).
        // Actually, re-running is default behavior of button. Maybe we should preserve state?
        // For now, simple hide is best for "Navigate" validation.
        const modal = bootstrap.Modal.getInstance(document.getElementById('summaryModal'));
        if (modal) modal.hide();
    } else {
        console.error("PDFViewerApplication not found");
    }
};
