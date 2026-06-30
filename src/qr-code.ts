export interface QrCodeMatrix {
  size: number;
  modules: boolean[][];
}

const FORMAT_ECC_LOW = 1;
const ECC_CODEWORDS_PER_BLOCK_LOW = [
  -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
  28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
];
const NUM_ERROR_CORRECTION_BLOCKS_LOW = [
  -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8,
  8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
];

export function createQrSvg(text: string): string {
  const qr = createQrCode(text);
  const quietZone = 4;
  const viewSize = qr.size + quietZone * 2;
  const path = qr.modules
    .flatMap((row, y) => row.map((isDark, x) => (isDark ? `M${x + quietZone},${y + quietZone}h1v1h-1z` : "")))
    .filter(Boolean)
    .join("");

  return [
    `<svg class="receipt-qr-code" viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="お預け状を開くQRコード" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="${viewSize}" height="${viewSize}" fill="#fffdf4"/>`,
    `<path d="${path}" fill="#17241f"/>`,
    "</svg>",
  ].join("");
}

export function createQrCode(text: string): QrCodeMatrix {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 65535) {
    throw new Error("QR text is too long.");
  }

  for (let version = 1; version <= 40; version += 1) {
    const dataCodewords = getNumDataCodewords(version);
    const bitBuffer = createByteModeBits(bytes, version);
    if (bitBuffer.length <= dataCodewords * 8) {
      const data = appendQrPadding(bitBuffer, dataCodewords);
      return drawQrCode(version, addErrorCorrectionAndInterleave(data, version));
    }
  }

  throw new Error("QR text is too long.");
}

function createByteModeBits(bytes: number[], version: number): number[] {
  const bits: number[] = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }
  return bits;
}

function appendQrPadding(bits: number[], dataCodewords: number): number[] {
  const capacityBits = dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - bits.length % 8) % 8);

  const data = bitsToBytes(bits);
  for (let padByte = 0xec; data.length < dataCodewords; padByte ^= 0xec ^ 0x11) {
    data.push(padByte);
  }
  return data;
}

function drawQrCode(version: number, codewords: number[]): QrCodeMatrix {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFunctionModule = (x: number, y: number, isDark: boolean): void => {
    modules[y][x] = isDark;
    isFunction[y][x] = true;
  };

  drawFunctionPatterns(version, size, setFunctionModule);
  drawCodewords(codewords, size, modules, isFunction);
  drawFormatBits(size, setFunctionModule);
  if (version >= 7) {
    drawVersionBits(version, size, setFunctionModule);
  }

  return { size, modules };
}

function drawFunctionPatterns(
  version: number,
  size: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
): void {
  drawFinderPattern(3, 3, size, setFunctionModule);
  drawFinderPattern(size - 4, 3, size, setFunctionModule);
  drawFinderPattern(3, size - 4, size, setFunctionModule);

  for (let i = 8; i < size - 8; i += 1) {
    const isDark = i % 2 === 0;
    setFunctionModule(6, i, isDark);
    setFunctionModule(i, 6, isDark);
  }

  const align = getAlignmentPatternPositions(version, size);
  for (const x of align) {
    for (const y of align) {
      const overlapsFinder = (x === 6 && y === 6) || (x === 6 && y === size - 7) || (x === size - 7 && y === 6);
      if (!overlapsFinder) {
        drawAlignmentPattern(x, y, setFunctionModule);
      }
    }
  }

  drawFormatBits(size, setFunctionModule);
  if (version >= 7) {
    drawVersionBits(version, size, setFunctionModule);
  }
}

function drawFinderPattern(
  centerX: number,
  centerY: number,
  size: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
): void {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (0 <= x && x < size && 0 <= y && y < size) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunctionModule(x, y, distance !== 2 && distance !== 4);
      }
    }
  }
}

function drawAlignmentPattern(
  centerX: number,
  centerY: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
): void {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(centerX + dx, centerY + dy, distance !== 1);
    }
  }
}

