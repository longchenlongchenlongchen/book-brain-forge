import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, ArrowLeft, Upload, Sparkles, FileText, Play, Trash2, BookOpen } from "lucide-react";
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
import { PdfUpload } from "@/components/PdfUpload";
import { Progress } from "@/components/ui/progress";

interface Book {
  id: string;
  title: string;
  author: string | null;
}

interface Material {
  id: string;
  filename: string;
  pages: number;
  storage_path: string;
  created_at: string;
}

interface Deck {
  id: string;
  title: string;
  card_count: number;
  due_count: number;
}

export default function BookDetail() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conceptCount, setConceptCount] = useState(0);

  useEffect(() => {
    checkAuth();
    fetchBookData();
  }, [bookId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchBookData = async () => {
    try {
      // Fetch book
      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("*")
        .eq("id", bookId)
        .single();

      if (bookError) throw bookError;
      setBook(bookData);

      // Fetch materials
      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select("*")
        .eq("book_id", bookId)
        .order("created_at", { ascending: false });

      if (materialsError) throw materialsError;
      setMaterials(materialsData || []);

      // Fetch decks with card counts
      const { data: decksData, error: decksError } = await supabase
        .from("decks")
        .select("id, title, book_id, created_at")
        .eq("book_id", bookId);

      if (decksError) throw decksError;
      
      // Transform decks data to include card counts
      const decksWithCounts = await Promise.all(
        (decksData || []).map(async (deck) => {
          const { count } = await supabase
            .from("cards")
            .select("*", { count: "exact", head: true })
            .eq("deck_id", deck.id);
          
          return {
            ...deck,
            card_count: count || 0,
            due_count: 0, // Will be calculated from reviews
          };
        })
      );
      
      setDecks(decksWithCounts);

      // Fetch concept count
      const { count: conceptsCount } = await supabase
        .from("concepts")
        .select("*", { count: "exact", head: true })
        .eq("book_id", bookId);
      
      setConceptCount(conceptsCount || 0);
    } catch (error: any) {
      toast.error("Failed to load book data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!materials.length) {
      toast.error("Please upload a PDF first");
      return;
    }

    toast.info("Generating flashcards...", { duration: 2000 });
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-flashcards", {
        body: { bookId, count: 10 },
      });

      if (error) throw error;
      toast.success(`Generated ${data.cards?.length || 0} flashcards!`);
      fetchBookData();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate flashcards");
    }
  };

  const handleGenerateMCQ = async () => {
    if (!materials.length) {
      toast.error("Please upload a PDF first");
      return;
    }

    toast.info("Generating quiz questions...", { duration: 2000 });
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-mcq", {
        body: { bookId, count: 10 },
      });

      if (error) throw error;
      toast.success(`Generated ${data.cards?.length || 0} quiz questions!`);
      fetchBookData();
    } catch (error: any) {
      toast.error(error.message || "Failed to generate quiz questions");
    }
  };

  const handleGenerateConcepts = async () => {
    if (!materials.length) {
      toast.error("Please upload a PDF first");
      return;
    }

    toast.info("Generating key concepts...", { duration: 2000 });
    
    try {
      const { data, error } = await supabase.functions.invoke("generate-concepts", {
        body: { bookId },
      });

      if (error) throw error;
      toast.success(`Generated ${data.conceptCount || 0} key concepts!`);
      fetchBookData();
      navigate(`/concepts/${bookId}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate key concepts");
    }
  };

  const handleDeleteMaterial = async (materialId: string, storagePath: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("pdfs")
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("materials")
        .delete()
        .eq("id", materialId);

      if (dbError) throw dbError;

      toast.success("PDF deleted successfully");
      fetchBookData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete PDF");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">Book not found</p>
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{book.title}</h1>
            {book.author && <p className="text-muted-foreground">by {book.author}</p>}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Upload Section */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PdfUpload bookId={book.id} onUploadComplete={fetchBookData} />
            
            {materials.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">Uploaded Materials</h3>
                {materials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium">{material.filename}</p>
                        <p className="text-xs text-muted-foreground">{material.pages} pages</p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete PDF?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{material.filename}" and all associated content. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteMaterial(material.id, material.storage_path)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generate Cards Section */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Generate Study Materials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Use AI to automatically generate flashcards and multiple-choice questions from your uploaded materials.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                onClick={handleGenerateFlashcards}
                disabled={!materials.length}
                className="bg-gradient-primary hover:opacity-90 shadow-glow-purple"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Flashcards
              </Button>
              <Button
                onClick={handleGenerateMCQ}
                disabled={!materials.length}
                className="bg-gradient-primary hover:opacity-90 shadow-glow-blue"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Quiz
              </Button>
              <Button
                onClick={handleGenerateConcepts}
                disabled={!materials.length}
                className="bg-gradient-primary hover:opacity-90 shadow-glow-purple"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Generate Concepts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Key Concepts */}
        {conceptCount > 0 && (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <Button
                onClick={() => navigate(`/concepts/${bookId}`)}
                className="w-full bg-gradient-primary hover:opacity-90 shadow-glow-purple"
                size="lg"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                View Key Concepts Structure ({conceptCount})
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Study Decks */}
        {decks.length > 0 && (
          <Card className="bg-gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Study Decks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {decks.map((deck) => {
                const isQuizDeck = deck.title === 'Generated Quiz';
                const route = isQuizDeck ? `/quiz/${deck.id}` : `/review/${deck.id}`;
                
                return (
                  <Card
                    key={deck.id}
                    className="bg-background/50 border-border/50 hover:shadow-glow-blue transition-all cursor-pointer"
                    onClick={() => navigate(route)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{deck.title}</h3>
                        <span className="text-sm text-primary">{deck.card_count} {isQuizDeck ? 'questions' : 'cards'}</span>
                      </div>
                      {deck.due_count > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Due for review</span>
                            <span className="text-primary font-medium">{deck.due_count}</span>
                          </div>
                          <Progress value={(deck.due_count / deck.card_count) * 100} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
