-- Create table for storing key concepts
CREATE TABLE public.concepts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  parent_id uuid REFERENCES public.concepts(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view concepts from their books"
ON public.concepts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = concepts.book_id
    AND books.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create concepts for their books"
ON public.concepts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = concepts.book_id
    AND books.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete concepts from their books"
ON public.concepts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = concepts.book_id
    AND books.user_id = auth.uid()
  )
);

-- Create index for better query performance
CREATE INDEX idx_concepts_book_id ON public.concepts(book_id);
CREATE INDEX idx_concepts_parent_id ON public.concepts(parent_id);