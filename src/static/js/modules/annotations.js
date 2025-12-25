
/**
 * Annotations Facade Module
 * Re-exports functionality from split modules for backward compatibility.
 */

export * from './drawing.js';
export * from './textAnnotations.js';
export * from './imageAnnotations.js';
export * from './watermark.js';
export * from './commitAnnotations.js';
export * from './formFields.js';

// Backward compatibility or legacy functions if any were left that didn't fit.
// Specifically `handleSelectionClick` was referenced in `drawing.js`.
// If it was supposed to be here, we should ensure it exists.
// Codebase analysis showed it might have been missing or in `ui.js`.
// I will not define it here if it wasn't defined in the original `annotations.js` visible code.
