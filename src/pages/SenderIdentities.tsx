import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import { Plus, Mail, Copy, CheckCircle, XCircle, Loader2, Trash2, RefreshCw, AlertCircle, Info, HelpCircle, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useClient } from '@/contexts/ClientContext';

const FREE_PROVIDERS = ['gmail', 'yahoo', 'outlook'];

type RecordStatus = 'not_set' | 'verified' | 'failed';

interface SenderIdentity {
  id: string;
  from_name: string;
  from_email: string;
  domain_status: 'unverified' | 'verified';
  dkim_record: string | null;
  email_provider: string | null;
  created_at: string;
  spf_status?: RecordStatus;
  dmarc_status?: RecordStatus;
}

export default function SenderIdentities() {
  const { user } = useAuth();
  const { planLimits } = useSubscription();
  const { activeClientId } = useClient();
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState<string | null>(null); // 'dkim' | 'spf' | 'dmarc' | null
  const [selectedIdentity, setSelectedIdentity] = useState<SenderIdentity | null>(null);

  // Form state
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [emailProvider, setEmailProvider] = useState('');

  useEffect(() => {
    if (user) {
      fetchIdentities();
    }
  }, [user, activeClientId]);

  const fetchIdentities = async () => {
    try {
      let query = supabase
        .from('sender_identities')
        .select('*')
        .eq('user_id', user!.id);
      if (activeClientId) query = query.eq('client_id', activeClientId);
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setIdentities((data as any[]) || []);
    } catch (error) {
      console.error('Error fetching identities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sender identities',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateDkimRecord = (email: string) => {
    const domain = email.split('@')[1];
    const randomId = Math.random().toString(36).substring(2, 8);
    return `em${randomId}._domainkey.${domain}`;
  };

  const isFreeProvider = (provider: string) => FREE_PROVIDERS.includes(provider);

  const handleAddIdentity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailProvider) {
      toast({ title: 'Select provider', description: 'Please select your email provider.', variant: 'destructive' });
      return;
    }

    if (identities.length >= planLimits.maxSenderIdentities) {
      toast({
        title: 'Limit reached',
        description: `Your plan allows a maximum of ${planLimits.maxSenderIdentities} sender identities. Upgrade your plan for more.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const isFree = isFreeProvider(emailProvider);
      const dkimRecord = isFree ? null : generateDkimRecord(fromEmail);

      const { error } = await supabase
        .from('sender_identities')
        .insert({
          user_id: user!.id,
          from_name: fromName,
          from_email: fromEmail,
          dkim_record: dkimRecord,
          domain_status: isFree ? 'verified' : 'unverified',
          email_provider: emailProvider,
          client_id: activeClientId,
        } as any);

      if (error) throw error;

      toast({
        title: isFree ? 'Identity added & verified!' : 'Identity added',
        description: isFree
          ? 'No DNS configuration is needed for this provider. Your identity is ready to use.'
          : 'Please configure your DNS records to verify the domain.',
      });

      setFromName('');
      setFromEmail('');
      setEmailProvider('');
      setIsAddDialogOpen(false);
      fetchIdentities();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add sender identity',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIdentity = async (id: string) => {
    try {
      const { error } = await supabase
        .from('sender_identities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Identity deleted',
        description: 'Sender identity has been removed.',
      });

      fetchIdentities();
      setSelectedIdentity(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete identity',
        variant: 'destructive',
      });
    }
  };

  const handleVerifyDomain = async (identity: SenderIdentity, recordType: 'dkim' | 'spf' | 'dmarc' = 'dkim') => {
    setIsVerifying(recordType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-domain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ identity_id: identity.id, record_type: recordType }),
        }
      );

      const result = await response.json();

      if (result.verified) {
        toast({
          title: `${recordType.toUpperCase()} Verified!`,
          description: result.message || 'Record verified successfully.',
        });
      } else {
        toast({
          title: 'Verification Pending',
          description: result.message || result.error || 'Record not found yet.',
          variant: 'destructive',
        });
      }

      // Refresh and keep the same identity selected
      const updated = await supabase
        .from('sender_identities')
        .select('*')
        .eq('id', identity.id)
        .single();
      if (updated.data) setSelectedIdentity(updated.data as any);
      fetchIdentities();
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify record',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'DNS record copied to clipboard.',
    });
  };

  const selectedIsFreeProvider = selectedIdentity?.email_provider
    ? isFreeProvider(selectedIdentity.email_provider)
    : false;

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
            <h1 className="text-3xl font-bold tracking-tight">Sender Identities</h1>
            <p className="text-muted-foreground mt-1">
              Manage your custom sending domains
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Identity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddIdentity}>
                <DialogHeader>
                  <DialogTitle>Add Sender Identity</DialogTitle>
                  <DialogDescription>
                    Add a new email address to send campaigns from
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Email Provider Selection */}
                  <div className="space-y-2">
                    <Label>Email Provider</Label>
                    <Select value={emailProvider} onValueChange={setEmailProvider}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your email provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gmail">Gmail / Google Workspace</SelectItem>
                        <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                        <SelectItem value="outlook">Outlook / Microsoft 365</SelectItem>
                        <SelectItem value="other">Other (Custom Domain)</SelectItem>
                      </SelectContent>
                    </Select>
                    {emailProvider && isFreeProvider(emailProvider) && (
                      <Alert className="border-primary/30 bg-primary/5">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          No DNS configuration required for {emailProvider === 'gmail' ? 'Gmail' : emailProvider === 'yahoo' ? 'Yahoo' : 'Outlook'}. Your identity will be auto-verified.
                        </AlertDescription>
                      </Alert>
                    )}
                    {emailProvider === 'other' && (
                      <Alert className="border-amber-500/30 bg-amber-500/5">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-xs">
                          Custom domains require DNS record verification (CNAME). You'll need access to your domain's DNS settings.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="from-name">From Name</Label>
                    <Input
                      id="from-name"
                      placeholder="John Doe"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from-email">From Email</Label>
                    <Input
                      id="from-email"
                      type="email"
                      placeholder={emailProvider === 'gmail' ? 'you@gmail.com' : emailProvider === 'yahoo' ? 'you@yahoo.com' : emailProvider === 'outlook' ? 'you@outlook.com' : 'john@youragency.com'}
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
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
                      'Add Identity'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Help & Instructions Accordion */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="what-is">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> What is a Sender Identity?</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">A sender identity defines the "From" name and email address that recipients see when they receive your emails. For example, <strong>"John from Acme" &lt;john@acme.com&gt;</strong>. You need at least one verified sender identity before you can send campaigns.</p>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="dns-needed">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> Do I need DNS verification?</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Gmail, Yahoo, Outlook:</strong> No DNS setup needed. These providers are automatically verified when you add them. Just make sure your SMTP credentials are configured in Settings.</p>
                <p><strong>Custom domains (e.g., you@yourcompany.com):</strong> DNS verification is required. You'll need to add a CNAME record to your domain's DNS settings to prove ownership. This helps improve email deliverability and prevents spoofing.</p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="dns-howto">
            <AccordionTrigger>
              <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4" /> How to add DNS records</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-muted-foreground text-sm">
                <p>After adding a custom domain identity, you'll see a CNAME record to add. Here's how for popular registrars:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>GoDaddy:</strong> DNS → Manage Zones → Add Record → CNAME → paste Host and Value</li>
                  <li><strong>Namecheap:</strong> Domain List → Advanced DNS → Add New Record → CNAME</li>
                  <li><strong>Cloudflare:</strong> DNS → Records → Add Record → CNAME (disable proxy/orange cloud)</li>
                  <li><strong>Hostinger:</strong> hPanel → DNS Zone → Add CNAME record</li>
                  <li><strong>IONOS:</strong> Domains & SSL → DNS → Add Record → CNAME</li>
                </ul>
                <p className="mt-2">After adding the record, wait 5–30 minutes (up to 48 hours in some cases), then click <strong>"Verify Domain"</strong>.</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Identities List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Identities</CardTitle>
              <CardDescription>
                Click on an identity to view DNS configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {identities.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium text-lg">No sender identities</h3>
                  <p className="text-muted-foreground mt-1">
                    Add your first sender identity to start sending emails
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {identities.map((identity) => (
                      <TableRow
                        key={identity.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedIdentity(identity)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{identity.from_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {identity.from_email}
                            </div>
                            {identity.email_provider && (
                              <Badge variant="outline" className="mt-1 text-xs capitalize">
                                {identity.email_provider === 'other' ? 'Custom Domain' : identity.email_provider}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {identity.domain_status === 'verified' ? (
                            <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="mr-1 h-3 w-3" />
                              Unverified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteIdentity(identity.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* DNS Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>DNS Configuration</CardTitle>
              <CardDescription>
                {selectedIdentity
                  ? `Configure DNS for ${selectedIdentity.from_email}`
                  : 'Select an identity to view configuration'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedIdentity ? (
                <div className="space-y-4">
                  {/* Free provider — no DNS needed */}
                  {selectedIsFreeProvider ? (
                    <Alert className="border-green-500/30 bg-green-500/5">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle>No DNS Setup Required</AlertTitle>
                      <AlertDescription>
                        <span className="capitalize">{selectedIdentity.email_provider}</span> identities don't require DNS verification. Your identity is verified and ready to use. Just make sure your SMTP credentials are configured in <strong>Settings</strong>.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {selectedIdentity.domain_status === 'unverified' && (
                        <Alert className="border-destructive/50 bg-destructive/10">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Action Required</AlertTitle>
                          <AlertDescription>
                            After adding DNS records, you must click "Verify Domain" below to complete verification.
                            The domain will not be verified automatically.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="rounded-lg bg-muted p-4">
                        <h4 className="font-medium mb-2">CNAME Record</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add this CNAME record to your DNS provider (GoDaddy, Namecheap, Cloudflare, etc.)
                        </p>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-background rounded border">
                            <div>
                              <div className="text-xs text-muted-foreground">Host</div>
                              <div className="font-mono text-sm">{selectedIdentity.dkim_record?.split('.')[0]}._domainkey</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(`${selectedIdentity.dkim_record?.split('.')[0]}._domainkey`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-background rounded border">
                            <div>
                              <div className="text-xs text-muted-foreground">Value</div>
                              <div className="font-mono text-sm break-all">
                                {selectedIdentity.dkim_record?.split('.')[0]}.dkim.amazonses.com
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => copyToClipboard(`${selectedIdentity.dkim_record?.split('.')[0]}.dkim.amazonses.com`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <RefreshCw className="h-4 w-4" />
                          Verify Your Domain
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          After adding the CNAME record to your DNS, click the button below to verify your domain.
                          DNS propagation can take up to 48 hours.
                        </p>
                        <Button
                          onClick={() => handleVerifyDomain(selectedIdentity)}
                          disabled={isVerifying || selectedIdentity.domain_status === 'verified'}
                          className="w-full"
                        >
                          {isVerifying ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verifying...
                            </>
                          ) : selectedIdentity.domain_status === 'verified' ? (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Domain Verified
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Verify Domain Now
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-2">
                        <p><strong>Important:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>DNS changes can take up to 48 hours to propagate</li>
                          <li>You must click "Verify Domain" after adding DNS records</li>
                          <li>If verification fails, wait a few hours and try again</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select an identity from the list to view its DNS configuration</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
