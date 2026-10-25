const MAX_UINT = 65535;
const textDecoder = new TextDecoder();

type NumericVector = number[];

export interface DecodedNode {
  path: string;
  ranges: [NumericVector, NumericVector];
  ev: [NumericVector | null, NumericVector | null];
  eq: [NumericVector | null, NumericVector | null];
}

export interface DecodedHoldemBinary {
  paths: string[];
  nodes: DecodedNode[];
  rootChildEv: NumericVector[];
  rootChildEq: NumericVector[];
  rootConfig: Record<string, unknown>;
  activeMaps: [number[], number[]];
}

function readU16(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.byteLength) throw new Error("HOLDEM_binary truncated uint16");
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function readJsonHeader(bytes: Uint8Array, offset: number): { value: Record<string, unknown>; offset: number } {
  const length = readU16(bytes, offset);
  const start = offset + 2;
  const end = start + length;
  if (end > bytes.byteLength) throw new Error("HOLDEM_binary truncated JSON header");
  const raw = textDecoder.decode(bytes.slice(start, end));
  // DeepSolver emits Infinity/-Infinity in JSON headers, which JSON.parse rejects.
  const sanitized = raw.replace(/(?<![\w"])Infinity(?![\w"])/g, "1e308").replace(/(?<![\w"])-Infinity(?![\w"])/g, "-1e308");
  const parsed: unknown = JSON.parse(sanitized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("HOLDEM_binary JSON header is not an object");
  }
  return { value: parsed as Record<string, unknown>, offset: end };
}

