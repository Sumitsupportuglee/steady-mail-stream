import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import {
  Loader2,
  Save,
  Zap,
  MessageSquare,
  Table2,
  Building,
  Cloud,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Info,
  KeyRound,
  Send,
} from 'lucide-react';

interface Integration {
  id?: string;
  provider: string;
  webhook_url: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

type IntegrationTokenRow = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

const PROVIDERS = [
  {
    id: 'zapier',
    name: 'Zapier',
    icon: Zap,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    description: 'Connect to 5,000+ apps including HubSpot, Salesforce, Google Sheets, and more.',
    fields: ['webhook_url'],
    setupUrl: 'https://zapier.com/app/zaps',
    instructions:
      'Create a Zap with a "Webhooks by Zapier" trigger (Catch Hook). Paste the webhook URL below.',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageSquare,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Get real-time notifications in Slack when leads open emails, click links, or new contacts are added.',
    fields: ['webhook_url'],
    setupUrl: 'https://api.slack.com/messaging/webhooks',
    instructions: 'Create an Incoming Webhook in your Slack workspace. Paste the webhook URL below.',
  },
];

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(digest);
}

function randomToken(lengthBytes = 32) {
  const bytes = new Uint8Array(lengthBytes);
  crypto.getRandomValues(bytes);
  // base64url
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export default function Integrations() {
  const { user } = useAuth();
  const { activeClientId } = useClient();
  const [integrations, setIntegrations] = useState<Record<string, Integration>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenRow, setTokenRow] = useState<IntegrationTokenRow | null>(null);
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);

  const inboundWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapier-inbound`;

  const scopedHint = useMemo(() => {
    if (activeClientId) return 'You are configuring integrations for the selected client.';
    return 'You are configuring integrations for your workspace (no client selected).';
  }, [activeClientId]);

  useEffect(() => {
    if (user) {
      fetchIntegrations();
      fetchLatestToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeClientId]);

  const fetchIntegrations = async () => {
    try {
      let query = supabase
        .from('integrations')
        .select('*')
        .eq('user_id', user!.id);

      if (activeClientId) {
        query = query.eq('client_id', activeClientId);
      } else {
        query = query.is('client_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const map: Record<string, Integration> = {};
      data?.forEach((item: any) => {
        map[item.provider] = {
          id: item.id,
          provider: item.provider,
          webhook_url: item.webhook_url || '',
          is_enabled: item.is_enabled,
          config: item.config || {},
        };
      });
      setIntegrations(map);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestToken = async () => {
    try {
      setTokenLoading(true);
      const { data, error } = await (supabase as any)
        .from('integration_tokens')
        .select('id,name,created_at,last_used_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      setTokenRow((data?.[0] as IntegrationTokenRow) || null);
    } catch (error) {
      console.error('Error fetching integration token:', error);
      setTokenRow(null);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleSave = async (providerId: string) => {
    const integration = integrations[providerId];

    // Allow saving disabled integrations without a URL
    if (integration?.is_enabled !== false && !integration?.webhook_url) {
      toast({ title: 'Missing URL', description: 'Please enter a webhook URL.', variant: 'destructive' });
      return;
    }

    setSaving(providerId);
    try {
      if (integration.id) {
        const { error } = await supabase
          .from('integrations')
          .update({
            webhook_url: integration.webhook_url,
            is_enabled: integration.is_enabled,
            config: integration.config as any,
          })
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('integrations').insert([
          {
            user_id: user!.id,
            client_id: activeClientId ?? null,
            provider: providerId,
            webhook_url: integration.webhook_url || null,
            is_enabled: integration.is_enabled,
            config: (integration.config || {}) as any,
          },
        ]);
        if (error) throw error;
      }

      toast({ title: 'Integration saved', description: `${providerId} configuration updated.` });
      fetchIntegrations();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = (providerId: string, enabled: boolean) => {
    setIntegrations((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || { provider: providerId, webhook_url: '', is_enabled: false, config: {} }),
        is_enabled: enabled,
      },
    }));
  };

  const handleUrlChange = (providerId: string, url: string) => {
    setIntegrations((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || { provider: providerId, webhook_url: '', is_enabled: true, config: {} }),
        webhook_url: url,
      },
    }));
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard.' });
  };

  const handleGenerateToken = async () => {
    try {
      setTokenLoading(true);
      const raw = randomToken();
      const hash = await sha256Hex(raw);

      const { data, error } = await (supabase as any).rpc('create_integration_token', {
        _name: 'Zapier token',
        _token_hash: hash,
      });

      if (error) throw error;

      setNewTokenValue(raw);
      toast({
        title: 'Token generated',
        description: 'Copy it now — it will be shown only once.',
      });

      // Refresh list
      await fetchLatestToken();
      return data;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to generate token', variant: 'destructive' });
    } finally {
      setTokenLoading(false);
    }
  };

  const sendTestEvent = async (providerId: string) => {
    try {
      const { error } = await supabase.functions.invoke('trigger-webhook', {
        body: {
          provider: providerId,
          event_type: 'test_webhook',
          data: {
            client_id: activeClientId ?? null,
            message: 'Test event from Integrations page',
          },
        },
      });

      if (error) throw error;
      toast({ title: 'Test sent', description: 'Check your destination app (Zapier/Slack) for the incoming webhook.' });
    } catch (error: any) {
      toast({ title: 'Test failed', description: error.message || 'Failed to send test', variant: 'destructive' });
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
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect your favorite tools to automate workflows</p>
        </div>

        <Alert>
          <AlertTitle>Scope</AlertTitle>
          <AlertDescription>{scopedHint}</AlertDescription>
        </Alert>

        {/* Inbound Webhook URL for Zapier */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cloud className="h-4 w-4 text-muted-foreground" />
              Your Inbound Webhook URL
            </CardTitle>
            <CardDescription>Use this in Zapier actions to push contacts and leads into your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={inboundWebhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(inboundWebhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Integration Token</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerateToken} disabled={tokenLoading}>
                  {tokenLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Generate token
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Use header <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;token&gt;</code> in Zapier.
              </p>
              <div className="mt-3 text-xs text-muted-foreground">
                {tokenLoading ? (
                  <span>Loading token…</span>
                ) : tokenRow ? (
                  <span>
                    Latest token: <span className="font-mono">{tokenRow.name}</span> (created{' '}
                    {new Date(tokenRow.created_at).toLocaleString()})
                  </span>
                ) : (
                  <span>No token generated yet.</span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>
                POST JSON like{' '}
                <code className="bg-muted px-1 rounded">
                  {'{"event_type":"create_contact","data":{"email":"a@b.com"}}'}
                </code>{' '}
                to create contacts, or{' '}
                <code className="bg-muted px-1 rounded">create_lead</code> to create CRM leads.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Integration Cards */}
        {PROVIDERS.map((provider) => {
          const integration = integrations[provider.id];
          const isConfigured = !!(integration?.id && integration.webhook_url);
          const isEnabled = integration?.is_enabled ?? false;

          return (
            <Card key={provider.id} className={isEnabled ? provider.borderColor : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${provider.bgColor} flex items-center justify-center`}>
                      <provider.icon className={`h-5 w-5 ${provider.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{provider.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{provider.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isConfigured ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="mr-1 h-3 w-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="mr-1 h-3 w-3" /> Not Connected
                      </Badge>
                    )}
                    <Switch checked={isEnabled} onCheckedChange={(checked) => handleToggle(provider.id, checked)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{provider.instructions}</div>
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={integration?.webhook_url || ''}
                    onChange={(e) => handleUrlChange(provider.id, e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => handleSave(provider.id)} disabled={saving === provider.id}>
                    {saving === provider.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />Save
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={provider.setupUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Setup Guide
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendTestEvent(provider.id)}
                    disabled={!isEnabled || !integration?.webhook_url}
                  >
                    <Send className="mr-2 h-3.5 w-3.5" />
                    Send test
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Coming Soon */}
        <Card className="opacity-60">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Building className="h-5 w-5 text-blue-500" />
              </div>
              <div className="h-10 w-10 rounded-lg bg-sky-50 flex items-center justify-center">
                <Cloud className="h-5 w-5 text-sky-500" />
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <Table2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div>
              <p className="font-medium">HubSpot, Salesforce & Google Sheets</p>
              <p className="text-sm text-muted-foreground">
                Connect these tools via Zapier. Create a Zap that triggers when events happen here, then send data to any of
                these apps.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* One-time token reveal */}
        <AlertDialog open={!!newTokenValue} onOpenChange={(open) => !open && setNewTokenValue(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Your Integration Token</AlertDialogTitle>
              <AlertDialogDescription>
                Copy this now — it will not be shown again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="flex gap-2">
                <Input readOnly value={newTokenValue || ''} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => newTokenValue && copyToClipboard(newTokenValue)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setNewTokenValue(null)}>Done</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
