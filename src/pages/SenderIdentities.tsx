import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Plus, Mail, Copy, CheckCircle, XCircle, Loader2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SenderIdentity {
  id: string;
  from_name: string;
  from_email: string;
  domain_status: 'unverified' | 'verified';
  dkim_record: string | null;
  created_at: string;
}

export default function SenderIdentities() {
  const { user } = useAuth();
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState<SenderIdentity | null>(null);

  // Form state
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');

  useEffect(() => {
    if (user) {
      fetchIdentities();
    }
  }, [user]);

  const fetchIdentities = async () => {
    try {
      const { data, error } = await supabase
        .from('sender_identities')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIdentities(data || []);
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

  const handleAddIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const dkimRecord = generateDkimRecord(fromEmail);

      const { error } = await supabase
        .from('sender_identities')
        .insert({
          user_id: user!.id,
          from_name: fromName,
          from_email: fromEmail,
          dkim_record: dkimRecord,
          domain_status: 'unverified',
        });

      if (error) throw error;

      toast({
        title: 'Identity added',
        description: 'Please configure your DNS records to verify the domain.',
      });

      setFromName('');
      setFromEmail('');
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

  const handleVerifyDomain = async (identity: SenderIdentity) => {
    setIsVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-domain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ identity_id: identity.id }),
        }
      );

      const result = await response.json();

      if (result.verified) {
        toast({
          title: 'Domain Verified!',
          description: 'You can now send emails from this address.',
        });
      } else {
        toast({
          title: 'Verification Pending',
          description: result.message || 'DNS records not found yet. Please try again later.',
          variant: 'destructive',
        });
      }

      fetchIdentities();
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify domain',
        variant: 'destructive',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'DNS record copied to clipboard.',
    });
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
                      placeholder="john@youragency.com"
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
