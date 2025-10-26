-- Add missing UPDATE policy for cards table
CREATE POLICY "Users can update cards from their books"
ON public.cards
FOR UPDATE
USING (EXISTS (
  SELECT 1
  FROM public.books
  WHERE books.id = cards.book_id
    AND books.user_id = auth.uid()
));