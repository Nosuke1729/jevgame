import { build } from "esbuild";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("out");
const decisionUrl = process.env.JEV_DECISION_URL ?? "";
if (decisionUrl && !/^https:\/\/[^\s/]+\/decision$/.test(decisionUrl)) {
  throw new Error("JEV_DECISION_URL must be an HTTPS /decision endpoint");
}
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "assets"), { recursive: true });

await build({
  entryPoints: ["src/pages-entry.tsx"],
  outdir: path.join(output, "assets"),
  entryNames: "app",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_JEV_API_ENABLED": JSON.stringify(decisionUrl ? "true" : "false"),
    "process.env.NEXT_PUBLIC_JEV_DECISION_URL": JSON.stringify(decisionUrl),
  },
  logLevel: "info",
});

await copyFile("static-pages/index.html", path.join(output, "index.html"));
await copyFile("static-pages/favicon.svg", path.join(output, "favicon.svg"));
await copyFile("public/third-party-notices.txt", path.join(output, "third-party-notices.txt"));
await writeFile(path.join(output, ".nojekyll"), "");
