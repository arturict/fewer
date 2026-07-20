import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = resolve(root, "dist");

export const RUNTIME_FILES = Object.freeze([
  "icon.svg",
  "index.html",
  "manifest.webmanifest",
  "src/app.js",
  "src/domain.js",
  "src/storage.js",
  "styles.css",
]);

export function assertSafeBuildOutput(outputDirectory) {
  const output = resolve(outputDirectory);
  const rootFromOutput = relative(output, root);
  const containsSourceRoot =
    rootFromOutput === "" ||
    (!isAbsolute(rootFromOutput) && rootFromOutput !== ".." && !rootFromOutput.startsWith(`..${sep}`));
  if (containsSourceRoot) {
    throw new Error("Refusing to use the source repository or one of its ancestors as build output.");
  }
  if (existsSync(output) && lstatSync(output).isSymbolicLink()) {
    throw new Error("Refusing to build into a symbolic link.");
  }
  if (output !== defaultOutput && existsSync(output) && readdirSync(output).length > 0) {
    throw new Error("Refusing to clear a non-empty custom build directory.");
  }
  return output;
}

export function buildApp(outputDirectory = defaultOutput) {
  const output = assertSafeBuildOutput(outputDirectory);
  rmSync(output, { recursive: true, force: true });
  for (const file of RUNTIME_FILES) {
    const destination = resolve(output, file);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(root, file), destination);
  }
  return output;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  console.log(`Built ${RUNTIME_FILES.length} runtime files in ${buildApp()}`);
}
