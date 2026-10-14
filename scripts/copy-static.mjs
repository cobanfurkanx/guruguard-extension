// Build sonrası statik dosyaları dist/ içine kopyalar:
// manifest, popup html/css, ikonlar. dist/ doğrudan
// chrome://extensions > "Load unpacked" ile yüklenir.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

mkdirSync(join(dist, "popup"), { recursive: true });
mkdirSync(join(dist, "icons"), { recursive: true });

cpSync(join(root, "manifest.json"), join(dist, "manifest.json"));
cpSync(join(root, "src", "popup", "popup.html"), join(dist, "popup", "popup.html"));
cpSync(join(root, "src", "popup", "popup.css"), join(dist, "popup", "popup.css"));
for (const size of [16, 48, 128]) {
  cpSync(
    join(root, "src", "icons", `icon${size}.png`),
    join(dist, "icons", `icon${size}.png`),
  );
}

// Eski badge.ts artık kullanılmıyor (panel.ts geçti); dist artığı varsa sil.
rmSync(join(dist, "content", "badge.js"), { force: true });
rmSync(join(dist, "content", "badge.js.map"), { force: true });
rmSync(join(dist, "background", "service-worker.js"), { force: true });
rmSync(join(dist, "background", "service-worker.js.map"), { force: true });

console.log("static kopyalandı -> dist/");
