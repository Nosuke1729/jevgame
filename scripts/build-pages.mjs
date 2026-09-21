import { build } from "esbuild";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("out");
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
    "process.env.NEXT_PUBLIC_JEV_API_ENABLED": '"false"',
  },
  logLevel: "info",
});

await copyFile("static-pages/index.html", path.join(output, "index.html"));
await copyFile("static-pages/favicon.svg", path.join(output, "favicon.svg"));
await writeFile(path.join(output, ".nojekyll"), "");
