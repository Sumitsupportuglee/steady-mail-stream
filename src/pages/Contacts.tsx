import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  ArrowRight
} from 'lucide-react';
import Papa from 'papaparse';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  status: 'active' | 'bounced' | 'unsubscribed';
  created_at: string;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing';

interface CSVRow {
  [key: string]: string;
}

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [nameColumn, setNameColumn] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
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
      });

      if (error) throw error;

      toast({
        title: 'Contact added',
        description: 'Contact has been added successfully.',
      });

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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as CSVRow[];
        const headers = results.meta.fields || [];

        setCsvData(data);
        setCsvHeaders(headers);

        // Auto-detect email and name columns
        const emailCol = headers.find(h => 
          h.toLowerCase().includes('email') || h.toLowerCase() === 'e-mail'
        );
        const nameCol = headers.find(h => 
          h.toLowerCase().includes('name') || h.toLowerCase() === 'full name'
        );

        if (emailCol) setEmailColumn(emailCol);
        if (nameCol) setNameColumn(nameCol);

        setImportStep('mapping');
      },
      error: (error) => {
        toast({
          title: 'Error parsing CSV',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
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

    const validContacts = csvData
      .filter(row => {
        const email = row[emailColumn];
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      })
      .map(row => ({
        user_id: user!.id,
        email: row[emailColumn].trim(),
        name: nameColumn ? row[nameColumn]?.trim() || null : null,
        status: 'active' as const,
      }));

    const batchSize = 100;
    const batches = Math.ceil(validContacts.length / batchSize);

    try {
      for (let i = 0; i < batches; i++) {
        const batch = validContacts.slice(i * batchSize, (i + 1) * batchSize);
        const { error } = await supabase.from('contacts').insert(batch);
        
        if (error) throw error;
        
        setImportProgress(Math.round(((i + 1) / batches) * 100));
      }

      toast({
        title: 'Import complete',
        description: `${validContacts.length} contacts imported successfully.`,
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
    setNameColumn('');
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; className: string }> = {
      active: { variant: 'default', className: 'bg-green-500/10 text-green-600 hover:bg-green-500/20' },
      bounced: { variant: 'destructive', className: '' },
      unsubscribed: { variant: 'secondary', className: '' },
    };
    const config = variants[status] || variants.active;
    return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
  };

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
            <Dialog open={isImportDialogOpen} onOpenChange={(open) => {
              setIsImportDialogOpen(open);
              if (!open) resetImport();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Contacts from CSV</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to bulk import contacts
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
                      <p className="text-sm text-muted-foreground mt-1">CSV files only</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
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
                            {csvHeaders.map(header => (
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
                            <SelectItem value="">None</SelectItem>
                            {csvHeaders.map(header => (
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
                    <p className="text-sm text-muted-foreground">
                      Preview of first 5 rows:
                    </p>
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
                            <TableCell>{nameColumn ? row[nameColumn] : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <DialogFooter className="mt-6">
                      <Button variant="outline" onClick={() => setImportStep('mapping')}>
                        Back
                      </Button>
                      <Button onClick={handleImport}>
                        Import {csvData.length} Contacts
                      </Button>
                    </DialogFooter>
                  </div>
                )}

                {importStep === 'importing' && (
                  <div className="py-8 text-center">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                    <p className="font-medium">Importing contacts...</p>
                    <p className="text-sm text-muted-foreground mt-1">{importProgress}% complete</p>
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
                    <DialogDescription>
                      Add a new contact to your list
                    </DialogDescription>
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
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
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

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Contacts</CardTitle>
                <CardDescription>{contacts.length} total contacts</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {selectedContacts.size > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedContacts.size})
                  </Button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg">No contacts found</h3>
                <p className="text-muted-foreground mt-1">
                  {searchQuery ? 'Try a different search term' : 'Add your first contact to get started'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleSelect(contact.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {contact.name || '-'}
                      </TableCell>
                      <TableCell>{contact.email}</TableCell>
                      <TableCell>{getStatusBadge(contact.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
