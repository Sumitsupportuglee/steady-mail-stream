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
  ArrowLeft,
  FolderOpen,
  Hash,
} from 'lucide-react';

interface CategorySummary {
  category: string;
  lead_count: number;
  unique_emails: number;
  latest_entry: string;
}

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

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
};

export default function MasterDirectory() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategorySummary[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');

  // Drill-down state
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<MasterBusiness[]>([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);
  const [businessFilter, setBusinessFilter] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const { data, error } = await supabase.rpc('get_master_directory_categories');
      if (error) throw error;
      setCategories((data as CategorySummary[]) || []);
      setFilteredCategories((data as CategorySummary[]) || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!categoryFilter.trim()) {
      setFilteredCategories(categories);
    } else {
      const q = categoryFilter.toLowerCase();
      setFilteredCategories(categories.filter((c) => c.category.toLowerCase().includes(q)));
    }
  }, [categoryFilter, categories]);

  const totalLeads = categories.reduce((s, c) => s + c.lead_count, 0);
  const totalEmails = categories.reduce((s, c) => s + c.unique_emails, 0);

  const handleDrillDown = async (category: string) => {
    setActiveCategory(category);
    setLoadingBusinesses(true);
    setBusinessFilter('');
    try {
      const queryVal = category === 'Uncategorized' ? '' : category;
      let query = supabase
        .from('master_business_directory')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (category === 'Uncategorized') {
        query = query.or('search_query.is.null,search_query.eq.');
      } else {
        query = query.ilike('search_query', `%${queryVal}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBusinesses((data as MasterBusiness[]) || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingBusinesses(false);
    }
  };

  const handleBack = () => {
    setActiveCategory(null);
    setBusinesses([]);
    setBusinessFilter('');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('master_business_directory').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setBusinesses((prev) => prev.filter((b) => b.id !== id));
      fetchCategories();
    }
  };

  const handleExportCategory = () => {
    const headers = ['Business Name', 'Emails', 'Phones', 'Address', 'Website', 'Source URL', 'Date'];
    const rows = filteredBusinesses.map((b) => [
      b.business_name || '',
      b.emails.join('; '),
      b.phones.join('; '),
      b.address || '',
      b.website || '',
      b.source_url || '',
      new Date(b.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCategory || 'directory'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredBusinesses = businessFilter.trim()
    ? businesses.filter(
        (b) =>
          b.business_name?.toLowerCase().includes(businessFilter.toLowerCase()) ||
          b.address?.toLowerCase().includes(businessFilter.toLowerCase()) ||
          b.emails.some((e) => e.toLowerCase().includes(businessFilter.toLowerCase()))
      )
    : businesses;

  // ─── Category overview ───
  if (!activeCategory) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Master Business Directory</h1>
            <p className="text-muted-foreground mt-1">
              All leads organized by search category — admin-only view
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatCount(totalLeads)}</div>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{formatCount(totalEmails)}</div>
                <p className="text-xs text-muted-foreground">Unique Emails</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{categories.length}</div>
                <p className="text-xs text-muted-foreground">Categories</p>
              </CardContent>
            </Card>
          </div>

          {/* Category List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Categories
              </CardTitle>
              <CardDescription>Click a category to view its leads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    placeholder="Filter categories..."
                    className="pl-9"
                  />
                </div>
              </div>

              {loadingCategories ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No categories yet. Leads will appear here as users search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat.category}
                      onClick={() => handleDrillDown(cat.category)}
                      className="group flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="font-semibold text-foreground truncate capitalize">
                          {cat.category}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {formatCount(cat.unique_emails)} emails
                          </span>
                          <span className="text-muted-foreground/50">
                            {new Date(cat.latest_entry).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-sm font-bold shrink-0 ml-3">
                        {formatCount(cat.lead_count)}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  // ─── Drill-down view ───
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight capitalize">{activeCategory}</h1>
            <p className="text-muted-foreground mt-1">
              {businesses.length} lead(s) in this category
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Leads
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleExportCategory} disabled={filteredBusinesses.length === 0}>
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
                  value={businessFilter}
                  onChange={(e) => setBusinessFilter(e.target.value)}
                  placeholder="Search leads..."
                  className="pl-9"
                />
              </div>
            </div>

            {loadingBusinesses ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No leads found.</p>
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
                      <TableHead>Date</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBusinesses.map((biz) => (
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
