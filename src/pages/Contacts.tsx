import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Plus,
  Upload,
  Users,
  Trash2,
  Loader2,
  Search,
  FileSpreadsheet,
  CheckCircle,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useClient } from '@/contexts/ClientContext';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'bounced' | 'unsubscribed';
  created_at: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing';
type SortField = 'name' | 'email' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'bounced' | 'unsubscribed';

interface CSVRow {
  [key: string]: string;
}

const NONE_VALUE = '__none__';
const PAGE_SIZE = 25;

export default function Contacts() {
  const { user } = useAuth();
  const { activeClientId } = useClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [letterFilter, setLetterFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add contact form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // CSV Import state
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [emailColumn, setEmailColumn] = useState('');
  const [nameColumn, setNameColumn] = useState(NONE_VALUE);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user, activeClientId]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, letterFilter, sortField, sortDir]);

  const fetchContacts = async () => {
    try {
      let query = supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user!.id);
      if (activeClientId) query = query.eq('client_id', activeClientId);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(10000);

      if (error) throw error;
      setContacts((data || []) as Contact[]);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load contacts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('contacts').insert({
        user_id: user!.id,
        email: newEmail,
        name: newName || null,
        status: 'active',
        client_id: activeClientId,
      });

      if (error) throw error;

      try {
        const { error: webhookError } = await supabase.functions.invoke('trigger-webhook', {
          body: {
            event_type: 'contact_created',
            data: {
              email: newEmail,
              name: newName || null,
              client_id: activeClientId ?? null,
            },
          },
        });
        if (webhookError) console.warn('trigger-webhook failed:', webhookError);
      } catch (e) {
        console.warn('trigger-webhook failed:', e);
      }

      toast({ title: 'Contact added', description: 'Contact has been added successfully.' });

      setNewName('');
      setNewEmail('');
      setIsAddDialogOpen(false);
      fetchContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add contact',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedContacts.size === 0) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', Array.from(selectedContacts));

      if (error) throw error;

      toast({
        title: 'Contacts deleted',
        description: `${selectedContacts.size} contact(s) have been removed.`,
      });

      setSelectedContacts(new Set());
      fetchContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contacts',
        variant: 'destructive',
      });
    }
  };

  const finalizeParsedData = (rows: CSVRow[], headers: string[]) => {
    if (!rows.length || !headers.length) {
      toast({
        title: 'Empty file',
        description: 'No rows or headers detected in the file.',
        variant: 'destructive',
      });
      return;
    }
    setCsvData(rows);
    setCsvHeaders(headers);

    const emailCol = headers.find(
      (h) => h.toLowerCase().includes('email') || h.toLowerCase() === 'e-mail'
    );
    const nameCol = headers.find(
      (h) => h.toLowerCase().includes('name') || h.toLowerCase() === 'full name'
    );

    setEmailColumn(emailCol || '');
    setNameColumn(nameCol || NONE_VALUE);
    setImportStep('mapping');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<CSVRow>(firstSheet, { defval: '', raw: false });
            const headers = json.length ? Object.keys(json[0]) : [];
            finalizeParsedData(json, headers);
          } catch (err: any) {
            toast({
              title: 'Error parsing Excel file',
              description: err.message || 'Could not read the file.',
              variant: 'destructive',
            });
          }
        };
        reader.onerror = () => {
          toast({ title: 'File read error', description: 'Could not read the file.', variant: 'destructive' });
        };
        reader.readAsArrayBuffer(file);
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = (results.data as CSVRow[]) || [];
            const headers = results.meta.fields || [];
            finalizeParsedData(data, headers);
          },
          error: (error) => {
            toast({
              title: 'Error parsing CSV',
              description: error.message,
              variant: 'destructive',
            });
          },
        });
      }
    } catch (err: any) {
      toast({
        title: 'Import error',
        description: err?.message || 'Could not process file.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!emailColumn) {
      toast({
        title: 'Error',
        description: 'Please select the email column',
        variant: 'destructive',
      });
      return;
    }

    setImportStep('importing');
    setImportProgress(0);

    const useNameCol = nameColumn && nameColumn !== NONE_VALUE ? nameColumn : null;

    // Dedup within file by email (case-insensitive)
    const seen = new Set<string>();
    const validContacts = csvData
      .map((row) => {
        const rawEmail = (row[emailColumn] || '').toString().trim();
        if (!rawEmail) return null;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) return null;
        const lower = rawEmail.toLowerCase();
        if (seen.has(lower)) return null;
        seen.add(lower);
        return {
          user_id: user!.id,
          email: rawEmail,
          name: useNameCol ? (row[useNameCol] || '').toString().trim() || null : null,
          status: 'active' as const,
          client_id: activeClientId,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (validContacts.length === 0) {
      toast({
        title: 'No valid contacts',
        description: 'No valid email addresses were found in the file.',
        variant: 'destructive',
      });
      setImportStep('preview');
      return;
    }

    // Skip emails already present (avoids unique-constraint failures and duplicates)
    const existingLower = new Set(contacts.map((c) => c.email.toLowerCase()));
    const toInsert = validContacts.filter((c) => !existingLower.has(c.email.toLowerCase()));
    const skipped = validContacts.length - toInsert.length;

    const batchSize = 200;
    const batches = Math.max(1, Math.ceil(toInsert.length / batchSize));
    let inserted = 0;

    try {
      for (let i = 0; i < batches; i++) {
        const batch = toInsert.slice(i * batchSize, (i + 1) * batchSize);
        if (batch.length === 0) continue;
        const { error } = await supabase.from('contacts').insert(batch);
        if (error) throw error;
        inserted += batch.length;
        setImportProgress(Math.round(((i + 1) / batches) * 100));
      }

      toast({
        title: 'Import complete',
        description: `${inserted} contacts imported${skipped ? `, ${skipped} duplicates skipped` : ''}.`,
      });

      resetImport();
      setIsImportDialogOpen(false);
      fetchContacts();
    } catch (error: any) {
      toast({
        title: 'Import failed',
        description: error.message || 'Failed to import contacts',
        variant: 'destructive',
      });
      setImportStep('preview');
    }
  };

  const resetImport = () => {
    setImportStep('upload');
    setCsvData([]);
    setCsvHeaders([]);
    setEmailColumn('');
    setNameColumn(NONE_VALUE);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Counts per status (for tabs)
  const statusCounts = useMemo(() => {
    const counts = { all: contacts.length, active: 0, bounced: 0, unsubscribed: 0 };
    for (const c of contacts) {
      if (c.status === 'active') counts.active++;
      else if (c.status === 'bounced') counts.bounced++;
      else if (c.status === 'unsubscribed') counts.unsubscribed++;
    }
    return counts;
  }, [contacts]);

  // Filter + sort
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = contacts.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (letterFilter !== 'all') {
        const first = (c.name || c.email || '').trim().charAt(0).toUpperCase();
        if (letterFilter === '#') {
          if (/[A-Z]/.test(first)) return false;
        } else if (first !== letterFilter) {
          return false;
        }
      }
      if (q) {
        return (
          c.email.toLowerCase().includes(q) ||
          (c.name?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      if (sortField === 'created_at') {
        av = new Date(a.created_at).getTime();
        bv = new Date(b.created_at).getTime();
      } else if (sortField === 'name') {
        av = (a.name || '').toLowerCase();
        bv = (b.name || '').toLowerCase();
      } else if (sortField === 'email') {
        av = a.email.toLowerCase();
        bv = b.email.toLowerCase();
      } else if (sortField === 'status') {
        av = a.status;
        bv = b.status;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [contacts, searchQuery, statusFilter, letterFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE));
  const pagedContacts = useMemo(
    () => filteredContacts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredContacts, page]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortDir === 'asc' ? (
        <ArrowUp className="inline h-3 w-3 ml-1" />
      ) : (
        <ArrowDown className="inline h-3 w-3 ml-1" />
      )
    ) : null;

  const toggleSelectAll = () => {
    const pageIds = pagedContacts.map((c) => c.id);
    const allSelected = pageIds.every((id) => selectedContacts.has(id));
    const newSelected = new Set(selectedContacts);
    if (allSelected) {
      pageIds.forEach((id) => newSelected.delete(id));
    } else {
      pageIds.forEach((id) => newSelected.add(id));
    }
    setSelectedContacts(newSelected);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedContacts(newSelected);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; className: string }> = {
      active: { variant: 'default', className: 'bg-green-500/10 text-green-600 hover:bg-green-500/20' },
      bounced: { variant: 'destructive', className: '' },
      unsubscribed: { variant: 'secondary', className: '' },
    };
    const config = variants[status] || variants.active;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  const letters = ['all', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
            <p className="text-muted-foreground mt-1">
              Manage your email contacts and lists
            </p>
          </div>
          <div className="flex gap-3">
            <Dialog
              open={isImportDialogOpen}
              onOpenChange={(open) => {
                setIsImportDialogOpen(open);
                if (!open) resetImport();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV / Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Contacts</DialogTitle>
                  <DialogDescription>
                    Upload a CSV or Excel file to bulk import contacts
                  </DialogDescription>
                </DialogHeader>

                {importStep === 'upload' && (
                  <div className="py-8">
                    <div
                      className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground mt-1">CSV, XLSX or XLS files</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                )}

                {importStep === 'mapping' && (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">{csvData.length} rows detected</span>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email Column *</Label>
                        <Select value={emailColumn} onValueChange={setEmailColumn}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select email column" />
                          </SelectTrigger>
                          <SelectContent>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Name Column (optional)</Label>
                        <Select value={nameColumn} onValueChange={setNameColumn}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select name column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>None</SelectItem>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter className="mt-6">
                      <Button variant="outline" onClick={resetImport}>
                        Back
                      </Button>
                      <Button onClick={() => setImportStep('preview')} disabled={!emailColumn}>
                        Preview
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </DialogFooter>
                  </div>
                )}

                {importStep === 'preview' && (
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">Preview of first 5 rows:</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row[emailColumn]}</TableCell>
                            <TableCell>
                              {nameColumn && nameColumn !== NONE_VALUE ? row[nameColumn] : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <DialogFooter className="mt-6">
                      <Button variant="outline" onClick={() => setImportStep('mapping')}>
                        Back
                      </Button>
                      <Button onClick={handleImport}>Import {csvData.length} Contacts</Button>
                    </DialogFooter>
                  </div>
                )}

                {importStep === 'importing' && (
                  <div className="py-8 text-center">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                    <p className="font-medium">Importing contacts...</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {importProgress}% complete
                    </p>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddContact}>
                  <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                    <DialogDescription>Add a new contact to your list</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Name (optional)</Label>
                      <Input
                        id="contact-name"
                        placeholder="John Doe"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Email *</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="john@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Contact'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Status tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
            <TabsTrigger value="active">Active ({statusCounts.active})</TabsTrigger>
            <TabsTrigger value="bounced">Bounced ({statusCounts.bounced})</TabsTrigger>
            <TabsTrigger value="unsubscribed">
              Unsubscribed ({statusCounts.unsubscribed})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>
                  Showing {pagedContacts.length} of {filteredContacts.length} ({contacts.length} total)
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {selectedContacts.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedContacts.size})
                  </Button>
                )}
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Date added</SelectItem>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                    <SelectItem value="email">Email (A–Z)</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Alphabet filter */}
            <div className="flex flex-wrap gap-1 mt-4">
              {letters.map((l) => (
                <Button
                  key={l}
                  size="sm"
                  variant={letterFilter === l ? 'default' : 'ghost'}
                  className="h-7 w-8 p-0 text-xs"
                  onClick={() => setLetterFilter(l)}
                >
                  {l === 'all' ? 'All' : l}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg">No contacts found</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery || statusFilter !== 'all' || letterFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add your first contact to get started'}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            pagedContacts.length > 0 &&
                            pagedContacts.every((c) => selectedContacts.has(c.id))
                          }
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                        Name <SortIcon field="name" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>
                        Email <SortIcon field="email" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('status')}>
                        Status <SortIcon field="status" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleSort('created_at')}
                      >
                        Added <SortIcon field="created_at" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={() => toggleSelect(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{contact.name || '-'}</TableCell>
                        <TableCell>{contact.email}</TableCell>
                        <TableCell>{getStatusBadge(contact.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(contact.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
