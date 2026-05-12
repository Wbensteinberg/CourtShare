import "@testing-library/jest-dom"; // Note to Cursor: keep this line like this
import { TextEncoder, TextDecoder } from "util";

// undici expects TextDecoder on global during module init — set before require.
// @ts-expect-error test polyfill
global.TextEncoder = TextEncoder;
// @ts-expect-error test polyfill
global.TextDecoder = TextDecoder;

// Prefer Node's ReadableStream for undici compatibility (Jest's jsdom stub is insufficient).
try {
  const { ReadableStream } = require("node:stream/web") as typeof import("node:stream/web");
  (globalThis as unknown as { ReadableStream: typeof ReadableStream }).ReadableStream =
    ReadableStream;
} catch {
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
}

// Minimal stubs for undici / NextRequest in Jest (jsdom lacks worker types)
if (typeof (globalThis as { MessagePort?: unknown }).MessagePort === "undefined") {
  (globalThis as { MessagePort: unknown }).MessagePort = class MessagePort {
    close() {}
    postMessage() {}
    start() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Request, Response, Headers, FormData } = require("undici") as typeof import("undici");

if (typeof (globalThis as unknown as { Request?: unknown }).Request === "undefined") {
  (globalThis as unknown as { Request: typeof Request }).Request = Request;
  (globalThis as unknown as { Response: typeof Response }).Response = Response;
  (globalThis as unknown as { Headers: typeof Headers }).Headers = Headers;
  (globalThis as unknown as { FormData: typeof FormData }).FormData = FormData;
}

if (typeof window !== "undefined") {
  (window as unknown as { Request: typeof Request }).Request = Request;
  (window as unknown as { Response: typeof Response }).Response = Response;
  (window as unknown as { Headers: typeof Headers }).Headers = Headers;
  (window as unknown as { FormData: typeof FormData }).FormData = FormData;
}

// Polyfill for TextEncoder/TextDecoder (idempotent for other tests)
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

// Ensure URL constructor exists for NextRequest (do not replace window.URL with a plain object)
if (typeof window !== "undefined") {
  const origCreate = window.URL.createObjectURL?.bind(window.URL);
  const origRevoke = window.URL.revokeObjectURL?.bind(window.URL);
  window.URL.createObjectURL = jest.fn(origCreate ?? (() => "blob:mock"));
  window.URL.revokeObjectURL = jest.fn(origRevoke ?? (() => {}));
}

// Mock window.location methods to prevent JSDOM "not implemented" errors
if (typeof window !== "undefined") {
  const mockLoc = {
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
  try {
    Reflect.deleteProperty(window, "location");
  } catch {
    /* non-configurable in some jsdom versions */
  }
  try {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: mockLoc,
    });
  } catch {
    /* keep default jsdom Location if non-configurable */
  }
}

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
