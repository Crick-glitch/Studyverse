import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { gridToRgba, type PixelGrid } from '../src/features/art/grid';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array): number => {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Uint8Array): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

export function writePng(path: string, w: number, h: number, rgba: Uint8Array): void {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', new Uint8Array(0)),
    ]),
  );
}

export interface SheetItem {
  grid: PixelGrid;
  bg?: [number, number, number];
}

/** Lay grids out in rows on a dark checker so transparency is visible, scaled by an integer. */
export function writeSheet(path: string, items: SheetItem[], scale: number, cols: number, pad = 4): void {
  const cw = Math.max(...items.map((i) => i.grid.w)) * scale + pad;
  const ch = Math.max(...items.map((i) => i.grid.h)) * scale + pad;
  const rowsN = Math.ceil(items.length / cols);
  const W = cols * cw + pad;
  const H = rowsN * ch + pad;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const c = ((x >> 3) + (y >> 3)) & 1 ? 0x30 : 0x38;
      out[i] = c;
      out[i + 1] = c + 4;
      out[i + 2] = c + 2;
      out[i + 3] = 255;
    }
  }
  items.forEach((item, n) => {
    const ox = pad + (n % cols) * cw;
    const oy = pad + Math.floor(n / cols) * ch;
    const rgba = gridToRgba(item.grid);
    for (let y = 0; y < item.grid.h * scale; y++) {
      for (let x = 0; x < item.grid.w * scale; x++) {
        const s = (Math.floor(y / scale) * item.grid.w + Math.floor(x / scale)) * 4;
        const bg = item.bg;
        const d = ((oy + y) * W + ox + x) * 4;
        if (bg) {
          out[d] = bg[0];
          out[d + 1] = bg[1];
          out[d + 2] = bg[2];
        }
        if ((rgba[s + 3] as number) > 0) {
          out[d] = rgba[s] as number;
          out[d + 1] = rgba[s + 1] as number;
          out[d + 2] = rgba[s + 2] as number;
          out[d + 3] = 255;
        }
      }
    }
  });
  writePng(path, W, H, out);
}
