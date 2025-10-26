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
    console.log('Generating MCQs for book:', bookId, 'count:', count);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get or create deck
    let { data: deck, error: deckError } = await supabaseClient
      .from('decks')
      .select('*')
      .eq('book_id', bookId)
      .eq('title', topic || 'Generated Quiz')
      .maybeSingle();

    if (!deck) {
      const { data: newDeck, error: createError } = await supabaseClient
        .from('decks')
        .insert([{
          book_id: bookId,
          title: topic || 'Generated Quiz'
        }])
        .select()
        .single();

      if (createError) throw createError;
      deck = newDeck;
    }

    console.log('Using deck:', deck.id);

    // Get chunks from the book
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

    // Generate MCQs using AI with enhanced prompts
    const systemPrompt = `You are an expert educational assessment designer specializing in effective multiple-choice questions using evidence-based assessment principles.

Generate high-quality MCQs that:
1. Test genuine understanding, not just memorization
2. Have ONE clearly correct answer based on the content
3. Include three plausible but incorrect distractors that:
   - Represent common misconceptions or errors
   - Are similar in length and complexity to the correct answer
   - Are not obviously wrong
   - Do not overlap or contradict each other
4. Use clear, unambiguous language
5. Avoid negative phrasing (e.g., "Which is NOT...") unless essential
6. Progressive difficulty across questions

Question stem guidelines:
- Be specific and focused on one concept
- Provide sufficient context
- Avoid "all of the above" or "none of the above"
- Test application and analysis, not just recall

Difficulty scale:
- 1-2: Basic recall and comprehension
- 3: Application of concepts
- 4-5: Analysis, evaluation, and synthesis

Return ONLY valid JSON in this exact format:
{
  "mcqs": [
    {
      "question": "Clear, specific question testing understanding",
      "answer": "The single correct answer",
      "distractors": ["Plausible wrong answer 1", "Plausible wrong answer 2", "Plausible wrong answer 3"],
      "difficulty": 3,
      "sourceChunkIds": ["chunk-id-1"]
    }
  ]
}`;

    const context = chunks.map(c => `[Chunk ${c.id}]: ${c.text}`).join('\n\n');
    const prompt = `Generate ${count} high-quality multiple-choice questions from this educational content. Ensure variety in difficulty and well-crafted distractors:\n\n${context}`;

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
    let mcqData;
    
    try {
      mcqData = JSON.parse(content);
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
          const match = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
          return match ? match[0] : null;
        })
        .filter(Boolean) as string[];
    };

    // Insert MCQs
    const cardsToInsert = mcqData.mcqs.map((mcq: any) => ({
      deck_id: deck.id,
      book_id: bookId,
      type: 'mcq',
      question: mcq.question,
      answer: mcq.answer,
      difficulty: mcq.difficulty || 3,
      source_chunk_ids: extractUUIDs(mcq.sourceChunkIds || []),
      distractors: mcq.distractors || []
    }));

    const { data: insertedCards, error: cardsError } = await supabaseClient
      .from('cards')
      .insert(cardsToInsert)
      .select();

    if (cardsError) throw cardsError;

    console.log(`Generated ${insertedCards.length} MCQs`);

    return new Response(
      JSON.stringify({ 
        success: true,
        cards: insertedCards,
        deckId: deck.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating MCQs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
