import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng } from "html-to-image";

/**
 * Renders the *entire* pedigree graph to a PNG data URL regardless of the
 * viewer's current pan/zoom — the standard React Flow "download image"
 * recipe: compute a viewport that fits every node's bounds, then rasterize
 * the `.react-flow__viewport` layer with that viewport forced via a
 * capture-only style override (html-to-image applies `style` only to the
 * cloned node, so the on-screen view never visibly jumps).
 */
export async function captureFullGraphPng(container: HTMLElement, nodes: Node[]): Promise<string> {
  const viewportEl = container.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportEl) throw new Error("عنصر گراف یافت نشد");

  const bounds = getNodesBounds(nodes);
  const width = Math.max(Math.ceil(bounds.width + 160), 400);
  const height = Math.max(Math.ceil(bounds.height + 160), 400);
  const viewport = getViewportForBounds(bounds, width, height, 0.1, 2, 0.15);

  return toPng(viewportEl, {
    backgroundColor: "#ffffff",
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
}
