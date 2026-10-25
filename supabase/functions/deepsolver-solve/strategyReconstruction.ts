import type { DecodedHoldemBinary, DecodedNode, NumericVector } from "./holdemBinary.ts";

export interface ReconstructedAction {
  action: string;
  strategy: NumericVector;
}

export interface ReconstructedNode {
  path: string;
  player: 0 | 1;
  actions: ReconstructedAction[];
  ranges: [NumericVector, NumericVector];
  ev: [NumericVector | null, NumericVector | null];
  eq: [NumericVector | null, NumericVector | null];
}

export interface ReconstructedTree {
  nodes: ReconstructedNode[];
}

export interface TreeTopology {
  children: Record<string, string[]>;
  actions: Record<string, string[]>;
  player_id: Record<string, 0 | 1>;
}

export interface ValidationFailure {
  path: string;
  combo: string;
  player: 0 | 1;
  parentRange: number;
  childRanges: number[];
  strategies: number[];
  childRangeSum: number;
  strategySum: number;
}

const MAX_UINT = 65535;
const TOLERANCE = 2 / MAX_UINT;

function safeDivide(child: number, parent: number): number | null {
  if (parent <= 0) return null;
  return child / parent;
}

function reconstructNode(
  node: DecodedNode,
  parent: DecodedNode | null,
  childNodes: DecodedNode[],
  actionLabels: string[],
  player: 0 | 1,
  saveFolds: boolean,
  failures: ValidationFailure[],
  canonicalCombos: string[],
): ReconstructedNode {
  const parentRange = parent ? parent.ranges[player] : node.ranges[player];
  const actions: ReconstructedAction[] = [];

  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i];
    const strategy = new Array(1326).fill(0) as NumericVector;
    for (let j = 0; j < 1326; j++) {
      const s = safeDivide(child.ranges[player][j], parentRange[j]);
      if (s !== null) strategy[j] = s;
    }
    actions.push({ action: actionLabels[i] ?? `action_${i}`, strategy });
  }

  if (!saveFolds && actions.length > 0) {
    const foldStrategy = new Array(1326).fill(0) as NumericVector;
    for (let j = 0; j < 1326; j++) {
      if (parentRange[j] > 0) {
        const sumChildren = actions.reduce((sum, a) => sum + a.strategy[j], 0);
        foldStrategy[j] = Math.max(0, 1 - sumChildren);
      }
    }
    actions.push({ action: "fold", strategy: foldStrategy });
  }

  if (saveFolds && actions.length > 0) {
    for (let j = 0; j < 1326; j++) {
      if (parentRange[j] > 0) {
        const childRangeSum = childNodes.reduce((s, c) => s + c.ranges[player][j], 0);
        const strategySum = actions.reduce((s, a) => s + a.strategy[j], 0);

        if (Math.abs(childRangeSum - parentRange[j]) > TOLERANCE) {
          failures.push({
            path: node.path,
            combo: canonicalCombos[j] ?? `idx_${j}`,
            player,
            parentRange: parentRange[j],
            childRanges: childNodes.map((c) => c.ranges[player][j]),
            strategies: actions.map((a) => a.strategy[j]),
            childRangeSum,
            strategySum,
          });
        }

        if (Math.abs(strategySum - 1) > TOLERANCE) {
          failures.push({
            path: node.path,
            combo: canonicalCombos[j] ?? `idx_${j}`,
            player,
            parentRange: parentRange[j],
            childRanges: childNodes.map((c) => c.ranges[player][j]),
            strategies: actions.map((a) => a.strategy[j]),
            childRangeSum,
            strategySum,
          });
        }
      }
    }
  }

  return {
    path: node.path,
    player,
    actions,
    ranges: node.ranges,
    ev: node.ev,
    eq: node.eq,
  };
}

export function reconstructStrategy(
  decoded: DecodedHoldemBinary,
  topology: TreeTopology | null,
  saveFolds: boolean,
  canonicalCombos: string[],
): ReconstructedTree {
  const nodes: ReconstructedNode[] = [];
  const pathIndex = new Map<string, number>();
  decoded.paths.forEach((p, i) => pathIndex.set(p, i));

  const failures: ValidationFailure[] = [];

  for (let i = 0; i < decoded.nodes.length; i++) {
    const node = decoded.nodes[i];

    let childPaths: string[] | null = null;
    let actionLabels: string[] | null = null;
    let player: 0 | 1 = 0;

    if (topology) {
      childPaths = topology.children?.[node.path] ?? null;
      actionLabels = topology.actions?.[node.path] ?? null;
      const pid = topology.player_id?.[node.path];
      if (pid === 0 || pid === 1) {
        player = pid;
      } else {
        if (i === 0) {
          player = 0;
        } else {
          const parentPath = findParentPath(node.path);
          const parentNode = parentPath ? decoded.nodes[pathIndex.get(parentPath) ?? -1] : null;
          if (parentNode) {
            player = (findNodePlayer(parentPath ?? "r:0", decoded, topology, pathIndex) === 0 ? 1 : 0) as 0 | 1;
          } else {
            player = 0;
          }
        }
      }
    } else {
      if (i === 0) {
        player = 0;
      } else {
        const parentPath = findParentPath(node.path);
        const parentNode = parentPath ? decoded.nodes[pathIndex.get(parentPath) ?? -1] : null;
        if (parentNode) {
          player = (findNodePlayer(parentPath ?? "r:0", decoded, null, pathIndex) === 0 ? 1 : 0) as 0 | 1;
        } else {
          player = 0;
        }
      }
      childPaths = findChildPaths(node.path, decoded);
      actionLabels = null;
    }

    const childNodes = childPaths
      ? childPaths.map((cp) => decoded.nodes[pathIndex.get(cp) ?? -1]).filter((n): n is DecodedNode => n !== undefined)
      : [];

    const parentPath = i === 0 ? null : findParentPath(node.path);
    const parentNode = parentPath !== null ? (decoded.nodes[pathIndex.get(parentPath) ?? -1] ?? null) : null;

    nodes.push(reconstructNode(node, parentNode, childNodes, actionLabels ?? [], player, saveFolds, failures, canonicalCombos));
  }

  if (failures.length > 0) {
    const sample = failures.slice(0, 20);
    console.warn(`[strategyValidation] ${failures.length} validation failures. First ${sample.length}:`);
    for (const f of sample) {
      console.warn(JSON.stringify(f));
    }
  }

  return { nodes };
}

function findParentPath(path: string): string | null {
  const parts = path.split(":");
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join(":");
}

function findChildPaths(parentPath: string, decoded: DecodedHoldemBinary): string[] {
  const prefix = parentPath === "r:0" ? "r:0:" : parentPath + ":";
  const parentDepth = parentPath.split(":").length;
  return decoded.paths.filter((p) => p.startsWith(prefix) && p.split(":").length === parentDepth + 1);
}

function findNodePlayer(
  path: string,
  decoded: DecodedHoldemBinary,
  topology: TreeTopology | null,
  pathIndex: Map<string, number>,
): 0 | 1 {
  if (topology?.player_id) {
    const pid = topology.player_id[path];
    if (pid === 0 || pid === 1) return pid;
  }
  if (path === "r:0") return 0;
  const parentPath = findParentPath(path);
  if (!parentPath) return 0;
  const parentPlayer = findNodePlayer(parentPath, decoded, topology, pathIndex);
  return parentPlayer === 0 ? 1 : 0;
}
