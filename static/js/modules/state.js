
export const state = {
    pdfDoc: null,
    pdfJsDoc: null,
    pdfBytes: null,
    filename: '',
    selectedPageIndex: 0,
    zoom: 1.0,
    modes: {
        text: false,
        redact: false,
        highlight: false,
        extract: false,
        note: false,
        shape: null // 'rect', 'ellipse', 'line', 'arrow'
    },
    shapeSettings: {
        strokeColor: '#ff0000',
        strokeWidth: 2,
        fillColor: 'transparent'
    },
    pageToExtractIndex: -1,
    // Constants
    MAX_HISTORY: 50
};

export const history = {
    undoStack: [],
    redoStack: []
};
