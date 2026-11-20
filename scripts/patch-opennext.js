const fs = require("node:fs");
const path = require("node:path");

const targetFile = path.resolve(
  process.cwd(),
  "node_modules/@opennextjs/aws/dist/build/copyTracedFiles.js"
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, "utf8");
  const unpatchedTarget = `        if (symlink) {
            try {
                symlinkSync(symlink, to);
            }
            catch (e) {
                if (e.code !== "EEXIST") {
                    throw e;
                }
            }
        }`;

  const patchedReplacement = `        if (symlink) {
            try {
                symlinkSync(symlink, to, process.platform === "win32" ? "junction" : undefined);
            }
            catch (e) {
                if (e.code !== "EEXIST") {
                    try {
                        if (statSync(symlink).isDirectory()) {
                            cpSync(symlink, to, { recursive: true });
                        } else {
                            copyFileSync(symlink, to);
                        }
                    } catch {
                        throw e;
                    }
                }
            }
        }`;

  if (content.includes(unpatchedTarget)) {
    content = content.replace(unpatchedTarget, patchedReplacement);
    fs.writeFileSync(targetFile, content, "utf8");
    console.log("[patch-opennext] Applied Windows symlink/junction compatibility patch to @opennextjs/aws.");
  } else {
    console.log("[patch-opennext] @opennextjs/aws copyTracedFiles is already patched or up-to-date.");
  }
}
