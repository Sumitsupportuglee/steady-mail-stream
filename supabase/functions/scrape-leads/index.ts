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

// Detects junk/auto-generated domains used by CDNs, trackers, asset hashes, etc.
// Examples: 455a081122cfe.org, reab746b.com, p53405f7e72s.com, a9efba47ad525e.com, heac1c14b8173a.com
function isJunkDomain(domain: string): boolean {
  const labels = domain.split('.');
  // Inspect the registrable label (second-level), e.g. "reab746b" in "reab746b.com"
  const sld = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  if (!sld) return true;

  // Hex-only label of length >= 8 (looks like a hash)
  if (/^[a-f0-9]{8,}$/i.test(sld)) return true;

  // Long alphanumeric string with no vowels — almost certainly random
  if (sld.length >= 8 && !/[aeiou]/i.test(sld)) return true;

  // Long string mixing letters and digits with high digit ratio
  if (sld.length >= 8 && /\d/.test(sld) && /[a-z]/i.test(sld)) {
    const digits = (sld.match(/\d/g) || []).length;
    const ratio = digits / sld.length;
    if (ratio >= 0.25) return true;
  }

  // Known tracking / asset / CDN domains
  const blockedDomains = [
    'sentry.io','wixpress.com','cloudfront.net','akamaized.net','akamaihd.net',
    'amazonaws.com','googleusercontent.com','gstatic.com','doubleclick.net',
    'googletagmanager.com','google-analytics.com','facebook.com','fbcdn.net',
    'cdninstagram.com','twimg.com','jsdelivr.net','unpkg.com','cloudflare.com',
    'cdn77.org','wp.com','wordpress.com','squarespace-cdn.com','shopify.com',
    'shopifycdn.com','bootstrapcdn.com','typekit.net','hsforms.com','hs-scripts.com',
    'mailchimp.com','list-manage.com','sendgrid.net','mailgun.org','postmarkapp.com',
    'intercom.io','hotjar.com','segment.io','mixpanel.com','optimizely.com',
    'example.com','example.org','example.net','localhost','test.com','domain.com',
    'yourdomain.com','email.com','company.com','website.com',
  ];
  if (blockedDomains.some(b => domain === b || domain.endsWith('.' + b))) return true;

  return false;
}

// Reject obvious system/role addresses that aren't useful business contacts.
function isJunkLocalPart(local: string): boolean {
  const l = local.toLowerCase();
  const blocked = [
    'noreply','no-reply','donotreply','do-not-reply','mailer-daemon','postmaster',
    'wordpress','wp','admin@wordpress','example','user','username','your-email',
    'youremail','name','firstname','lastname','test','testing',
  ];
  if (blocked.some(b => l === b || l.startsWith(b + '+') || l.startsWith(b + '.'))) return true;
  // Pure hex/random-looking local parts
  if (/^[a-f0-9]{16,}$/i.test(l)) return true;
  return false;
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
    const [local, domain] = c.split('@');
    if (isJunkLocalPart(local)) continue;
    if (isJunkDomain(domain)) continue;
    cleaned.push(c);
  }
  return [...new Set(cleaned)];
}

// Final pass: ask Lovable AI to clean and validate each email.
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
            content: `You validate scraped business email addresses. For each input email decide if it is a REAL, usable business contact email.

Rules:
1. If extra characters are glued to a valid email, clean them (e.g. "info@site.comTel" -> "info@site.com", "Emailsales@x.co" -> "sales@x.co").
2. REJECT (return null) emails whose domain is clearly auto-generated/random/CDN/tracker, e.g. "adopt@455a081122cfe.org", "team@reab746b.com", "evan@p53405f7e72s.com", "info@a9efba47ad525e.com", "ps@heac1c14b8173a.com". These have hash/random-looking second-level domains and are not real contact addresses.
3. REJECT placeholder/example/role-only addresses: example.com, yourdomain.com, noreply@*, postmaster@*, etc.
4. Keep legitimate business emails even if generic role addresses (info@, sales@, contact@, hello@).
5. If unsure whether a domain is real, REJECT it (return null) — precision matters more than recall.

Respond ONLY with a JSON object {"emails": [...]} where each item is the cleaned email string or null, in the same order as the input.`,
          },
          { role: 'user', content: JSON.stringify({ emails }) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return emails.filter(e => STRICT_EMAIL_RE.test(e));
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return emails;
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.emails)) return emails;
    const out: string[] = [];
    for (const e of parsed.emails) {
      if (typeof e !== 'string') continue;
      const lower = e.toLowerCase();
      if (!STRICT_EMAIL_RE.test(lower) || lower.length >= 100) continue;
      const [local, domain] = lower.split('@');
      if (isJunkLocalPart(local) || isJunkDomain(domain)) continue;
      out.push(lower);
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
  fallbackTitle: string | null,
  fastMode = false
): Promise<{ lead: ScrapedLead | null; outcome: 'success' | 'no_contact' | 'timeout' | 'error' }> {
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
        onlyMainContent: fastMode,
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
          lead: {
            url,
            name: extractBusinessName(markdown, metadata) || fallbackTitle,
            emails,
            phones,
            website: url,
            address: extractAddress(markdown),
          },
          outcome: 'success',
        };
      }
      return { lead: null, outcome: 'no_contact' };
    }
    return { lead: null, outcome: 'error' };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return { lead: null, outcome: isTimeout ? 'timeout' : 'error' };
  }
}

