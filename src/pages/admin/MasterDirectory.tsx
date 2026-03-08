import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  ExternalLink,
  Loader2,
  Trash2,
  Download,
} from 'lucide-react';

interface MasterBusiness {
  id: string;
  contributed_by: string;
  business_name: string | null;
  website: string | null;
  emails: string[];
  phones: string[];
  address: string | null;
  source_url: string | null;
  search_query: string | null;
  created_at: string;
}

export default function MasterDirectory() {
  const [businesses, setBusinesses] = useState<MasterBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('master_business_directory')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(500);

      if (searchFilter.trim()) {
        query = query.or(
          `business_name.ilike.%${searchFilter.trim()}%,address.ilike.%${searchFilter.trim()}%,search_query.ilike.%${searchFilter.trim()}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setBusinesses((data as MasterBusiness[]) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [searchFilter]);

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('master_business_directory').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      setTotalCount((c) => c - 1);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Business Name', 'Emails', 'Phones', 'Address', 'Website', 'Source URL', 'Search Query', 'Date'];
    const rows = businesses.map((b) => [
      b.business_name || '',
      b.emails.join('; '),
      b.phones.join('; '),
      b.address || '',
      b.website || '',
      b.source_url || '',
      b.search_query || '',
      new Date(b.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-directory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueEmails = new Set(businesses.flatMap((b) => b.emails));
  const uniquePhones = new Set(businesses.flatMap((b) => b.phones));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Master Business Directory</h1>
          <p className="text-muted-foreground mt-1">
            All businesses scraped by every user — admin-only view
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">Total Businesses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{uniqueEmails.size}</div>
              <p className="text-xs text-muted-foreground">Unique Emails</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{uniquePhones.size}</div>
              <p className="text-xs text-muted-foreground">Unique Phones</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {new Set(businesses.map((b) => b.contributed_by)).size}
              </div>
              <p className="text-xs text-muted-foreground">Contributors</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter + Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Directory
                </CardTitle>
                <CardDescription>
                  {totalCount} business record(s) collected from all user searches
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={businesses.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Search by name, location, or query..."
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : businesses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No businesses in the master directory yet.</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Emails</TableHead>
                      <TableHead>Phones</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Search Query</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {businesses.map((biz) => (
                      <TableRow key={biz.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <span className="font-medium truncate max-w-[200px] block">
                                {biz.business_name || 'Unknown'}
                              </span>
                              {biz.website && (
                                <a
                                  href={biz.website.startsWith('http') ? biz.website : `https://${biz.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {biz.website}
                                </a>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {biz.emails.slice(0, 2).map((email, i) => (
                              <Badge key={i} variant="secondary" className="text-xs mr-1">
                                <Mail className="h-3 w-3 mr-1" />
                                {email}
                              </Badge>
                            ))}
                            {biz.emails.length > 2 && (
                              <span className="text-xs text-muted-foreground">+{biz.emails.length - 2} more</span>
                            )}
                            {biz.emails.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {biz.phones.slice(0, 2).map((phone, i) => (
                              <Badge key={i} variant="outline" className="text-xs mr-1">
                                <Phone className="h-3 w-3 mr-1" />
                                {phone}
                              </Badge>
                            ))}
                            {biz.phones.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {biz.address ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[150px] truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {biz.address}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{biz.search_query || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(biz.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(biz.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
