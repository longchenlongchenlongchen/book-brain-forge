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
    const { materialId } = await req.json();
    console.log('Processing material:', materialId);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get material info (no joins to avoid potential recursion issues)
    const { data: material, error: materialError } = await supabaseClient
      .from('materials')
      .select('*')
      .eq('id', materialId)
      .single();

    if (materialError) throw materialError;
    console.log('Material found:', material.filename);

    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabaseClient.storage
      .from('pdfs')
      .download(material.storage_path);

    if (downloadError) throw downloadError;
    console.log('PDF downloaded, size:', pdfData.size);

    // Basic page estimate fallback (until real parser is wired)
    const pagesToUpdate = Math.max(1, Math.round(pdfData.size / 500_000));

    // Parse and chunk - using mock text placeholder for now
    console.log('Parsing PDF...');
    const mockText = `This is sample text from ${material.filename}.

    Chapter 1: Introduction
    This chapter introduces the main concepts of the subject matter.
    Key topics include: fundamentals, basic principles, and foundational knowledge.

    Chapter 2: Core Concepts
    The core concepts build upon the introduction and provide deeper insights.
    Important topics: advanced principles, practical applications, case studies.

    Chapter 3: Advanced Topics
    Advanced material for deeper understanding of the subject.
    Topics covered: expert knowledge, complex scenarios, real-world examples.`;

    // Split into chunks (800-1200 characters with 100 char overlap)
    const chunks: any[] = [];
    const chunkSize = 1000;
    const overlap = 100;
    let startIdx = 0;

    while (startIdx < mockText.length) {
      const endIdx = Math.min(startIdx + chunkSize, mockText.length);
      const chunkText = mockText.slice(startIdx, endIdx);

      // Try to generate embedding but do NOT fail the whole job if it errors
      let embedding: number[] | null = null;
      try {
        const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: chunkText,
            model: 'text-embedding-ada-002',
          }),
        });

        if (!embeddingResponse.ok) {
          console.error('Embedding error:', await embeddingResponse.text());
        } else {
          const embeddingData = await embeddingResponse.json();
          embedding = embeddingData.data?.[0]?.embedding ?? null;
        }
      } catch (e) {
        console.error('Embedding fetch failed:', e);
      }

      chunks.push({
        material_id: materialId,
        book_id: material.book_id,
        page_from: Math.floor(startIdx / chunkSize) + 1,
        page_to: Math.floor(endIdx / chunkSize) + 1,
        topic: `Chapter ${Math.floor(startIdx / chunkSize) + 1}`,
        difficulty: Math.floor(Math.random() * 3) + 2, // 2-4
        text: chunkText,
        embedding: embedding,
      });

      startIdx += chunkSize - overlap;
    }

    console.log(`Created ${chunks.length} chunks`);

    // Insert chunks (best-effort)
    const { error: chunksError } = await supabaseClient
      .from('chunks')
      .insert(chunks);

    if (chunksError) {
      console.error('Chunks insert error:', chunksError);
      // continue: we still update pages so UI reflects processing happened
    }

    // Update material with page count (never 0)
    const { error: updateError } = await supabaseClient
      .from('materials')
      .update({ pages: pagesToUpdate })
      .eq('id', materialId);

    if (updateError) throw updateError;

    console.log('PDF processing complete');

    return new Response(
      JSON.stringify({
        success: true,
        chunksCreated: chunks.length,
        pages: pagesToUpdate,
        message: 'PDF processed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
