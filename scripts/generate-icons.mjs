import sharp from "sharp";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsOut = path.join(__dirname, "..", "public", "icons");

const anySvg = readFileSync(path.join(__dirname, "icon-any.svg"));
const maskableSvg = readFileSync(path.join(__dirname, "icon-maskable.svg"));

const targets = [
  { svg: anySvg, size: 192, file: "icon-192.png" },
  { svg: anySvg, size: 512, file: "icon-512.png" },
  { svg: anySvg, size: 180, file: "apple-touch-icon.png" },
  { svg: anySvg, size: 32, file: "favicon-32.png" },
  { svg: maskableSvg, size: 192, file: "icon-maskable-192.png" },
  { svg: maskableSvg, size: 512, file: "icon-maskable-512.png" },
];

for (const t of targets) {
  await sharp(t.svg)
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(iconsOut, t.file));
  console.log("generated", t.file);
}
