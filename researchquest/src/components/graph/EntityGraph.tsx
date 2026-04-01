import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../store/appStore";
import { useBacklinks } from "../../hooks/useBacklinks";
import { useRelatedItems } from "../../hooks/useRelatedItems";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, BookOpen, Lightbulb, User } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { logger } from "../../utils/logger";
import { useShallow } from "zustand/react/shallow";

type NodeType = "note" | "paper" | "idea" | "current";

interface Node {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  relationship: "current" | "backlink" | "related";
}

interface Edge {
  source: string;
  target: string;
  type: "backlink" | "related";
}

const GRAPH_WIDTH = 300;
const GRAPH_HEIGHT = 300;
const CENTER_X = GRAPH_WIDTH / 2;
const CENTER_Y = GRAPH_HEIGHT / 2;

export function EntityGraph() {
  const {
    selectedNote,
    selectedPaper,
    selectedIdea,
    user,
    setCurrentView,
    setSelectedNote,
    setSelectedPaper,
    setSelectedIdea,
    isRightSidebarOpen
  } = useAppStore(
    useShallow((state) => ({
      selectedNote: state.selectedNote,
      selectedPaper: state.selectedPaper,
      selectedIdea: state.selectedIdea,
      user: state.user,
      setCurrentView: state.setCurrentView,
      setSelectedNote: state.setSelectedNote,
      setSelectedPaper: state.setSelectedPaper,
      setSelectedIdea: state.setSelectedIdea,
      isRightSidebarOpen: state.isRightSidebarOpen
    }))
  );

  const currentEntity = selectedNote || selectedPaper || selectedIdea;
  const currentEntityId = currentEntity?.id || null;
  const currentEntityType = selectedNote
    ? "note"
    : selectedPaper
      ? "paper"
      : selectedIdea
        ? "idea"
        : null;

  const { backlinks } = useBacklinks(
    currentEntityId,
    currentEntityType,
    user?.id,
    { enabled: isRightSidebarOpen && !!currentEntityId }
  );

  const { relatedItems } = useRelatedItems(
    currentEntityId,
    currentEntityType,
    user?.id,
    { enabled: isRightSidebarOpen && !!currentEntityId }
  );

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const requestRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);

  // Initialize nodes and edges
  useEffect(() => {
    if (!currentEntityId || !currentEntity) {
      setNodes([]);
      setEdges([]);
      nodesRef.current = [];
      return;
    }

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Add central node
    const centerNode: Node = {
      id: currentEntityId,
      type: currentEntityType as NodeType,
      title: currentEntity.title || "Current Item",
      x: CENTER_X,
      y: CENTER_Y,
      vx: 0,
      vy: 0,
      radius: 24,
      relationship: "current",
    };
    newNodes.push(centerNode);

    // Add backlink nodes
    backlinks.forEach((item, index) => {
      // Avoid duplicates
      if (newNodes.some(n => n.id === item.id)) return;
      
      const angle = (index / backlinks.length) * Math.PI * 2;
      const distance = 80;
      
      newNodes.push({
        id: item.id,
        type: item.type as NodeType,
        title: item.title,
        x: CENTER_X + Math.cos(angle) * distance,
        y: CENTER_Y + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        radius: 16,
        relationship: "backlink",
      });

      newEdges.push({
        source: item.id,
        target: currentEntityId,
        type: "backlink",
      });
    });

    // Add related items nodes
    relatedItems.forEach((item, index) => {
      if (newNodes.some(n => n.id === item.id)) return;
      
      const angle = (index / relatedItems.length) * Math.PI * 2 + (Math.PI / 4);
      const distance = 120;
      
      newNodes.push({
        id: item.id,
        type: item.type as NodeType,
        title: item.title,
        x: CENTER_X + Math.cos(angle) * distance,
        y: CENTER_Y + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        radius: 16,
        relationship: "related",
      });

      newEdges.push({
        source: currentEntityId,
        target: item.id,
        type: "related",
      });
    });

    nodesRef.current = newNodes;
    setNodes([...newNodes]);
    setEdges(newEdges);
    
  }, [currentEntityId, backlinks, relatedItems, currentEntity, currentEntityType]);

  // Force directed graph simulation
  useEffect(() => {
    if (nodesRef.current.length <= 1) return;

    let isRunning = true;
    
    const tick = () => {
      if (!isRunning) return;

      const currentNodes = nodesRef.current;
      const alpha = 0.1; // damping

      // Repulsion force between all nodes
      for (let i = 0; i < currentNodes.length; i++) {
        for (let j = i + 1; j < currentNodes.length; j++) {
          const dx = currentNodes[j].x - currentNodes[i].x;
          const dy = currentNodes[j].y - currentNodes[i].y;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq === 0) continue;
          
          const distance = Math.sqrt(distanceSq);
          const minDistance = currentNodes[i].radius + currentNodes[j].radius + 30;
          
          if (distance < minDistance) {
            const force = (minDistance - distance) / distance * 0.5;
            const fx = dx * force;
            const fy = dy * force;
            
            if (i !== 0) { // Keep center node fixed
              currentNodes[i].vx -= fx;
              currentNodes[i].vy -= fy;
            }
            if (j !== 0) {
              currentNodes[j].vx += fx;
              currentNodes[j].vy += fy;
            }
          }
        }
      }

      // Attraction force for edges
      edges.forEach(edge => {
        const sourceNode = currentNodes.find(n => n.id === edge.source);
        const targetNode = currentNodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          const targetDistance = edge.type === 'backlink' ? 80 : 120;
          
          if (distance > 0) {
            const force = (distance - targetDistance) * 0.05;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            if (sourceNode.id !== currentEntityId) {
              sourceNode.vx += fx;
              sourceNode.vy += fy;
            }
            if (targetNode.id !== currentEntityId) {
              targetNode.vx -= fx;
              targetNode.vy -= fy;
            }
          }
        }
      });

      // Update positions
      let hasMovement = false;
      
      currentNodes.forEach(node => {
        if (node.id === currentEntityId) {
          node.x = CENTER_X;
          node.y = CENTER_Y;
          node.vx = 0;
          node.vy = 0;
          return;
        }

        // Add some friction
        node.vx *= 0.8;
        node.vy *= 0.8;

        // Bounding box force
        const margin = 20;
        if (node.x < margin) node.vx += 2;
        if (node.x > GRAPH_WIDTH - margin) node.vx -= 2;
        if (node.y < margin) node.vy += 2;
        if (node.y > GRAPH_HEIGHT - margin) node.vy -= 2;

        node.x += node.vx;
        node.y += node.vy;
        
        if (Math.abs(node.vx) > 0.1 || Math.abs(node.vy) > 0.1) {
          hasMovement = true;
        }
      });

      setNodes([...currentNodes]);

      if (hasMovement) {
        requestRef.current = requestAnimationFrame(tick);
      }
    };

    requestRef.current = requestAnimationFrame(tick);

    return () => {
      isRunning = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [edges, currentEntityId]);

  const handleNavigateToItem = (
    itemId: string,
    itemType: string,
  ) => {
    if (itemId === currentEntityId) return;
    
    if (itemType === "note") {
      setCurrentView("notes");
      const fetchNote = async () => {
        try {
          const { data } = await supabase
            .from("notes")
            .select("*")
            .eq("id", itemId)
            .single();

          if (data) {
            setSelectedNote(data);
            window.history.pushState(null, "", `/notes/${itemId}`);
          }
        } catch (error) {
          logger.error("Error navigating to note:", error);
        }
      };
      void fetchNote();
    } else if (itemType === "paper") {
      setCurrentView("papers");
      const fetchPaper = async () => {
        try {
          const { data } = await supabase
            .from("papers")
            .select("*")
            .eq("id", itemId)
            .single();

          if (data) {
            setSelectedPaper(data);
            window.history.pushState(null, "", `/papers/${itemId}`);
          }
        } catch (error) {
          logger.error("Error navigating to paper:", error);
        }
      };
      void fetchPaper();
    } else if (itemType === "idea") {
      setCurrentView("ideas");
      const fetchIdea = async () => {
        try {
          const { data } = await supabase
            .from("ideas")
            .select("*")
            .eq("id", itemId)
            .single();

          if (data) {
            setSelectedIdea(data);
            window.history.pushState(null, "", `/ideas/${itemId}`);
          }
        } catch (error) {
          logger.error("Error navigating to idea:", error);
        }
      };
      void fetchIdea();
    }
  };

  const getNodeIcon = (type: string, isCenter: boolean) => {
    const className = isCenter ? "w-6 h-6 text-white" : "w-4 h-4 text-white";
    switch (type) {
      case "note":
        return <FileText className={className} aria-hidden="true" />;
      case "paper":
        return <BookOpen className={className} aria-hidden="true" />;
      case "idea":
        return <Lightbulb className={className} aria-hidden="true" />;
      default:
        return <User className={className} aria-hidden="true" />;
    }
  };

  const getNodeColorClass = (relationship: string, type: string) => {
    if (relationship === "current") {
      switch (type) {
        case "note": return "bg-blue-500 border-blue-600 dark:bg-blue-600 dark:border-blue-700";
        case "paper": return "bg-purple-500 border-purple-600 dark:bg-purple-600 dark:border-purple-700";
        case "idea": return "bg-amber-500 border-amber-600 dark:bg-amber-600 dark:border-amber-700";
        default: return "bg-slate-500 border-slate-600 dark:bg-slate-600 dark:border-slate-700";
      }
    } else if (relationship === "backlink") {
      return "bg-indigo-400 border-indigo-500 dark:bg-indigo-500 dark:border-indigo-600";
    } else {
      return "bg-teal-400 border-teal-500 dark:bg-teal-500 dark:border-teal-600";
    }
  };

  if (!currentEntityId || nodes.length <= 1) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-text-tertiary bg-bg-base/50 rounded-lg border border-dashed border-border-subtle p-4 text-center" role="status" aria-live="polite">
        No connections found yet. Add backlinks or shared topics to see the entity graph.
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden bg-bg-base/50 rounded-lg border border-border-subtle" style={{ height: GRAPH_HEIGHT }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <AnimatePresence>
          {edges.map((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            return (
              <motion.line
                key={`${edge.source}-${edge.target}-${edge.type}`}
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ 
                  opacity: 0.6, 
                  pathLength: 1,
                  x1: sourceNode.x,
                  y1: sourceNode.y,
                  x2: targetNode.x,
                  y2: targetNode.y
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className={edge.type === 'backlink' ? "stroke-indigo-400/50 dark:stroke-indigo-500/50" : "stroke-teal-400/50 dark:stroke-teal-500/50"}
                strokeWidth={edge.type === 'backlink' ? 2 : 1.5}
                strokeDasharray={edge.type === 'related' ? "4 4" : "none"}
              />
            );
          })}
        </AnimatePresence>
      </svg>

      <AnimatePresence>
        {nodes.map((node) => {
          const isCenter = node.relationship === "current";
          return (
            <motion.button
              key={node.id}
              onClick={() => handleNavigateToItem(node.id, node.type)}
              aria-label={isCenter ? `Current ${node.type}: ${node.title}` : `Navigate to ${node.type} ${node.title}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: node.x - node.radius,
                y: node.y - node.radius,
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ 
                type: "spring",
                stiffness: 260,
                damping: 20
              }}
              whileHover={{ scale: 1.1, zIndex: 10 }}
              className={`absolute flex items-center justify-center rounded-full shadow-md border-2 cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 group ${getNodeColorClass(node.relationship, node.type)}`}
              style={{
                width: node.radius * 2,
                height: node.radius * 2,
              }}
            >
              {getNodeIcon(node.type, isCenter)}
              
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-bg-surface text-text-primary text-xs px-2 py-1 rounded shadow border border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50" aria-hidden="true">
                {node.title}
                <div className="text-[10px] text-text-tertiary capitalize mt-0.5">{node.type} • {node.relationship}</div>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
