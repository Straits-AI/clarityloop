// Browser no-op stub for node:* builtins that @clarityloop/evals' report writer imports
// transitively. The browser never calls these — they only run in the CLI report writer — so
// no-ops are safe. Mapped for both `vite dev` and the production build (see vite.config.ts).
export const mkdir = async () => undefined;
export const writeFile = async () => undefined;
export const readFile = async () => "";
export const readdir = async () => [];
export const stat = async () => ({});
export const join = (...parts: string[]) => parts.join("/");
export const resolve = (...parts: string[]) => parts.join("/");
export const dirname = (p: string) => p.split("/").slice(0, -1).join("/");
export const basename = (p: string) => p.split("/").pop() ?? "";
export const extname = (p: string) => {
  const b = p.split("/").pop() ?? "";
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i) : "";
};
export default {};
