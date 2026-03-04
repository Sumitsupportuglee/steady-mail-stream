import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  Search,
  Globe,
  Loader2,
  Mail,
  Phone,
  MapPin,
  UserPlus,
  Building2,
  ExternalLink,
} from 'lucide-react';

interface ScrapedLead {
  url: string;
  name: string | null;
  emails: string[];
  phones: string[];
  website: string | null;
  address: string | null;
}

export default function LeadFinder() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'url'>('search');
  const [leadLimit, setLeadLimit] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<ScrapedLead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setLeads([]);
    setSelectedLeads(new Set());
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-leads', {
        body: { query: query.trim(), mode, limit: leadLimit },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Scraping failed');

      setLeads(data.leads || []);

      if (data.leads?.length === 0) {
        toast({
          title: 'No leads found',
          description: 'Try a different search query or URL.',
        });
      } else {
        toast({
          title: 'Leads found',
          description: `Found ${data.leads.length} leads with contact information.`,
        });
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to search for leads',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    const updated = new Set(selectedLeads);
    if (updated.has(index)) {
      updated.delete(index);
    } else {
      updated.add(index);
    }
    setSelectedLeads(updated);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((_, i) => i)));
    }
  };

  const handleSaveToContacts = async () => {
    if (selectedLeads.size === 0) {
      toast({ title: 'No leads selected', description: 'Select leads to save as contacts.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const contacts = Array.from(selectedLeads).flatMap((idx) => {
        const lead = leads[idx];
        // Create a contact for each email found
        return lead.emails.map((email) => ({
          user_id: user!.id,
          email,
          name: lead.name || null,
          status: 'active' as const,
        }));
      });

      if (contacts.length === 0) {
        toast({ title: 'No emails', description: 'Selected leads have no email addresses.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('contacts').insert(contacts);
      if (error) throw error;

      toast({
        title: 'Contacts saved',
        description: `${contacts.length} contact(s) added successfully.`,
      });
      setSelectedLeads(new Set());
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save contacts',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Finder</h1>
          <p className="text-muted-foreground mt-1">
            Discover business contacts by searching the web or scraping websites
          </p>
        </div>

        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Find Leads
            </CardTitle>
            <CardDescription>
              Search for businesses or paste a website URL to extract contact information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'search' | 'url')}>
              <TabsList className="mb-4">
                <TabsTrigger value="search" className="gap-2">
                  <Search className="h-4 w-4" />
                  Web Search
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-2">
                  <Globe className="h-4 w-4" />
                  Scrape URL
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSearch}>
                <TabsContent value="search" className="space-y-3">
                  <div className="space-y-2">
                    <Label>Search Query</Label>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder='e.g. "digital marketing agencies in New York"'
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Searches the web and extracts emails & phone numbers from results
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Leads</Label>
                    <Select value={String(leadLimit)} onValueChange={(v) => setLeadLimit(Number(v))}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 leads</SelectItem>
                        <SelectItem value="10">10 leads</SelectItem>
                        <SelectItem value="50">50 leads (slower)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      More leads take longer to process
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="url" className="space-y-3">
                  <div className="space-y-2">
                    <Label>Website URL</Label>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="https://example.com"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Scrapes a specific website for contact information
                    </p>
                  </div>
                </TabsContent>

                <Button type="submit" disabled={loading || !query.trim()} className="mt-4">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find Leads
                    </>
                  )}
                </Button>
              </form>
            </Tabs>
          </CardContent>
        </Card>

        {/* Results */}
        {(leads.length > 0 || (hasSearched && !loading)) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Results</CardTitle>
                  <CardDescription>
                    {leads.length} lead(s) found with contact information
                  </CardDescription>
                </div>
                {leads.length > 0 && (
                  <Button
                    onClick={handleSaveToContacts}
                    disabled={selectedLeads.size === 0 || saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    Save {selectedLeads.size > 0 ? `${selectedLeads.size} ` : ''}to Contacts
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No leads with contact info found. Try a different query.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedLeads.size === leads.length && leads.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Business</TableHead>
                      <TableHead>Emails</TableHead>
                      <TableHead>Phones</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Checkbox
                            checked={selectedLeads.has(idx)}
                            onCheckedChange={() => toggleSelect(idx)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[200px]">
                              {lead.name || 'Unknown'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {lead.emails.slice(0, 3).map((email, i) => (
                              <Badge key={i} variant="secondary" className="text-xs mr-1">
                                <Mail className="h-3 w-3 mr-1" />
                                {email}
                              </Badge>
                            ))}
                            {lead.emails.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{lead.emails.length - 3} more
                              </span>
                            )}
                            {lead.emails.length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {lead.phones.slice(0, 2).map((phone, i) => (
                              <Badge key={i} variant="outline" className="text-xs mr-1">
                                <Phone className="h-3 w-3 mr-1" />
                                {phone}
                              </Badge>
                            ))}
                            {lead.phones.length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.address ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[150px] truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {lead.address}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.url && (
                            <a
                              href={lead.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Visit
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
