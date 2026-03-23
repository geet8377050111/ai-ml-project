import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Search, Star, Calendar, Clock, CheckCircle, XCircle, AlertCircle, MapPin, User, Briefcase, IndianRupee, TrendingUp, ThumbsUp, Loader2, Navigation, Phone, Sparkles, ShieldAlert, ShieldCheck } from 'lucide-react';
import MapComponent from './Map';
import ReviewModal from './ReviewModal';
import toast from 'react-hot-toast';
import { aiService, Recommendation, PricePrediction } from '../services/aiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES = ["Electrician", "Maid", "Cook", "Labour", "Painter", "Dancer", "Home Tutor", "Plumber", "Carpenter", "Welder"];

// Haversine formula to calculate distance between two points in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

interface Provider {
  id: string;
  uid: string;
  name: string;
  category: string;
  categories?: string[];
  pricePerHour: number;
  rating: number;
  location?: { lat: number; lng: number; address: string };
  availability: boolean;
  description: string;
  skills: string[];
  experienceLevel: string;
  phoneNumber?: string;
}

interface Booking {
  id: string;
  providerId: string;
  providerName: string;
  category: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  startTime: any;
  endTime: any;
  totalPrice: number;
  reviewed?: boolean;
}

export default function Dashboard({ setView }: { setView: (v: any) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingTime, setBookingTime] = useState<string>("");
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [confirmingProvider, setConfirmingProvider] = useState<Provider | null>(null);
  const [showSimpleConfirm, setShowSimpleConfirm] = useState<Provider | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [liveTracking, setLiveTracking] = useState<any>(null);
  const [activeTrackingId, setActiveTrackingId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [predictedPrice, setPredictedPrice] = useState<PricePrediction | null>(null);
  const [predictingPrice, setPredictingPrice] = useState(false);
  const [hasNotifiedArrival, setHasNotifiedArrival] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribeUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      const data = snapshot.data();
      setUserData(data);
    });

    const providersQuery = query(collection(db, 'providers'), where('availability', '==', true));
    const unsubscribeProviders = onSnapshot(providersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Provider));
      // Simple matching: Sort by rating (descending)
      setProviders(data.sort((a, b) => b.rating - a.rating));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'providers'));

    return () => {
      unsubscribeUser();
      unsubscribeProviders();
    };
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;

    let bookingsQuery;
    if (userData?.role === 'admin') {
      bookingsQuery = query(collection(db, 'bookings'));
    } else {
      bookingsQuery = query(collection(db, 'bookings'), where('customerId', '==', auth.currentUser.uid));
    }

    const unsubscribeBookings = onSnapshot(bookingsQuery, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setBookings(data.sort((a, b) => b.startTime?.seconds - a.startTime?.seconds));
      
      // Fetch AI Recommendations based on history
      if (data.length > 0 && recommendations.length === 0) {
        const history = data.map(b => ({ category: b.category, status: b.status }));
        aiService.getServiceRecommendations(history).then(setRecommendations);
      }

      // Check for active tracking
      const activeTrackingBooking = data.find(b => b.status === 'confirmed' && (b as any).isTracking);
      setActiveTrackingId(activeTrackingBooking?.id || null);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));

    return () => {
      unsubscribeBookings();
    };
  }, [userData?.role]);

  useEffect(() => {
    if (!activeTrackingId || !auth.currentUser) {
      setLiveTracking(null);
      return;
    }

    const unsubscribeTracking = onSnapshot(doc(db, 'tracking', activeTrackingId), (trackSnap) => {
      if (trackSnap.exists()) {
        const trackData = trackSnap.data();
        setLiveTracking(trackData);
        
        // Check distance for notification
        if (userData?.location) {
          const dist = getDistance(
            userData.location.lat, 
            userData.location.lng, 
            trackData.lat, 
            trackData.lng
          );
          
          if (dist < 0.1 && !hasNotifiedArrival.includes(activeTrackingId)) {
            toast.success(`Your service provider ${trackData.providerName} has reached your location!`, {
              duration: 6000,
              icon: '🏠'
            });
            setHasNotifiedArrival(prev => [...prev, activeTrackingId]);
          }
        }
      }
    }, (error) => {
      // Silently handle permission errors for tracking if it's just being created
      if (error.code !== 'permission-denied') {
        console.error('Tracking error:', error);
      }
    });

    return () => unsubscribeTracking();
  }, [activeTrackingId, userData?.location, hasNotifiedArrival]);

  useEffect(() => {
    if (confirmingProvider && bookingTime) {
      const fetchPricePrediction = async () => {
        setPredictingPrice(true);
        try {
          const prediction = await aiService.predictPrice(
            userData?.location?.address || 'New Delhi',
            selectedCategory || confirmingProvider.category,
            new Date(bookingTime).toLocaleString()
          );
          setPredictedPrice(prediction);
        } catch (error) {
          console.error("Price prediction failed", error);
        } finally {
          setPredictingPrice(false);
        }
      };
      fetchPricePrediction();
    } else {
      setPredictedPrice(null);
    }
  }, [confirmingProvider, bookingTime, selectedCategory, userData?.location?.address]);

  const handleBook = (provider: Provider) => {
    if (!auth.currentUser) {
      toast.error("Please login to book a service.");
      return;
    }
    if (!bookingTime) {
      toast.error("Please select a booking time.");
      return;
    }
    setConfirmingProvider(provider);
  };

  const processBooking = async () => {
    if (!confirmingProvider || !auth.currentUser) return;

    setBookingLoading(true);
    try {
      const startTime = new Date(bookingTime);
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

      await addDoc(collection(db, 'bookings'), {
        customerId: auth.currentUser.uid,
        customerName: userData?.displayName || 'Customer',
        customerPhone: userData?.phoneNumber || '',
        providerId: confirmingProvider.uid,
        providerName: confirmingProvider.name,
        providerPhone: confirmingProvider.phoneNumber || '',
        category: selectedCategory || confirmingProvider.category,
        status: 'pending',
        startTime: startTime,
        endTime: endTime,
        totalPrice: confirmingProvider.pricePerHour * 2,
        createdAt: serverTimestamp()
      });
      toast.success(`Booking request sent to ${confirmingProvider.name}!`);
      setBookingTime("");
      setConfirmingProvider(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bookings');
      toast.error("Failed to create booking.");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled'
      });
      toast.success('Booking cancelled successfully.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bookings');
      toast.error('Failed to cancel booking.');
    }
  };

  // Filter providers based on category AND distance (5km)
  const filteredProviders = providers.filter(p => {
    const pCategories = p.categories || (p.category ? [p.category] : []);
    const categoryMatch = selectedCategory ? pCategories.includes(selectedCategory) : true;
    
    // If user location is available, filter by 5km radius
    if (userData?.location?.lat && userData?.location?.lng && p.location?.lat && p.location?.lng) {
      const distance = getDistance(
        userData.location.lat, 
        userData.location.lng, 
        p.location.lat, 
        p.location.lng
      );
      return categoryMatch && distance <= 5;
    }
    
    // If no user location, just filter by category
    return categoryMatch;
  });

  // Combine hardcoded categories with any custom ones from providers
  const allCategories = Array.from(new Set([
    ...CATEGORIES,
    ...providers.flatMap(p => p.categories || (p.category ? [p.category] : []))
  ])).filter(Boolean);

  // Calculate counts for each category (within 5km if location exists)
  const categoryCounts = allCategories.reduce((acc, cat) => {
    acc[cat] = providers.filter(p => {
      const pCategories = p.categories || (p.category ? [p.category] : []);
      const categoryMatch = pCategories.includes(cat);
      if (userData?.location?.lat && userData?.location?.lng && p.location?.lat && p.location?.lng) {
        const distance = getDistance(
          userData.location.lat, 
          userData.location.lng, 
          p.location.lat, 
          p.location.lng
        );
        return categoryMatch && distance <= 5;
      }
      return categoryMatch;
    }).length;
    return acc;
  }, {} as Record<string, number>);

  const recommendations = filteredProviders
    .filter(p => p.rating >= 4.5)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Live Tracking Section */}
      {liveTracking && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-blue-100 space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Navigation className="text-white animate-pulse" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Live Tracking</h2>
                <p className="text-sm text-blue-600 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></span>
                  {liveTracking.providerName} is on the way!
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Updated</p>
              <p className="text-xs font-mono text-slate-600">
                {liveTracking.updatedAt?.toDate().toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <MapComponent 
                providers={[]} 
                userLocation={userData?.location} 
                liveProvider={{
                  id: liveTracking.providerId,
                  name: liveTracking.providerName,
                  lat: liveTracking.lat,
                  lng: liveTracking.lng
                }}
              />
            </div>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex flex-col justify-center">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <MapPin className="text-red-500" size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Your Destination</p>
                    <p className="text-xs text-slate-700 font-medium truncate max-w-[150px]">
                      {userData?.location?.address || 'Your Location'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <Navigation className="text-blue-600" size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Provider Status</p>
                    <p className="text-xs text-slate-700 font-medium">Moving towards you</p>
                  </div>
                </div>
                {liveTracking.providerPhone && (
                  <a 
                    href={`mobile:${liveTracking.providerPhone}`}
                    className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    <Phone size={14} />
                    Call {liveTracking.providerName}
                  </a>
                )}
                <button 
                  onClick={() => {
                    if (liveTracking.lat && liveTracking.lng) {
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${userData.location.lat},${userData.location.lng}&origin=${liveTracking.lat},${liveTracking.lng}`, '_blank');
                    }
                  }}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <Navigation size={14} />
                  View in Google Maps
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {recommendations.length > 0 && !selectedCategory && (
        <section className="animate-in fade-in slide-in-from-bottom-4 mb-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Sparkles className="text-blue-600" />
            Smart Suggestions for You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map((rec, idx) => (
              <div 
                key={idx} 
                className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl cursor-pointer hover:bg-blue-100 transition-all group" 
                onClick={() => setSelectedCategory(rec.category)}
              >
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Recommended</p>
                <h3 className="font-bold text-slate-900 group-hover:text-blue-700">{rec.category}</h3>
                <p className="text-xs text-slate-500 mt-1">{rec.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subscription Banner */}
      {userData && (!userData.subscriptionPlan || userData.subscriptionPlan === 'cust_basic') && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-2xl shadow-lg text-white flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
              <Star className="text-white" fill="currentColor" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Upgrade to Premium</h3>
              <p className="text-blue-100 text-sm">Get unlimited bookings, priority support, and access to verified top-rated professionals.</p>
            </div>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'subscription' }))}
            className="px-6 py-2 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all whitespace-nowrap"
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && !selectedCategory && (
        <section className="animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-600" />
            Recommended for You
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedCategory(p.category)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">{p.category}</span>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      p.availability ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" : "bg-red-500"
                    )} />
                  </div>
                  <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                    <Star size={14} fill="currentColor" />
                    {p.rating.toFixed(1)}
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                <p className="text-xs text-slate-500 mt-1">Top rated professional</p>
              </div>
            ))}
          </div>
        </section>
      )}
      
      {/* Category Selection */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Briefcase className="text-blue-600" />
          Choose a Service
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all text-center flex flex-col items-center gap-2 relative overflow-hidden neo-button",
                selectedCategory === cat 
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-105" 
                  : "bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50"
              )}
            >
              <span className="font-bold text-sm">{cat}</span>
              <span className={cn(
                "text-[10px] font-black px-2 py-0.5 rounded-full",
                selectedCategory === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}>
                {categoryCounts[cat] || 0} Registered
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Provider List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <User className="text-blue-600" />
              Available Professionals
            </h2>
            <div className="flex items-center gap-3">
              {!userData?.location?.lat && (
                <button 
                  onClick={() => setView('profile')}
                  className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <MapPin size={10} />
                  Set Location for 5km Filter
                </button>
              )}
              <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {filteredProviders.length} {userData?.location?.lat ? 'within 5km' : 'found'}
              </span>
            </div>
          </div>

          <MapComponent 
            providers={filteredProviders} 
            userLocation={userData?.location} 
            liveProvider={liveTracking ? {
              id: liveTracking.providerId,
              name: liveTracking.providerName,
              lat: liveTracking.lat,
              lng: liveTracking.lng
            } : undefined}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-12 text-slate-400">Loading providers...</div>
            ) : filteredProviders.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <AlertCircle className="mx-auto mb-2 text-slate-400" />
                <p className="text-slate-500">No professionals available in this category yet.</p>
              </div>
            ) : (
              filteredProviders.map((p) => (
                <div key={p.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{p.name}</h3>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          p.availability ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"
                        )} title={p.availability ? 'Available' : 'Unavailable'} />
                        {(p as any).fraudScore !== undefined && (p as any).fraudScore > 70 ? (
                          <div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full" title="Suspicious activity detected">
                            <ShieldAlert size={12} />
                            <span className="text-[10px] font-bold">Suspicious</span>
                          </div>
                        ) : (p as any).isVerified ? (
                          <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            <ShieldCheck size={12} />
                            <span className="text-[10px] font-bold">Verified</span>
                          </div>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{p.category}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg text-sm font-bold">
                      <Star size={14} fill="currentColor" />
                      {p.rating.toFixed(1)}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 mb-4 h-10">{p.description}</p>
                    <div className="flex flex-col gap-2 pt-4 border-t border-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400">Starting from</span>
                          <span className="text-lg font-bold text-slate-900 flex items-center">
                            <IndianRupee size={16} />
                            {p.pricePerHour}/hr
                          </span>
                        </div>
                        <div className="flex flex-col items-end">
                          <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Select Time</label>
                          <input 
                            type="datetime-local" 
                            className="text-xs border border-slate-200 rounded p-1 focus:outline-none focus:border-blue-500"
                            value={bookingTime}
                            onChange={(e) => setBookingTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowSimpleConfirm(p)}
                        disabled={bookingLoading}
                        className="w-full py-2 bg-slate-900 text-white rounded-lg hover:bg-blue-600 transition-all font-medium disabled:opacity-50 mt-2"
                      >
                        Book Now
                      </button>
                    </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Booking History */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="text-blue-600" />
            My Bookings
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {bookings.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Clock className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-sm">No bookings yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {bookings.map((b) => (
                  <div key={b.id} className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-900 text-sm">{b.providerName}</h4>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                        b.status === 'completed' ? "bg-green-100 text-green-700" :
                        b.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                        b.status === 'confirmed' ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {b.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {b.startTime?.toDate().toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <IndianRupee size={12} />
                        {b.totalPrice}
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      {b.status === 'completed' && !b.reviewed && (
                        <button
                          onClick={() => setReviewingBooking(b)}
                          className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <ThumbsUp size={12} />
                          Review
                        </button>
                      )}
                      {b.status === 'confirmed' && (b as any).isTracking && (
                        <button
                          onClick={() => {
                            setActiveTrackingId(b.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 animate-pulse"
                        >
                          <Navigation size={12} />
                          Track Live
                        </button>
                      )}
                      {b.status === 'confirmed' && (b as any).providerPhone && (
                        <a
                          href={`mobile:${(b as any).providerPhone}`}
                          className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                        >
                          <Phone size={12} />
                          Call
                        </a>
                      )}
                      {(b.status === 'pending' || b.status === 'confirmed') && (
                        <button
                          onClick={() => setShowCancelConfirm(b.id)}
                          className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simple Confirmation Dialog */}
      {showSimpleConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertCircle className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Booking</h3>
            <p className="text-slate-500 mb-8">Are you sure you want to book this service?</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowSimpleConfirm(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  handleBook(showSimpleConfirm);
                  setShowSimpleConfirm(null);
                }}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <XCircle className="text-red-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Cancel Booking</h3>
            <p className="text-slate-500 mb-8">Are you sure you want to cancel this booking? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCancelConfirm(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Keep Booking
              </button>
              <button 
                onClick={() => {
                  handleCancelBooking(showCancelConfirm);
                  setShowCancelConfirm(null);
                }}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewingBooking && (
        <ReviewModal
          booking={reviewingBooking}
          onClose={() => setReviewingBooking(null)}
          onSuccess={() => {}}
        />
      )}

      {/* Booking Confirmation Modal */}
      {confirmingProvider && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Calendar className="text-blue-600" size={32} />
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 text-center mb-2 tracking-tight">Confirm Booking</h3>
            <p className="text-slate-500 text-center mb-8">Please review your booking details before proceeding.</p>

            <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Professional</span>
                <span className="font-bold text-slate-900">{confirmingProvider.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Service</span>
                <span className="font-bold text-slate-900">{selectedCategory || confirmingProvider.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Scheduled Time</span>
                <span className="font-bold text-slate-900">{new Date(bookingTime).toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Total Price (2 hrs)</span>
                <span className="text-xl font-black text-blue-600 flex items-center">
                  <IndianRupee size={18} />
                  {confirmingProvider.pricePerHour * 2}
                </span>
              </div>
            </div>

            {/* AI Price Prediction */}
            <AnimatePresence>
              {(predictingPrice || predictedPrice) && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-blue-50 border border-blue-100 p-4 rounded-2xl overflow-hidden mb-8"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="text-blue-600" size={16} />
                    <h4 className="text-sm font-bold text-blue-900">AI Price Prediction</h4>
                  </div>
                  {predictingPrice ? (
                    <div className="flex items-center gap-2 text-xs text-blue-500">
                      <Loader2 className="animate-spin" size={12} />
                      Analyzing market rates...
                    </div>
                  ) : predictedPrice && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-blue-700">Fair Market Price</span>
                        <span className="text-sm font-black text-blue-900">₹{predictedPrice.predictedPrice}</span>
                      </div>
                      <div className="text-[10px] text-blue-600/70">
                        Confidence: {Math.round(predictedPrice.confidence * 100)}% • Factors: {predictedPrice.factors.join(', ')}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingProvider(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={processBooking}
                disabled={bookingLoading}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2 neo-button"
              >
                {bookingLoading ? <Loader2 className="animate-spin" size={20} /> : 'Confirm & Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
