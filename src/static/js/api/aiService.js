/**
 * @typedef {Object} AIStatusResponse
 * @property {boolean} available
 * @property {boolean} ollama_running
 * @property {string[]} models
 * @property {string} [error]
 * @property {boolean} langchain_installed
 */

/**
 * @typedef {Object} AISummarizeResponse
 * @property {string} summary
 * @property {'brief'|'detailed'} mode
 * @property {string} model_used
 * @property {string|null} [error]
 */

const BASE_URL = '/api/ai';

export const AIService = {
    /**
     * Checks AI availability.
     * @returns {Promise<AIStatusResponse>}
     */
    async checkStatus() {
        const res = await fetch(`${BASE_URL}/status`);
        return res.json();
    },

    /**
     * Indexes a PDF file.
     * @param {string} filename 
     * @returns {Promise<{success: boolean, chunks_indexed: number}>}
     */
    async indexPDF(filename) {
        const res = await fetch(`${BASE_URL}/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
    },

    /**
     * Summarizes the current document.
     * @param {'brief'|'detailed'} mode 
     * @returns {Promise<AISummarizeResponse>}
     */
    async summarize(mode = 'brief') {
        const res = await fetch(`${BASE_URL}/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        return res.json();
    },

    /**
     * Asks a question.
     * @param {string} question
     * @param {string} [model]
     * @returns {Promise<any>}
     */
    async ask(question, model) {
        const res = await fetch(`${BASE_URL}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, model })
        });
        return res.json();
    },

    /**
     * Pulls a model.
     * @param {string} model 
     * @returns {Promise<any>}
     */
    async pullModel(model) {
        const res = await fetch(`${BASE_URL}/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });
        return res.json();
    }
};
