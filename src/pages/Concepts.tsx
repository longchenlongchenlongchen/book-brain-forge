import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    <div className="px-16 py-12 shadow-2xl rounded-2xl bg-gradient-primary text-white border-4 border-primary min-w-[700px] max-w-[800px]">
      <div className="font-bold text-5xl mb-6">{data.label}</div>
      {data.description && (
        <div className="text-2xl opacity-95 line-clamp-5">{data.description}</div>
      )}
    </div>
  ),
  subConcept: ({ data }: { data: any }) => (
    <div className="px-12 py-8 shadow-xl rounded-xl bg-card border-3 border-border min-w-[600px] max-w-[700px]">
      <div className="font-semibold text-3xl mb-4">{data.label}</div>
      {data.description && (
        <div className="text-xl text-muted-foreground line-clamp-4">{data.description}</div>
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
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0);
  const [totalConcepts, setTotalConcepts] = useState(0);
  const [allNodesData, setAllNodesData] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

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

      // Transform to React Flow nodes and edges - one diagram per main concept
      const allDiagramsData: { nodes: Node[]; edges: Edge[] }[] = [];
      
      const mainConcepts = conceptsData.filter(c => c.level === 1);
      const subConcepts = conceptsData.filter(c => c.level === 2);

      // Create separate diagram for each main concept
      mainConcepts.forEach((concept, mainIndex) => {
        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];

        // Center position for main concept
        const mainConceptX = 400;
        const mainConceptY = 100;

        // Add main concept node
        flowNodes.push({
          id: concept.id,
          type: 'mainConcept',
          position: { x: mainConceptX, y: mainConceptY },
          data: { 
            label: concept.title,
            description: concept.description
          },
        });

        // Add sub-concepts for this main concept
        const relatedSubConcepts = subConcepts.filter(sc => sc.parent_id === concept.id);
        const subConceptY = mainConceptY + 600;
        
        relatedSubConcepts.forEach((subConcept, subIndex) => {
          // Distribute sub-concepts horizontally around center
          const totalSubs = relatedSubConcepts.length;
          const startX = mainConceptX - ((totalSubs - 1) * 750) / 2;
          const subX = startX + (subIndex * 750);
          
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
            style: { stroke: 'hsl(var(--primary))', strokeWidth: 6 },
          });
        });

        allDiagramsData.push({ nodes: flowNodes, edges: flowEdges });
      });

      setAllNodesData(allDiagramsData);
      setTotalConcepts(mainConcepts.length);
      
      // Set initial diagram
      if (allDiagramsData.length > 0) {
        setNodes(allDiagramsData[0].nodes);
        setEdges(allDiagramsData[0].edges);
      }
    } catch (error: any) {
      toast.error("Failed to load concepts");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviousConcept = () => {
    const newIndex = Math.max(0, currentConceptIndex - 1);
    setCurrentConceptIndex(newIndex);
    if (allNodesData[newIndex]) {
      setNodes(allNodesData[newIndex].nodes);
      setEdges(allNodesData[newIndex].edges);
    }
  };

  const handleNextConcept = () => {
    const newIndex = Math.min(totalConcepts - 1, currentConceptIndex + 1);
    setCurrentConceptIndex(newIndex);
    if (allNodesData[newIndex]) {
      setNodes(allNodesData[newIndex].nodes);
      setEdges(allNodesData[newIndex].edges);
    }
  };

  const handleDeleteAllConcepts = async () => {
    try {
      const { error } = await supabase
        .from("concepts")
        .delete()
        .eq("book_id", bookId);

      if (error) throw error;

      toast.success("All concepts deleted successfully");
      navigate(`/books/${bookId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete concepts");
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
          {totalConcepts > 0 && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/50 hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Concepts?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {totalConcepts} key concepts for this book. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllConcepts}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All Concepts
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {totalConcepts > 1 && (
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handlePreviousConcept}
                    disabled={currentConceptIndex === 0}
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Concept {currentConceptIndex + 1} of {totalConcepts}
                  </span>
                  <Button
                    variant="outline"
                    onClick={handleNextConcept}
                    disabled={currentConceptIndex === totalConcepts - 1}
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
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
              minZoom={0.3}
              maxZoom={2}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
