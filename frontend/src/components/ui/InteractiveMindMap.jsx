import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Network, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const NODE_W = 180;
const NODE_H = 52;
const LAYER_GAP = 130;
const SIBLING_GAP = 30;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;
const DRAG_THRESHOLD = 5;
const SCALE_STEP = 0.05;

function calcSubtreeWidths(node, collapsed, path = "r", depth = 0) {
  const id = path;
  if (!node.children?.length || collapsed.has(id)) {
    return { ...node, _id: id, _sw: NODE_W, _kids: [], _depth: depth };
  }
  const _kids = node.children.map((c, i) =>
    calcSubtreeWidths(c, collapsed, `${id}.${i}`, depth + 1)
  );
  const total =
    _kids.reduce((s, k) => s + k._sw, 0) + (_kids.length - 1) * SIBLING_GAP;
  return { ...node, _id: id, _sw: Math.max(NODE_W, total), _kids, _depth: depth };
}

function positionTree(node, x, y) {
  const nx = x + node._sw / 2 - NODE_W / 2;
  const depth = node._depth || 0;
  const current = {
    id: node._id,
    name: node.name,
    description: node.description || "",
    is_core: node.is_core,
    relationship_type: node.relationship_type,
    x: Math.round(nx * 100) / 100,
    y: Math.round(y * 100) / 100,
    hasKids: node._kids.length > 0,
    depth,
    childCount: node.children?.length || 0,
  };
  const nodes = [current];
  const edges = [];

  if (node._kids.length) {
    const tw =
      node._kids.reduce((s, k) => s + k._sw, 0) +
      (node._kids.length - 1) * SIBLING_GAP;
    let cx = x + (node._sw - tw) / 2;
    for (const kid of node._kids) {
      const sub = positionTree(kid, cx, y + LAYER_GAP);
      nodes.push(...sub.nodes);
      edges.push(...sub.edges);
      const kidNode = sub.nodes[0];
      const fx = current.x + NODE_W / 2;
      const fy = current.y + NODE_H;
      const tx = kidNode.x + NODE_W / 2;
      const ty = kidNode.y;
      edges.push({
        fromId: current.id,
        toId: kidNode.id,
        fx: Math.round(fx * 100) / 100,
        fy: Math.round(fy * 100) / 100,
        tx: Math.round(tx * 100) / 100,
        ty: Math.round(ty * 100) / 100,
        rel: kid.relationship_type,
        fromDepth: depth,
        toDepth: kid._depth || depth + 1,
      });
      cx += kid._sw + SIBLING_GAP;
    }
  }
  return { nodes, edges };
}

