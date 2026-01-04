
export function openSanitizeModal() {
    const modal = new bootstrap.Modal(document.getElementById('sanitizeModal'));
    modal.show();
}

export async function runSanitization() {
    const removeJS = document.getElementById('sanitize-js').checked;
    const removeMetadata = document.getElementById('sanitize-metadata').checked;
    const removeLayers = document.getElementById('sanitize-layers').checked;
    const removeEmbedded = document.getElementById('sanitize-embedded').checked;

    if (!removeJS && !removeMetadata && !removeLayers && !removeEmbedded) {
        window.showToast("Please select at least one option", "warning");
        return;
    }

    // Close modal
    const modalEl = document.getElementById('sanitizeModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    window.showProcessingOverlay("Sanitizing Document...");

    try {
        const formData = new FormData();
        formData.append('filename', window.filename);
        formData.append('remove_js', removeJS);
        formData.append('remove_metadata', removeMetadata);
        formData.append('remove_layers', removeLayers);
        formData.append('remove_embedded', removeEmbedded);

        const response = await fetch('/api/sanitize', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Sanitization failed');
        }

        const result = await response.json();

        // Hide overlay
        document.getElementById('processing-overlay').style.display = 'none';

        // Show Summary
        let summaryText = "Sanitization Complete!\n\n";
        if (result.summary && result.summary.length > 0) {
            summaryText += "Items Removed:\n";
            result.summary.forEach(item => {
                summaryText += `- ${item}\n`;
            });
        } else {
            summaryText += "No items were found to remove.";
        }

        // Use standard showToast for success, or a modal if it's long?
        // Story says "Then I should see a summary of what was removed"
        // Let's use an alert or a simple modal. We have a summaryModal.
        // Let's re-use summaryModal if it supports text injection.

        const summaryContent = document.getElementById('summary-content');
        if (summaryContent) {
            summaryContent.innerText = summaryText;
            new bootstrap.Modal(document.getElementById('summaryModal')).show();
        } else {
            window.showToast("Sanitization Complete", "success");
        }

        // If a new file was returned, download it or reload?
        // Usually Sanitize returns a downloadable file.
        // Story AC2: "And the document should still be viewable"
        // Typically we want the user to download the sanitized version.

        if (result.url) {
            // Initiate download
            const link = document.createElement('a');
            link.href = result.url;
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            link.remove();
        }

    } catch (error) {
        document.getElementById('processing-overlay').style.display = 'none';
        window.showToast(error.message, "error");
        console.error(error);
    }
}

// Make accessible globally
window.openSanitizeModal = openSanitizeModal;
window.runSanitization = runSanitization;
