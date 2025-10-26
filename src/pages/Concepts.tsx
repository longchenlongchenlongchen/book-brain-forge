import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface SubConcept {
  id: string;
  title: string;
  description: string | null;
  parent_id: string;
}

interface MainConcept {
  id: string;
  title: string;
  description: string | null;
  subConcepts: SubConcept[];
}

const nodeTypes = {
  mainConcept: ({ data }: { data: any }) => (
    <div className="px-6 py-4 shadow-lg rounded-lg bg-gradient-primary text-white border-2 border-primary min-w-[250px]">
      <div className="font-bold text-lg mb-2">{data.label}</div>
      {data.description && (
        <div className="text-sm opacity-90 line-clamp-3">{data.description}</div>
      )}
    </div>
  ),
  subConcept: ({ data }: { data: any }) => (
    <div className="px-4 py-3 shadow-md rounded-lg bg-card border-2 border-border min-w-[200px]">
      <div className="font-semibold text-sm mb-1">{data.label}</div>
      {data.description && (
        <div className="text-xs text-muted-foreground line-clamp-2">{data.description}</div>
      )}
    </div>
  ),
};

export default function Concepts() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [bookTitle, setBookTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, [bookId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchData = async () => {
    try {
      // Fetch book info
      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("title")
        .eq("id", bookId)
        .single();

      if (bookError) throw bookError;
      setBookTitle(bookData.title);

      // Fetch concepts
      const { data: conceptsData, error: conceptsError } = await supabase
        .from("concepts")
        .select("*")
        .eq("book_id", bookId)
        .order("level")
        .order("order_index");

      if (conceptsError) throw conceptsError;

      // Transform to React Flow nodes and edges
      const flowNodes: Node[] = [];
      const flowEdges: Edge[] = [];
      
      const mainConcepts = conceptsData.filter(c => c.level === 1);
      const subConcepts = conceptsData.filter(c => c.level === 2);

      // Calculate layout positions
      const horizontalSpacing = 400;
      const verticalSpacing = 200;
      const mainConceptY = 100;
      const subConceptY = mainConceptY + verticalSpacing;

      // Add main concepts
      mainConcepts.forEach((concept, index) => {
        const x = index * horizontalSpacing + 100;
        flowNodes.push({
          id: concept.id,
          type: 'mainConcept',
          position: { x, y: mainConceptY },
          data: { 
            label: concept.title,
            description: concept.description
          },
        });

        // Add sub-concepts for this main concept
        const relatedSubConcepts = subConcepts.filter(sc => sc.parent_id === concept.id);
        relatedSubConcepts.forEach((subConcept, subIndex) => {
          const subX = x + (subIndex - (relatedSubConcepts.length - 1) / 2) * 250;
          flowNodes.push({
            id: subConcept.id,
            type: 'subConcept',
            position: { x: subX, y: subConceptY },
            data: { 
              label: subConcept.title,
              description: subConcept.description
            },
          });

          // Add edge connecting main concept to sub-concept
          flowEdges.push({
            id: `${concept.id}-${subConcept.id}`,
            source: concept.id,
            target: subConcept.id,
            type: ConnectionLineType.Bezier,
            animated: true,
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
          });
        });
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error: any) {
      toast.error("Failed to load concepts");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading concepts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(`/books/${bookId}`)}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Key Concepts</h1>
            <p className="text-muted-foreground">{bookTitle}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {nodes.length === 0 ? (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="text-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                No key concepts generated yet
              </p>
              <Button onClick={() => navigate(`/books/${bookId}`)} variant="outline">
                Go Back
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="h-[calc(100vh-12rem)] rounded-lg border-2 border-border/50 bg-card/50 overflow-hidden">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.1}
              maxZoom={1.5}
              defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
              connectionLineType={ConnectionLineType.Bezier}
            >
              <Background />
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  if (node.type === 'mainConcept') return 'hsl(var(--primary))';
                  return 'hsl(var(--muted))';
                }}
                className="bg-background border border-border"
              />
            </ReactFlow>
          </div>
        )}
      </main>
    </div>
  );
}