function numberArray(value: unknown, name: string): number[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [value];
  }
  if (!Array.isArray(value)) {
    throw new Error(`HOLDEM_binary header field ${name} is invalid: expected number or array, got ${typeof value} = ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new Error(`HOLDEM_binary header field ${name}[${i}] is invalid: ${typeof item} = ${JSON.stringify(item)?.slice(0, 100)}`);
    }
  }
  return value as number[];
}

function byteCount(header: Record<string, unknown>): number {
  const value = header.mapBytes;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value % 2 !== 0) {
    throw new Error("HOLDEM_binary mapBytes is invalid");
  }
  return value;
}

function readU16Array(bytes: Uint8Array, offset: number, byteLength: number): { values: number[]; offset: number } {
  if (offset + byteLength > bytes.byteLength || byteLength % 2 !== 0) {
    throw new Error("HOLDEM_binary truncated vector");
  }
  const values: number[] = [];
  for (let i = 0; i < byteLength; i += 2) values.push(readU16(bytes, offset + i));
  return { values, offset: offset + byteLength };
}

function expand(values: number[], activeMap: number[], transform: (value: number, index: number) => number): number[] {
  const dense = new Array(1326).fill(0) as number[];
  for (let i = 0; i < activeMap.length; i++) dense[activeMap[i]] = transform(values[i], i);
  return dense;
}

function deinterleave3(values: number[], stride: number): [number[], number[], number[]] {
  if (values.length !== stride * 3) throw new Error(`HOLDEM_binary interleaved block length mismatch: got ${values.length}, expected ${stride * 3}`);
  const a: number[] = [], b: number[] = [], c: number[] = [];
  for (let i = 0; i < stride; i++) {
    a.push(values[i * 3]);
    b.push(values[i * 3 + 1]);
    c.push(values[i * 3 + 2]);
  }
  return [a, b, c];
}

function deinterleave2(values: number[], stride: number): [number[], number[]] {
  if (values.length !== stride * 2) throw new Error(`HOLDEM_binary pair block length mismatch: got ${values.length}, expected ${stride * 2}`);
  const a: number[] = [], b: number[] = [];
  for (let i = 0; i < stride; i++) {
    a.push(values[i * 2]);
    b.push(values[i * 2 + 1]);
  }
  return [a, b];
}

function decodeRootPlayerZero(
  bytes: Uint8Array,
  offset: number,
  paths: string[],
): { node: DecodedNode; rootChildEv: NumericVector[]; rootChildEq: NumericVector[]; activeMap: number[]; offset: number } {
  const header = readJsonHeader(bytes, offset);
  offset = header.offset;
  const mapBytes = byteCount(header.value);
  const activeMapRead = readU16Array(bytes, offset, mapBytes);
  offset = activeMapRead.offset;
  const activeMap = activeMapRead.values;
  if (activeMap.some((index) => index < 0 || index >= 1326)) throw new Error("HOLDEM_binary active map index is invalid");

  const minValue = numberArray(header.value.minValue, "minValue");
  const diffValue = numberArray(header.value.diffValue, "diffValue");
  if (minValue.length !== diffValue.length) throw new Error("HOLDEM_binary root child metric lengths differ");

  const rangeRead = readU16Array(bytes, offset, mapBytes);
  offset = rangeRead.offset;
  const range = expand(rangeRead.values, activeMap, (value) => value / MAX_UINT);
  const childCount = minValue.length;
  const childEv: NumericVector[] = [];
  const childEq: NumericVector[] = [];
  for (let child = 0; child < childCount; child++) {
    const childRead = readU16Array(bytes, offset, mapBytes * 2);
    offset = childRead.offset;
    const [evValues, eqValues] = deinterleave2(childRead.values, activeMap.length);
    childEv.push(expand(evValues, activeMap, (value) => (value / MAX_UINT) * diffValue[child] + minValue[child]));
    childEq.push(expand(eqValues, activeMap, (value) => value / MAX_UINT));
  }

  return {
    node: { path: paths[0], ranges: [range, new Array(1326).fill(0)], ev: [null, null], eq: [null, null] },
    rootChildEv: childEv,
    rootChildEq: childEq,
    activeMap,
    offset,
  };
}

function decodeRootPlayerOne(
  bytes: Uint8Array,
  offset: number,
): { ranges: NumericVector; ev: NumericVector; eq: NumericVector; activeMap: number[]; offset: number } {
  const header = readJsonHeader(bytes, offset);
  offset = header.offset;
  const mapBytes = byteCount(header.value);
  const mapRead = readU16Array(bytes, offset, mapBytes);
  offset = mapRead.offset;
  const activeMap = mapRead.values;
  if (activeMap.some((index) => index < 0 || index >= 1326)) throw new Error("HOLDEM_binary player 1 active map index is invalid");
  const block = readU16Array(bytes, offset, mapBytes * 3);
  offset = block.offset;
  const minValue = numberArray(header.value.minValue, "minValue");
  const diffValue = numberArray(header.value.diffValue, "diffValue");
  if (minValue.length < 1 || diffValue.length < 1) throw new Error("HOLDEM_binary root OOP metrics missing");
  const [rangeValues, evValues, eqValues] = deinterleave3(block.values, activeMap.length);
  const ranges = expand(rangeValues, activeMap, (value) => value / MAX_UINT);
  const ev = expand(evValues, activeMap, (value) => (value / MAX_UINT) * diffValue[0] + minValue[0]);
  const eq = expand(eqValues, activeMap, (value) => value / MAX_UINT);
  return { ranges, ev, eq, activeMap, offset };
}

function decodeNonRoot(
  bytes: Uint8Array,
  offset: number,
  path: string,
  activeMaps: [number[], number[]],
  minValue: number[],
  diffValue: number[],
): { node: DecodedNode; offset: number } {
  const decodedPlayers: Array<{ range: NumericVector; ev: NumericVector; eq: NumericVector }> = [];
  for (let p = 0; p < activeMaps.length; p++) {
    const activeMap = activeMaps[p];
    const block = readU16Array(bytes, offset, activeMap.length * 2 * 3);
    offset = block.offset;
    const [rangeValues, evValues, eqValues] = deinterleave3(block.values, activeMap.length);
    const range = expand(rangeValues, activeMap, (value) => value / MAX_UINT);
    const ev = expand(evValues, activeMap, (value) => (value / MAX_UINT) * diffValue[p] + minValue[p]);
    const eq = expand(eqValues, activeMap, (value) => value / MAX_UINT);
    decodedPlayers.push({ range, ev, eq });
  }

  return {
    node: {
      path,
      ranges: [decodedPlayers[0].range, decodedPlayers[1].range],
      ev: [decodedPlayers[0].ev, decodedPlayers[1].ev],
      eq: [decodedPlayers[0].eq, decodedPlayers[1].eq],
    },
    offset,
  };
}

export function decodeHoldemBinary(nodesBytes: Uint8Array, config: Record<string, unknown>): DecodedHoldemBinary {
  const paths = config.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.some((path) => typeof path !== "string")) {
    throw new Error("HOLDEM_binary config.paths is missing or invalid");
  }
  if (paths[0] !== "r:0") throw new Error("HOLDEM_binary root path is not r:0");

  let offset = 0;
  const rootPlayerZero = decodeRootPlayerZero(nodesBytes, offset, paths as string[]);
  offset = rootPlayerZero.offset;
  const rootPlayerOne = decodeRootPlayerOne(nodesBytes, offset);
  offset = rootPlayerOne.offset;

  const nodes: DecodedNode[] = [{
    path: paths[0] as string,
    ranges: [rootPlayerZero.node.ranges[0], rootPlayerOne.ranges],
    ev: [null, rootPlayerOne.ev],
    eq: [null, rootPlayerOne.eq],
  }];

  const activeMaps: [number[], number[]] = [rootPlayerZero.activeMap, rootPlayerOne.activeMap];
  for (let i = 1; i < (paths as string[]).length; i++) {
    const path = (paths as string[])[i];
    const header = readJsonHeader(nodesBytes, offset);
    offset = header.offset;
    const minValue = numberArray(header.value.minValue, "minValue");
    const diffValue = numberArray(header.value.diffValue, "diffValue");
    if (minValue.length < 2 || diffValue.length < 2) throw new Error("HOLDEM_binary node metrics missing");
    const decoded = decodeNonRoot(nodesBytes, offset, path, activeMaps, minValue, diffValue);
    nodes.push(decoded.node);
    offset = decoded.offset;
  }

  if (offset !== nodesBytes.byteLength) {
    throw new Error(`HOLDEM_binary payload not fully consumed (final offset=${offset}, total=${nodesBytes.byteLength}, remaining=${nodesBytes.byteLength - offset}, last path=${(paths as string[])[(paths as string[]).length - 1]})`);
  }

  return {
    paths: paths as string[],
    nodes,
    rootChildEv: rootPlayerZero.rootChildEv,
    rootChildEq: rootPlayerZero.rootChildEq,
    rootConfig: config,
    activeMaps,
  };
}
