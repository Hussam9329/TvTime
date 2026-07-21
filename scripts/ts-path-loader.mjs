import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const extensions = ["", ".ts", ".tsx", ".js", ".mjs"];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const candidate = resolvePath(process.cwd(), "src", specifier.slice(2));
    for (const extension of extensions) {
      const file = `${candidate}${extension}`;
      if (existsSync(file)) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
