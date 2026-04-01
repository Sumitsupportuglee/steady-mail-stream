import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Sparkles, Loader2, Wand2, RefreshCw, Zap } from 'lucide-react';

interface AIEmailWriterProps {
  onApply: (subject: string, bodyHtml: string) => void;
  existingSubject?: string;
  existingBody?: string;
}

const TONES = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'sales', label: 'Sales', emoji: '🎯' },
  { value: 'casual', label: 'Casual', emoji: '✌️' },
  { value: 'formal', label: 'Formal', emoji: '🎩' },
  { value: 'witty', label: 'Witty', emoji: '✨' },
];

const PURPOSES = [
  { value: 'cold_outreach', label: 'Cold Outreach', description: 'First contact with a prospect' },
  { value: 'follow_up', label: 'Follow Up', description: 'Following up on a previous interaction' },
  { value: 'newsletter', label: 'Newsletter', description: 'Informational update or digest' },
  { value: 'announcement', label: 'Announcement', description: 'Share news or launch' },
  { value: 'thank_you', label: 'Thank You', description: 'Express appreciation' },
  { value: 'meeting_request', label: 'Meeting Request', description: 'Schedule a call or meeting' },
  { value: 'promotion', label: 'Promotion', description: 'Promote an offer or deal' },
];

export function AIEmailWriter({ onApply, existingSubject, existingBody }: AIEmailWriterProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('professional');
  const [purpose, setPurpose] = useState('cold_outreach');
  const [senderName, setSenderName] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const hasExistingContent = !!(existingSubject?.trim() || existingBody?.trim());

  const handleGenerate = async (action: 'generate' | 'rewrite' | 'improve' = 'generate') => {
    if (action === 'generate' && !prompt.trim()) {
      toast({ title: 'Please describe what you want', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-write-email', {
        body: {
          prompt: prompt.trim(),
          tone,
          purpose,
          senderName: senderName.trim() || undefined,
          existingSubject: action !== 'generate' ? (existingSubject || generatedSubject) : undefined,
          existingBody: action !== 'generate' ? (existingBody || generatedBody) : undefined,
          action,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate email');

      setGeneratedSubject(data.email.subject);
      setGeneratedBody(data.email.body);
      setHasGenerated(true);

      toast({ title: 'Email generated!', description: 'Review and apply it to your campaign.' });
    } catch (err: any) {
      toast({
        title: 'Generation failed',
        description: err.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    onApply(generatedSubject, generatedBody);
    setOpen(false);
    setHasGenerated(false);
    setPrompt('');
    toast({ title: 'Applied!', description: 'AI-generated email applied to your campaign.' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          Write with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Email Writer
          </DialogTitle>
          <DialogDescription>
            Describe what you want and let AI craft a high-converting email for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">What should this email be about?</Label>
            <Textarea
              id="ai-prompt"
              placeholder="e.g. Introduce our new SaaS product to marketing managers. Highlight the 14-day free trial and 3x ROI guarantee..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Options row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sender name */}
          <div className="space-y-2">
            <Label htmlFor="sender-name">Your Name (optional)</Label>
            <Input
              id="sender-name"
              placeholder="e.g. John Smith"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleGenerate('generate')} disabled={loading || !prompt.trim()} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Generate Email
            </Button>
            {hasExistingContent && (
              <>
                <Button variant="outline" onClick={() => handleGenerate('rewrite')} disabled={loading} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Rewrite Current
                </Button>
                <Button variant="outline" onClick={() => handleGenerate('improve')} disabled={loading || !prompt.trim()} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Improve Current
                </Button>
              </>
            )}
          </div>

          {/* Preview */}
          {hasGenerated && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Generated
                </Badge>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Input
                  value={generatedSubject}
                  onChange={(e) => setGeneratedSubject(e.target.value)}
                  className="font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Body</Label>
                <div
                  className="rounded-md border bg-background p-3 prose prose-sm max-w-none text-sm min-h-[120px]"
                  dangerouslySetInnerHTML={{ __html: generatedBody }}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleApply} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Apply to Campaign
                </Button>
                <Button variant="outline" onClick={() => handleGenerate('generate')} disabled={loading} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
