
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
        select: false,
        hand: false,
        zoomIn: false,
        zoomOut: false,
        shape: null, // 'rect', 'ellipse', 'line', 'arrow'
        formField: false
    },
    formFieldType: null, // 'textfield', 'checkbox', 'radio', 'dropdown', 'signature'
    formSettings: {
        fontFamily: 'Helvetica',
        fontSize: 12,
        textColor: '#000000',
        backgroundColor: '#ffffff',
        backgroundAlpha: 1.0,
        borderColor: '#000000',
        borderWidth: 1,
        textAlign: 'left'
    },
    shapeSettings: {
        strokeColor: '#ff0000',
        strokeWidth: 2,
        fillColor: 'transparent'
    },
    pageToExtractIndex: -1,
    // Constants
    MAX_HISTORY: 50,
    hasUnsavedChanges: false
};

export const history = {
    undoStack: [],
    redoStack: []
};
