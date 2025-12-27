
/**
 * Language Manager Module
 * Handles fetching, rendering, and managing (download/uninstall) languages.
 */

// Cache for languages
let languagesCache = null;

/**
 * Fetches available languages from backend.
 */
export async function fetchLanguages(forceRefresh = false) {
    if (languagesCache && !forceRefresh) {
        return languagesCache;
    }

    try {
        const response = await fetch('/languages');
        if (!response.ok) throw new Error('Failed to fetch languages');
        const data = await response.json();
        languagesCache = data.languages;
        return data.languages;
    } catch (e) {
        console.error("Error fetching languages:", e);
        return [];
    }
}

/**
 * Renders language options into a select element.
 * Groups by "Downloaded" and "Available".
 * @param {string} selectId - ID of the <select> element
 * @param {string|null} selectedValue - Value to select (optional)
 * @param {boolean} includeMultilingual - Add "Multilingual" option
 * @param {boolean} filterSource - If provided, only show targets for this source code
 */
export async function renderLanguageDropdown(selectId, selectedValue = null, includeMultilingual = false, filterSource = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Show loading state
    const originalText = select.options.length > 0 ? select.options[0].text : 'Loading...';
    // select.innerHTML = `<option disabled selected>Loading...</option>`;

    let langs = await fetchLanguages();

    // If source is specified, filter targets that have package from_code == filterSource
    if (filterSource) {
        langs = langs.filter(l => l.from_code === filterSource);
    }

    select.innerHTML = '';

    if (includeMultilingual) {
        const opt = document.createElement('option');
        opt.value = 'multilingual';
        opt.textContent = '⚡ Multilingual / Auto';
        select.appendChild(opt);
    }

    // Add "No Translation" or default if needed, dependent on context
    // E.g. for target language, "None" might be valid

    const installedGroup = document.createElement('optgroup');
    installedGroup.label = "⚡ Downloaded (Ready)";

    const availableGroup = document.createElement('optgroup');
    availableGroup.label = "📦 Available to Download";

    let hasInstalled = false;
    let hasAvailable = false;

    langs.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang.to_code; // Usually we select target lang

        // Use a composite key if we need both codes in value
        // But standardized logic usually assumes we pick 'es' and know source is 'en' or pick pairs
        // The implementation plan implies standard single-code selection, but internally we need pairs.
        // Let's store codes in data attributes.
        option.setAttribute('data-from', lang.from_code);
        option.setAttribute('data-to', lang.to_code);
        option.setAttribute('data-installed', lang.installed);

        let label = `${lang.from_name} ➝ ${lang.to_name}`;
        if (!lang.installed) {
            let info = 'Download';
            if (lang.size_bytes && lang.size_bytes > 0) {
                info += ` ${formatBytes(lang.size_bytes)}`;
            }
            label += ` (${info})`;
        }


        option.textContent = label;

        if (lang.installed) {
            installedGroup.appendChild(option);
            hasInstalled = true;
        } else {
            availableGroup.appendChild(option);
            hasAvailable = true;
        }
    });

    if (hasInstalled) select.appendChild(installedGroup);
    if (hasAvailable) select.appendChild(availableGroup);

    // Select the requested value if exists
    if (selectedValue) {
        select.value = selectedValue;
    }
}

/**
 * Helper to download language if not installed.
 * Returns true if installed or successfully downloaded.
 */
export async function ensureLanguageInstalled(fromCode, toCode) {
    // Check cache first
    let langs = await fetchLanguages();
    let pkg = langs.find(l => l.from_code === fromCode && l.to_code === toCode);

    if (pkg && pkg.installed) return true;

    // Ask user? Or just do it with toast?
    // Using simple confirm for now or implicit
    if (!confirm(`Language pack ${fromCode}➝${toCode} is not installed. Download now?`)) {
        return false;
    }

    // Trigger download
    // showToast from utils.js if available globally
    if (window.showToast) window.showToast(`Downloading ${fromCode}➝${toCode}...`, 'info');

    try {
        const res = await fetch('/languages/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from_code: fromCode, to_code: toCode })
        });

        const data = await res.json();
        if (res.ok) {
            if (window.showToast) window.showToast('Language installed!', 'success');
            // Refresh cache
            await fetchLanguages(true);
            return true;
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast(`Download failed: ${e.message}`, 'danger');
        return false;
    }
}

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
