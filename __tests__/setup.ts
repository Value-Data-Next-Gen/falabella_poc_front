import '@testing-library/jest-dom';

// jsdom no implementa matchMedia ni ResizeObserver — los stubeamos.
window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  media: '',
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}) as any);

(window as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
