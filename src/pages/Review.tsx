import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, ArrowLeft, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CardData {
  id: string;
  question: string;
  answer: string;
  type: string;
  difficulty: number;
  book_id: string;
}

export default function Review() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [cards, setCards] = useState<CardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);
  const [reviewedCards, setReviewedCards] = useState<Set<number>>(new Set());

  useEffect(() => {
    checkAuth();
    fetchCards();
  }, [deckId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("No cards found in this deck");
        setIsLoading(false);
        return;
      }

      setCards(data);
      if (data[0]?.book_id) {
        setBookId(data[0].book_id);
      }
    } catch (error: any) {
      toast.error("Failed to load cards");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrade = async (grade: number) => {
    const card = cards[currentIndex];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Simple SM-2 algorithm
      let interval = 1;
      let ease = 2.5;

      if (grade >= 3) {
        interval = Math.ceil(interval * ease);
      }

      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + interval);

      await supabase.from("reviews").insert({
        card_id: card.id,
        user_id: user.id,
        grade,
        due_at: dueAt.toISOString(),
        reviewed_at: new Date().toISOString(),
        interval_days: interval,
        ease_factor: ease,
      });

      // Mark card as reviewed
      setReviewedCards(prev => new Set(prev).add(currentIndex));

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        toast.success("Review session complete!");
        navigate(bookId ? `/books/${bookId}` : "/dashboard");
      }
    } catch (error: any) {
      toast.error("Failed to save review");
      console.error(error);
    }
  };

  const handleNavigateToCard = (index: number) => {
    setCurrentIndex(index);
    setShowAnswer(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading cards...</p>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">No cards found in this deck</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => bookId ? navigate(`/books/${bookId}`) : navigate("/dashboard")} 
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Review Session</h1>
            <p className="text-muted-foreground">
              Card {currentIndex + 1} of {cards.length}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Question Navigation */}
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Jump to Question:</h3>
                <div className="flex flex-wrap gap-2">
                  {cards.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => handleNavigateToCard(index)}
                      className={cn(
                        "w-10 h-10 rounded-lg border-2 transition-all text-sm font-medium",
                        "hover:scale-105",
                        currentIndex === index && "border-primary bg-primary text-primary-foreground",
                        currentIndex !== index && reviewedCards.has(index) && "border-green-500 bg-green-500/10 text-green-600",
                        currentIndex !== index && !reviewedCards.has(index) && "border-border bg-background"
                      )}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            />
          </div>

          {/* Card */}
          <Card className="bg-gradient-card border-border/50 shadow-glow-purple">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Question:</h2>
                <p className="text-lg">{currentCard.question}</p>
              </div>

              {showAnswer && (
                <div className="space-y-4 pt-6 border-t border-border/50">
                  <h2 className="text-xl font-semibold text-primary">Answer:</h2>
                  <p className="text-lg">{currentCard.answer}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          {!showAnswer ? (
            <Button
              onClick={() => setShowAnswer(true)}
              className="w-full bg-gradient-primary hover:opacity-90 shadow-glow-blue"
              size="lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Show Answer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleGrade(1)}
                variant="outline"
                size="lg"
                className="border-destructive/50 hover:bg-destructive/10 text-destructive"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Hard
              </Button>
              <Button
                onClick={() => handleGrade(4)}
                size="lg"
                className="bg-gradient-primary hover:opacity-90"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Easy
              </Button>
            </div>
          )}

          <div className="flex justify-center gap-2 text-sm text-muted-foreground">
            <span>Difficulty: {currentCard.difficulty}/5</span>
          </div>
        </div>
      </main>
    </div>
  );
}
