import { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { Star, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReviewModalProps {
  booking: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewModal({ booking, onClose, onSuccess }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setSubmitting(true);

    try {
      // 1. Add the review
      const reviewData = {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        providerId: booking.providerId,
        rating,
        comment,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'reviews'), reviewData);

      // 2. Update provider's average rating using a transaction
      const providerRef = doc(db, 'providers', booking.providerId);
      
      await runTransaction(db, async (transaction) => {
        const providerDoc = await transaction.get(providerRef);
        if (!providerDoc.exists()) return;

        const currentRating = providerDoc.data().rating || 5;
        const currentReviewCount = providerDoc.data().reviewCount || 0;
        
        const newReviewCount = currentReviewCount + 1;
        const newRating = ((currentRating * currentReviewCount) + rating) / newReviewCount;

        transaction.update(providerRef, {
          rating: Number(newRating.toFixed(1)),
          reviewCount: newReviewCount
        });
      });

      // 3. Mark booking as reviewed (optional, to hide button)
      await updateDoc(doc(db, 'bookings', booking.id), {
        reviewed: true
      });

      toast.success('Review submitted! Thank you.');
      onSuccess();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reviews');
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Rate your experience</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <p className="text-sm text-slate-500 mb-4">How was your service with {booking.providerName}?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    size={40}
                    className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-slate-200"}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Your Comment (Optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none"
              placeholder="Tell others about the service..."
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
