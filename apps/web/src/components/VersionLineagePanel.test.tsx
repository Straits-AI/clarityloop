import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { VersionLineagePanel } from "./VersionLineagePanel";
import { DEMO_VERSIONS } from "../lib/promotion-demo";

describe("VersionLineagePanel (jsdom, no network)", () => {
  it("renders parent-first lineage with depth padding and a promoted badge", () => {
    render(<VersionLineagePanel versions={DEMO_VERSIONS} />);

    expect(screen.getByText("Procedure version history")).toBeInTheDocument();

    const v1 = screen.getByText("v1").closest("li")!;
    const v2 = screen.getByText("v2").closest("li")!;

    // Root has no indent; child is indented one level (18px per depth).
    expect(v1.style.marginLeft).toBe("0px");
    expect(v2.style.marginLeft).toBe("18px");

    // Only the promoted root carries the badge.
    expect(within(v1).queryByText("promoted")).toBeTruthy();
    expect(within(v2).queryByText("promoted")).toBeNull();
  });
});
