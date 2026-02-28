import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, Server, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const SMTP_PRESETS: Record<string, { host: string; ssl: number; tls: number; note: string }> = {
  hostinger: { host: 'smtp.hostinger.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  google: { host: 'smtp.gmail.com', ssl: 465, tls: 587, note: 'App Password or OAuth2 Workspace' },
  microsoft365: { host: 'smtp.office365.com', ssl: 0, tls: 587, note: 'OAuth2 or App Pass (TLS only)' },
  zoho: { host: 'smtppro.zoho.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  godaddy: { host: 'smtpout.secureserver.net', ssl: 465, tls: 587, note: 'Full Email + Password' },
  namecheap: { host: 'mail.privateemail.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  dreamhost: { host: 'smtp.dreamhost.com', ssl: 465, tls: 587, note: 'Full Email + Password' },
  custom: { host: '', ssl: 465, tls: 587, note: 'Enter your SMTP details manually' },
};

interface Profile {
  organization_name: string | null;
  email_credits: number;
  tier: string;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_encryption: string | null;
}

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // SMTP state
  const [selectedProvider, setSelectedProvider] = useState('custom');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('tls');

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('organization_name, email_credits, tier, smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setOrganizationName(data.organization_name || '');

      // Populate SMTP fields
      if (data.smtp_host) {
        setSmtpHost(data.smtp_host);
        setSmtpPort(String(data.smtp_port || 587));
        setSmtpUsername(data.smtp_username || '');
        setSmtpPassword(data.smtp_password || '');
        setSmtpEncryption(data.smtp_encryption || 'tls');

        // Match to preset
        const preset = Object.entries(SMTP_PRESETS).find(
          ([key, p]) => key !== 'custom' && p.host === data.smtp_host
        );
        setSelectedProvider(preset ? preset[0] : 'custom');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ organization_name: organizationName })
        .eq('id', user!.id);
      if (error) throw error;
      toast({ title: 'Settings saved', description: 'Your profile has been updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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
      const { error } = await supabase
        .from('profiles')
        .update({
          smtp_host: smtpHost.trim(),
          smtp_port: parseInt(smtpPort, 10),
          smtp_username: smtpUsername.trim(),
          smtp_password: smtpPassword,
          smtp_encryption: smtpEncryption,
        })
        .eq('id', user!.id);

      if (error) throw error;
      toast({ title: 'SMTP saved', description: 'Your email sending credentials have been saved.' });
      fetchProfile();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save SMTP settings', variant: 'destructive' });
    } finally {
      setSavingSmtp(false);
    }
  };

  const smtpConfigured = !!(profile?.smtp_host && profile?.smtp_username && profile?.smtp_password);

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
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and email settings</p>
        </div>

        {/* Organization Card */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your organization details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} placeholder="Your Agency Name" />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
            </Button>
          </CardContent>
        </Card>

        {/* SMTP Configuration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  SMTP Configuration
                </CardTitle>
                <CardDescription>Configure your email provider credentials to send campaigns</CardDescription>
              </div>
              {smtpConfigured ? (
                <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20">
                  <CheckCircle className="mr-1 h-3 w-3" /> Configured
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="mr-1 h-3 w-3" /> Not Configured
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider Preset */}
            <div className="space-y-2">
              <Label>Email Provider</Label>
              <Select value={selectedProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hostinger">Hostinger</SelectItem>
                  <SelectItem value="google">Google / Gmail</SelectItem>
                  <SelectItem value="microsoft365">Microsoft 365</SelectItem>
                  <SelectItem value="zoho">Zoho Mail</SelectItem>
                  <SelectItem value="godaddy">GoDaddy</SelectItem>
                  <SelectItem value="namecheap">Namecheap</SelectItem>
                  <SelectItem value="dreamhost">DreamHost</SelectItem>
                  <SelectItem value="custom">Custom / Other</SelectItem>
                </SelectContent>
              </Select>
              {selectedProvider !== 'custom' && (
                <p className="text-xs text-muted-foreground">{SMTP_PRESETS[selectedProvider].note}</p>
              )}
            </div>

            {/* SMTP Host */}
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.yourprovider.com"
              />
            </div>

            {/* Encryption + Port row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Encryption</Label>
                <Select value={smtpEncryption} onValueChange={handleEncryptionChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS (STARTTLS)</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp-port">Port</Label>
                <Input
                  id="smtp-port"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="smtp-username">Username / Email</Label>
              <Input
                id="smtp-username"
                value={smtpUsername}
                onChange={(e) => setSmtpUsername(e.target.value)}
                placeholder="you@yourdomain.com"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="smtp-password">Password / App Password</Label>
              <div className="relative">
                <Input
                  id="smtp-password"
                  type={showPassword ? 'text' : 'password'}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button onClick={handleSaveSmtp} disabled={savingSmtp} className="w-full">
              {savingSmtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save SMTP Settings</>}
            </Button>
          </CardContent>
        </Card>

        {/* Account Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Input value={profile?.tier || 'starter'} disabled className="capitalize" />
            </div>
            <div className="space-y-2">
              <Label>Email Credits</Label>
              <Input value={profile?.email_credits === 999999 ? 'Unlimited (Beta)' : profile?.email_credits?.toLocaleString()} disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
