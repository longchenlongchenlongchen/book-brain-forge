import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SubConcept {
  id: string;
  title: string;
  description: string | null;
}

interface MainConcept {
  id: string;
  title: string;
  description: string | null;
  subConcepts: SubConcept[];
}

export default function Concepts() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [concepts, setConcepts] = useState<MainConcept[]>([]);
  const [bookTitle, setBookTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [openConcepts, setOpenConcepts] = useState<Set<string>>(new Set());

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

      // Organize into hierarchy
      const mainConcepts: MainConcept[] = [];
      const conceptsMap = new Map<string, MainConcept>();

      conceptsData.forEach((concept) => {
        if (concept.level === 1) {
          const mainConcept: MainConcept = {
            id: concept.id,
            title: concept.title,
            description: concept.description,
            subConcepts: [],
          };
          mainConcepts.push(mainConcept);
          conceptsMap.set(concept.id, mainConcept);
        }
      });

      conceptsData.forEach((concept) => {
        if (concept.level === 2 && concept.parent_id) {
          const parent = conceptsMap.get(concept.parent_id);
          if (parent) {
            parent.subConcepts.push({
              id: concept.id,
              title: concept.title,
              description: concept.description,
            });
          }
        }
      });

      setConcepts(mainConcepts);
    } catch (error: any) {
      toast.error("Failed to load concepts");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleConcept = (conceptId: string) => {
    setOpenConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
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
        {concepts.length === 0 ? (
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
          <div className="space-y-4">
            {concepts.map((concept, index) => (
              <Card
                key={concept.id}
                className="bg-gradient-card border-border/50 overflow-hidden"
              >
                <Collapsible
                  open={openConcepts.has(concept.id)}
                  onOpenChange={() => toggleConcept(concept.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="p-6 flex items-start gap-4 hover:bg-accent/5 transition-colors">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold shadow-glow-purple">
                        {index + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <h2 className="text-xl font-semibold mb-2">
                          {concept.title}
                        </h2>
                        {concept.description && (
                          <p className="text-muted-foreground">
                            {concept.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 text-muted-foreground transition-transform ${
                          openConcepts.has(concept.id) ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-6 pb-6 space-y-3">
                      {concept.subConcepts.map((subConcept) => (
                        <div
                          key={subConcept.id}
                          className="ml-14 p-4 rounded-lg bg-background/50 border border-border/50"
                        >
                          <h3 className="font-medium mb-1">{subConcept.title}</h3>
                          {subConcept.description && (
                            <p className="text-sm text-muted-foreground">
                              {subConcept.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
