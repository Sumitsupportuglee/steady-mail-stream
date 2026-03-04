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

// Scrape a single URL with its own timeout
async function scrapeUrl(
  url: string,
  apiKey: string,
  timeoutMs: number,
  fallbackTitle: string | null
): Promise<ScrapedLead | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
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

    clearTimeout(timeout);
    const data = await res.json();

    if (res.ok && data.success) {
      const markdown = data.data?.markdown || data.markdown || '';
      const metadata = data.data?.metadata || data.metadata || {};
      const emails = extractEmails(markdown);
      const phones = extractPhones(markdown);

      if (emails.length > 0 || phones.length > 0) {
        return {
          url,
          name: extractBusinessName(markdown, metadata) || fallbackTitle,
          emails,
          phones,
          website: url,
          address: extractAddress(markdown),
        };
      }
    }
    return null;
  } catch {
    console.log('Skipping URL (timeout/error):', url);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, mode, limit: requestedLimit } = await req.json();

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

    // Validate and cap the limit
    const limit = Math.min(Math.max(Number(requestedLimit) || 5, 1), 50);

    const leads: ScrapedLead[] = [];

    if (mode === 'url') {
      // Single URL scrape — straightforward
      let url = query.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      console.log('Scraping single URL:', url);

      const lead = await scrapeUrl(url, apiKey, 20000, null);
      if (lead) leads.push(lead);
    } else {
      // Search mode — adaptive strategy based on limit
      console.log(`Searching for: "${query}" (limit: ${limit})`);

      // Step 1: Fast search (no scraping) to get URLs
      const searchController = new AbortController();
      const searchTimeout = setTimeout(() => searchController.abort(), 12000);

      let searchResults: any[] = [];
      try {
        const searchRes = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query + ' contact email phone',
            limit: Math.min(limit * 2, 20), // Search more than needed since some won't have contacts
          }),
          signal: searchController.signal,
        });

        clearTimeout(searchTimeout);
        const searchData = await searchRes.json();

        if (!searchRes.ok) {
          console.error('Firecrawl search error:', searchData);
          return new Response(
            JSON.stringify({ success: false, error: searchData.error || `Search failed with status ${searchRes.status}` }),
            { status: searchRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        searchResults = searchData.data || [];
        console.log(`Search returned ${searchResults.length} results`);
      } catch (e) {
        clearTimeout(searchTimeout);
        console.error('Search timed out');
        return new Response(
          JSON.stringify({ success: false, error: 'Search timed out. Try a more specific query.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (searchResults.length === 0) {
        return new Response(
          JSON.stringify({ success: true, leads: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 2: Scrape URLs in parallel batches with adaptive timeouts
      // We have ~15s left after search. Process in batches of 5 to avoid overwhelming.
      const BATCH_SIZE = 5;
      const PER_URL_TIMEOUT = limit <= 5 ? 8000 : limit <= 10 ? 6000 : 4000;
      const urlsToScrape = searchResults.filter((r: any) => r.url).slice(0, Math.min(limit * 2, 20));

      console.log(`Scraping ${urlsToScrape.length} URLs in batches of ${BATCH_SIZE} (${PER_URL_TIMEOUT}ms timeout each)`);

      for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
        // Stop early if we have enough leads
        if (leads.length >= limit) break;

        const batch = urlsToScrape.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map((result: any) =>
          scrapeUrl(result.url, apiKey, PER_URL_TIMEOUT, result.title || null)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            leads.push(result.value);
          }
        }

        console.log(`After batch ${Math.floor(i / BATCH_SIZE) + 1}: ${leads.length} leads found`);
      }
    }

    // Trim to requested limit
    const trimmedLeads = leads.slice(0, limit);
    console.log(`Returning ${trimmedLeads.length} leads (requested: ${limit})`);

    return new Response(
      JSON.stringify({ success: true, leads: trimmedLeads }),
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
