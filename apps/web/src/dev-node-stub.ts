// Dev-only stub. The evals report writer imports node:fs/promises + node:path, which the
// production build externalizes — but `vite dev` would otherwise throw on the import. The
// browser never calls these (they only run in the CLI report writer), so no-ops are safe.
export const mkdir = async () => undefined;
export const writeFile = async () => undefined;
export const join = (...parts: string[]) => parts.join("/");
export default {};
