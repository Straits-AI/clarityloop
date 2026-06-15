import { describe, it, expect } from "vitest";
import { CLARITYLOOP_CORE_VERSION } from "./index";
describe("core sanity", () => {
  it("exports a version string", () => {
    expect(typeof CLARITYLOOP_CORE_VERSION).toBe("string");
  });
});
