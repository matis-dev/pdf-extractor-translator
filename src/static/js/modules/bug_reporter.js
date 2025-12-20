
/**
 * Bug Reporting Module
 * Handles UI logic for generating and downloading structured bug reports.
 */

class BugReporter {
    constructor() {
        this.endpoint = '/api/generate-report';
        this.systemInfoEndpoint = '/api/system-info';
    }

    async init() {
        this.loadSystemInfo();
        this.attachEventListeners();
    }

    attachEventListeners() {
        const generateBtn = document.getElementById('generate-report-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateReport());
        }
    }

    async loadSystemInfo() {
        try {
            const response = await fetch(this.systemInfoEndpoint);
            const info = await response.json();

            const infoContainer = document.getElementById('system-info-preview');
            if (infoContainer) {
                infoContainer.innerHTML = `
                    <small class="text-muted d-block">OS: ${info.os}</small>
                    <small class="text-muted d-block">Python: ${info.python_version}</small>
                    <small class="text-muted d-block">DeepMind AI: ${info.langchain_available ? 'Active' : 'Missing Dependencies'}</small>
                `;
            }
        } catch (error) {
            console.error('Failed to load system info', error);
        }
    }

    async generateReport() {
        const description = document.getElementById('bug-description').value;
        const includeLogs = document.getElementById('include-logs-check').checked;
        const btn = document.getElementById('generate-report-btn');
        const originalText = btn.innerHTML;

        if (!description.trim()) {
            alert('Please describe the issue briefly.');
            return;
        }

        try {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
            btn.disabled = true;

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, include_logs: includeLogs })
            });

            const data = await response.json();

            if (response.ok) {
                // Determine GitHub issue link content
                const title = encodeURIComponent("Bug Report: " + description.substring(0, 50) + "...");
                const body = encodeURIComponent(
                    `**Description**\n${description}\n\n` +
                    `**Attachments**\nPlease drag and drop the generated ZIP file here.\n\n` +
                    `**Context**\n[Auto-generated from local reporter]`
                );
                const githubUrl = `https://github.com/your-repo/issues/new?title=${title}&body=${body}`;

                // Swap footer content to show success
                const footer = document.getElementById('bug-report-footer');
                footer.innerHTML = `
                    <div class="d-grid gap-2 w-100">
                        <a href="${data.url}" class="btn btn-primary">
                            <i class="bi bi-download me-2"></i> Download Report (ZIP)
                        </a>
                        <a href="${githubUrl}" target="_blank" class="btn btn-outline-secondary">
                            <i class="bi bi-github me-2"></i> Open GitHub Issue
                        </a>
                    </div>
                `;
            } else {
                alert('Error: ' + data.error);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }

        } catch (error) {
            console.error(error);
            alert('Failed to generate report.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const reporter = new BugReporter();

    // Only init if the modal exists in the DOM
    const modal = document.getElementById('bugReportModal');
    if (modal) {
        modal.addEventListener('shown.bs.modal', () => reporter.init());
    }
});
