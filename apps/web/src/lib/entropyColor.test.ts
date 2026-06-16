import { describe, it, expect } from "vitest";
import { entropyColor } from "./entropyColor";

describe("entropyColor", () => {
  it("maps low entropy to green and high to red", () => {
    expect(entropyColor(0)).toBe("hsl(120, 70%, 45%)");
    expect(entropyColor(1)).toBe("hsl(0, 70%, 45%)");
    expect(entropyColor(0.5)).toBe("hsl(60, 70%, 45%)");
  });

  it("clamps out-of-range values", () => {
    expect(entropyColor(-1)).toBe("hsl(120, 70%, 45%)");
    expect(entropyColor(2)).toBe("hsl(0, 70%, 45%)");
  });
});
