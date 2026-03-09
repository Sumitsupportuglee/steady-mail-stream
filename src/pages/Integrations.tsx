import { useEffect, useState } from 'react';
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
import { toast } from '@/hooks/use-toast';
import { 
  Loader2, Save, Zap, MessageSquare, Table2, 
  Building, Cloud, CheckCircle, XCircle, ExternalLink,
  Copy, Info
} from 'lucide-react';

interface Integration {
  id?: string;
  provider: string;
  webhook_url: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

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
    instructions: 'Create a Zap with a "Webhooks by Zapier" trigger (Catch Hook). Paste the webhook URL below.',
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

export default function Integrations() {
  const { user } = useAuth();
  const { activeClientId } = useClient();
  const [integrations, setIntegrations] = useState<Record<string, Integration>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const inboundWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapier-inbound`;

  useEffect(() => {
    if (user) fetchIntegrations();
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

  const handleSave = async (providerId: string) => {
    const integration = integrations[providerId];
    if (!integration?.webhook_url) {
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
        const { error } = await supabase
          .from('integrations')
          .insert({
            user_id: user!.id,
            client_id: activeClientId,
            provider: providerId,
            webhook_url: integration.webhook_url,
            is_enabled: integration.is_enabled,
            config: integration.config || {},
          });
        if (error) throw error;
      }

      toast({ title: 'Integration saved', description: `${providerId} webhook has been configured.` });
      fetchIntegrations();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleToggle = (providerId: string, enabled: boolean) => {
    setIntegrations(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId] || { provider: providerId, webhook_url: '', is_enabled: false, config: {} },
        is_enabled: enabled,
      },
    }));
  };

  const handleUrlChange = (providerId: string, url: string) => {
    setIntegrations(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId] || { provider: providerId, webhook_url: '', is_enabled: true, config: {} },
        webhook_url: url,
      },
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'URL copied to clipboard.' });
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
          <p className="text-muted-foreground mt-1">
            Connect your favorite tools to automate workflows
          </p>
        </div>

        {/* Inbound Webhook URL for Zapier */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cloud className="h-4 w-4 text-muted-foreground" />
              Your Inbound Webhook URL
            </CardTitle>
            <CardDescription>
              Use this URL in Zapier actions to push contacts and leads into your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={inboundWebhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(inboundWebhookUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>
                POST contacts to this URL from Zapier. Send JSON with fields: <code className="bg-muted px-1 rounded">name</code>, <code className="bg-muted px-1 rounded">email</code>. 
                Include your API token in the <code className="bg-muted px-1 rounded">Authorization</code> header.
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
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggle(provider.id, checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  {provider.instructions}
                </div>
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    value={integration?.webhook_url || ''}
                    onChange={(e) => handleUrlChange(provider.id, e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => handleSave(provider.id)}
                    disabled={saving === provider.id}
                  >
                    {saving === provider.id ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" />Save</>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={provider.setupUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Setup Guide
                    </a>
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
                Connect these tools directly via Zapier. Create a Zap that triggers when events happen in Senddot, then send data to any of these apps.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
