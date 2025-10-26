-- Create deck_sessions table to track completion of quiz and review sessions
CREATE TABLE public.deck_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  deck_id UUID NOT NULL,
  session_type TEXT NOT NULL CHECK (session_type IN ('quiz', 'review')),
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cards_completed INTEGER NOT NULL DEFAULT 0,
  score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deck_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own deck sessions"
ON public.deck_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deck sessions"
ON public.deck_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX idx_deck_sessions_user_deck ON public.deck_sessions(user_id, deck_id);
CREATE INDEX idx_deck_sessions_completed_at ON public.deck_sessions(completed_at DESC);