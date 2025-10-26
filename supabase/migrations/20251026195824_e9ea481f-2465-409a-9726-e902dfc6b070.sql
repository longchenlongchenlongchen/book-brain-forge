-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Materials (PDF files) table
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  pages INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chunks table (text segments with embeddings)
CREATE TABLE public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  page_from INTEGER NOT NULL,
  page_to INTEGER NOT NULL,
  topic TEXT,
  difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  text TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Decks table
CREATE TABLE public.decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cards table (flashcards and MCQs)
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('flashcard', 'mcq')),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  distractors JSONB DEFAULT '[]'::jsonb,
  source_chunk_ids UUID[] DEFAULT ARRAY[]::UUID[],
  difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reviews table (spaced repetition tracking)
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 5),
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Books policies
CREATE POLICY "Users can view their own books"
  ON public.books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own books"
  ON public.books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
  ON public.books FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
  ON public.books FOR DELETE
  USING (auth.uid() = user_id);

-- Materials policies
CREATE POLICY "Users can view materials from their books"
  ON public.materials FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = materials.book_id
    AND books.user_id = auth.uid()
  ));

CREATE POLICY "Users can create materials for their books"
  ON public.materials FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = book_id
    AND books.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete materials from their books"
  ON public.materials FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = materials.book_id
    AND books.user_id = auth.uid()
  ));

-- Chunks policies
CREATE POLICY "Users can view chunks from their books"
  ON public.chunks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = chunks.book_id
    AND books.user_id = auth.uid()
  ));

CREATE POLICY "Users can create chunks for their books"
  ON public.chunks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = book_id
    AND books.user_id = auth.uid()
  ));

-- Decks policies
CREATE POLICY "Users can view decks from their books"
  ON public.decks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = decks.book_id
    AND books.user_id = auth.uid()
  ));

CREATE POLICY "Users can create decks for their books"
  ON public.decks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = book_id
    AND books.user_id = auth.uid()
  ));

-- Cards policies
CREATE POLICY "Users can view cards from their books"
  ON public.cards FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = cards.book_id
    AND books.user_id = auth.uid()
  ));

CREATE POLICY "Users can create cards for their books"
  ON public.cards FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = book_id
    AND books.user_id = auth.uid()
  ));

-- Reviews policies
CREATE POLICY "Users can view their own reviews"
  ON public.reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_books_user_id ON public.books(user_id);
CREATE INDEX idx_materials_book_id ON public.materials(book_id);
CREATE INDEX idx_chunks_book_id ON public.chunks(book_id);
CREATE INDEX idx_chunks_material_id ON public.chunks(material_id);
CREATE INDEX idx_chunks_embedding ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_decks_book_id ON public.decks(book_id);
CREATE INDEX idx_cards_deck_id ON public.cards(deck_id);
CREATE INDEX idx_cards_book_id ON public.cards(book_id);
CREATE INDEX idx_reviews_user_id_due_at ON public.reviews(user_id, due_at);
CREATE INDEX idx_reviews_card_id ON public.reviews(card_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for books updated_at
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pdfs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );