import type { MultiverseGraph } from "../../types/multiverse.ts";
import { COMMIT_NODE_WIDTH, COMMIT_NODE_HEIGHT } from "./flow-dimensions.ts";

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
})[character]!);

/** A standalone image: no foreignObject, remote assets, or executable commit content. */
export function exportGraphSvg(graph: MultiverseGraph, title: string): string {
  const minX = Math.min(0, ...graph.nodes.map((node) => node.position.x)) - 32;
  const minY = Math.min(0, ...graph.nodes.map((node) => node.position.y)) - 80;
  const width = Math.max(640, ...graph.nodes.map((node) => node.position.x + COMMIT_NODE_WIDTH + 32 - minX));
  const height = Math.max(240, ...graph.nodes.map((node) => node.position.y + COMMIT_NODE_HEIGHT + 32 - minY));
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = graph.edges.map((edge) => {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) return "";
    const color = edge.type === "sacred" ? "#f5a623" : edge.type === "incursion" ? "#ef4444" : "#22d3ee";
    return `<path d="M${source.position.x + COMMIT_NODE_WIDTH},${source.position.y + COMMIT_NODE_HEIGHT / 2} L${target.position.x},${target.position.y + COMMIT_NODE_HEIGHT / 2}" fill="none" stroke="${color}" stroke-width="${edge.type === "sacred" ? 4 : 2}"/>`;
  }).join("");
  const nodes = graph.nodes.map((node) => {
    const color = node.data.isDefaultBranch ? "#f5a623" : node.data.riskScore >= 60 ? "#ef4444" : node.data.riskScore >= 30 ? "#a78bfa" : "#22d3ee";
    const label = node.data.isDefaultBranch ? "Sacred Timeline" : node.data.isMerge ? "Convergence" : node.data.isNexus ? "Nexus Event" : "Variant";
    return `<g transform="translate(${node.position.x},${node.position.y})"><rect width="${COMMIT_NODE_WIDTH}" height="${COMMIT_NODE_HEIGHT}" rx="6" fill="#10111a" stroke="${color}"/><text x="12" y="20" fill="${color}" font-size="11">${label}</text><text x="12" y="42" fill="#f0f0f5" font-size="12">${escapeXml(node.data.headline.slice(0, 31))}</text><text x="12" y="62" fill="#a0a0b0" font-size="11">${escapeXml(node.id.slice(0, 8))}</text></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" font-family="system-ui, sans-serif"><title>${escapeXml(title)} — Multiverse Git</title><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#05050a"/><text x="${minX + 32}" y="${minY + 32}" fill="#f0f0f5" font-size="18">${escapeXml(title)} · Multiverse Git</text><text x="${minX + 32}" y="${minY + 54}" fill="#a0a0b0" font-size="12">${graph.nodes.length} sampled commits · Missing ancestry is not shown · Risk is an estimate</text>${edges}${nodes}</svg>`;
}
