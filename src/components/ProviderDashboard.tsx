import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle, XCircle, Clock, Calendar, Briefcase, User, IndianRupee, Power, Loader2, TrendingUp, Star, MapPin, MessageSquare, Navigation, Phone, Sparkles, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import MapComponent from './Map';
import toast from 'react-hot-toast';
import { aiService } from '../services/aiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Booking {
  id: string;
  customerId: string;
  customerName?: string;
  category: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  startTime: any;
  totalPrice: number;
}

export default function ProviderDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providerProfile, setProviderProfile] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingBooking, setTrackingBooking] = useState<Booking | null>(null);
  const [customerLocation, setCustomerLocation] = useState<any>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newDateTime, setNewDateTime] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [fetchingRoute, setFetchingRoute] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      setUserData(snapshot.data());
    });

    // Fetch Provider Profile
    const fetchProfile = async () => {
      const q = query(collection(db, 'providers'), where('uid', '==', auth.currentUser!.uid));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setProviderProfile({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    };
    fetchProfile();

    // Fetch Reviews
    const reviewsQuery = query(collection(db, 'reviews'), where('providerId', '==', auth.currentUser.uid));
    const unsubscribeReviews = onSnapshot(reviewsQuery, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(data);

      // AI Sentiment Analysis for new reviews without sentiment
      data.forEach(async (review) => {
        if (review.comment && !review.sentiment) {
          try {
            const analysis = await aiService.analyzeSentiment(review.comment);
            await updateDoc(doc(db, 'reviews', review.id), { sentiment: analysis.sentiment });
          } catch (error) {
            console.error("Sentiment analysis failed", error);
          }
        }
      });
    });

    return () => {
      unsubscribeUser();
      unsubscribeReviews();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    let q;
    if (userData?.role === 'admin') {
      q = query(collection(db, 'bookings'));
    } else {
      q = query(collection(db, 'bookings'), where('providerId', '==', auth.currentUser.uid));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(data.sort((a, b) => b.startTime?.seconds - a.startTime?.seconds));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));

    return () => {
      unsubscribe();
    };
  }, [userData?.role]);

  useEffect(() => {
    if (trackingBooking && customerLocation && userData?.location) {
      const fetchRoute = async () => {
        setFetchingRoute(true);
        try {
          const route = await aiService.optimizeRoute(
            `${userData.location.lat},${userData.location.lng}`,
            `${customerLocation.lat},${customerLocation.lng}`
          );
          setOptimizedRoute(route);
        } catch (error) {
          console.error("Route optimization failed", error);
        } finally {
          setFetchingRoute(false);
        }
      };
      fetchRoute();
    } else {
      setOptimizedRoute(null);
    }
  }, [trackingBooking, customerLocation, userData?.location]);

  useEffect(() => {
    if (trackingBooking) {
      const unsubscribeCustomer = onSnapshot(doc(db, 'users', trackingBooking.customerId), (snapshot) => {
        const data = snapshot.data();
        if (data?.location) {
          setCustomerLocation(data.location);
        }
        if (data?.phoneNumber) {
          setCustomerPhone(data.phoneNumber);
        }
      });
      return () => unsubscribeCustomer();
    } else {
      setCustomerLocation(null);
      setCustomerPhone(null);
    }
  }, [trackingBooking]);

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      toast.success(`Booking marked as ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bookings');
      toast.error('Failed to update booking status');
    }
  };

  const handleAdjustBooking = async () => {
    if (!selectedBooking || !newDateTime) return;
    setAdjusting(true);
    try {
      const dateObj = new Date(newDateTime);
      await updateDoc(doc(db, 'bookings', selectedBooking.id), {
        startTime: dateObj,
        status: 'confirmed',
        updatedAt: serverTimestamp()
      });
      toast.success('Booking time adjusted!');
      setSelectedBooking(null);
      setNewDateTime('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${selectedBooking.id}`);
      toast.error('Failed to adjust booking');
    } finally {
      setAdjusting(false);
    }
  };

  const toggleAvailability = async () => {
    if (!providerProfile) return;
    try {
      const newStatus = !providerProfile.availability;
      await updateDoc(doc(db, 'providers', providerProfile.id), { availability: newStatus });
      setProviderProfile({ ...providerProfile, availability: newStatus });
      toast.success(newStatus ? 'You are now online!' : 'You are now offline.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'providers');
      toast.error('Failed to update availability');
    }
  };

  const startJourney = (booking: Booking) => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported');
      return;
    }

    setIsSharingLocation(true);
    const id = navigator.geolocation.watchPosition(
      async (position) => {
        const user = auth.currentUser;
        if (!user) return;

        const { latitude, longitude } = position.coords;
        try {
          await setDoc(doc(db, 'tracking', booking.id), {
            bookingId: booking.id,
            providerId: user.uid,
            customerId: booking.customerId,
            providerName: userData?.displayName || 'Provider',
            providerPhone: userData?.phoneNumber || '',
            lat: latitude,
            lng: longitude,
            updatedAt: serverTimestamp()
          });
          await updateDoc(doc(db, 'bookings', booking.id), { isTracking: true });
        } catch (error) {
          console.error('Error updating tracking:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Failed to share location');
        stopJourney(booking.id);
      },
      { enableHighAccuracy: true }
    );
    setWatchId(id);
    toast.success('Journey started! Sharing live location.');
  };

  const stopJourney = async (bookingId: string) => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsSharingLocation(false);
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { isTracking: false });
      toast.success('Journey ended.');
    } catch (error) {
      console.error('Error stopping tracking:', error);
    }
  };

  const handleNavigate = async (customerId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', customerId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data?.location?.lat && data?.location?.lng) {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${data.location.lat},${data.location.lng}`, '_blank');
        } else {
          toast.error("Customer location not available");
        }
      }
    } catch (error) {
      console.error('Error fetching customer location:', error);
      toast.error('Failed to open navigation');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-10">
      {/* Subscription Banner */}
      {userData && (!userData.subscriptionPlan || userData.subscriptionPlan === 'prov_basic') && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-2xl shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
              <TrendingUp className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Upgrade to Professional</h3>
              <p className="text-purple-100 text-sm">Get featured in search, lower commission, and priority matching with customers.</p>
            </div>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'subscription' }))}
            className="px-6 py-2 bg-white text-purple-600 rounded-xl font-bold hover:bg-purple-50 transition-all whitespace-nowrap"
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Availability Toggle */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
            providerProfile?.availability ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          )}>
            <Power size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your Availability</h2>
            <p className="text-sm text-slate-500">
              {providerProfile?.availability ? "You are currently visible to customers." : "You are currently hidden from search."}
            </p>
          </div>
        </div>
        <button
          onClick={toggleAvailability}
          className={cn(
            "px-6 py-2 rounded-xl font-bold transition-all",
            providerProfile?.availability 
              ? "bg-red-500 text-white hover:bg-red-600" 
              : "bg-green-500 text-white hover:bg-green-600"
          )}
        >
          {providerProfile?.availability ? "Go Offline" : "Go Online"}
        </button>
      </div>

      {/* Map Tracking */}
      {trackingBooking && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="text-blue-600" />
              Tracking Customer Location
            </h2>
            <div className="flex items-center gap-4">
              {customerPhone && (
                <a 
                  href={`mobile:${customerPhone}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                >
                  <Phone size={14} />
                  Call Customer
                </a>
              )}
              {customerLocation?.lat && (
                <button 
                  onClick={() => {
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${customerLocation.lat},${customerLocation.lng}`, '_blank');
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  <Navigation size={14} />
                  Open Google Maps
                </button>
              )}
              <button 
                onClick={() => setTrackingBooking(null)}
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                Close Map
              </button>
            </div>
          </div>
          <MapComponent 
            providers={[]} 
            userLocation={customerLocation} 
          />
          
          {/* AI Route Optimization */}
          <AnimatePresence>
            {(fetchingRoute || optimizedRoute) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-blue-50 border border-blue-100 p-4 rounded-2xl overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="text-blue-600" size={16} />
                  <h4 className="text-sm font-bold text-blue-900">AI Route Optimization</h4>
                </div>
                {fetchingRoute ? (
                  <div className="flex items-center gap-2 text-xs text-blue-500">
                    <Loader2 className="animate-spin" size={12} />
                    Calculating fastest route...
                  </div>
                ) : optimizedRoute && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-blue-700">Estimated Time</span>
                      <span className="text-sm font-black text-blue-900">{optimizedRoute.estimatedTime}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Waypoints</p>
                      <div className="flex flex-wrap gap-1">
                        {optimizedRoute.optimizedRoute.map((step: string, i: number) => (
                          <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-blue-100 text-blue-700">
                            {step}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Traffic Tips</p>
                      <ul className="list-disc list-inside text-[10px] text-blue-700/80">
                        {optimizedRoute.tips.map((tip: string, i: number) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {customerLocation?.address && (
            <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="font-bold">Address:</span> {customerLocation.address}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Star className="text-blue-600" size={20} />
            </div>
            <span className="text-sm font-bold text-slate-500">Rating</span>
          </div>
          <p className="text-3xl font-black text-slate-900">{providerProfile?.rating?.toFixed(1) || '0.0'}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center">
              <CheckCircle className="text-green-600" size={20} />
            </div>
            <span className="text-sm font-bold text-slate-500">Completion</span>
          </div>
          <p className="text-3xl font-black text-slate-900">{providerProfile?.completionRate || '100'}%</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center">
              <Clock className="text-purple-600" size={20} />
            </div>
            <span className="text-sm font-bold text-slate-500">Response</span>
          </div>
          <p className="text-3xl font-black text-slate-900">{providerProfile?.responseTime || '15'}m</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center">
              <TrendingUp className="text-orange-600" size={20} />
            </div>
            <span className="text-sm font-bold text-slate-500">Earnings</span>
          </div>
          <p className="text-3xl font-black text-slate-900">₹{bookings.filter(b => b.status === 'completed').reduce((acc, b) => acc + b.totalPrice, 0)}</p>
        </div>
      </div>
        {/* Incoming Bookings */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-blue-600" />
            Incoming Bookings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').map((b) => (
              <div key={b.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Customer ID: {b.customerId.slice(-6)}</h3>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{b.category}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                    b.status === 'confirmed' ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                  )}>
                    {b.status}
                  </span>
                </div>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={14} className="text-slate-400" />
                    {b.startTime?.toDate().toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <IndianRupee size={14} className="text-slate-400" />
                    ₹{b.totalPrice}
                  </div>
                </div>

                 <div className="flex gap-2">
                  {b.status === 'pending' && (
                    <button
                      onClick={() => handleStatusUpdate(b.id, 'confirmed')}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm"
                    >
                      Accept
                    </button>
                  )}
                  {b.status === 'confirmed' && (
                    <>
                      {!isSharingLocation ? (
                        <button
                          onClick={() => startJourney(b)}
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2 neo-button"
                        >
                          <Navigation size={14} />
                          Start Journey
                        </button>
                      ) : (
                        <button
                          onClick={() => stopJourney(b.id)}
                          className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors text-sm flex items-center justify-center gap-2 neo-button"
                        >
                          <XCircle size={14} />
                          Stop Journey
                        </button>
                      )}
                      <button
                        onClick={() => setTrackingBooking(b)}
                        className="flex-1 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <MapPin size={14} />
                        Track
                      </button>
                      <button
                        onClick={() => handleNavigate(b.customerId)}
                        className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <Navigation size={14} />
                        Navigate
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(b.id, 'completed')}
                        className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors text-sm"
                      >
                        Complete
                      </button>
                      {(b as any).customerPhone && (
                        <a
                          href={`mobile:${(b as any).customerPhone}`}
                          className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg font-bold hover:bg-green-100 transition-colors text-sm flex items-center justify-center gap-2"
                        >
                          <Phone size={14} />
                          Call
                        </a>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => handleStatusUpdate(b.id, 'cancelled')}
                    className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-red-50 hover:text-red-600 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setSelectedBooking(b)}
                    className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors text-sm"
                  >
                    Adjust
                  </button>
                </div>
              </div>
            ))}
            {bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <p>No active bookings at the moment.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent History & Reviews */}
        <div className="space-y-10">
          {/* Reviews Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="text-blue-600" />
              Recent Reviews
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="divide-y divide-slate-50">
                {reviews.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No reviews yet.
                  </div>
                ) : (
                  reviews.slice(0, 5).map((r) => (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">{r.userName}</span>
                        <div className="flex items-center gap-2">
                          {r.sentiment && (
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                              r.sentiment === 'positive' ? "bg-green-50 text-green-600" :
                              r.sentiment === 'negative' ? "bg-red-50 text-red-600" :
                              "bg-slate-50 text-slate-600"
                            )}>
                              {r.sentiment === 'positive' ? <ThumbsUp size={10} /> :
                               r.sentiment === 'negative' ? <ThumbsDown size={10} /> :
                               <Minus size={10} />}
                              {r.sentiment.toUpperCase()}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold">
                            <Star size={12} fill="currentColor" />
                            {r.rating}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 italic">"{r.comment || 'No comment provided'}"</p>
                      <p className="text-[10px] text-slate-400">{r.createdAt?.toDate().toLocaleDateString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="text-blue-600" />
              Recent History
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="divide-y divide-slate-50">
                {bookings.filter(b => b.status === 'completed' || b.status === 'cancelled').slice(0, 5).map((b) => (
                  <div key={b.id} className="p-4 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Booking #{b.id.slice(-4)}</h4>
                      <p className="text-xs text-slate-500">{b.startTime?.toDate().toLocaleDateString()}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                      b.status === 'completed' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {b.status}
                    </span>
                  </div>
                ))}
                {bookings.filter(b => b.status === 'completed' || b.status === 'cancelled').length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No history yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Booking Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Adjust Booking</h3>
            <p className="text-sm text-slate-500 mb-6">
              Propose a new date and time for this booking.
            </p>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">New Date & Time</label>
                <input
                  type="datetime-local"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedBooking(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjustBooking}
                disabled={adjusting || !newDateTime}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {adjusting ? <Loader2 className="animate-spin" size={20} /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
