import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { AIEmailWriter } from '@/components/email/AIEmailWriter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useClient } from '@/contexts/ClientContext';
import { 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  Loader2, 
  Mail,
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Contact {
  id: string;
  email: string;
  name: string | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string | null;
}

interface SenderIdentity {
  id: string;
  from_name: string;
  from_email: string;
  domain_status: 'unverified' | 'verified';
}

interface SmtpAccount {
  id: string;
  label: string;
  smtp_username: string;
  smtp_host: string;
  is_default: boolean;
  daily_send_limit?: number;
  hourly_send_limit?: number;
  emails_sent_today?: number;
  emails_sent_this_hour?: number;
  is_active?: boolean;
  sender_identity_id?: string | null;
}

type WizardStep = 1 | 2 | 3;

export default function CampaignWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeClientId } = useClient();
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Compose
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  // Step 2: Audience
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [selectedSmtp, setSelectedSmtp] = useState('');
  const [smtpMode, setSmtpMode] = useState<'single' | 'rotation'>('single');
  const [smtpPool, setSmtpPool] = useState<Set<string>>(new Set());
  // Per-SMTP sender identity override for rotation mode (smtpId -> identityId)
  const [smtpIdentityOverrides, setSmtpIdentityOverrides] = useState<Record<string, string>>({});
  const [audienceType, setAudienceType] = useState<'all' | 'category' | 'selected'>('all');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      let contactsQuery = supabase
        .from('contacts')
        .select('id, email, name, category_id')
        .eq('user_id', user!.id)
        .eq('status', 'active');
      if (activeClientId) contactsQuery = contactsQuery.eq('client_id', activeClientId);

      let identitiesQuery = supabase
        .from('sender_identities')
        .select('id, from_name, from_email, domain_status')
        .eq('user_id', user!.id);
      if (activeClientId) identitiesQuery = identitiesQuery.eq('client_id', activeClientId);

      const smtpQuery = supabase
        .from('smtp_accounts' as any)
        .select('id, label, smtp_username, smtp_host, is_default, daily_send_limit, hourly_send_limit, emails_sent_today, emails_sent_this_hour, is_active, sender_identity_id')
        .eq('user_id', user!.id);

      let categoriesQuery = supabase
        .from('contact_categories')
        .select('id, name, color')
        .eq('user_id', user!.id);
      if (activeClientId) categoriesQuery = categoriesQuery.eq('client_id', activeClientId);

      const [contactsRes, identitiesRes, smtpRes, categoriesRes] = await Promise.all([contactsQuery, identitiesQuery, smtpQuery, categoriesQuery]);

      if (contactsRes.error) throw contactsRes.error;
      if (identitiesRes.error) throw identitiesRes.error;

      setContacts((contactsRes.data as Contact[]) || []);
      setIdentities(identitiesRes.data || []);
      setCategories((categoriesRes.data as Category[]) || []);
      const smtpData = (smtpRes.data as any[]) || [];
      setSmtpAccounts(smtpData);
      // Seed per-SMTP identity overrides from each account's linked identity
      const seeded: Record<string, string> = {};
      smtpData.forEach((s: any) => { if (s.sender_identity_id) seeded[s.id] = s.sender_identity_id; });
      setSmtpIdentityOverrides(seeded);
      // Auto-select default SMTP
      const defaultSmtp = smtpData.find((s: any) => s.is_default);
      if (defaultSmtp) setSelectedSmtp(defaultSmtp.id);
      else if (smtpData.length > 0) setSelectedSmtp(smtpData[0].id);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const contactsInSelectedCategories = () =>
    contacts.filter(c => c.category_id && selectedCategoryIds.has(c.category_id));

  const getRecipientCount = () => {
    if (audienceType === 'all') return contacts.length;
    if (audienceType === 'category') return contactsInSelectedCategories().length;
    return selectedContacts.size;
  };

  const toggleContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  const toggleCategory = (id: string) => {
    const next = new Set(selectedCategoryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCategoryIds(next);
  };

  const recipientCount = getRecipientCount();
  const shouldUseRotation = recipientCount > 100;
  const poolList = smtpAccounts.filter(a => smtpPool.has(a.id) && (a.is_active ?? true));
  const poolDailyCapacity = poolList.reduce((s, a) => s + Math.max(0, (a.daily_send_limit ?? 300) - (a.emails_sent_today ?? 0)), 0);
  const poolHourlyCapacity = poolList.reduce((s, a) => s + Math.max(0, (a.hourly_send_limit ?? 50) - (a.emails_sent_this_hour ?? 0)), 0);

  const canProceedToStep2 = subject.trim() !== '' && bodyHtml.trim() !== '';
  // Effective identity per SMTP = override (if set) || account's linked identity
  const effectiveIdentityFor = (smtpId: string) =>
    smtpIdentityOverrides[smtpId] || smtpAccounts.find(a => a.id === smtpId)?.sender_identity_id || '';
  const poolMissingIdentity = poolList.filter(a => !effectiveIdentityFor(a.id));
  const canProceedToStep3 =
    recipientCount > 0 &&
    (smtpMode === 'single'
      ? selectedIdentity !== '' && selectedSmtp !== ''
      : poolList.length >= 2 && poolMissingIdentity.length === 0);

  const togglePool = (id: string) => {
    const next = new Set(smtpPool);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSmtpPool(next);
  };

  // Auto-suggest rotation mode when recipient count crosses threshold
  useEffect(() => {
    if (shouldUseRotation && smtpMode === 'single' && smtpAccounts.length >= 2) {
      setSmtpMode('rotation');
      // Pre-fill pool with active accounts that already have a linked identity
      setSmtpPool(new Set(
        smtpAccounts
          .filter(a => (a.is_active ?? true) && a.sender_identity_id)
          .map(a => a.id)
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldUseRotation, smtpAccounts.length]);

  const handleQueueCampaign = async () => {
    setIsSubmitting(true);

    try {
      const useRotation = smtpMode === 'rotation' && poolList.length >= 2;

      // Resolve sender identity:
      //  - single mode: the user-picked identity (existing behavior)
      //  - rotation mode: each SMTP account uses ITS OWN linked identity
      //    (required to satisfy "Sender address rejected: not owned by user")
      const identityById = new Map(identities.map(i => [i.id, i] as const));
      const fallbackIdentity = identities.find(i => i.id === selectedIdentity)
        ?? (useRotation ? identityById.get(poolList[0]?.sender_identity_id || '') : undefined);
      if (!fallbackIdentity) throw new Error('No sender identity available');

      const allRecipients = audienceType === 'all'
        ? contacts
        : audienceType === 'category'
          ? contactsInSelectedCategories()
          : contacts.filter(c => selectedContacts.has(c.id));

      const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      const recipients = allRecipients.filter(c => EMAIL_RX.test(c.email.trim()));
      const skipped = allRecipients.length - recipients.length;
      if (skipped > 0) {
        toast({
          title: `Skipped ${skipped} invalid address${skipped === 1 ? '' : 'es'}`,
          description: 'These contacts had malformed emails and were excluded.',
        });
      }
      if (recipients.length === 0) {
        throw new Error('No valid recipients after filtering');
      }

      const poolIds = useRotation ? poolList.map(a => a.id) : null;

      // Create campaign — store fallback identity (used by single-mode and as
      // a safety fallback). In rotation mode the queue processor overrides
      // From per-email using the SMTP account's linked identity.
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          user_id: user!.id,
          sender_identity_id: fallbackIdentity.id,
          subject,
          body_html: bodyHtml,
          status: 'queued',
          recipient_count: recipients.length,
          client_id: activeClientId,
          smtp_rotation_pool: poolIds,
        } as any)
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Smoothing: spread sends across time so we never spike. Pace by the
      // pool's combined hourly capacity (or single account's hourly limit).
      const totalHourly = useRotation
        ? poolList.reduce((s, a) => s + (a.hourly_send_limit ?? 50), 0)
        : (smtpAccounts.find(a => a.id === selectedSmtp)?.hourly_send_limit ?? 50);
      // ms between sends to stay under hourly cap
      const intervalMs = totalHourly > 0 ? Math.ceil((60 * 60 * 1000) / totalHourly) : 0;
      const startTime = Date.now();

      // Round-robin assignment across the pool (single mode → always same account)
      const queueEntries = recipients.map((contact, idx) => {
        const personalizedBody = bodyHtml
          .replace(/\{\{name\}\}/gi, contact.name || 'there')
          .replace(/\{\{email\}\}/gi, contact.email);

        const smtpAccountId = useRotation
          ? poolIds![idx % poolIds!.length]
          : (selectedSmtp || null);

        // Per-email From: rotation mode uses each SMTP's linked identity so
        // the SMTP login is authorized to send From that address.
        let fromEmailForRow = fallbackIdentity.from_email;
        if (useRotation && smtpAccountId) {
          const smtp = smtpAccounts.find(a => a.id === smtpAccountId);
          const linked = smtp?.sender_identity_id ? identityById.get(smtp.sender_identity_id) : undefined;
          if (linked) fromEmailForRow = linked.from_email;
        }

        // Spread schedule. First batch sends immediately (scheduled_for = null).
        const scheduledFor = idx < (totalHourly || 50)
          ? null
          : new Date(startTime + idx * intervalMs).toISOString();

        return {
          user_id: user!.id,
          campaign_id: campaign.id,
          contact_id: contact.id,
          from_email: fromEmailForRow,
          to_email: contact.email,
          subject,
          body: personalizedBody,
          status: 'pending' as const,
          smtp_account_id: smtpAccountId,
          scheduled_for: scheduledFor,
        } as any;
      });

      const batchSize = 100;
      for (let i = 0; i < queueEntries.length; i += batchSize) {
        const batch = queueEntries.slice(i, i + batchSize);
        const { error } = await supabase.from('email_queue').insert(batch);
        if (error) throw error;
      }

      toast({
        title: 'Campaign Queued!',
        description: 'Sending will start automatically.',
      });

      navigate('/campaigns');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to queue campaign',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Campaign</h1>
            <p className="text-muted-foreground mt-1">
              Create and send your email campaign
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div 
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s === step 
                    ? 'bg-primary text-primary-foreground' 
                    : s < step 
                      ? 'bg-green-500 text-white'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {s < step ? <CheckCircle className="h-5 w-5" /> : s}
              </div>
              <span className={`text-sm ${s === step ? 'font-medium' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Compose' : s === 2 ? 'Audience' : 'Review'}
              </span>
              {s < 3 && <div className="w-16 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Compose */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Compose Your Email</CardTitle>
              <CardDescription>
                Write your subject line and email body. Use {"{{name}}"} and {"{{email}}"} for personalization.
              </CardDescription>
              <div className="pt-2">
                <AIEmailWriter
                  existingSubject={subject}
                  existingBody={bodyHtml}
                  onApply={(s, b) => {
                    setSubject(s);
                    setBodyHtml(b);
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Enter your email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Body</Label>
                <TipTapEditor
                  content={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Write your email content here..."
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!canProceedToStep2}>
                  Next: Select Audience
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Select Your Audience</CardTitle>
              <CardDescription>
                Choose who will receive this campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {smtpMode === 'single' && (
                <div className="space-y-2">
                  <Label>Sender Identity</Label>
                  <Select value={selectedIdentity} onValueChange={setSelectedIdentity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sender identity" />
                    </SelectTrigger>
                    <SelectContent>
                      {identities.map((identity) => (
                        <SelectItem
                          key={identity.id}
                          value={identity.id}
                          disabled={identity.domain_status === 'unverified'}
                        >
                          <div className="flex items-center gap-2">
                            <span>{identity.from_name} &lt;{identity.from_email}&gt;</span>
                            {identity.domain_status === 'unverified' && (
                              <Badge variant="secondary" className="text-xs">Unverified</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {identities.length === 0 && (
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      You need to add a sender identity first
                    </p>
                  )}
                </div>
              )}
              {smtpMode === 'rotation' && (
                <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
                  In rotation mode, each email is sent From the identity linked to the SMTP account that delivers it. Manage these links in Settings → SMTP Accounts.
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>SMTP Sending</Label>
                  {smtpAccounts.length >= 2 && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={smtpMode === 'single' ? 'default' : 'outline'}
                        onClick={() => setSmtpMode('single')}
                      >
                        Single account
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={smtpMode === 'rotation' ? 'default' : 'outline'}
                        onClick={() => setSmtpMode('rotation')}
                      >
                        Rotation pool
                      </Button>
                    </div>
                  )}
                </div>

                {shouldUseRotation && smtpMode === 'single' && smtpAccounts.length >= 2 && (
                  <p className="text-xs text-amber-600 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    You have {recipientCount} recipients. Rotation pool is recommended for sends over 100 to avoid hitting per-account limits.
                  </p>
                )}

                {smtpMode === 'single' ? (
                  <Select value={selectedSmtp} onValueChange={setSelectedSmtp}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select SMTP account" />
                    </SelectTrigger>
                    <SelectContent>
                      {smtpAccounts.map((acct) => (
                        <SelectItem key={acct.id} value={acct.id}>
                          {acct.label} ({acct.smtp_username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-auto">
                    {smtpAccounts.map((acct) => {
                      const dailyLeft = Math.max(0, (acct.daily_send_limit ?? 300) - (acct.emails_sent_today ?? 0));
                      const isInactive = acct.is_active === false;
                      const linked = acct.sender_identity_id
                        ? identities.find(i => i.id === acct.sender_identity_id)
                        : undefined;
                      const noIdentity = !linked;
                      const disabled = isInactive || noIdentity;
                      return (
                        <div key={acct.id} className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 ${disabled ? 'opacity-60' : ''}`}>
                          <Checkbox
                            checked={smtpPool.has(acct.id)}
                            onCheckedChange={() => togglePool(acct.id)}
                            disabled={disabled}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{acct.label}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {acct.smtp_username}
                              {linked && (
                                <span className="ml-1">→ sends as <span className="text-foreground">{linked.from_email}</span></span>
                              )}
                            </div>
                            {noIdentity && (
                              <div className="text-xs text-destructive mt-0.5">No linked identity — add one in Settings → SMTP Accounts</div>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs">{dailyLeft} left today</Badge>
                        </div>
                      );
                    })}
                    {poolList.length >= 2 && (
                      <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
                        Pool capacity: <strong className="text-foreground">{poolDailyCapacity}</strong>/day · <strong className="text-foreground">{poolHourlyCapacity}</strong>/hour
                        {recipientCount > poolDailyCapacity && (
                          <span className="text-amber-600 ml-2">· Will take ~{Math.ceil(recipientCount / Math.max(1, poolDailyCapacity))} day(s) to finish</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {smtpAccounts.length === 0 && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Add an SMTP account in Settings first
                  </p>
                )}
                {smtpMode === 'rotation' && poolList.length < 2 && smtpAccounts.length >= 2 && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Select at least 2 accounts for rotation
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <Label>Recipients</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button
                    variant={audienceType === 'all' ? 'default' : 'outline'}
                    onClick={() => setAudienceType('all')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    All Active ({contacts.length})
                  </Button>
                  <Button
                    variant={audienceType === 'category' ? 'default' : 'outline'}
                    onClick={() => setAudienceType('category')}
                    disabled={categories.length === 0}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    By Category ({contactsInSelectedCategories().length})
                  </Button>
                  <Button
                    variant={audienceType === 'selected' ? 'default' : 'outline'}
                    onClick={() => setAudienceType('selected')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Specific ({selectedContacts.size})
                  </Button>
                </div>

                {audienceType === 'category' && (
                  <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-auto">
                    {categories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No categories yet. Create categories in the Contacts page.
                      </p>
                    ) : (
                      categories.map((cat) => {
                        const count = contacts.filter(c => c.category_id === cat.id).length;
                        return (
                          <div key={cat.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                            <Checkbox
                              checked={selectedCategoryIds.has(cat.id)}
                              onCheckedChange={() => toggleCategory(cat.id)}
                            />
                            <span
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ backgroundColor: cat.color || '#3b82f6' }}
                            />
                            <div className="flex-1 font-medium">{cat.name}</div>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {audienceType === 'selected' && (
                  <div className="border rounded-lg max-h-64 overflow-auto">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleContact(contact.id)}
                        />
                        <div>
                          <div className="font-medium">{contact.name || contact.email}</div>
                          {contact.name && (
                            <div className="text-sm text-muted-foreground">{contact.email}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedToStep3}>
                  Next: Review
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review & Queue Campaign</CardTitle>
              <CardDescription>
                Review your campaign before sending
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Subject</div>
                    <div className="font-medium mt-1">{subject}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="font-medium mt-1">
                      {identities.find(i => i.id === selectedIdentity)?.from_name}
                      {' <'}
                      {identities.find(i => i.id === selectedIdentity)?.from_email}
                      {'>'}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Sending</div>
                    <div className="font-medium mt-1">
                      {smtpMode === 'rotation' && poolList.length >= 2
                        ? `Rotation pool · ${poolList.length} accounts (${poolDailyCapacity}/day)`
                        : (smtpAccounts.find(s => s.id === selectedSmtp)?.label || 'Not selected')}
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Recipients</div>
                    <div className="font-medium mt-1 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {getRecipientCount()} contacts
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="text-sm text-muted-foreground mb-2">Preview</div>
                  <div 
                    className="prose prose-sm max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-4 flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Ready to send</div>
                  <div className="text-sm text-muted-foreground">
                    This campaign will be queued for immediate delivery
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleQueueCampaign} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Queuing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Queue Campaign
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
