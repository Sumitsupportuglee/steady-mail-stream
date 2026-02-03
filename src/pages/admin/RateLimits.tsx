import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Loader2, Edit2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  organization_name: string | null;
  daily_send_limit: number | null;
  hourly_send_limit: number | null;
  emails_sent_today: number | null;
  emails_sent_this_hour: number | null;
}

export default function RateLimits() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hourlyLimit, setHourlyLimit] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, organization_name, daily_send_limit, hourly_send_limit, emails_sent_today, emails_sent_this_hour')
        .order('organization_name', { ascending: true });

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

  const openEditDialog = (user: UserProfile) => {
    setEditUser(user);
    setHourlyLimit(String(user.hourly_send_limit || 20));
    setDailyLimit(String(user.daily_send_limit || 100));
    setEditDialogOpen(true);
  };

  const handleSaveLimits = async () => {
    if (!editUser) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          hourly_send_limit: parseInt(hourlyLimit) || 20,
          daily_send_limit: parseInt(dailyLimit) || 100,
        })
        .eq('id', editUser.id);

      if (error) throw error;

      toast({
        title: 'Limits Updated',
        description: 'User rate limits have been saved',
      });

      setEditDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update limits',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetCounters = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          emails_sent_today: 0,
          emails_sent_this_hour: 0,
          last_daily_reset: new Date().toISOString(),
          last_hourly_reset: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'Counters Reset',
        description: 'User sending counters have been reset',
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset counters',
        variant: 'destructive',
      });
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rate Limits</h1>
          <p className="text-muted-foreground mt-1">
            Control sending rates and volumes for each user
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Rate Limits</CardTitle>
            <CardDescription>
              Configure hourly and daily email sending limits per user
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Hourly Limit</TableHead>
                  <TableHead>Daily Limit</TableHead>
                  <TableHead>Sent (Hour)</TableHead>
                  <TableHead>Sent (Today)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs">
                      {user.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{user.organization_name || '-'}</TableCell>
                    <TableCell>{user.hourly_send_limit || 20}</TableCell>
                    <TableCell>{user.daily_send_limit || 100}</TableCell>
                    <TableCell>
                      <span className={
                        (user.emails_sent_this_hour || 0) >= (user.hourly_send_limit || 20)
                          ? 'text-red-500 font-medium'
                          : ''
                      }>
                        {user.emails_sent_this_hour || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={
                        (user.emails_sent_today || 0) >= (user.daily_send_limit || 100)
                          ? 'text-red-500 font-medium'
                          : ''
                      }>
                        {user.emails_sent_today || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(user)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleResetCounters(user.id)}
                        >
                          Reset
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rate Limits</DialogTitle>
            <DialogDescription>
              Set sending limits for {editUser?.organization_name || 'this user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hourly">Hourly Limit</Label>
              <Input
                id="hourly"
                type="number"
                min="1"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily">Daily Limit</Label>
              <Input
                id="daily"
                type="number"
                min="1"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLimits} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
