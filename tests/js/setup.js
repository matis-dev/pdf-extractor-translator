if (typeof document === 'undefined') {
  global.document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    fullscreenElement: null,
    documentElement: { requestFullscreen: () => {} },
    exitFullscreen: () => {}
  };
  global.window = {
    addEventListener: () => {},
    getSelection: () => ({ removeAllRanges: () => {} })
  };
}
