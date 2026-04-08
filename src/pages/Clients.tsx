import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Building2,
  Loader2,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Server,
} from 'lucide-react';

const SMTP_PRESETS: Record<string, { host: string; ssl: number; tls: number; note: string }> = {
  hostinger: { host: 'smtp.hostinger.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  google: { host: 'smtp.gmail.com', ssl: 465, tls: 587, note: 'App Password or OAuth2 Workspace' },
  microsoft365: { host: 'smtp.office365.com', ssl: 0, tls: 587, note: 'OAuth2 or App Pass (TLS only)' },
  zoho: { host: 'smtppro.zoho.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  custom: { host: '', ssl: 465, tls: 587, note: 'Enter your SMTP details manually' },
};

export default function Clients() {
  const { user } = useAuth();
  const { clients, refetchClients, loading, setActiveClientId } = useClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSmtpOpen, setIsSmtpOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Add client form
  const [newName, setNewName] = useState('');

  // SMTP form
  const [smtpClientId, setSmtpClientId] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('custom');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('tls');

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('clients').insert({
        user_id: user!.id,
        name: newName.trim(),
      });
      if (error) throw error;

      toast({ title: 'Client added', description: `${newName} has been created.` });
      setNewName('');
      setIsAddOpen(false);
      refetchClients();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Client deleted', description: `${name} has been removed.` });
      refetchClients();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openSmtpDialog = (client: any) => {
    setSmtpClientId(client.id);
    setSmtpHost(client.smtp_host || '');
    setSmtpPort(String(client.smtp_port || 587));
    setSmtpUsername(client.smtp_username || '');
    setSmtpPassword('');
    setSmtpEncryption(client.smtp_encryption || 'tls');

    const preset = Object.entries(SMTP_PRESETS).find(
      ([key, p]) => key !== 'custom' && p.host === client.smtp_host
    );
    setSelectedProvider(preset ? preset[0] : 'custom');
    setIsSmtpOpen(true);
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider);
    if (provider !== 'custom') {
      const preset = SMTP_PRESETS[provider];
      setSmtpHost(preset.host);
      const port = smtpEncryption === 'ssl' ? preset.ssl : preset.tls;
      setSmtpPort(String(port || preset.tls));
    }
  };

  const handleEncryptionChange = (enc: string) => {
    setSmtpEncryption(enc);
    if (selectedProvider !== 'custom') {
      const preset = SMTP_PRESETS[selectedProvider];
      const port = enc === 'ssl' ? preset.ssl : preset.tls;
      if (port) setSmtpPort(String(port));
    }
  };

  const handleSaveSmtp = async () => {
    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      toast({ title: 'Missing fields', description: 'Please fill all SMTP fields.', variant: 'destructive' });
      return;
    }
    setSavingSmtp(true);
    try {
      const encryptionRes = await supabase.functions.invoke('manage-smtp', {
        body: { action: 'encrypt', smtp_password: smtpPassword },
      });
      if (encryptionRes.error) throw encryptionRes.error;

      const { error } = await supabase
        .from('clients')
        .update({
          smtp_host: smtpHost.trim(),
          smtp_port: parseInt(smtpPort, 10),
          smtp_username: smtpUsername.trim(),
          smtp_password: encryptionRes.data.encrypted_password,
          smtp_encryption: smtpEncryption,
        })
        .eq('id', smtpClientId);
      if (error) throw error;
      toast({ title: 'SMTP saved', description: 'Client email credentials updated.' });
      setIsSmtpOpen(false);
      refetchClients();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingSmtp(false);
    }
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
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground mt-1">Manage your agency's client workspaces</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Client</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddClient}>
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>Create a new client workspace with separate campaigns, contacts, and SMTP settings.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-name">Client Name</Label>
                    <Input id="client-name" placeholder="e.g. Acme Corp" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : 'Create Client'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Clients</CardTitle>
            <CardDescription>{clients.length} client workspace{clients.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg">No clients yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">Create your first client to organize campaigns and contacts</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>SMTP Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {client.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.smtp_host ? (
                          <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
                            <CheckCircle className="mr-1 h-3 w-3" /> Configured
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="mr-1 h-3 w-3" /> Not Set
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setActiveClientId(client.id); toast({ title: 'Client selected', description: `Switched to ${client.name}` }); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openSmtpDialog(client)}>
                            <Server className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClient(client.id, client.name)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SMTP Dialog */}
      <Dialog open={isSmtpOpen} onOpenChange={setIsSmtpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Client SMTP Settings</DialogTitle>
            <DialogDescription>Configure email sending credentials for this client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hostinger">Hostinger</SelectItem>
                  <SelectItem value="google">Google / Gmail</SelectItem>
                  <SelectItem value="microsoft365">Microsoft 365</SelectItem>
                  <SelectItem value="zoho">Zoho Mail</SelectItem>
                  <SelectItem value="custom">Custom / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>SMTP Host</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.provider.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Encryption</Label>
                <Select value={smtpEncryption} onValueChange={handleEncryptionChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS (STARTTLS)</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Username / Email</Label>
              <Input value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} placeholder="you@domain.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">For security, saved passwords are never shown again. Enter a new password only when changing it.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSmtpOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSmtp} disabled={savingSmtp}>
              {savingSmtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save SMTP</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
