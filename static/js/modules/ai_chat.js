/**
 * AI Chat Module
 * Handles interactions with the local Ollama backend.
 */

import { state } from './state.js';
import * as ui from './ui.js';

let isIndexed = false;
let isIndexing = false;
let isAvailable = false;

export async function initAIChat() {
    console.log("Initializing AI Chat...");

    // Create UI elements
    createChatPanel();

    // Check status
    try {
        const response = await fetch('/ai/status');
        const data = await response.json();

        const statusEl = document.getElementById('ai-status');
        if (data.available && data.ollama_running) {
            isAvailable = true;
            statusEl.textContent = 'Local';
            statusEl.classList.add('online');

            // Populate models
            const select = document.getElementById('ai-model-select');
            const models = data.models.available_models || [];

            // Filter for likely LLMs (exclude embedding models if possible, but hard to know for sure)
            // We'll just show all, maybe prioritized
            models.sort();

            // Define curated list of efficient local models
            const RECOMMENDED_MODELS = [
                { id: 'llama3.2:1b', name: 'Llama 3.2 1B', size: '1.3GB', ram: '4GB+' },
                { id: 'llama3.2:3b', name: 'Llama 3.2 3B', size: '2.0GB', ram: '8GB+' },
                { id: 'mistral', name: 'Mistral 7B', size: '4.1GB', ram: '12GB+' },
                { id: 'llama3.1:8b', name: 'Llama 3.1 8B', size: '4.7GB', ram: '16GB+' },
                { id: 'deepseek-coder:6.7b', name: 'DeepSeek Coder 6.7B', size: '3.8GB', ram: '12GB+' }
            ];

            // Helper to estimate RAM based on model tags
            const getRamHint = (modelName) => {
                const m = modelName.toLowerCase();
                // Specific overrides
                if (m.includes('deepseek')) {
                    if (m.includes('33b')) return '32GB+';
                    if (m.includes('coder')) return '12GB+'; // Usually 6.7B
                    return '16GB+'; // Default safest assumption for Deepseek standard usually 7B/8B/R1
                }

                // Size tags
                if (m.includes('70b')) return '64GB+';
                if (m.includes('30b') || m.includes('32b') || m.includes('34b')) return '32GB+';
                if (m.includes('13b') || m.includes('14b')) return '24GB+';
                if (m.includes('8b')) return '16GB+';
                if (m.includes('7b')) return '12GB+';
                if (m.includes('3b')) return '8GB+';
                if (m.includes('1.5b') || m.includes('1b')) return '4GB+';

                return 'Unknown RAM';
            };

            // Filter installed models
            const installedModels = models.filter(m =>
                !m.includes('embed') &&
                !m.includes('70b')
            );

            select.innerHTML = '';
            const processed = new Set();

            // --- 1. INSTALLED MODELS ---
            const groupInstalled = document.createElement('optgroup');
            groupInstalled.label = "✓ Installed (Ready to use)";

            installedModels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;

                // Nicer numbering/name
                let niceName = m.split(':')[0];
                niceName = niceName.charAt(0).toUpperCase() + niceName.slice(1);

                const ram = getRamHint(m);
                opt.textContent = `✓ ${niceName} (needs ${ram} RAM)`;

                groupInstalled.appendChild(opt);
                processed.add(m);

                // Set default
                if (m.includes('llama3.2') && m.includes('3b')) opt.selected = true;
            });
            select.appendChild(groupInstalled);

            // --- 2. DOWNLOADABLE MODELS ---
            const groupDownload = document.createElement('optgroup');
            groupDownload.label = "⬇️ Download New Models";

            RECOMMENDED_MODELS.forEach(rec => {
                // Check if installed (loose match on ID base)
                const isInstalled = Array.from(processed).some(p => p.includes(rec.id.split(':')[0]));

                if (!isInstalled) {
                    const opt = document.createElement('option');
                    opt.value = rec.id;
                    opt.textContent = `⬇️ ${rec.name} (needs ${rec.ram} RAM) - ${rec.size} download`;
                    opt.setAttribute('data-download', 'true');
                    opt.setAttribute('data-size', rec.size);
                    opt.setAttribute('data-name', rec.name);
                    groupDownload.appendChild(opt);
                }
            });

            if (groupDownload.children.length > 0) {
                select.appendChild(groupDownload);
            }

            // Fallback selection if nothing selected
            if (select.selectedIndex === -1 && installedModels.length > 0) select.selectedIndex = 0;

            // Change Listener for Downloads
            select.onchange = async function () {
                const selectedOpt = this.options[this.selectedIndex];
                if (selectedOpt.getAttribute('data-download') === 'true') {
                    const modelName = selectedOpt.value;
                    const size = selectedOpt.getAttribute('data-size');
                    const prettyName = selectedOpt.getAttribute('data-name') || modelName;

                    const confirmDownload = confirm(
                        `⚠️ Start Download?\n\n` +
                        `Model: ${prettyName}\n` +
                        `Download Size: ~${size}\n\n` +
                        `This will download data to your machine. It may take a few minutes.`
                    );

                    if (confirmDownload) {
                        addBotMessage(`Starting download of ${prettyName}... I'll let you know when it's ready.`);
                        try {
                            await fetch('/ai/pull', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ model: modelName })
                            });
                        } catch (e) {
                            addBotMessage("Error triggering download: " + e.message);
                        }
                    } else {
                        // Cancelled: Revert to first installed option
                        // Find first option that is NOT a download (in first group)
                        if (groupInstalled.children.length > 0) {
                            this.value = groupInstalled.children[0].value;
                        } else {
                            this.selectedIndex = 0; // fallback
                        }
                    }
                }
            };

            // Check if we need to index
            checkIndexStatus();
        } else {
            statusEl.textContent = 'Not Running';
            statusEl.classList.add('offline');
            addBotMessage("Local AI is unavailable. Please ensure Ollama is running (`ollama serve`).");
            disableInput(true);
        }
    } catch (e) {
        console.error("AI Status Check Failed", e);
        document.getElementById('ai-status').textContent = 'Error';
    }
}

