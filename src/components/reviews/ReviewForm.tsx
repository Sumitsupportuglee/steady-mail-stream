import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Star, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function ReviewForm() {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [existingReview, setExistingReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (user) fetchExistingReview();
  }, [user]);

  const fetchExistingReview = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) {
      setExistingReview(data);
      setRating(data.rating);
      setReviewText(data.review_text);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!rating || !reviewText.trim()) {
      toast.error('Please provide both a rating and review text');
      return;
    }
    setSubmitting(true);
    try {
      if (existingReview) {
        const { error } = await supabase
          .from('reviews')
          .update({ rating, review_text: reviewText.trim() })
          .eq('id', existingReview.id);
        if (error) throw error;
        toast.success('Review updated!');
      } else {
        const { error } = await supabase
          .from('reviews')
          .insert({
            user_id: user!.id,
            user_email: user!.email!,
            rating,
            review_text: reviewText.trim(),
          });
        if (error) throw error;
        toast.success('Review submitted!');
      }
      setEditing(false);
      await fetchExistingReview();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingReview) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', existingReview.id);
      if (error) throw error;
      setExistingReview(null);
      setRating(0);
      setReviewText('');
      setEditing(false);
      toast.success('Review deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const StarRow = ({ interactive = true }: { interactive?: boolean }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && setRating(star)}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className="disabled:cursor-default"
        >
          <Star
            className={`h-6 w-6 transition-colors ${
              star <= (hoverRating || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );

  // Show existing review in read mode
  if (existingReview && !editing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Your Review</CardTitle>
              <CardDescription>Submitted on {new Date(existingReview.created_at).toLocaleDateString()}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete} disabled={submitting}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <StarRow interactive={false} />
          <p className="mt-3 text-sm text-muted-foreground">{existingReview.review_text}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{existingReview ? 'Edit Your Review' : 'Leave a Review'}</CardTitle>
        <CardDescription>Share your experience with Senddot</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Rating</label>
          <StarRow />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Your Review</label>
          <Textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Tell us what you think about Senddot..."
            rows={4}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {existingReview ? 'Update Review' : 'Submit Review'}
          </Button>
          {editing && (
            <Button variant="ghost" onClick={() => { setEditing(false); setRating(existingReview.rating); setReviewText(existingReview.review_text); }}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
