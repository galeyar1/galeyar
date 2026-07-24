"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Maximize2, Minimize2 } from "lucide-react";

import { SPECIES_LABELS, portfolioColor, isJuvenile } from "@/lib/animal-labels";
import { layoutPedigreeGraph, ROW_HEIGHT } from "@/lib/pedigree-layout";
import { captureFullGraphPng } from "@/lib/graph-export";
import { formatJalali } from "@/lib/jalali";
import type { AncestorNode, DescendantNode, PedigreeAnimal } from "@/lib/pedigree";
import type { Species } from "@/lib/supabase/types";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 108;

type PedigreeNodeData = { animal: PedigreeAnimal; isFocal: boolean };

function PedigreeNodeCard({ data }: NodeProps<Node<PedigreeNodeData>>) {
  const { animal, isFocal } = data;
  const species = (animal.species ?? "sheep") as Species;
  const gender = animal.gender === "male" || animal.gender === "female" ? animal.gender : "male";
  const juvenile = isJuvenile(animal.birth_date ?? null) ?? false;
  const color = portfolioColor(species, gender, juvenile);

  return (
    <div
      className="flex flex-col gap-0.5 rounded-xl border-2 bg-card p-2 shadow-sm"
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        borderColor: color,
        boxShadow: isFocal ? `0 0 0 3px ${color}55` : undefined,
      }}
      dir="rtl"
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <div className="flex items-center gap-1">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate text-sm font-bold">{animal.ear_tag}</span>
      </div>
      {animal.name && <span className="truncate text-xs text-muted-foreground">{animal.name}</span>}
      <span className="truncate text-xs text-muted-foreground">
        {SPECIES_LABELS[species]}
        {animal.breed ? ` · ${animal.breed}` : ""}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {gender === "male" ? "نر" : "ماده"}
        {animal.birth_date ? ` · ${formatJalali(animal.birth_date)}` : ""}
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
}

const nodeTypes = { pedigreeNode: PedigreeNodeCard };

export interface PedigreeGraphHandle {
  /** Rasterizes the *entire* tree (not just the current viewport) to a PNG data URL. */
  capturePng: () => Promise<string>;
}

interface PedigreeGraphProps {
  focal: PedigreeAnimal;
  ancestorTree: AncestorNode | null;
  descendantTree: DescendantNode[];
  onNodeClick: (animal: PedigreeAnimal) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /**
   * Called (with an always-current handle) whenever the graph's node layout
   * changes. A plain ref-forwarding API is deliberately avoided here since
   * this component is loaded via next/dynamic — a callback prop sidesteps
   * any ambiguity about ref forwarding through a lazy-loaded component.
   */
  onReady?: (handle: PedigreeGraphHandle) => void;
}

/**
 * Interactive graph view of a pedigree — zoom/pan/fullscreen via React Flow,
 * generation-based tidy-tree layout (src/lib/pedigree-layout.ts) so it holds
 * up whether the tree is a single pair or a dozen generations deep.
 *
 * The canvas itself is kept LTR (React Flow's own pan/zoom/controls math and
 * the MiniMap widget assume it) — RTL support here means the surrounding UI
 * and every node's Persian text render right-to-left, not that the diagram
 * geometry mirrors. Diagram tools generally follow the same convention.
 *
 * Animal photos aren't shown on nodes: photos live in Supabase Storage and
 * need an online signed-URL fetch per image, which would defeat "pedigree
 * works offline" for a tree of dozens of nodes. The click-through detail
 * sheet links to the full profile, which already has the photo gallery.
 */
export function PedigreeGraph({
  focal,
  ancestorTree,
  descendantTree,
  onNodeClick,
  isFullscreen,
  onToggleFullscreen,
  onReady,
}: PedigreeGraphProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { nodes, edges } = useMemo(() => {
    const { nodes: layoutNodes, edges: layoutEdges } = layoutPedigreeGraph(focal, ancestorTree, descendantTree);

    const rfNodes: Node<PedigreeNodeData>[] = layoutNodes.map((n) => ({
      id: n.id,
      type: "pedigreeNode",
      position: { x: n.x - NODE_WIDTH / 2, y: n.y - ROW_HEIGHT / 2 },
      data: { animal: n.animal, isFocal: n.id === focal.id },
      draggable: false,
    }));

    const rfEdges: Edge[] = layoutEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      style: { stroke: "var(--border)", strokeWidth: 2 },
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [focal, ancestorTree, descendantTree]);

  useEffect(() => {
    onReady?.({
      async capturePng() {
        if (!wrapperRef.current) throw new Error("گراف آماده نیست");
        return captureFullGraphPng(wrapperRef.current, nodes);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  return (
    <div
      ref={wrapperRef}
      dir="ltr"
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-background"
          : "h-[70vh] w-full overflow-hidden rounded-xl border border-border bg-background"
      }
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          onNodeClick={(_, node) => onNodeClick((node.data as PedigreeNodeData).animal)}
        >
          <Background gap={24} />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap position="bottom-right" pannable zoomable />
          <Panel position="top-right">
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="flex size-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm"
              aria-label={isFullscreen ? "خروج از تمام‌صفحه" : "نمایش تمام‌صفحه"}
            >
              {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
            </button>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}