function MarkdownView({ node, depth = 0 }) {
  if (!node) return null;
  const indent = "  ".repeat(depth);
  const prefix = depth === 0 ? "# " : "- ";
  const depthColors = [
    "text-blue-400",
    "text-cyan-400",
    "text-teal-400",
    "text-green-400",
    "text-amber-400",
  ];
  const colorCls = depthColors[Math.min(depth, depthColors.length - 1)];
  return (
    <div className="font-mono text-sm leading-relaxed">
      <div className="flex items-start gap-1">
        <span className="text-slate-500 shrink-0 select-none">{indent}{prefix}</span>
        <span className={`${colorCls} ${depth === 0 ? "font-bold text-base" : "font-medium"}`}>
          {node.name}
        </span>
        {node.is_core && (
          <span className="text-yellow-400 ml-1 shrink-0">&#9733;</span>
        )}
        {node.relationship_type && depth > 0 && (
          <span className="text-slate-500 text-xs ml-2 shrink-0">
            [{node.relationship_type}]
          </span>
        )}
      </div>
      {node.description && (
        <div
          className="text-slate-400 text-xs leading-relaxed mt-0.5"
          style={{ paddingLeft: (indent.length + 2) * 8 + 8 }}
        >
          {node.description}
        </div>
      )}
      {node.children?.map((child, i) => (
        <MarkdownView key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

const DEPTH_COLORS = [
  { fill: "#7c3aed", stroke: "#6d28d9", text: "#fff", badge: "#5b21b6" },
  { fill: "#3b82f6", stroke: "#2563eb", text: "#fff", badge: "#1d4ed8" },
  { fill: "#06b6d4", stroke: "#0891b2", text: "#fff", badge: "#0e7490" },
  { fill: "#10b981", stroke: "#059669", text: "#fff", badge: "#047857" },
  { fill: "#f59e0b", stroke: "#d97706", text: "#1e293b", badge: "#b45309" },
];

function getDepthColor(depth, isCore) {
  const idx = Math.min(depth, DEPTH_COLORS.length - 1);
  const c = DEPTH_COLORS[idx];
  if (isCore && depth > 0) {
    return { fill: c.fill, stroke: c.stroke, text: c.text, badge: c.badge };
  }
  if (depth === 0) return c;
  return {
    fill: c.fill + "80",
    stroke: c.stroke,
    text: "#1e293b",
    badge: c.badge,
  };
}

function MapEdge({ edge, offsets }) {
  const fo = offsets[edge.fromId] || { x: 0, y: 0 };
  const to = offsets[edge.toId] || { x: 0, y: 0 };
  const fx = edge.fx + fo.x;
  const fy = edge.fy + fo.y;
  const tx = edge.tx + to.x;
  const ty = edge.ty + to.y;
  const dy = ty - fy;
  const cp1y = fy + dy * 0.4;
  const cp2y = fy + dy * 0.6;
  const d = `M${fx},${fy} C${fx},${cp1y} ${tx},${cp2y} ${tx},${ty}`;
  const lx = (fx + tx) / 2;
  const ly = fy + dy * 0.5;

  const fromColor = DEPTH_COLORS[Math.min(edge.fromDepth || 0, DEPTH_COLORS.length - 1)];
  const toColor = DEPTH_COLORS[Math.min(edge.toDepth || 1, DEPTH_COLORS.length - 1)];
  const gradientId = `edge-${edge.fromId}-${edge.toId}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fromColor.stroke} />
          <stop offset="100%" stopColor={toColor.stroke} />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2.5} opacity={0.7} />
      {edge.rel && (
        <g transform={`translate(${lx},${ly})`}>
          <rect
            x={-(edge.rel.length * 6 + 8)}
            y={-10}
            width={edge.rel.length * 12 + 16}
            height={20}
            rx={6}
            fill="#1e293b"
            stroke={toColor.stroke}
            strokeWidth={1}
            opacity={0.9}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#e2e8f0"
            fontSize={10}
            className="pointer-events-none select-none"
          >
            {edge.rel}
          </text>
        </g>
      )}
    </g>
  );
}

function MapNode({
  node,
  isCollapsed,
  offsets,
  onToggle,
  onDragStart,
  onHover,
  onLeave,
  hasMovedRef,
}) {
  const off = offsets[node.id] || { x: 0, y: 0 };
  const depth = node.depth || 0;
  const colors = getDepthColor(depth, node.is_core);
  const maxLen = node.hasKids ? 10 : 14;
  const displayName =
    node.name.length > maxLen
      ? node.name.slice(0, maxLen - 1) + "\u2026"
      : node.name;
  const showSecondLine = node.name.length > maxLen && !node.hasKids;
  const secondLine = showSecondLine
    ? node.name.slice(maxLen - 1, maxLen - 1 + 12) + (node.name.length > maxLen - 1 + 12 ? "\u2026" : "")
    : "";

  return (
    <g
      className="mind-map-node"
      style={{
        transform: `translate(${node.x + off.x}px, ${node.y + off.y}px)`,
        transition: "transform 0.3s ease",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!hasMovedRef.current && node.hasKids) onToggle(node.id);
      }}
      onMouseDown={(e) => onDragStart(e, node.id)}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={onLeave}
    >
      <rect
        width={NODE_W}
        height={showSecondLine ? NODE_H + 16 : NODE_H}
        rx={depth === 0 ? 12 : 8}
        ry={depth === 0 ? 12 : 8}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={depth === 0 ? 3 : 2}
        style={{
          filter: depth === 0
            ? "drop-shadow(0 4px 8px rgba(0,0,0,0.4))"
            : "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
          transition: "fill 0.2s, stroke 0.2s, stroke-width 0.2s",
        }}
      />
      {node.is_core && depth > 0 && (
        <circle
          cx={12}
          cy={NODE_H / 2}
          r={4}
          fill="#fbbf24"
          stroke="#f59e0b"
          strokeWidth={1}
        />
      )}
      <text
        x={node.hasKids ? (NODE_W - 20) / 2 : NODE_W / 2}
        y={showSecondLine ? NODE_H / 2 - 6 : NODE_H / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={colors.text}
        fontSize={depth === 0 ? 14 : 12}
        fontWeight={depth <= 1 || node.is_core ? "bold" : "normal"}
        className="pointer-events-none select-none"
      >
        {displayName}
      </text>
      {showSecondLine && (
        <text
          x={NODE_W / 2}
          y={NODE_H / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={colors.text}
          fontSize={10}
          fontWeight="normal"
          opacity={0.85}
          className="pointer-events-none select-none"
        >
          {secondLine}
        </text>
      )}
      {node.hasKids && (
        <g transform={`translate(${NODE_W - 18}, ${NODE_H / 2})`}>
          <circle
            r={8}
            fill={isCollapsed ? colors.badge : colors.stroke}
            stroke={colors.stroke}
            strokeWidth={1}
            style={{ transition: "fill 0.2s" }}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill={colors.text}
            fontSize={12}
            fontWeight="bold"
            className="pointer-events-none select-none"
          >
            {isCollapsed ? `+${node.childCount || ""}` : "\u2212"}
          </text>
        </g>
      )}
    </g>
  );
}

export default function InteractiveMindMap({ data, height = 500 }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const [viewMode, setViewMode] = useState("graph");
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [offsets, setOffsets] = useState({});
  const [hovered, setHovered] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef(null);
  const dragCanvasRef = useRef(false);
  const dragNodeRef = useRef(false);
  const dragIdRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragOffStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const centeredRef = useRef(false);

  const tree = useMemo(() => {
    if (!data?.root) return { nodes: [], edges: [] };
    const w = calcSubtreeWidths(data.root, collapsed);
    return positionTree(w, 0, 0);
  }, [data, collapsed]);

  useEffect(() => {
    if (!centeredRef.current && containerRef.current && tree.nodes.length > 0) {
      centeredRef.current = true;
      const rect = containerRef.current.getBoundingClientRect();
      const root = tree.nodes[0];
      setPan({
        x: rect.width / 2 - (root.x + NODE_W / 2),
        y: 30,
      });
    }
  }, [tree]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const d = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
      setScale((s) =>
        Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + d).toFixed(2)))
      );
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const toggle = useCallback((id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const zoomIn = useCallback(
    () => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP * 2).toFixed(2))),
    []
  );
  const zoomOut = useCallback(
    () => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP * 2).toFixed(2))),
    []
  );
  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setOffsets({});
    centeredRef.current = false;
  }, []);

  const onCanvasDown = useCallback(
    (e) => {
      if (e.target.closest(".mind-map-node")) return;
      dragCanvasRef.current = true;
      setDragging(true);
      dragStartRef.current = {
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      };
    },
    [pan]
  );

  const onNodeDown = useCallback(
    (e, id) => {
      e.stopPropagation();
      hasMovedRef.current = false;
      dragNodeRef.current = true;
      setDragging(true);
      dragIdRef.current = id;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dragOffStartRef.current = offsets[id] || { x: 0, y: 0 };
    },
    [offsets]
  );

  const onMove = useCallback(
    (e) => {
      setMouse({ x: e.clientX, y: e.clientY });
      if (dragCanvasRef.current) {
        setPan({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      }
      if (dragNodeRef.current && dragIdRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        if (
          Math.abs(dx) > DRAG_THRESHOLD ||
          Math.abs(dy) > DRAG_THRESHOLD
        ) {
          hasMovedRef.current = true;
        }
        if (hasMovedRef.current) {
          const nid = dragIdRef.current;
          setOffsets((prev) => ({
            ...prev,
            [nid]: {
              x: dragOffStartRef.current.x + dx / scale,
              y: dragOffStartRef.current.y + dy / scale,
            },
          }));
        }
      }
    },
    [scale]
  );

  const onUp = useCallback(() => {
    dragCanvasRef.current = false;
    dragNodeRef.current = false;
    dragIdRef.current = null;
    setDragging(false);
  }, []);

  const onHover = useCallback((node) => {
    if (!dragCanvasRef.current && !dragNodeRef.current) setHovered(node);
  }, []);

  const onLeave = useCallback(() => setHovered(null), []);

  if (!data?.root) {
    return (
      <div
        className="flex items-center justify-center text-slate-400 rounded-lg border border-slate-700"
        style={{ height, backgroundColor: "#1e293b" }}
      >
        暂无数据
      </div>
    );
  }

  const cr = containerRef.current?.getBoundingClientRect();

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-lg border border-slate-700"
      style={{ height, backgroundColor: "#1e293b" }}
    >
      <style>{`
        .mind-map-node:hover rect {
          stroke-width: 3;
          filter: drop-shadow(0 0 8px rgba(124, 58, 237, 0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
      `}</style>

      <div className="flex-none flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 z-10">
        <button
          onClick={zoomIn}
          className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
          title="放大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={zoomOut}
          className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
          title="缩小"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded hover:bg-slate-700 text-slate-300 transition-colors"
          title="重置"
        >
          <RotateCcw size={16} />
        </button>
        <span className="text-slate-500 text-xs min-w-[36px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <div className="w-px h-4 bg-slate-600 mx-1" />
        <button
          onClick={() => setViewMode("graph")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
            viewMode === "graph"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:bg-slate-700 hover:text-slate-300"
          )}
        >
          <Network size={14} />
          图形
        </button>
        <button
          onClick={() => setViewMode("markdown")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors",
            viewMode === "markdown"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:bg-slate-700 hover:text-slate-300"
          )}
        >
          <FileText size={14} />
          Markdown
        </button>
        <div className="flex-1" />
        <span className="text-slate-600 text-xs hidden sm:inline">
          滚轮缩放 · 拖拽平移 · 点击节点展开/折叠
        </span>
      </div>

      {viewMode === "markdown" ? (
        <div className="flex-1 px-6 py-4 overflow-auto">
          <MarkdownView node={data.root} />
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 relative"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <svg width="100%" height="100%" onMouseDown={onCanvasDown}>
            <defs>
              <pattern
                id="mindmap-grid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mindmap-grid)" />
            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {tree.edges.map((edge, i) => (
                <MapEdge key={i} edge={edge} offsets={offsets} />
              ))}
              {tree.nodes.map((node) => (
                <MapNode
                  key={node.id}
                  node={node}
                  isCollapsed={collapsed.has(node.id)}
                  offsets={offsets}
                  onToggle={toggle}
                  onDragStart={onNodeDown}
                  onHover={onHover}
                  onLeave={onLeave}
                  hasMovedRef={hasMovedRef}
                />
              ))}
            </g>
          </svg>

          {hovered?.description && cr && (
            <div
              className="absolute z-20 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-slate-200 text-xs max-w-[250px] pointer-events-none"
              style={{
                left: mouse.x - cr.left + 14,
                top: mouse.y - cr.top + 14,
              }}
            >
              <div className="font-semibold text-blue-400 mb-1">
                {hovered.name}
              </div>
              <div>{hovered.description}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