function createChatPanel() {
    const html = `
    <button id="ai-toggle-btn" title="Open AI Chat">
        <i class="bi bi-robot"></i>
    </button>
    <div id="ai-chat-panel" class="hidden">
        <div class="ai-chat-header" id="ai-header">
            <div class="ai-header-content">
                <h3>🤖 Chat with PDF</h3>
                <select id="ai-model-select" title="Choose AI Model">
                    <option disabled selected>Loading...</option>
                </select>
            </div>
            <div class="ai-header-controls">
                <span class="ai-status" id="ai-status">Connecting...</span>
                <i class="bi bi-x-lg" id="ai-minimize-btn" title="Close"></i>
            </div>
        </div>
        <div class="ai-chat-messages" id="ai-messages">
            <div class="ai-message bot">Hello! I'm your local AI assistant. I can answer questions about this document securely on your device.</div>
        </div>
        <div class="ai-chat-input">
            <input type="text" id="ai-question" placeholder="Ask a question..." autocomplete="off">
            <button id="ai-send-btn"><i class="bi bi-send-fill"></i></button>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Event Listeners
    const panel = document.getElementById('ai-chat-panel');
    const toggleBtn = document.getElementById('ai-toggle-btn');
    const header = document.getElementById('ai-header'); // Only click on header background?
    const minimizeBtn = document.getElementById('ai-minimize-btn');
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-question');
    const select = document.getElementById('ai-model-select');

    // Toggle Logic
    const toggleChat = (e) => {
        // Don't toggle if clicking select
        if (e && e.target === select) return;

        panel.classList.toggle('hidden');
        if (panel.classList.contains('hidden')) {
            toggleBtn.style.display = 'flex';
        } else {
            toggleBtn.style.display = 'none';
        }
    };

    // Start hidden, show button
    panel.classList.add('hidden');
    toggleBtn.style.display = 'flex';

    toggleBtn.addEventListener('click', () => toggleChat());
    minimizeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleChat(); });
    // header.addEventListener('click', toggleChat); // Removed to avoid conflict with select

    // Send Logic
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function checkIndexStatus() {
    // In a real session, we'd check if this specific file hash is indexed.
    // For now, we'll prompt the user to index if they try to chat.
    addBotMessage("I'm ready. Click 'Index Document' to start analyzes this PDF.", true);
}

async function indexDocument() {
    if (isIndexing) return;

    addBotMessage("Indexing document... This may take a moment depending on file size.");
    isIndexing = true;
    disableInput(true);

    try {
        const response = await fetch('/ai/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: window.filename })
        });

        const data = await response.json();

        if (data.success) {
            isIndexed = true;
            addBotMessage(`Indexing complete! Processed ${data.chunks_indexed} chunks. You can now ask questions.`);
            disableInput(false);
        } else {
            addBotMessage("Indexing failed: " + data.error);
        }
    } catch (e) {
        addBotMessage("Error connecting to server: " + e.message);
    } finally {
        isIndexing = false;
    }
}

async function sendMessage() {
    const input = document.getElementById('ai-question');
    const question = input.value.trim();
    const modelSelect = document.getElementById('ai-model-select');
    const model = modelSelect.value;

    if (!question) return;

    // User Message
    addMessage(question, 'user');
    input.value = '';
    disableInput(true);

    // Auto-index if needed
    if (!isIndexed) {
        await indexDocument();
        if (!isIndexed) return; // Stop if failed
    }

    // Show waiting state
    const loadingId = addTypingIndicator();

    try {
        const response = await fetch('/ai/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                model: model
            })
        });

        const data = await response.json();
        removeMessage(loadingId);

        if (data.error) {
            addBotMessage("Error: " + data.error);
        } else {
            let text = data.answer;
            // Append sources
            if (data.sources && data.sources.length > 0) {
                // text += "\n\nSources:\n";
                // data.sources.forEach(s => text += `- Page ${s.page}: "${s.content.substring(0, 50)}..."\n`);
                // We render sources nicely in HTML instead
                addBotMessage(text, false, data.sources);
            } else {
                addBotMessage(text);
            }
        }

    } catch (e) {
        removeMessage(loadingId);
        addBotMessage("Network error: " + e.message);
    } finally {
        disableInput(false);
    }
}

function addMessage(text, type) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = `ai-message ${type}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addBotMessage(text, isAction = false, sources = null) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = `ai-message bot`;

    if (isAction) {
        div.innerHTML = `${text} <br><button class="btn btn-sm btn-primary mt-2" onclick="window.indexPdfAction()">Index Document</button>`;
        window.indexPdfAction = indexDocument; // Expose for click
    } else {
        // Convert simple markdown to HTML (basic)
        let html = text.replace(/\n/g, '<br>');

        if (sources) {
            html += `<div class="mt-2 pt-2 border-top text-muted small"><strong>Sources:</strong>`;
            sources.forEach(s => {
                const pageNum = parseInt(s.page) + 1; // LangChain uses 0-indexed sometimes
                html += `<div class="mt-1">📄 <strong>Page ${s.page}</strong>: ${s.content}</div>`;
            });
            html += `</div>`;
        }
        div.innerHTML = html;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
    const container = document.getElementById('ai-messages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'typing';
    div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function disableInput(disabled) {
    document.getElementById('ai-question').disabled = disabled;
    document.getElementById('ai-send-btn').disabled = disabled;
    if (!disabled) document.getElementById('ai-question').focus();
}
