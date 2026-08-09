import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, FileText, Hash, Lightbulb } from "lucide-react";
import type { Idea, Note, Paper, TopicWithCounts } from "../../types/database";

interface ResearchRadarProps {
  notes: Note[];
  papers: Paper[];
  ideas: Idea[];
  topics: TopicWithCounts[];
}

interface RadarNode {
  id: string;
  label: string;
  kind: "note" | "paper" | "idea" | "topic";
  x: number;
  y: number;
  r: number;
  color: string;
  topicIds: string[];
}

const COLORS = {
  note: "46, 111, 221",
  paper: "101, 86, 200",
  idea: "168, 110, 20",
  topic: "14, 124, 114",
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function shortLabel(value: string, max = 14): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function ResearchRadar({
  notes,
  papers,
  ideas,
  topics,
}: ResearchRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hovered, setHovered] = useState<RadarNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nodes = useMemo<RadarNode[]>(() => {
    const topicList = topics.slice(0, 6);
    const topicNodes: RadarNode[] = topicList.map((topic, index) => {
      const angle = (index / Math.max(1, topicList.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        id: topic.id,
        label: topic.name,
        kind: "topic",
        x: Math.cos(angle) * 58,
        y: Math.sin(angle) * 58,
        r: 6,
        color: COLORS.topic,
        topicIds: [topic.id],
      };
    });

    const entityNodes: RadarNode[] = [];
    const paperTopic = new Map<string, string>();
    papers.slice(0, 26).forEach((paper, index) => {
      const topicId = paper.topic_ids?.[0];
      if (topicId) paperTopic.set(paper.id, topicId);
      const topicIndex = Math.max(0, topicList.findIndex((topic) => topic.id === topicId));
      const angle =
        (hashString(paper.id) % 360) * (Math.PI / 180) +
        (topicIndex / Math.max(1, topicList.length)) * 0.6;
      entityNodes.push({
        id: paper.id,
        label: paper.title,
        kind: "paper",
        x: Math.cos(angle) * (122 + (index % 3) * 12),
        y: Math.sin(angle) * (122 + (index % 3) * 12),
        r: 4.5,
        color: COLORS.paper,
        topicIds: paper.topic_ids ?? [],
      });
    });
    const topicForIdea = new Map<string, string>();
    ideas.slice(0, 16).forEach((idea, index) => {
      const linkedPaperId = (idea.linked_paper_ids ?? []).find((id) => paperTopic.has(id));
      if (linkedPaperId) topicForIdea.set(idea.id, paperTopic.get(linkedPaperId) ?? "");
      const angle = (hashString(idea.id) % 360) * (Math.PI / 180) + index * 0.04;
      entityNodes.push({
        id: idea.id,
        label: idea.title,
        kind: "idea",
        x: Math.cos(angle) * (98 + (index % 3) * 9),
        y: Math.sin(angle) * (98 + (index % 3) * 9),
        r: 4,
        color: COLORS.idea,
        topicIds: topicForIdea.get(idea.id) ? [topicForIdea.get(idea.id) ?? ""] : [],
      });
    });
    notes.slice(0, 22).forEach((note, index) => {
      const linkedPaperId = (note.linked_entity_ids ?? []).find((id) => paperTopic.has(id));
      const linkedIdeaId = (note.linked_entity_ids ?? []).find((id) => topicForIdea.has(id));
      const topicId = linkedPaperId
        ? paperTopic.get(linkedPaperId)
        : linkedIdeaId
          ? topicForIdea.get(linkedIdeaId)
          : undefined;
      const angle = (hashString(note.id) % 360) * (Math.PI / 180) + index * 0.03;
      entityNodes.push({
        id: note.id,
        label: note.title || "Untitled Note",
        kind: "note",
        x: Math.cos(angle) * (138 + (index % 3) * 10),
        y: Math.sin(angle) * (138 + (index % 3) * 10),
        r: 3.5,
        color: COLORS.note,
        topicIds: topicId ? [topicId] : [],
      });
    });
    return [...topicNodes, ...entityNodes];
  }, [notes, papers, ideas, topics]);

  const links = useMemo(() => {
    const result: Array<[RadarNode, RadarNode]> = [];
    const topicById = new Map<string, RadarNode>();
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].kind === "topic") {
        topicById.set(nodes[i].id, nodes[i]);
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.kind === "topic") continue;

      for (let j = 0; j < node.topicIds.length; j++) {
        const topic = topicById.get(node.topicIds[j]);
        if (topic) {
          result.push([node, topic]);
        }
      }
    }
    return result;
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(260, rect.width);
      const height = Math.max(260, rect.height);
      setDimensions({ width, height });
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    let running = true;
    const draw = (time: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      const pulse = reducedMotion ? 0 : (Math.sin(time / 1400) + 1) / 2;

      // Radar rings and crosshair
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(151, 167, 181, 0.28)";
      [42, 78, 118, 160].forEach((radius) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.moveTo(cx - 168, cy);
      ctx.lineTo(cx + 168, cy);
      ctx.moveTo(cx, cy - 168);
      ctx.lineTo(cx, cy + 168);
      ctx.stroke();

      // Links
      ctx.lineWidth = 1;
      links.forEach(([from, to]) => {
        const alpha = 0.16 + pulse * 0.08;
        ctx.strokeStyle = `rgba(${from.color}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(cx + from.x, cy + from.y);
        ctx.lineTo(cx + to.x, cy + to.y);
        ctx.stroke();
      });

      // Entity nodes
      nodes.forEach((node) => {
        const x = cx + node.x;
        const y = cy + node.y;
        if (node.kind === "topic") {
          const halo = node.r + 3 + pulse * 2.5;
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, halo * 2.6);
          gradient.addColorStop(0, `rgba(${node.color}, 0.42)`);
          gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, halo * 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${node.color}, 0.92)`;
          ctx.beginPath();
          ctx.arc(x, y, node.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(16, 23, 34, 0.72)";
          ctx.font = "600 10px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(shortLabel(node.label), x, y - node.r - 5);
        } else {
          ctx.fillStyle = `rgba(${node.color}, 0.85)`;
          ctx.beginPath();
          ctx.arc(x, y, node.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${node.color}, 0.18)`;
          ctx.beginPath();
          ctx.arc(x, y, node.r * 2 + pulse * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Center hub
      ctx.fillStyle = "rgba(16, 23, 34, 0.9)";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 10 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();

      if (!reducedMotion && typeof window.requestAnimationFrame === "function") {
        requestAnimationFrame(draw);
      }
    };

    if (reducedMotion) {
      draw(0);
    } else if (typeof window.requestAnimationFrame !== "function") {
      draw(0);
    } else {
      const frame = requestAnimationFrame(draw);
      return () => {
        running = false;
        cancelAnimationFrame(frame);
      };
    }
  }, [dimensions, links, nodes, reducedMotion]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let closest: RadarNode | null = null;
    let closestDistance = 14;
    nodes.forEach((node) => {
      const dx = x - (cx + node.x);
      const dy = y - (cy + node.y);
      const distance = Math.hypot(dx, dy);
      if (distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    });
    setHovered(closest);
  };

  const isEmpty = nodes.length === 0;

  return (
    <div className="relative flex h-full min-h-64 w-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
        <div>
          <div className="text-small font-semibold text-text-primary">Research radar</div>
          <div className="text-caption text-text-tertiary">
            {nodes.length} entities · {topics.length} clusters
          </div>
        </div>
        <span className="status-chip bg-accent-soft text-accent-strong">Live</span>
      </div>
      <div className="relative min-h-56 flex-1">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center p-8 text-center">
            <p className="font-serif italic text-text-tertiary">
              Add papers, notes, and ideas to light up your research constellation.
            </p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Interactive map of your research library, topics, notes, papers, and ideas"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
            className="absolute inset-0"
          />
        )}
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 max-w-52 rounded-lg border border-border-subtle bg-bg-surface/95 px-3 py-2 shadow-lift backdrop-blur"
            style={{
              left: `clamp(8px, ${hovered.x + dimensions.width / 2 + 10}px, calc(100% - 210px))`,
              top: `clamp(8px, ${hovered.y + dimensions.height / 2 - 12}px, calc(100% - 64px))`,
            }}
          >
            <div className="text-caption font-bold uppercase tracking-wider text-text-tertiary">
              {hovered.kind}
            </div>
            <div className="mt-0.5 line-clamp-2 text-small font-medium text-text-primary">
              {hovered.label}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-subtle px-5 py-3">
        <span className="flex items-center gap-1.5 text-caption text-text-secondary">
          <Hash className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> Topics
        </span>
        <span className="flex items-center gap-1.5 text-caption text-text-secondary">
          <BookOpen className="h-3.5 w-3.5 text-violet-strong" aria-hidden="true" /> Papers
        </span>
        <span className="flex items-center gap-1.5 text-caption text-text-secondary">
          <FileText className="h-3.5 w-3.5 text-blue-strong" aria-hidden="true" /> Notes
        </span>
        <span className="flex items-center gap-1.5 text-caption text-text-secondary">
          <Lightbulb className="h-3.5 w-3.5 text-gold-strong" aria-hidden="true" /> Ideas
        </span>
      </div>
    </div>
  );
}
