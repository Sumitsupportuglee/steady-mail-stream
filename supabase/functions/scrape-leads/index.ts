const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScrapedLead {
  url: string;
  name: string | null;
  emails: string[];
  phones: string[];
  website: string | null;
  address: string | null;
}

function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  const filtered = matches.filter(email => {
    const lower = email.toLowerCase();
    return !lower.endsWith('.png') &&
      !lower.endsWith('.jpg') &&
      !lower.endsWith('.gif') &&
      !lower.endsWith('.svg') &&
      !lower.endsWith('.webp') &&
      !lower.includes('example.com') &&
      !lower.includes('sentry.io') &&
      !lower.includes('wixpress.com') &&
      !lower.startsWith('noreply') &&
      email.length < 100;
  });
  return [...new Set(filtered)];
}

function extractPhones(text: string): string[] {
  const phoneRegex = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}/g;
  const matches = text.match(phoneRegex) || [];
  const filtered = matches
    .map(p => p.trim())
    .filter(p => p.replace(/\D/g, '').length >= 7 && p.replace(/\D/g, '').length <= 15);
  return [...new Set(filtered)].slice(0, 5);
}

function extractBusinessName(markdown: string, metadata: any): string | null {
  if (metadata?.title) {
    return metadata.title.split(/[|\-–—]/)[0].trim() || metadata.title;
  }
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return null;
}

function extractAddress(text: string): string | null {
  const addressPatterns = [
    /\d{1,5}\s[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[\s,]*[\w\s]*,?\s*[A-Z]{2}\s*\d{5}/i,
    /(?:Address|Location|Office):\s*(.+?)(?:\n|$)/i,
  ];
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match) return (match[1] || match[0]).trim().slice(0, 200);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, mode } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Search query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl is not configured. Please connect it in settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leads: ScrapedLead[] = [];

    // Use AbortController with 20s timeout to avoid edge function timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      if (mode === 'url') {
        let url = query.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = `https://${url}`;
        }

        console.log('Scraping single URL:', url);

        const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: false,
          }),
          signal: controller.signal,
        });

        const scrapeData = await scrapeRes.json();

        if (scrapeRes.ok && scrapeData.success) {
          const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
          const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

          leads.push({
            url,
            name: extractBusinessName(markdown, metadata),
            emails: extractEmails(markdown),
            phones: extractPhones(markdown),
            website: url,
            address: extractAddress(markdown),
          });
        } else {
          console.error('Scrape failed:', scrapeData);
        }
      } else {
        // Search mode - use Firecrawl search WITHOUT scraping content (much faster)
        console.log('Searching for:', query);

        const searchRes = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query + ' contact email phone',
            limit: 5,
          }),
          signal: controller.signal,
        });

        const searchData = await searchRes.json();

        if (!searchRes.ok) {
          console.error('Firecrawl search error:', searchData);
          clearTimeout(timeoutId);
          return new Response(
            JSON.stringify({ success: false, error: searchData.error || `Search failed with status ${searchRes.status}` }),
            { status: searchRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Search returned, now scraping top results individually...');
        const results = searchData.data || [];

        // Scrape each result URL individually with a short timeout per URL
        const scrapePromises = results.slice(0, 3).map(async (result: any) => {
          try {
            const urlToScrape = result.url;
            if (!urlToScrape) return null;

            const perUrlController = new AbortController();
            const perUrlTimeout = setTimeout(() => perUrlController.abort(), 8000);

            const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: urlToScrape,
                formats: ['markdown'],
                onlyMainContent: false,
              }),
              signal: perUrlController.signal,
            });

            clearTimeout(perUrlTimeout);
            const scrapeData = await scrapeRes.json();

            if (scrapeRes.ok && scrapeData.success) {
              const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
              const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};
              const emails = extractEmails(markdown);
              const phones = extractPhones(markdown);

              if (emails.length > 0 || phones.length > 0) {
                return {
                  url: urlToScrape,
                  name: extractBusinessName(markdown, metadata) || result.title || null,
                  emails,
                  phones,
                  website: urlToScrape,
                  address: extractAddress(markdown),
                } as ScrapedLead;
              }
            }
            return null;
          } catch (e) {
            console.log('Skipping URL due to timeout/error:', result.url);
            return null;
          }
        });

        const scrapeResults = await Promise.all(scrapePromises);
        for (const lead of scrapeResults) {
          if (lead) leads.push(lead);
        }
      }
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        console.error('Request timed out after 20s');
        clearTimeout(timeoutId);
        return new Response(
          JSON.stringify({ success: false, error: 'Search timed out. Try a more specific query or use Scrape URL mode with a direct website.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    console.log(`Found ${leads.length} leads with contact info`);

    return new Response(
      JSON.stringify({ success: true, leads }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-leads:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to scrape leads' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
