import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Mail, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SenderIdentity {
  id: string;
  from_name: string;
  from_email: string;
  domain_status: string | null;
  user_id: string;
  created_at: string | null;
}

export default function SESIdentities() {
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchIdentities();
  }, []);

  const fetchIdentities = async () => {
    try {
      const { data, error } = await supabase
        .from('sender_identities')
        .select('*')
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

  const handleAddToSES = async (email: string) => {
    setActionLoading(email);
    try {
      const { data, error } = await supabase.functions.invoke('manage-ses-identity', {
        body: { action: 'add', email }
      });

      if (error) throw error;

      toast({
        title: 'Identity Added',
        description: data.message || `${email} has been added to SES`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add identity to SES',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
      setAddDialogOpen(false);
      setNewEmail('');
    }
  };

  const handleVerifyInSES = async (email: string) => {
    setActionLoading(email);
    try {
      const { data, error } = await supabase.functions.invoke('manage-ses-identity', {
        body: { action: 'verify', email }
      });

      if (error) throw error;

      toast({
        title: 'Verification Sent',
        description: data.message || `Verification email sent to ${email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SES Identities</h1>
            <p className="text-muted-foreground mt-1">
              Manage Amazon SES email identities for users
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Email Identity
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Sender Identities</CardTitle>
            <CardDescription>
              Email addresses and domains registered by users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {identities.map((identity) => (
                  <TableRow key={identity.id}>
                    <TableCell className="font-medium">
                      {identity.from_email}
                    </TableCell>
                    <TableCell>{identity.from_name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {identity.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {identity.domain_status === 'verified' ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">
                          <XCircle className="h-3 w-3 mr-1" />
                          Unverified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {identity.created_at 
                        ? new Date(identity.created_at).toLocaleDateString() 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddToSES(identity.from_email)}
                          disabled={actionLoading === identity.from_email}
                        >
                          {actionLoading === identity.from_email ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-1" />
                              Add to SES
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleVerifyInSES(identity.from_email)}
                          disabled={actionLoading === identity.from_email}
                        >
                          {actionLoading === identity.from_email ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Send Verification'
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Email to SES</DialogTitle>
            <DialogDescription>
              Add a new email address to Amazon SES for verification
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleAddToSES(newEmail)}
              disabled={!newEmail || actionLoading === newEmail}
            >
              {actionLoading === newEmail ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add to SES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
