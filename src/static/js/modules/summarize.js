
import { state } from './state.js';

export async function summarizeDocument() {
    // Globals from utils.js
    const handleApiError = window.handleApiError || console.error;
    const showToast = window.showToast || console.log;

    // 1. Check if indexed (we can just try to ask, if not indexed backend might fail or auto-index? 
    // The current /ai/ask implementation assumes index exists or it might try to query existing.
    // Ideally we ensure index exists.

    // Show loading overlay
    const overlay = document.getElementById('processing-overlay');
    const statusText = document.getElementById('status-text');
    if (overlay) {
        overlay.style.display = 'flex';
        statusText.innerText = 'Analyzing document...';
    }

    try {
        // Ensure index first?
        // We can call /ai/index just to be sure. It's usually fast if already indexed (vector store check).
        if (statusText) statusText.innerText = 'Indexing content...';
        await fetch('/ai/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: state.filename })
        });

        // Ask for summary
        if (statusText) statusText.innerText = 'Generating summary...';
        const response = await fetch('/ai/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: "Summarize this document in a concise manner, finding the main topics and key takeaways.",
                model: 'llama3' // or default
            })
        });

        const data = await response.json();

        if (overlay) overlay.style.display = 'none';

        if (data.answer) {
            showSummaryModal(data.answer);
        } else {
            throw new Error(data.error || "No summary returned");
        }

    } catch (e) {
        if (overlay) overlay.style.display = 'none';
        handleApiError(e, "Summarization Failed");
    }
}

function showSummaryModal(summaryText) {
    // Create modal dynamically or use existing 'generic' modal if we had one.
    // We'll create a dedicated one in HTML or inject it.
    // Let's assume we add a #summaryModal to HTML.

    // Parse markdown if marked is available
    let content = summaryText;
    if (window.marked) {
        content = window.marked.parse(summaryText);
    }

    document.getElementById('summary-content').innerHTML = content;
    const modal = new bootstrap.Modal(document.getElementById('summaryModal'));
    modal.show();
}
