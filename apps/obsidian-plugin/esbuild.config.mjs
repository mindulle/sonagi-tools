import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

const prod = process.env.BUILD_ENV === "production";
const pluginDir = process.env.OBSIDIAN_VAULT_PLUGIN_DIR;

// Custom plugin to copy files to the Obsidian Vault after build
const copyToVaultPlugin = {
  name: "copy-to-vault",
  setup(build) {
    build.onEnd(() => {
      if (!pluginDir) {
        console.log("⚠️ OBSIDIAN_VAULT_PLUGIN_DIR is not set in .env. Skipping copy.");
        return;
      }

      try {
        if (!fs.existsSync(pluginDir)) {
          fs.mkdirSync(pluginDir, { recursive: true });
        }

        fs.copyFileSync("main.js", path.join(pluginDir, "main.js"));
        fs.copyFileSync("manifest.json", path.join(pluginDir, "manifest.json"));
        
        if (fs.existsSync("styles.css")) {
          fs.copyFileSync("styles.css", path.join(pluginDir, "styles.css"));
        }
        
        console.log(`✅ Successfully copied build files to: ${pluginDir}`);
      } catch (err) {
        console.error("❌ Failed to copy files to Vault:", err);
      }
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  plugins: [copyToVaultPlugin],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
  console.log("👀 Watching for changes...");
}
