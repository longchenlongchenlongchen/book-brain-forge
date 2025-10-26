import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookId, count = 10, topic } = await req.json();
    console.log('Generating flashcards for book:', bookId, 'count:', count);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get or create deck
    let { data: deck, error: deckError } = await supabaseClient
      .from('decks')
      .select('*')
      .eq('book_id', bookId)
      .eq('title', topic || 'Generated Flashcards')
      .maybeSingle();

    if (!deck) {
      const { data: newDeck, error: createError } = await supabaseClient
        .from('decks')
        .insert([{
          book_id: bookId,
          title: topic || 'Generated Flashcards'
        }])
        .select()
        .single();

      if (createError) throw createError;
      deck = newDeck;
    }

    console.log('Using deck:', deck.id);

    // Get chunks from the book (with embeddings for potential similarity search)
    const { data: chunks, error: chunksError } = await supabaseClient
      .from('chunks')
      .select('*')
      .eq('book_id', bookId)
      .limit(20);

    if (chunksError) throw chunksError;

    if (!chunks || chunks.length === 0) {
      throw new Error('No content found. Please upload and process a PDF first.');
    }

    console.log(`Found ${chunks.length} chunks to work with`);

    // Generate flashcards using AI with enhanced prompts
    const systemPrompt = `You are an expert educational content creator specializing in effective learning materials using evidence-based pedagogical principles.

Generate high-quality flashcards that:
1. Focus on ONE key concept per card (atomic principle)
2. Use clear, precise language without ambiguity
3. Ask questions that test understanding, not just recall
4. Provide comprehensive answers that explain the "why" and "how"
5. Progressive difficulty: start with fundamentals, build to complex concepts
6. Include practical examples or applications where relevant
7. Use active recall triggers (e.g., "Explain...", "How does...", "What is the relationship between...")

Quality criteria:
- Questions should be answerable from the provided context alone
- Avoid yes/no questions; prefer open-ended questions
- Difficulty scale: 1=basic definition, 3=understanding/application, 5=analysis/synthesis
- Cite source chunks for traceability

Return ONLY valid JSON in this exact format:
{
  "flashcards": [
    {
      "question": "Clear, specific question that tests understanding",
      "answer": "Complete answer with explanation and context",
      "difficulty": 3,
      "sourceChunkIds": ["chunk-id-1", "chunk-id-2"]
    }
  ]
}`;

    const context = chunks.map(c => `[Chunk ${c.id}]: ${c.text}`).join('\n\n');
    const prompt = `Generate ${count} high-quality flashcards from this educational content. Ensure variety in question types and progressive difficulty:\n\n${context}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI generation failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');
    
    const content = aiData.choices[0].message.content;
    let flashcardsData;
    
    try {
      flashcardsData = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Helper to extract valid UUIDs from AI response
    const extractUUIDs = (ids: any[]): string[] => {
      if (!Array.isArray(ids)) return [];
      return ids
        .map(id => {
          if (typeof id !== 'string') return null;
          // Extract UUID pattern (8-4-4-4-12 hex digits)
          const match = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
          return match ? match[0] : null;
        })
        .filter(Boolean) as string[];
    };

    // Insert flashcards
    const cardsToInsert = flashcardsData.flashcards.map((fc: any) => ({
      deck_id: deck.id,
      book_id: bookId,
      type: 'flashcard',
      question: fc.question,
      answer: fc.answer,
      difficulty: fc.difficulty || 3,
      source_chunk_ids: extractUUIDs(fc.sourceChunkIds || []),
      distractors: []
    }));

    const { data: insertedCards, error: cardsError } = await supabaseClient
      .from('cards')
      .insert(cardsToInsert)
      .select();

    if (cardsError) throw cardsError;

    console.log(`Generated ${insertedCards.length} flashcards`);

    return new Response(
      JSON.stringify({ 
        success: true,
        cards: insertedCards,
        deckId: deck.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating flashcards:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
