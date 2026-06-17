import type { BenchmarkCase } from "../types";
import { QUOTE_CASES } from "./quote";
import { SUPPLIER_CASES } from "./supplier";

export { QUOTE_CASES } from "./quote";
export { SUPPLIER_CASES } from "./supplier";
export { defineCase, presetFor, riskFor } from "./factory";

/** The full ClarityLoopBench seed corpus (36 cases: 20 quote + 16 supplier). */
export const ALL_CASES: BenchmarkCase[] = [...QUOTE_CASES, ...SUPPLIER_CASES];
