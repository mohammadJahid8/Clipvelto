import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const logo = await readFile(new URL("front-end/src/app/icon.svg", root));
const card = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0c0f14"/>
  <image x="128" y="242" width="96" height="96" href="data:image/svg+xml;base64,${logo.toString("base64")}"/>
  <text x="252" y="307" fill="#f0f1f3" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="700" letter-spacing="-2">Clipvelto</text>
  <text x="254" y="354" fill="#a5abb5" font-family="Arial, Helvetica, sans-serif" font-size="29">Video to shorts</text>
  <text x="128" y="562" fill="#a5abb5" font-family="Arial, Helvetica, sans-serif" font-size="22">clipvelto.com</text>
</svg>`);

await sharp(card).png({ palette: true, compressionLevel: 9 }).toFile(
  new URL("front-end/public/opengraph-image.png", root).pathname,
);
await sharp(logo).resize(180, 180).png({ palette: true, compressionLevel: 9 }).toFile(
  new URL("front-end/src/app/apple-icon.png", root).pathname,
);

// ICO supports embedded PNGs: keep small browser-tab sizes in one static file.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) =>
  sharp(logo).resize(size, size).png({ palette: true, compressionLevel: 9 }).toBuffer(),
));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (const [index, size] of sizes.entries()) {
  const entry = 6 + index * 16;
  header[entry] = size;
  header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(images[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[index].length;
}
await writeFile(new URL("front-end/src/app/favicon.ico", root), Buffer.concat([header, ...images]));
