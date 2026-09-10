import '@testing-library/jest-dom/vitest';

// jsdom은 ResizeObserver를 구현하지 않는다. cmdk(콤보박스 목록)가 크기 관찰에 사용하므로 no-op으로 대체한다.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
