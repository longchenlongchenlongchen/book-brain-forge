import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brain, BookOpen, Sparkles, Brain as BrainIcon } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center space-y-12">
        {/* Hero Section */}
        <div className="space-y-6 animate-slide-in">
          <div className="mx-auto w-20 h-20 bg-gradient-primary rounded-3xl flex items-center justify-center animate-pulse-glow">
            <Brain className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            BookBrain
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Transform your textbooks into smart flashcards with AI-powered learning
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="p-6 bg-gradient-card rounded-xl border border-border/50 hover:shadow-glow-purple transition-all">
            <BookOpen className="w-10 h-10 text-primary mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Upload PDFs</h3>
            <p className="text-sm text-muted-foreground">
              Upload any textbook and let AI extract the key concepts
            </p>
          </div>
          <div className="p-6 bg-gradient-card rounded-xl border border-border/50 hover:shadow-glow-blue transition-all">
            <Sparkles className="w-10 h-10 text-secondary mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">AI Generation</h3>
            <p className="text-sm text-muted-foreground">
              Generate flashcards and MCQs with source citations
            </p>
          </div>
          <div className="p-6 bg-gradient-card rounded-xl border border-border/50 hover:shadow-glow-purple transition-all">
            <BrainIcon className="w-10 h-10 text-primary mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Spaced Repetition</h3>
            <p className="text-sm text-muted-foreground">
              Smart review scheduling based on SM-2 algorithm
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4 pt-8">
          <Button
            onClick={() => navigate("/auth")}
            className="bg-gradient-primary hover:opacity-90 shadow-glow-purple text-lg px-8 py-6 h-auto"
          >
            Get Started
          </Button>
          <p className="text-sm text-muted-foreground">
            Free to start • No credit card required
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
