import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Fetch chunks for this book
    const { data: chunks, error: chunksError } = await supabaseClient
      .from('chunks')
      .select('text, topic')
      .eq('book_id', bookId)
      .order('page_from');

    if (chunksError) throw chunksError;
    if (!chunks?.length) throw new Error('No content found for this book');

    // Combine chunks into context
    const context = chunks.map(c => c.text).join('\n\n');

    // Call Lovable AI to generate key concepts with enhanced prompts
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `You are an expert educational content analyst specializing in knowledge structure and curriculum design.

Your task is to create a comprehensive, hierarchical concept map that:
1. Identifies the core themes and organizing principles of the content
2. Structures knowledge from foundational to advanced concepts
3. Shows logical relationships and dependencies between concepts
4. Provides clear, instructive descriptions for each concept

Guidelines:
- Extract 5-8 main concepts that represent major themes or domains
- For each main concept, identify 2-4 sub-concepts that elaborate or specify
- Descriptions should be clear, educational, and provide context
- Use consistent terminology from the source material
- Order concepts logically (e.g., prerequisites before advanced topics)
- Avoid redundancy between concepts

Format: Return ONLY a valid JSON array with this structure.`
          },
          {
            role: 'user',
            content: `Analyze this educational content and extract a hierarchical structure of key concepts. Create a comprehensive concept map with main concepts and their sub-concepts:

Required JSON format:
[{
  "title": "Clear, concise main concept title (2-6 words)",
  "description": "Detailed description explaining what this concept covers, its importance, and key characteristics (50-100 words)",
  "subConcepts": [
    {
      "title": "Specific sub-concept title",
      "description": "Clear explanation of this aspect, including how it relates to the main concept (30-60 words)"
    }
  ]
}]

Content to analyze:
${context.slice(0, 15000)}`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error('Failed to generate concepts');
    }

    const aiData = await aiResponse.json();
    const conceptsText = aiData.choices[0].message.content;
    
    // Extract JSON from the response
    const jsonMatch = conceptsText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Invalid AI response format');
    
    const concepts = JSON.parse(jsonMatch[0]);

    // Delete existing concepts for this book
    await supabaseClient
      .from('concepts')
      .delete()
      .eq('book_id', bookId);

    // Insert new concepts
    const conceptsToInsert: Array<{
      id: string;
      book_id: string;
      title: string;
      description: string;
      parent_id: string | null;
      level: number;
      order_index: number;
    }> = [];
    
    concepts.forEach((mainConcept: any, mainIndex: number) => {
      // Insert main concept
      const mainConceptId = crypto.randomUUID();
      conceptsToInsert.push({
        id: mainConceptId,
        book_id: bookId,
        title: mainConcept.title,
        description: mainConcept.description,
        parent_id: null,
        level: 1,
        order_index: mainIndex,
      });

      // Insert sub-concepts
      if (mainConcept.subConcepts) {
        mainConcept.subConcepts.forEach((subConcept: any, subIndex: number) => {
          conceptsToInsert.push({
            id: crypto.randomUUID(),
            book_id: bookId,
            title: subConcept.title,
            description: subConcept.description,
            parent_id: mainConceptId,
            level: 2,
            order_index: subIndex,
          });
        });
      }
    });

    const { error: insertError } = await supabaseClient
      .from('concepts')
      .insert(conceptsToInsert);

    if (insertError) throw insertError;

    console.log(`Generated ${conceptsToInsert.length} concepts for book ${bookId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        conceptCount: conceptsToInsert.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-concepts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