function drawFormatBits(size: number, setFunctionModule: (x: number, y: number, isDark: boolean) => void): void {
  const data = FORMAT_ECC_LOW << 3;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  }
  const bits = ((data << 10) | remainder) ^ 0x5412;

  for (let i = 0; i <= 5; i += 1) {
    setFunctionModule(8, i, getBit(bits, i));
  }
  setFunctionModule(8, 7, getBit(bits, 6));
  setFunctionModule(8, 8, getBit(bits, 7));
  setFunctionModule(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i += 1) {
    setFunctionModule(14 - i, 8, getBit(bits, i));
  }
  for (let i = 0; i < 8; i += 1) {
    setFunctionModule(size - 1 - i, 8, getBit(bits, i));
  }
  for (let i = 8; i < 15; i += 1) {
    setFunctionModule(8, size - 15 + i, getBit(bits, i));
  }
  setFunctionModule(8, size - 8, true);
}

function drawVersionBits(
  version: number,
  size: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
): void {
  let remainder = version;
  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  }
  const bits = (version << 12) | remainder;

  for (let i = 0; i < 18; i += 1) {
    const isDark = getBit(bits, i);
    const a = size - 11 + i % 3;
    const b = Math.floor(i / 3);
    setFunctionModule(a, b, isDark);
    setFunctionModule(b, a, isDark);
  }
}

function drawCodewords(
  codewords: number[],
  size: number,
  modules: boolean[][],
  isFunction: boolean[][],
): void {
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right -= 1;
    }

    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x]) {
          const byte = codewords[Math.floor(bitIndex / 8)] ?? 0;
          const isDark = getBit(byte, 7 - bitIndex % 8);
          modules[y][x] = isDark !== shouldApplyMask(x, y);
          bitIndex += 1;
        }
      }
    }
    upward = !upward;
  }
}

function addErrorCorrectionAndInterleave(data: number[], version: number): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS_LOW[version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK_LOW[version];
  const rawCodewords = getNumRawDataModules(version) >> 3;
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const rsDivisor = reedSolomonComputeDivisor(blockEccLen);
  const blocks: number[][] = [];
  let offset = 0;

  for (let i = 0; i < numBlocks; i += 1) {
    const dataLength = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dataBlock = data.slice(offset, offset + dataLength);
    offset += dataLength;
    const eccBlock = reedSolomonComputeRemainder(dataBlock, rsDivisor);
    if (i < numShortBlocks) {
      dataBlock.push(0);
    }
    blocks.push([...dataBlock, ...eccBlock]);
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    for (let j = 0; j < blocks.length; j += 1) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        result.push(blocks[j][i]);
      }
    }
  }
  return result;
}

function reedSolomonComputeDivisor(degree: number): number[] {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = reedSolomonMultiply(result[j], root);
      if (j + 1 < degree) {
        result[j] ^= result[j + 1];
      }
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = Array<number>(divisor.length).fill(0);

  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= reedSolomonMultiply(coefficient, factor);
    });
  }
  return result;
}

function reedSolomonMultiply(left: number, right: number): number {
  let result = 0;
  let x = left;
  let y = right;

  for (let i = 0; i < 8; i += 1) {
    if ((y & 1) !== 0) {
      result ^= x;
    }
    const carry = (x & 0x80) !== 0;
    x = (x << 1) & 0xff;
    if (carry) {
      x ^= 0x1d;
    }
    y >>>= 1;
  }
  return result;
}

function getAlignmentPatternPositions(version: number, size: number): number[] {
  if (version === 1) {
    return [];
  }

  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let position = size - 7; result.length < numAlign; position -= step) {
    result.splice(1, 0, position);
  }
  return result;
}

function getNumDataCodewords(version: number): number {
  return (getNumRawDataModules(version) >> 3)
    - ECC_CODEWORDS_PER_BLOCK_LOW[version] * NUM_ERROR_CORRECTION_BLOCKS_LOW[version];
}

function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) {
      result -= 36;
    }
  }
  return result;
}

function appendBits(bits: number[], value: number, length: number): void {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >>> i) & 1);
  }
}

function bitsToBytes(bits: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | (bits[i + j] ?? 0);
    }
    result.push(byte);
  }
  return result;
}

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

function shouldApplyMask(x: number, y: number): boolean {
  return (x + y) % 2 === 0;
}
