const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'Use a polished, corporate tone. Confident yet respectful.',
  friendly: 'Use a warm, personable tone. Conversational but still credible.',
  sales: 'Use a persuasive, benefit-driven tone. Highlight value and include a compelling call to action.',
  casual: 'Use a relaxed, peer-to-peer tone. Brief, punchy, and genuine.',
  formal: 'Use a highly formal tone. Suitable for executive or legal communication.',
  witty: 'Use a clever, engaging tone with subtle humor. Stand out while remaining professional.',
};

const PURPOSE_INSTRUCTIONS: Record<string, string> = {
  cold_outreach: 'This is a cold outreach email to someone who doesn\'t know the sender. Make it attention-grabbing in the first line. Reference something specific. Keep it under 120 words.',
  follow_up: 'This is a follow-up email. Reference the previous interaction naturally. Be concise and add new value — don\'t just "check in". Under 100 words.',
  newsletter: 'This is a newsletter/update email. Make it informative and scannable with clear sections. Can be up to 250 words.',
  announcement: 'This is an announcement email. Lead with the news, explain the impact, and include a clear next step. Under 150 words.',
  thank_you: 'This is a thank-you or appreciation email. Be genuine and specific about what you\'re grateful for. Under 80 words.',
  meeting_request: 'This is a meeting request email. Clearly state the purpose, suggest specific times, and make it easy to say yes. Under 100 words.',
  promotion: 'This is a promotional email. Create urgency, highlight the offer clearly, and include a strong CTA. Under 150 words.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      prompt,
      tone = 'professional',
      purpose = 'cold_outreach',
      senderName,
      senderCompany,
      recipientContext,
      existingSubject,
      existingBody,
      action = 'generate', // generate | rewrite | improve
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional;
    const purposeInstruction = PURPOSE_INSTRUCTIONS[purpose] || PURPOSE_INSTRUCTIONS.cold_outreach;

    let systemPrompt: string;
    let userPrompt: string;

    if (action === 'rewrite' && existingBody) {
      systemPrompt = `You are a world-class email copywriter. Rewrite the given email to be more effective.

Rules:
- ${toneInstruction}
- ${purposeInstruction}
- Preserve the core message but make it significantly better
- Improve clarity, flow, and persuasiveness
- Format response as JSON with "subject" and "body" fields
- The body should be HTML with proper <p>, <strong>, <em>, <ul>/<li> tags for formatting
- Use <br> for line breaks within paragraphs
${senderName ? `- Sign off with: ${senderName}` : ''}`;

      userPrompt = `Rewrite this email to be more compelling:

Subject: ${existingSubject || '(no subject)'}
Body: ${existingBody}

${prompt ? `Additional instructions: ${prompt}` : ''}`;
    } else if (action === 'improve' && existingBody) {
      systemPrompt = `You are a world-class email copywriter. Improve the given email based on the user's specific instructions.

Rules:
- ${toneInstruction}
- Make targeted improvements as requested
- Keep changes focused — don't rewrite entirely unless asked
- Format response as JSON with "subject" and "body" fields
- The body should be HTML with proper <p>, <strong>, <em>, <ul>/<li> tags
${senderName ? `- Sign off with: ${senderName}` : ''}`;

      userPrompt = `Current email:
Subject: ${existingSubject || '(no subject)'}
Body: ${existingBody}

Improvement requested: ${prompt || 'Make it better'}`;
    } else {
      systemPrompt = `You are a world-class email copywriter who writes emails that get opened, read, and acted upon.

Rules:
- ${toneInstruction}
- ${purposeInstruction}
- Write a compelling subject line that drives opens (avoid spam triggers)
- The first line must hook the reader — no generic openers like "I hope this email finds you well"
- Every sentence must earn its place — cut ruthlessly
- End with ONE clear, low-friction call to action
- Format response as JSON with "subject" and "body" fields
- The body should be HTML with proper <p>, <strong>, <em>, <ul>/<li> tags for rich formatting
- Use <br> for line breaks within paragraphs
- Support personalization variables: {{name}} for recipient name, {{email}} for recipient email
${senderName ? `- Sign off with: ${senderName}` : ''}
${senderCompany ? `- Sender's company: ${senderCompany}` : ''}`;

      userPrompt = `Write an email with this context:

${prompt || 'Write a professional outreach email'}

${recipientContext ? `About the recipients: ${recipientContext}` : ''}`;
    }

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
              name: 'compose_email',
              description: 'Compose an email with subject line and HTML body.',
              parameters: {
                type: 'object',
                properties: {
                  subject: { type: 'string', description: 'Email subject line' },
                  body: { type: 'string', description: 'Email body as HTML' },
                },
                required: ['subject', 'body'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'compose_email' } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI is busy — please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds.' }),
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
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        emailResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: 'Your Email', body: content };
      } catch {
        emailResult = { subject: 'Your Email', body: `<p>${content}</p>` };
      }
    }

    // Ensure body is HTML
    if (!emailResult.body.includes('<')) {
      emailResult.body = emailResult.body
        .split('\n\n')
        .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
    }

    return new Response(
      JSON.stringify({ success: true, email: emailResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in ai-write-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
