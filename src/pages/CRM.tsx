import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClient } from '@/contexts/ClientContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  Loader2, 
  GripVertical, 
  Trash2, 
  Pencil, 
  DollarSign,
  Building,
  Mail,
  User,
} from 'lucide-react';

const STAGES = [
  { value: 'new_lead', label: 'New Lead', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  { value: 'contacted', label: 'Contacted', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  { value: 'interested', label: 'Interested', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', color: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30' },
  { value: 'closed', label: 'Closed', color: 'bg-green-500/15 text-green-600 border-green-500/30' },
] as const;

type StageValue = typeof STAGES[number]['value'];

interface CRMLead {
  id: string;
  user_id: string;
  client_id: string | null;
  contact_id: string | null;
  name: string;
  email: string | null;
  company: string | null;
  stage: StageValue;
  notes: string | null;
  deal_value: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export default function CRM() {
  const { user } = useAuth();
  const { activeClientId } = useClient();
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CRMLead | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedLead, setDraggedLead] = useState<CRMLead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<StageValue | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formStage, setFormStage] = useState<StageValue>('new_lead');
  const [formNotes, setFormNotes] = useState('');
  const [formDealValue, setFormDealValue] = useState('');

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('crm_leads')
        .select('*')
        .eq('user_id', user.id);
      if (activeClientId) query = query.eq('client_id', activeClientId);
      const { data, error } = await query.order('position', { ascending: true });
      if (error) throw error;
      setLeads((data as CRMLead[]) || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({ title: 'Error', description: 'Failed to load CRM leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, activeClientId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormCompany('');
    setFormStage('new_lead');
    setFormNotes('');
    setFormDealValue('');
    setEditingLead(null);
  };

  const openAddDialog = (stage?: StageValue) => {
    resetForm();
    if (stage) setFormStage(stage);
    setIsDialogOpen(true);
  };

  const openEditDialog = (lead: CRMLead) => {
    setEditingLead(lead);
    setFormName(lead.name);
    setFormEmail(lead.email || '');
    setFormCompany(lead.company || '');
    setFormStage(lead.stage);
    setFormNotes(lead.notes || '');
    setFormDealValue(lead.deal_value?.toString() || '');
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const leadData = {
      name: formName,
      email: formEmail || null,
      company: formCompany || null,
      stage: formStage,
      notes: formNotes || null,
      deal_value: formDealValue ? parseFloat(formDealValue) : null,
    };

    try {
      if (editingLead) {
        const { error } = await supabase
          .from('crm_leads')
          .update(leadData)
          .eq('id', editingLead.id);
        if (error) throw error;
        toast({ title: 'Lead updated', description: 'Lead has been updated successfully.' });
      } else {
        const stageLeads = leads.filter(l => l.stage === formStage);
        const { error } = await supabase.from('crm_leads').insert({
          ...leadData,
          user_id: user.id,
          client_id: activeClientId,
          position: stageLeads.length,
        });
        if (error) throw error;
        toast({ title: 'Lead added', description: 'New lead has been added.' });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchLeads();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save lead', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('crm_leads').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Lead deleted' });
      fetchLeads();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDragStart = (lead: CRMLead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent, stage: StageValue) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStage: StageValue) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggedLead || draggedLead.stage === targetStage) {
      setDraggedLead(null);
      return;
    }

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, stage: targetStage } : l));

    try {
      const { error } = await supabase
        .from('crm_leads')
        .update({ stage: targetStage })
        .eq('id', draggedLead.id);
      if (error) throw error;
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to move lead', variant: 'destructive' });
      fetchLeads(); // Revert
    }
    setDraggedLead(null);
  };

  const getStageLeads = (stage: StageValue) => leads.filter(l => l.stage === stage);
  const getStageDealTotal = (stage: StageValue) => 
    getStageLeads(stage).reduce((sum, l) => sum + (l.deal_value || 0), 0);

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
            <h1 className="text-3xl font-bold tracking-tight">CRM Pipeline</h1>
            <p className="text-muted-foreground mt-1">
              Track and manage your leads through the sales pipeline
            </p>
          </div>
          <Button onClick={() => openAddDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>

        {/* Pipeline Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = getStageLeads(stage.value);
            const dealTotal = getStageDealTotal(stage.value);
            const isOver = dragOverStage === stage.value;

            return (
              <div
                key={stage.value}
                className={`flex-shrink-0 w-72 rounded-xl border transition-colors ${
                  isOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.value)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.value)}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-border">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className={stage.color}>
                      {stage.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">
                      {stageLeads.length}
                    </span>
                  </div>
                  {dealTotal > 0 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <DollarSign className="h-3 w-3" />
                      {dealTotal.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead)}
                      className={`group bg-background border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                        draggedLead?.id === lead.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                          <span className="font-medium text-sm truncate">{lead.name}</span>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDialog(lead)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(lead.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {lead.company && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                          <Building className="h-3 w-3" />
                          <span className="truncate">{lead.company}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                      {lead.deal_value && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Badge variant="secondary" className="text-xs font-mono">
                            ${lead.deal_value.toLocaleString()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add to stage button */}
                  <button
                    onClick={() => openAddDialog(stage.value)}
                    className="w-full border border-dashed border-border rounded-lg p-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    + Add lead
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
              <DialogDescription>
                {editingLead ? 'Update lead information' : 'Add a new lead to your pipeline'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Name *</Label>
                <Input id="lead-name" placeholder="John Doe" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-email">Email</Label>
                  <Input id="lead-email" type="email" placeholder="john@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-company">Company</Label>
                  <Input id="lead-company" placeholder="Acme Inc" value={formCompany} onChange={(e) => setFormCompany(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={formStage} onValueChange={(v) => setFormStage(v as StageValue)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-deal">Deal Value ($)</Label>
                  <Input id="lead-deal" type="number" placeholder="5000" value={formDealValue} onChange={(e) => setFormDealValue(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-notes">Notes</Label>
                <Textarea id="lead-notes" placeholder="Additional notes..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : editingLead ? 'Update Lead' : 'Add Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
