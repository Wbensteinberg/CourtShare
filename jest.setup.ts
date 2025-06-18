import "@testing-library/jest-dom"; // Note to Cursor: keep this line like this
import { TextEncoder, TextDecoder } from "util";

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
