import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuizCard {
  id: string;
  question: string;
  answer: string;
  distractors: string[];
  type: string;
  difficulty: number;
  book_id: string;
}

export default function Quiz() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const [cards, setCards] = useState<QuizCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [bookId, setBookId] = useState<string | null>(null);
  const [answeredCards, setAnsweredCards] = useState<Map<number, boolean>>(new Map());

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
        .eq("deck_id", deckId)
        .eq("type", "mcq");

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error("No quiz questions found in this deck");
        setIsLoading(false);
        return;
      }

      // Cast distractors from Json to string[]
      const formattedCards = data.map(card => ({
        ...card,
        distractors: Array.isArray(card.distractors) ? card.distractors as string[] : []
      }));

      setCards(formattedCards);
      if (data[0]?.book_id) {
        setBookId(data[0].book_id);
      }
    } catch (error: any) {
      toast.error("Failed to load quiz questions");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer) {
      toast.error("Please select an answer");
      return;
    }

    const card = cards[currentIndex];
    const isCorrect = selectedAnswer === card.answer;
    
    if (isCorrect) {
      setScore(score + 1);
    }

    // Mark card as answered
    setAnsweredCards(prev => new Map(prev).set(currentIndex, isCorrect));
    setShowResult(true);

    // Save review
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("reviews").insert({
          card_id: card.id,
          user_id: user.id,
          grade: isCorrect ? 4 : 1,
          due_at: new Date(Date.now() + (isCorrect ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString(),
          reviewed_at: new Date().toISOString(),
          interval_days: isCorrect ? 7 : 1,
          ease_factor: 2.5,
        });
      }
    } catch (error) {
      console.error("Failed to save review:", error);
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      toast.success(`Quiz complete! Score: ${score + (selectedAnswer === cards[currentIndex].answer ? 1 : 0)}/${cards.length}`);
      navigate(bookId ? `/books/${bookId}` : "/dashboard");
    }
  };

  const handleNavigateToCard = (index: number) => {
    setCurrentIndex(index);
    setSelectedAnswer(null);
    setShowResult(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">No quiz questions found in this deck</p>
            <Button onClick={() => navigate(bookId ? `/books/${bookId}` : "/dashboard")} variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentCard = cards[currentIndex];
  const allOptions = [currentCard.answer, ...(currentCard.distractors || [])].sort(() => Math.random() - 0.5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(bookId ? `/books/${bookId}` : "/dashboard")} 
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Quiz</h1>
            <p className="text-muted-foreground">
              Question {currentIndex + 1} of {cards.length} • Score: {score}/{currentIndex + (showResult ? 1 : 0)}
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
                  {cards.map((_, index) => {
                    const isAnswered = answeredCards.has(index);
                    const isCorrect = answeredCards.get(index);

                    return (
                      <button
                        key={index}
                        onClick={() => handleNavigateToCard(index)}
                        className={cn(
                          "w-10 h-10 rounded-lg border-2 transition-all text-sm font-medium",
                          "hover:scale-105",
                          currentIndex === index && "border-primary bg-primary text-primary-foreground",
                          currentIndex !== index && isAnswered && isCorrect && "border-green-500 bg-green-500/10 text-green-600",
                          currentIndex !== index && isAnswered && !isCorrect && "border-destructive bg-destructive/10 text-destructive",
                          currentIndex !== index && !isAnswered && "border-border bg-background"
                        )}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
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

          {/* Question Card */}
          <Card className="bg-gradient-card border-border/50 shadow-glow-purple">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">{currentCard.question}</h2>
              </div>

              {/* Answer Options */}
              <div className="space-y-3">
                {allOptions.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = option === currentCard.answer;
                  const showCorrectAnswer = showResult && isCorrect;
                  const showWrongAnswer = showResult && isSelected && !isCorrect;

                  return (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(option)}
                      disabled={showResult}
                      className={cn(
                        "w-full p-4 text-left rounded-lg border-2 transition-all",
                        "hover:bg-primary/5",
                        isSelected && !showResult && "border-primary bg-primary/10",
                        !isSelected && !showResult && "border-border",
                        showCorrectAnswer && "border-green-500 bg-green-500/10",
                        showWrongAnswer && "border-destructive bg-destructive/10",
                        showResult && !isSelected && !isCorrect && "opacity-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                        <span className="flex-1">{option}</span>
                        {showCorrectAnswer && <CheckCircle className="w-5 h-5 text-green-500" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {showResult && (
                <div className={cn(
                  "p-4 rounded-lg border-2",
                  selectedAnswer === currentCard.answer
                    ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-300"
                    : "border-destructive bg-destructive/10 text-destructive"
                )}>
                  {selectedAnswer === currentCard.answer
                    ? "Correct! Well done!"
                    : `Incorrect. The correct answer is: ${currentCard.answer}`}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          {!showResult ? (
            <Button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer}
              className="w-full bg-gradient-primary hover:opacity-90 shadow-glow-blue"
              size="lg"
            >
              Submit Answer
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="w-full bg-gradient-primary hover:opacity-90"
              size="lg"
            >
              {currentIndex < cards.length - 1 ? "Next Question" : "Finish Quiz"}
            </Button>
          )}

          <div className="flex justify-center gap-2 text-sm text-muted-foreground">
            <span>Difficulty: {currentCard.difficulty}/5</span>
          </div>
        </div>
      </main>
    </div>
  );
}
