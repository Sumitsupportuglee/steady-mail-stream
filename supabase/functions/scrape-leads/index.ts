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

// Common TLDs we recognize. Anything after these is junk glued to the email.
const KNOWN_TLDS = [
  'com','net','org','io','co','ai','app','dev','info','biz','me','us','uk','in','ca',
  'au','de','fr','es','it','nl','eu','jp','cn','br','mx','ru','tv','xyz','online',
  'site','tech','store','shop','agency','digital','studio','media','news','live',
  'edu','gov','mil','int','asia','cloud','space','world','today','solutions','tools',
];

const STRICT_EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,24}$/;

function cleanEmail(raw: string): string | null {
  let e = raw.trim().replace(/^[<("'\[]+|[>)"'\]\.,;:]+$/g, '');

  // Strip a leading non-email char run before the local part (e.g. "xinfo@" stays as "xinfo@",
  // but "Email:info@" -> "info@"). We only strip if there's a clear delimiter like : or whitespace.
  const colonIdx = e.lastIndexOf(':', e.indexOf('@'));
  if (colonIdx > -1 && colonIdx < e.indexOf('@')) {
    e = e.slice(colonIdx + 1);
  }

  // Truncate after the longest valid TLD match: scan TLDs and cut at first known TLD boundary.
  const atIdx = e.indexOf('@');
  if (atIdx === -1) return null;
  const local = e.slice(0, atIdx);
  let domain = e.slice(atIdx + 1).toLowerCase();

  // Remove anything after the TLD that looks like glued text (letters following the TLD).
  // Try matching domain.tld and cutting there.
  const domainMatch = domain.match(/^([a-z0-9.\-]+?\.([a-z]{2,24}))(?=[^a-z0-9\-]|$)/i);
  let cleanedDomain = domainMatch ? domainMatch[1] : domain;

  // If the matched TLD is unusually long or unknown, try to find a known TLD inside it.
  const tldMatch = cleanedDomain.match(/\.([a-z]{2,24})$/i);
  if (tldMatch) {
    const tld = tldMatch[1].toLowerCase();
    if (!KNOWN_TLDS.includes(tld)) {
      // Try to find a known TLD prefix inside this segment (e.g. "comTel" -> "com")
      for (const known of KNOWN_TLDS) {
        if (tld.startsWith(known)) {
          cleanedDomain = cleanedDomain.slice(0, cleanedDomain.length - tld.length) + known;
          break;
        }
      }
    }
  }

  const candidate = `${local}@${cleanedDomain}`;
  if (!STRICT_EMAIL_RE.test(candidate)) return null;
  if (candidate.length > 100) return null;
  return candidate.toLowerCase();
}

function extractEmails(text: string): string[] {
  // Loose grab — we'll clean each match.
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,30}[a-zA-Z]*/g;
  const matches = text.match(emailRegex) || [];
  const cleaned: string[] = [];
  for (const m of matches) {
    const c = cleanEmail(m);
    if (!c) continue;
    if (c.endsWith('.png') || c.endsWith('.jpg') || c.endsWith('.gif') || c.endsWith('.svg') || c.endsWith('.webp')) continue;
    if (c.includes('example.com') || c.includes('sentry.io') || c.includes('wixpress.com')) continue;
    if (c.startsWith('noreply') || c.startsWith('no-reply') || c.startsWith('donotreply')) continue;
    cleaned.push(c);
  }
  return [...new Set(cleaned)];
}

// Final pass: ask Lovable AI to fix any emails that still look mangled.
async function aiValidateEmails(emails: string[]): Promise<string[]> {
  if (emails.length === 0) return emails;
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return emails;

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You clean scraped email addresses. For each input email, return a valid cleaned email address by removing extra characters glued to it (e.g. "info@site.comTel" -> "info@site.com", "Emailsales@x.co" -> "sales@x.co"). If the email is already valid, return it unchanged. If it cannot be salvaged into a valid email, return null. Respond ONLY with a JSON object {"emails": [...]} where each item is the cleaned email or null, in the same order as the input.',
          },
          { role: 'user', content: JSON.stringify({ emails }) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return emails;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return emails;
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.emails)) return emails;
    const out: string[] = [];
    for (const e of parsed.emails) {
      if (typeof e !== 'string') continue;
      if (STRICT_EMAIL_RE.test(e) && e.length < 100) out.push(e.toLowerCase());
    }
    return [...new Set(out)];
  } catch (err) {
    console.log('AI email validation failed, falling back to regex output:', err);
    return emails;
  }
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
