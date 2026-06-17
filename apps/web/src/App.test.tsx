import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the dashboard panels", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "ClarityLoop" })).toBeInTheDocument();
    expect(screen.getByTestId("entropy-heatmap")).toBeInTheDocument();
    expect(screen.getByText("Input Request")).toBeInTheDocument();
    expect(screen.getByText("Generated Workflow")).toBeInTheDocument();
    expect(screen.getByText("Next Best Action")).toBeInTheDocument();
    expect(screen.getByText("Trace")).toBeInTheDocument();
  });
});
