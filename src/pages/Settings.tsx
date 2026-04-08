import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription, PILOT_LIMITS } from '@/hooks/useSubscription';
import { useClient } from '@/contexts/ClientContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Save, Plus, Trash2, Eye, EyeOff, CheckCircle, XCircle,
  Server, Mail, HelpCircle, Info, AlertCircle, Copy, RefreshCw, Star
} from 'lucide-react';

// ─── SMTP Presets ────────────────────────────────────────────
const SMTP_PRESETS: Record<string, { host: string; ssl: number; tls: number; note: string }> = {
  hostinger: { host: 'smtp.hostinger.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  google: { host: 'smtp.gmail.com', ssl: 465, tls: 587, note: 'App Password required' },
  microsoft365: { host: 'smtp.office365.com', ssl: 0, tls: 587, note: 'TLS only, port 587' },
  zoho: { host: 'smtppro.zoho.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  godaddy: { host: 'smtpout.secureserver.net', ssl: 465, tls: 587, note: 'Full Email + Password' },
  namecheap: { host: 'mail.privateemail.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  dreamhost: { host: 'smtp.dreamhost.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  ionos: { host: 'smtp.ionos.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  icloud: { host: 'smtp.mail.me.com', ssl: 0, tls: 587, note: 'App-specific Password (TLS only)' },
  aol: { host: 'smtp.aol.com', ssl: 465, tls: 587, note: 'App Password required' },
  fastmail: { host: 'smtp.fastmail.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  protonmail: { host: '127.0.0.1', ssl: 0, tls: 1025, note: 'Requires ProtonMail Bridge' },
  rackspace: { host: 'secure.emailsrvr.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  amazonses: { host: 'email-smtp.us-east-1.amazonaws.com', ssl: 465, tls: 587, note: 'AWS SMTP credentials' },
  custom: { host: '', ssl: 465, tls: 587, note: 'Enter details manually' },
};

const FREE_PROVIDERS = ['gmail', 'yahoo', 'outlook'];

// ─── Types ───────────────────────────────────────────────────
interface SmtpAccount {
  id: string;
  label: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: string;
  is_default: boolean;
  created_at: string;
}

interface SenderIdentity {
  id: string;
  from_name: string;
  from_email: string;
  domain_status: 'unverified' | 'verified';
  dkim_record: string | null;
  email_provider: string | null;
  created_at: string;
}

interface Profile {
  organization_name: string | null;
  email_credits: number;
  tier: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { isPilotAccount } = useSubscription();
  const { activeClientId } = useClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [saving, setSaving] = useState(false);

  // SMTP
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [isSmtpDialogOpen, setIsSmtpDialogOpen] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    label: '', provider: 'custom', host: '', port: '587',
    username: '', password: '', encryption: 'tls',
  });

  // Sender Identities
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityForm, setIdentityForm] = useState({ fromName: '', fromEmail: '', provider: '' });
  const [selectedIdentity, setSelectedIdentity] = useState<SenderIdentity | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, activeClientId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [profileRes, smtpRes, identitiesRes] = await Promise.all([
        supabase.from('profiles').select('organization_name, email_credits, tier').eq('id', user!.id).single(),
        supabase.from('smtp_accounts' as any).select('*').eq('user_id', user!.id).order('created_at', { ascending: true }),
        (() => {
          let q = supabase.from('sender_identities').select('*').eq('user_id', user!.id);
          if (activeClientId) q = q.eq('client_id', activeClientId);
          return q.order('created_at', { ascending: false });
        })(),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data as any);
        setOrganizationName((profileRes.data as any).organization_name || '');
      }
      setSmtpAccounts((smtpRes.data as any[]) || []);
      setIdentities((identitiesRes.data as any[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ─── Organization ──────────────────────────────────────────
  const handleSaveOrg = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ organization_name: organizationName }).eq('id', user!.id);
      if (error) throw error;
      toast({ title: 'Saved', description: 'Organization name updated.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── SMTP ──────────────────────────────────────────────────
  const handleSmtpProviderChange = (provider: string) => {
    setSmtpForm(f => {
      const preset = SMTP_PRESETS[provider];
      if (provider !== 'custom' && preset) {
        const port = f.encryption === 'ssl' ? preset.ssl : preset.tls;
        return { ...f, provider, host: preset.host, port: String(port || preset.tls) };
      }
      return { ...f, provider };
    });
  };

  const handleSmtpEncChange = (enc: string) => {
    setSmtpForm(f => {
      const preset = SMTP_PRESETS[f.provider];
      if (f.provider !== 'custom' && preset) {
        const port = enc === 'ssl' ? preset.ssl : preset.tls;
        return { ...f, encryption: enc, port: String(port || preset.tls) };
      }
      return { ...f, encryption: enc };
    });
  };

  const handleSaveSmtp = async () => {
    const { label, host, port, username, password, encryption, provider } = smtpForm;
    if (!host || !port || !username || !password) {
      toast({ title: 'Missing fields', description: 'Fill all SMTP fields.', variant: 'destructive' });
      return;
    }
    setSmtpSaving(true);
    try {
      const isFirst = smtpAccounts.length === 0;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('manage-smtp', {
        body: {
          action: 'create',
          label: label || `${provider !== 'custom' ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Custom'} SMTP`,
          provider,
          smtp_host: host.trim(),
          smtp_port: parseInt(port, 10),
          smtp_username: username.trim(),
          smtp_password: password,
          smtp_encryption: encryption,
          is_default: isFirst,
          client_id: activeClientId,
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast({ title: 'SMTP account added securely' });
      setSmtpForm({ label: '', provider: 'custom', host: '', port: '587', username: '', password: '', encryption: 'tls' });
      setIsSmtpDialogOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleDeleteSmtp = async (id: string) => {
    try {
      const { error } = await supabase.from('smtp_accounts' as any).delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'SMTP account removed' });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSetDefaultSmtp = async (id: string) => {
    try {
      // unset all defaults
      await supabase.from('smtp_accounts' as any).update({ is_default: false } as any).eq('user_id', user!.id);
      await supabase.from('smtp_accounts' as any).update({ is_default: true } as any).eq('id', id);
      toast({ title: 'Default updated' });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // ─── Sender Identities ────────────────────────────────────
  const generateDkimRecord = (email: string) => {
    const domain = email.split('@')[1];
    const rid = Math.random().toString(36).substring(2, 8);
    return `em${rid}._domainkey.${domain}`;
  };

  const handleAddIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    const { fromName, fromEmail, provider } = identityForm;
    if (!provider) {
      toast({ title: 'Select provider', description: 'Choose your email provider.', variant: 'destructive' });
      return;
    }
    if (isPilotAccount && identities.length >= PILOT_LIMITS.maxSenderIdentities) {
      toast({ title: 'Pilot limit reached', description: `Max ${PILOT_LIMITS.maxSenderIdentities} sender identities on pilot.`, variant: 'destructive' });
      return;
    }
    setIdentitySaving(true);
    try {
      const isFree = FREE_PROVIDERS.includes(provider);
      const { error } = await supabase.from('sender_identities').insert({
        user_id: user!.id,
        from_name: fromName,
        from_email: fromEmail,
        dkim_record: isFree ? null : generateDkimRecord(fromEmail),
        domain_status: isFree ? 'verified' : 'unverified',
        email_provider: provider,
        client_id: activeClientId,
      } as any);
      if (error) throw error;
      toast({ title: isFree ? 'Identity added & verified!' : 'Identity added — verify DNS' });
      setIdentityForm({ fromName: '', fromEmail: '', provider: '' });
      setIsIdentityDialogOpen(false);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIdentitySaving(false);
    }
  };

  const handleDeleteIdentity = async (id: string) => {
    try {
      await supabase.from('sender_identities').delete().eq('id', id);
      toast({ title: 'Identity removed' });
      if (selectedIdentity?.id === id) setSelectedIdentity(null);
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleVerifyDomain = async (identity: SenderIdentity) => {
    setIsVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ identity_id: identity.id }),
      });
      const result = await res.json();
      toast({
        title: result.verified ? 'Domain Verified!' : 'Verification Pending',
        description: result.verified ? 'Ready to send.' : (result.message || 'DNS not found yet.'),
        variant: result.verified ? 'default' : 'destructive',
      });
      fetchAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
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
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account, SMTP connections, and sender identities</p>
        </div>

        <Tabs defaultValue="smtp" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="smtp">SMTP Accounts</TabsTrigger>
            <TabsTrigger value="identities">Sender Identities</TabsTrigger>
          </TabsList>

          {/* ─── General ───────────────────────────────────── */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input value={organizationName} onChange={e => setOrganizationName(e.target.value)} placeholder="Your Agency Name" />
                </div>
                <Button onClick={handleSaveOrg} disabled={saving} size="sm">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Account</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Plan</Label>
                    <p className="text-sm font-medium capitalize">{profile?.tier || 'starter'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Email Credits</Label>
                    <p className="text-sm font-medium">{profile?.email_credits === 999999 ? 'Unlimited' : profile?.email_credits?.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── SMTP Accounts ─────────────────────────────── */}
          <TabsContent value="smtp" className="space-y-4 mt-4">
            {/* Help */}
            <Accordion type="single" collapsible>
              <AccordionItem value="help" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> How to find your SMTP credentials</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground text-sm">
                    <p><strong>Gmail:</strong> Enable 2-Step Verification → Generate an App Password at myaccount.google.com → Security → App Passwords.</p>
                    <p><strong>Microsoft 365:</strong> Enable SMTP AUTH in admin center. Use full email + password on port 587 (TLS).</p>
                    <p><strong>Zoho:</strong> Use your full Zoho email and password. Enable "Less secure apps" if needed.</p>
                    <p><strong>IONOS:</strong> Use your IONOS email and the password set in IONOS control panel.</p>
                    <p><strong>Hostinger:</strong> Go to hPanel → Emails → Manage. Use email + password you created.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* SMTP List */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your SMTP Accounts</h3>
              <Dialog open={isSmtpDialogOpen} onOpenChange={setIsSmtpDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add SMTP</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add SMTP Account</DialogTitle>
                    <DialogDescription>Configure email sending credentials</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Label</Label>
                      <Input value={smtpForm.label} onChange={e => setSmtpForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. My Gmail" />
                    </div>
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select value={smtpForm.provider} onValueChange={handleSmtpProviderChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SMTP_PRESETS).map(([key, val]) => (
                            <SelectItem key={key} value={key}>{key === 'custom' ? 'Custom / Other' : key.charAt(0).toUpperCase() + key.slice(1)}{key === 'microsoft365' ? ' (Office 365)' : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {smtpForm.provider !== 'custom' && (
                        <p className="text-xs text-muted-foreground">{SMTP_PRESETS[smtpForm.provider]?.note}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input value={smtpForm.host} onChange={e => setSmtpForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.example.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Encryption</Label>
                        <Select value={smtpForm.encryption} onValueChange={handleSmtpEncChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tls">TLS (587)</SelectItem>
                            <SelectItem value="ssl">SSL (465)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Port</Label>
                        <Input type="number" value={smtpForm.port} onChange={e => setSmtpForm(f => ({ ...f, port: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Username / Email</Label>
                      <Input value={smtpForm.username} onChange={e => setSmtpForm(f => ({ ...f, username: e.target.value }))} placeholder="you@domain.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Password / App Password</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={smtpForm.password}
                          onChange={e => setSmtpForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="••••••••"
                          className="pr-10"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(p => !p)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSmtpDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveSmtp} disabled={smtpSaving}>
                      {smtpSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {smtpAccounts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Server className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No SMTP accounts yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Add your first SMTP account to start sending emails</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {smtpAccounts.map(acct => (
                  <Card key={acct.id} className="group">
                    <CardContent className="flex items-center justify-between py-4 px-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Server className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{acct.label}</span>
                            {acct.is_default && (
                              <Badge variant="secondary" className="text-xs"><Star className="h-3 w-3 mr-1" />Default</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{acct.smtp_username} · {acct.smtp_host}:{acct.smtp_port}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!acct.is_default && (
                          <Button variant="ghost" size="sm" onClick={() => handleSetDefaultSmtp(acct.id)} className="text-xs">Set Default</Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSmtp(acct.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Sender Identities ─────────────────────────── */}
          <TabsContent value="identities" className="space-y-4 mt-4">
            {/* Help */}
            <Accordion type="single" collapsible>
              <AccordionItem value="help" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> What is a Sender Identity?</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 text-muted-foreground text-sm">
                    <p>A sender identity is the "From" name and email that recipients see. Gmail, Yahoo, and Outlook identities are auto-verified. Custom domains require DNS verification.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Sender Identities</h3>
              <Dialog open={isIdentityDialogOpen} onOpenChange={setIsIdentityDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Identity</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleAddIdentity}>
                    <DialogHeader>
                      <DialogTitle>Add Sender Identity</DialogTitle>
                      <DialogDescription>Add a new email address to send from</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Email Provider</Label>
                        <Select value={identityForm.provider} onValueChange={v => setIdentityForm(f => ({ ...f, provider: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gmail">Gmail / Google Workspace</SelectItem>
                            <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                            <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                            <SelectItem value="other">Other (Custom Domain)</SelectItem>
                          </SelectContent>
                        </Select>
                        {identityForm.provider && FREE_PROVIDERS.includes(identityForm.provider) && (
                          <Alert className="border-primary/30 bg-primary/5">
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">No DNS required — auto-verified.</AlertDescription>
                          </Alert>
                        )}
                        {identityForm.provider === 'other' && (
                          <Alert className="border-amber-500/30 bg-amber-500/5">
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                            <AlertDescription className="text-xs">Custom domains require DNS verification (CNAME record).</AlertDescription>
                          </Alert>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>From Name</Label>
                        <Input value={identityForm.fromName} onChange={e => setIdentityForm(f => ({ ...f, fromName: e.target.value }))} placeholder="John Doe" required />
                      </div>
                      <div className="space-y-2">
                        <Label>From Email</Label>
                        <Input type="email" value={identityForm.fromEmail} onChange={e => setIdentityForm(f => ({ ...f, fromEmail: e.target.value }))} placeholder="you@domain.com" required />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsIdentityDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={identitySaving}>
                        {identitySaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add Identity
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {identities.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">No sender identities yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Add your first identity to start sending campaigns</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Identity list */}
                <div className="space-y-2">
                  {identities.map(identity => (
                    <Card
                      key={identity.id}
                      className={`cursor-pointer transition-all ${selectedIdentity?.id === identity.id ? 'ring-2 ring-primary' : 'hover:shadow-sm'}`}
                      onClick={() => setSelectedIdentity(identity)}
                    >
                      <CardContent className="flex items-center justify-between py-3 px-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{identity.from_name}</span>
                            {identity.domain_status === 'verified' ? (
                              <Badge className="bg-green-500/10 text-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Unverified</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{identity.from_email}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); handleDeleteIdentity(identity.id); }}>
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* DNS panel */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">DNS Configuration</CardTitle>
                    <CardDescription>
                      {selectedIdentity ? `Configure DNS for ${selectedIdentity.from_email}` : 'Select an identity'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedIdentity ? (
                      selectedIdentity.email_provider && FREE_PROVIDERS.includes(selectedIdentity.email_provider) ? (
                        <Alert className="border-green-500/30 bg-green-500/5">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <AlertTitle>No DNS Setup Required</AlertTitle>
                          <AlertDescription className="text-sm">
                            <span className="capitalize">{selectedIdentity.email_provider}</span> identities are auto-verified. Make sure your SMTP is configured above.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-4">
                          {selectedIdentity.domain_status === 'unverified' && (
                            <Alert className="border-destructive/50 bg-destructive/10">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Action Required</AlertTitle>
                              <AlertDescription className="text-sm">Add the DNS record below, then click "Verify Domain".</AlertDescription>
                            </Alert>
                          )}
                          <div className="rounded-lg bg-muted p-4 space-y-3">
                            <h4 className="font-medium text-sm">CNAME Record</h4>
                            <div className="flex items-center justify-between p-2.5 bg-background rounded border">
                              <div>
                                <div className="text-xs text-muted-foreground">Host</div>
                                <div className="font-mono text-xs">{selectedIdentity.dkim_record?.split('.')[0]}._domainkey</div>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${selectedIdentity.dkim_record?.split('.')[0]}._domainkey`)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between p-2.5 bg-background rounded border">
                              <div>
                                <div className="text-xs text-muted-foreground">Value</div>
                                <div className="font-mono text-xs break-all">{selectedIdentity.dkim_record?.split('.')[0]}.dkim.amazonses.com</div>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(`${selectedIdentity.dkim_record?.split('.')[0]}.dkim.amazonses.com`)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleVerifyDomain(selectedIdentity)}
                            disabled={isVerifying || selectedIdentity.domain_status === 'verified'}
                            className="w-full"
                            size="sm"
                          >
                            {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> :
                              selectedIdentity.domain_status === 'verified' ? <><CheckCircle className="mr-2 h-4 w-4" />Verified</> :
                              <><RefreshCw className="mr-2 h-4 w-4" />Verify Domain</>}
                          </Button>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Select an identity to view DNS config</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
