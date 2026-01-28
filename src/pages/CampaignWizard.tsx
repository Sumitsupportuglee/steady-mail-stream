import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
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
}

interface SenderIdentity {
  id: string;
  from_name: string;
  from_email: string;
  domain_status: 'unverified' | 'verified';
}

type WizardStep = 1 | 2 | 3;

export default function CampaignWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Compose
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  // Step 2: Audience
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [audienceType, setAudienceType] = useState<'all' | 'selected'>('all');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [contactsRes, identitiesRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, email, name')
          .eq('user_id', user!.id)
          .eq('status', 'active'),
        supabase
          .from('sender_identities')
          .select('id, from_name, from_email, domain_status')
          .eq('user_id', user!.id),
      ]);

      if (contactsRes.error) throw contactsRes.error;
      if (identitiesRes.error) throw identitiesRes.error;

      setContacts(contactsRes.data || []);
      setIdentities(identitiesRes.data || []);
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

  const getRecipientCount = () => {
    if (audienceType === 'all') return contacts.length;
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

  const canProceedToStep2 = subject.trim() !== '' && bodyHtml.trim() !== '';
  const canProceedToStep3 = selectedIdentity !== '' && getRecipientCount() > 0;

  const handleQueueCampaign = async () => {
    setIsSubmitting(true);

    try {
      const identity = identities.find(i => i.id === selectedIdentity);
      if (!identity) throw new Error('No sender identity selected');

      const recipients = audienceType === 'all' 
        ? contacts 
        : contacts.filter(c => selectedContacts.has(c.id));

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          user_id: user!.id,
          sender_identity_id: selectedIdentity,
          subject,
          body_html: bodyHtml,
          status: 'queued',
          recipient_count: recipients.length,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Create email queue entries
      const queueEntries = recipients.map(contact => {
        // Replace template variables
        let personalizedBody = bodyHtml
          .replace(/\{\{name\}\}/gi, contact.name || 'there')
          .replace(/\{\{email\}\}/gi, contact.email);

        return {
          user_id: user!.id,
          campaign_id: campaign.id,
          contact_id: contact.id,
          from_email: identity.from_email,
          to_email: contact.email,
          subject,
          body: personalizedBody,
          status: 'pending' as const,
        };
      });

      // Batch insert in chunks of 100
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

              <div className="space-y-4">
                <Label>Recipients</Label>
                <div className="flex gap-4">
                  <Button
                    variant={audienceType === 'all' ? 'default' : 'outline'}
                    onClick={() => setAudienceType('all')}
                    className="flex-1"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    All Active Contacts ({contacts.length})
                  </Button>
                  <Button
                    variant={audienceType === 'selected' ? 'default' : 'outline'}
                    onClick={() => setAudienceType('selected')}
                    className="flex-1"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Select Specific ({selectedContacts.size})
                  </Button>
                </div>

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
