import "@testing-library/jest-dom"; // Note to Cursor: keep this line like this
import { TextEncoder, TextDecoder } from "util";

// Polyfill for ReadableStream
if (typeof global.ReadableStream === "undefined") {
  // @ts-ignore
  global.ReadableStream = class MockReadableStream {
    constructor() {}
    getReader() {
      return {
        read: () => Promise.resolve({ done: true, value: undefined }),
        releaseLock: () => {},
      };
    }
  };
}

// Polyfill for TextEncoder/TextDecoder
// @ts-ignore
if (typeof global.TextEncoder === "undefined") {
  // @ts-ignore
  global.TextEncoder = TextEncoder;
}

// @ts-ignore
if (typeof global.TextDecoder === "undefined") {
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}

// Mock window.URL.createObjectURL
if (typeof window !== "undefined") {
  Object.defineProperty(window, "URL", {
    value: {
      createObjectURL: jest.fn(),
      revokeObjectURL: jest.fn(),
    },
  });
}

// Mock window.location methods to prevent JSDOM "not implemented" errors
// Delete first to avoid "Cannot redefine property" error
delete (window as any).location;
(window as any).location = {
  href: "http://localhost:3000",
  origin: "http://localhost:3000",
  protocol: "http:",
  host: "localhost:3000",
  hostname: "localhost",
  port: "3000",
  pathname: "/",
  search: "",
  hash: "",
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
};

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Polyfill for requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 0);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Mock alert to prevent errors in tests
global.alert = jest.fn();
