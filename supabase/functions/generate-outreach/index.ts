const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TONE_PROMPTS: Record<string, string> = {
  professional: 'Write in a professional, corporate tone. Be respectful and formal.',
  friendly: 'Write in a warm, friendly, and approachable tone. Be personable but still professional.',
  sales: 'Write in a persuasive, sales-focused tone. Highlight value propositions and include a clear call to action.',
  casual: 'Write in a casual, conversational tone. Keep it brief and engaging like a message from a peer.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { websiteUrl, businessName, emails, tone = 'professional', senderName } = await req.json();

    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'Website URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Scrape the website to understand the business
    let websiteContent = '';
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (firecrawlKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: websiteUrl,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const scrapeData = await scrapeRes.json();

        if (scrapeRes.ok && scrapeData.success) {
          websiteContent = (scrapeData.data?.markdown || scrapeData.markdown || '').slice(0, 4000);
        }
      } catch (e) {
        console.log('Website scrape failed, continuing with basic info:', e);
      }
    }

    // Step 2: Generate personalized email using AI
    const toneInstruction = TONE_PROMPTS[tone] || TONE_PROMPTS.professional;

    const systemPrompt = `You are an expert cold email copywriter. Your job is to write a short, personalized outreach email based on the recipient's business website content. 

Rules:
- Keep the email under 150 words
- ${toneInstruction}
- Personalize based on the actual business details found on their website
- Include a clear subject line
- Do NOT use generic filler like "I came across your website"
- Reference something specific about their business
- End with a simple call to action
- Format your response as JSON with "subject" and "body" fields
- The body should be plain text (no HTML), with \\n for line breaks
- Sign off with the sender's name if provided`;

    const userPrompt = `Generate a personalized outreach email for this business:

Business Name: ${businessName || 'Unknown'}
Website: ${websiteUrl}
Contact Email(s): ${(emails || []).join(', ') || 'N/A'}
${senderName ? `Sender Name: ${senderName}` : ''}

${websiteContent ? `Website Content:\n${websiteContent}` : 'No website content available - use the business name and URL to personalize.'}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'generate_email',
              description: 'Generate a personalized outreach email with subject and body.',
              parameters: {
                type: 'object',
                properties: {
                  subject: { type: 'string', description: 'Email subject line' },
                  body: { type: 'string', description: 'Email body text with \\n for line breaks' },
                },
                required: ['subject', 'body'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'generate_email' } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await aiRes.text();
      console.error('AI gateway error:', aiRes.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let emailResult: { subject: string; body: string };

    if (toolCall?.function?.arguments) {
      emailResult = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try parsing from content
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        emailResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: 'Introduction', body: content };
      } catch {
        emailResult = { subject: 'Introduction', body: content };
      }
    }

    return new Response(
      JSON.stringify({ success: true, email: emailResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-outreach:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
