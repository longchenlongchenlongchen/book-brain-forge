-- Add RLS policies for deleting cards and decks

-- Allow users to delete cards from their own books
CREATE POLICY "Users can delete cards from their books"
ON public.cards
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = cards.book_id
    AND books.user_id = auth.uid()
  )
);

-- Allow users to delete decks from their own books
CREATE POLICY "Users can delete decks from their books"
ON public.decks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.books
    WHERE books.id = decks.book_id
    AND books.user_id = auth.uid()
  )
);