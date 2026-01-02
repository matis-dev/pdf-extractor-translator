
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
/**
 * Renders language options into a select element.
 * Groups by "Downloaded" and "Available".
 * @param {string} selectId - ID of the <select> element
 * @param {string|null} selectedValue - Value to select (optional)
 * @param {boolean} includeMultilingual - Add "Multilingual" option
 * @param {string|null} filterSource - If provided, only show targets for this source code (used in 'target' or 'pair' mode)
 * @param {boolean} includeNone - Add "No Translation" option
 * @param {string} mode - 'pair' (default), 'source', 'target'
 */
export async function renderLanguageDropdown(selectId, selectedValue = null, includeMultilingual = false, filterSource = null, includeNone = false, mode = 'pair') {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Show loading state
    if (select.options.length === 0) {
        const loadingOpt = document.createElement('option');
        loadingOpt.text = 'Loading...';
        select.add(loadingOpt);
    }

    let langs = await fetchLanguages();

    // If source is specified, filter targets that have package from_code == filterSource
    if (filterSource && (mode === 'target' || mode === 'pair')) {
        langs = langs.filter(l => l.from_code === filterSource);
    }

    select.innerHTML = '';

    if (includeNone) {
        const opt = document.createElement('option');
        opt.value = 'none';
        opt.textContent = 'No Translation';
        select.appendChild(opt);
    }

    if (includeMultilingual) {
        const opt = document.createElement('option');
        opt.value = 'multilingual';
        opt.textContent = '⚡ Multilingual / Auto';
        select.appendChild(opt);
    }

    const installedGroup = document.createElement('optgroup');
    installedGroup.label = "⚡ Downloaded (Ready)";

    const availableGroup = document.createElement('optgroup');
    availableGroup.label = "📦 Available to Download";

    let hasInstalled = false;
    let hasAvailable = false;

    // Process items based on mode
    let items = [];

    if (mode === 'pair') {
        items = langs.map(l => ({
            value: l.to_code, // Default legacy behavior
            label: `${l.from_name} ➝ ${l.to_name}`,
            installed: l.installed,
            size: l.size_bytes,
            data: { from: l.from_code, to: l.to_code }
        }));
    } else if (mode === 'source') {
        const unique = new Map();
        langs.forEach(l => {
            if (!unique.has(l.from_code)) {
                unique.set(l.from_code, {
                    value: l.from_code,
                    label: l.from_name,
                    installed: l.installed,
                    size: l.size_bytes, // Store size
                    data: { code: l.from_code }
                });
            } else if (l.installed) {
                unique.get(l.from_code).installed = true;
            }
        });
        items = Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
    } else if (mode === 'target') {
        const unique = new Map();
        langs.forEach(l => {
            if (!unique.has(l.to_code)) {
                unique.set(l.to_code, {
                    value: l.to_code,
                    label: l.to_name,
                    installed: l.installed,
                    size: l.size_bytes, // Store size
                    data: { code: l.to_code }
                });
            } else {
                // If we encounter another package for same target,
                // we should prefer 'installed'. If both not installed, what about size?
                // If filterSource implies we only have one, this is fine.
                // If auto, we accept first size or if we want logic we can add here.
                if (l.installed) unique.get(l.to_code).installed = true;
            }
        });
        items = Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));
    }

    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;

        let label = item.label;
        // Display download info if not installed.
        // Enabled for source, target and pair modes.
        if (!item.installed && (mode === 'pair' || mode === 'target' || mode === 'source')) {
            let info = 'Download';
            if (item.size && item.size > 0) info += ` ${formatBytes(item.size)}`;
            label += ` (${info})`;
        }

        option.textContent = label;
        if (item.data) {
            Object.keys(item.data).forEach(k => option.setAttribute(`data-${k}`, item.data[k]));
        }
        option.setAttribute('data-installed', item.installed);

        if (item.installed) {
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
