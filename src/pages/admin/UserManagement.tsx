import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Check, X, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  organization_name: string | null;
  email_credits: number | null;
  tier: string | null;
  is_approved: boolean | null;
  daily_send_limit: number | null;
  hourly_send_limit: number | null;
  created_at: string | null;
  user_email?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (userId: string, approve: boolean) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: approve })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: approve ? 'User Approved' : 'User Rejected',
        description: approve 
          ? 'User can now send emails' 
          : 'User access has been revoked',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already Admin',
            description: 'This user is already an admin',
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: 'Admin Role Granted',
          description: 'User now has admin privileges',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grant admin role',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = filter === 'all' 
    ? users 
    : filter === 'pending' 
      ? users.filter(u => !u.is_approved)
      : users.filter(u => u.is_approved);

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Approve accounts and manage user access
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>{users.length} total users</CardDescription>
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Limits</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs">
                      {user.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{user.organization_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.tier || 'starter'}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_approved ? (
                        <Badge className="bg-green-500">Approved</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.hourly_send_limit}/hr, {user.daily_send_limit}/day
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.created_at 
                        ? new Date(user.created_at).toLocaleDateString() 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!user.is_approved && (
                          <Button
                            size="sm"
                            onClick={() => handleApproval(user.id, true)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {user.is_approved && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleApproval(user.id, false)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMakeAdmin(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          <Shield className="h-4 w-4" />
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
    </AdminLayout>
  );
}