// Extract registrable hostname for dedup (e.g. "blog.example.com" -> "example.com")
function hostnameKey(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const parts = h.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : h;
  } catch {
    return url;
  }
}

async function firecrawlSearch(query: string, limit: number, apiKey: string, timeoutMs: number): Promise<any[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) {
      console.error('Search error for', query, data);
      return [];
    }
    return data.data || [];
  } catch {
    clearTimeout(timeout);
    return [];
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

      const result = await scrapeUrl(url, apiKey, 20000, null);
      if (result.lead) leads.push(result.lead);
    } else {
      // Search mode — adaptive strategy based on requested limit
      console.log(`Searching for: "${query}" (limit: ${limit})`);

      // Tiered candidate pool: bigger pool for bigger asks
      const candidatePool = limit <= 10 ? 20 : limit <= 25 ? 60 : 100;
      const fastMode = limit >= 25;

      // For larger requests, fan out multiple search variants in parallel for better contact-page hit rate
      const searchQueries: string[] = limit >= 25
        ? [`${query} contact email`, `${query} about us`]
        : [`${query} contact email phone`];

      const perQueryLimit = Math.ceil(candidatePool / searchQueries.length);

      const searchBatches = await Promise.all(
        searchQueries.map(q => firecrawlSearch(q, perQueryLimit, apiKey, 12000))
      );
      const allResults = searchBatches.flat();

      if (allResults.length === 0) {
        return new Response(
          JSON.stringify({ success: true, leads: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Dedupe by registrable hostname so we don't scrape the same domain twice
      const seenHosts = new Set<string>();
      const urlsToScrape: any[] = [];
      for (const r of allResults) {
        if (!r.url) continue;
        const key = hostnameKey(r.url);
        if (seenHosts.has(key)) continue;
        seenHosts.add(key);
        urlsToScrape.push(r);
        if (urlsToScrape.length >= candidatePool) break;
      }

      // Reasonable, uniform per-URL timeout — rely on parallelism, not starvation
      const BATCH_SIZE = 10;
      const PER_URL_TIMEOUT = 8000;

      console.log(`Scraping up to ${urlsToScrape.length} unique-host URLs in batches of ${BATCH_SIZE} (${PER_URL_TIMEOUT}ms each, fastMode=${fastMode})`);

      const stats = { success: 0, no_contact: 0, timeout: 0, error: 0 };

      for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
        if (leads.length >= limit) break;

        const batch = urlsToScrape.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((result: any) =>
            scrapeUrl(result.url, apiKey, PER_URL_TIMEOUT, result.title || null, fastMode)
          )
        );
        for (const r of batchResults) {
          if (r.status === 'fulfilled') {
            stats[r.value.outcome]++;
            if (r.value.lead) leads.push(r.value.lead);
          } else {
            stats.error++;
          }
        }
        console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: leads=${leads.length} ${JSON.stringify(stats)}`);
      }

      console.log(`Yield: pool=${urlsToScrape.length} ${JSON.stringify(stats)}`);
    }

    // Trim to requested limit
    const trimmedLeads = leads.slice(0, limit);

    // AI-powered email validation pass — fix any mangled addresses
    console.log(`Running AI email validation on ${trimmedLeads.length} leads`);
    await Promise.all(
      trimmedLeads.map(async (lead) => {
        if (lead.emails.length > 0) {
          lead.emails = await aiValidateEmails(lead.emails);
        }
      })
    );

    // Drop leads that have no valid emails AND no phones after cleanup
    const finalLeads = trimmedLeads.filter(l => l.emails.length > 0 || l.phones.length > 0);
    console.log(`Returning ${finalLeads.length} leads (requested: ${limit})`);

    return new Response(
      JSON.stringify({ success: true, leads: finalLeads }),
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
