import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle, XCircle, Users, Briefcase, TrendingUp, IndianRupee, Star, MapPin, CreditCard, Loader2, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import toast from 'react-hot-toast';
import { aiService } from '../services/aiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES = ["Electrician", "Maid", "Cook", "Labour", "Painter", "Dancer", "Home Tutor", "Plumber", "Carpenter", "Welder"];

interface Provider {
  id: string;
  name: string;
  category: string;
  categories?: string[];
  pricePerHour: number;
  rating: number;
  availability: boolean;
  description: string;
  location?: { lat: number; lng: number };
}

interface Booking {
  id: string;
  customerId: string;
  providerName: string;
  category: string;
  status: string;
  totalPrice: number;
  startTime: any;
  createdAt: any;
}

interface Subscription {
  id: string;
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  amount: number;
  status: string;
  createdAt: any;
  expiresAt: any;
}

export default function Admin() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'bookings' | 'subscriptions'>('overview');
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [newProvider, setNewProvider] = useState({
    name: '',
    categories: [] as string[],
    category: '',
    pricePerHour: 0,
    description: '',
    lat: 28.6139,
    lng: 77.2090
  });

  useEffect(() => {
    const unsubscribeProviders = onSnapshot(collection(db, 'providers'), (snapshot) => {
      setProviders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Provider)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'providers'));

    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookings'));

    const unsubscribeSubscriptions = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
      setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'subscriptions'));

    return () => {
      unsubscribeProviders();
      unsubscribeBookings();
      unsubscribeSubscriptions();
    };
  }, []);

  const handleAuditProvider = async (provider: Provider) => {
    setAuditingId(provider.id);
    try {
      // Fetch reviews for this provider
      const reviewsQuery = query(collection(db, 'reviews'), where('providerId', '==', (provider as any).uid));
      const reviewsSnapshot = await getDocs(reviewsQuery);
      const reviews = reviewsSnapshot.docs.map(doc => doc.data());

      const analysis = await aiService.detectFraud(provider, reviews);
      
      await updateDoc(doc(db, 'providers', provider.id), {
        fraudScore: analysis.fraudScore,
        isVerified: !analysis.isSuspicious
      });

      if (analysis.isSuspicious) {
        toast.error(`Suspicious activity detected! Fraud Score: ${analysis.fraudScore}`);
      } else {
        toast.success("Provider verified successfully.");
      }
    } catch (error) {
      console.error("Audit failed", error);
      toast.error("Failed to audit provider.");
    } finally {
      setAuditingId(null);
    }
  };
  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'providers'), {
        ...newProvider,
        category: newProvider.categories[0] || '',
        rating: 4.5,
        availability: true,
        location: { lat: Number(newProvider.lat), lng: Number(newProvider.lng) },
        createdAt: serverTimestamp()
      });
      setNewProvider({ 
        name: '', 
        categories: [], 
        category: '', 
        pricePerHour: 0, 
        description: '', 
        lat: 28.6139, 
        lng: 77.2090 
      });
      toast.success('Professional added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'providers');
      toast.error('Failed to add professional');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProvider) return;
    setLoading(true);
    try {
      const updatedData = {
        ...editingProvider,
        category: editingProvider.categories?.[0] || editingProvider.category || '',
        location: { lat: Number(editingProvider.location?.lat), lng: Number(editingProvider.location?.lng) }
      };
      await updateDoc(doc(db, 'providers', editingProvider.id), updatedData);
      setEditingProvider(null);
      toast.success('Professional updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'providers');
      toast.error('Failed to update professional');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'providers', id));
      toast.success('Professional removed');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'providers');
      toast.error('Failed to remove professional');
    }
  };

  const handleUpdateBookingStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      toast.success(`Booking marked as ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'bookings');
      toast.error('Failed to update booking');
    }
  };

  // Stats for Chart
  const categoryStats = CATEGORIES.map(cat => ({
    name: cat,
    count: providers.filter(p => {
      const pCats = p.categories || (p.category ? [p.category] : []);
      return pCats.includes(cat);
    }).length,
    revenue: bookings.filter(b => b.category === cat && b.status === 'completed').reduce((sum, b) => sum + b.totalPrice, 0)
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];

  const totalBookingRevenue = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + b.totalPrice, 0);
  const totalSubscriptionRevenue = subscriptions.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-10">
      {/* Tabs */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        {(['overview', 'providers', 'bookings', 'subscriptions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap capitalize",
              activeTab === tab ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard title="Total Providers" value={providers.length} icon={<Users className="text-blue-600" />} />
            <StatCard title="Active Bookings" value={bookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length} icon={<Briefcase className="text-green-600" />} />
            <StatCard title="Total Revenue" value={`₹${totalBookingRevenue + totalSubscriptionRevenue}`} icon={<TrendingUp className="text-orange-600" />} />
            <StatCard title="Subscriptions" value={subscriptions.length} icon={<CreditCard className="text-purple-600" />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Service Distribution</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryStats}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {categoryStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6">Revenue Breakdown</h2>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Bookings', value: totalBookingRevenue },
                        { name: 'Subscriptions', value: totalSubscriptionRevenue }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#8b5cf6" />
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-8 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold text-slate-500">Bookings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-xs font-bold text-slate-500">Subscriptions</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-4">
          {/* Add Provider Form */}
          <div className="lg:col-span-1 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Plus className="text-blue-600" />
              Add New Provider
            </h2>
            <form onSubmit={handleAddProvider} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newProvider.name}
                  onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Rajesh Kumar"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Service Categories</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl max-h-32 overflow-y-auto">
                  {CATEGORIES.map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-[10px] text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                      <input
                        type="checkbox"
                        checked={newProvider.categories.includes(cat)}
                        onChange={(e) => {
                          const newCats = e.target.checked 
                            ? [...newProvider.categories, cat]
                            : newProvider.categories.filter(c => c !== cat);
                          setNewProvider({ ...newProvider, categories: newCats });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {cat}
                    </label>
                  ))}
                  {newProvider.categories.filter(c => !CATEGORIES.includes(c)).map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-[10px] text-blue-600 font-bold cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            const newCats = newProvider.categories.filter(c => c !== cat);
                            setNewProvider({ ...newProvider, categories: newCats });
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {cat}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Custom service..."
                    className="flex-1 px-3 py-1 text-[10px] bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customCategory.trim() && !newProvider.categories.includes(customCategory.trim())) {
                        setNewProvider({ ...newProvider, categories: [...newProvider.categories, customCategory.trim()] });
                        setCustomCategory('');
                      }
                    }}
                    className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Price per Hour (₹)</label>
                <input
                  type="number"
                  required
                  value={newProvider.pricePerHour}
                  onChange={(e) => setNewProvider({ ...newProvider, pricePerHour: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newProvider.lat}
                    onChange={(e) => setNewProvider({ ...newProvider, lat: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newProvider.lng}
                    onChange={(e) => setNewProvider({ ...newProvider, lng: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                <textarea
                  value={newProvider.description}
                  onChange={(e) => setNewProvider({ ...newProvider, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="Briefly describe the professional's experience..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-100"
              >
                Add Professional
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50">
              <h2 className="text-xl font-bold text-slate-900">Manage Professionals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Rating</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {providers.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <div className="flex flex-wrap gap-1">
                          {(p.categories || [p.category]).map(cat => (
                            <span key={cat} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full">{cat}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">₹{p.pricePerHour}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-yellow-600 text-sm font-bold">
                          <Star size={14} fill="currentColor" />
                          {p.rating}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAuditProvider(p)}
                            disabled={auditingId === p.id}
                            className={cn(
                              "p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold",
                              (p as any).fraudScore > 70 ? "bg-red-50 text-red-600 hover:bg-red-100" :
                              (p as any).isVerified ? "bg-green-50 text-green-600 hover:bg-green-100" :
                              "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            )}
                          >
                            {auditingId === p.id ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                            {(p as any).fraudScore !== undefined ? `Score: ${(p as any).fraudScore}` : "Audit"}
                          </button>
                          <button
                            onClick={() => setEditingProvider(p)}
                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Plus size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteProvider(p.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bookings' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 border-b border-slate-50">
            <h2 className="text-xl font-bold text-slate-900">All Bookings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Provider</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">{b.providerName}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{b.category}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        b.status === 'completed' ? "bg-green-50 text-green-600" :
                        b.status === 'confirmed' ? "bg-blue-50 text-blue-600" :
                        b.status === 'cancelled' ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"
                      )}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">₹{b.totalPrice}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {b.status === 'pending' && (
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {b.status !== 'cancelled' && b.status !== 'completed' && (
                          <button
                            onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 border-b border-slate-50">
            <h2 className="text-xl font-bold text-slate-900">Active Subscriptions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">User Email</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Expires At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {subscriptions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">{s.userEmail}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{s.planName}</td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">₹{s.amount}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-50 text-green-600">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {s.expiresAt?.toDate().toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-bold italic">
                      No active subscriptions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Edit Provider Modal */}
      {editingProvider && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Edit Professional</h3>
            <p className="text-sm text-slate-500 mb-6">Update professional details.</p>

            <form onSubmit={handleUpdateProvider} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingProvider.name}
                  onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Service Categories</label>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl max-h-32 overflow-y-auto">
                  {CATEGORIES.map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-[10px] text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                      <input
                        type="checkbox"
                        checked={(editingProvider.categories || [editingProvider.category]).includes(cat)}
                        onChange={(e) => {
                          const currentCats = editingProvider.categories || [editingProvider.category];
                          const newCats = e.target.checked 
                            ? [...currentCats, cat]
                            : currentCats.filter(c => c !== cat);
                          setEditingProvider({ ...editingProvider, categories: newCats });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {cat}
                    </label>
                  ))}
                  {(editingProvider.categories || [editingProvider.category]).filter(c => !CATEGORIES.includes(c)).map(cat => (
                    <label key={cat} className="flex items-center gap-2 text-[10px] text-blue-600 font-bold cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            const currentCats = editingProvider.categories || [editingProvider.category];
                            const newCats = currentCats.filter(c => c !== cat);
                            setEditingProvider({ ...editingProvider, categories: newCats });
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {cat}
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Custom service..."
                    className="flex-1 px-3 py-1 text-[10px] bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customCategory.trim()) {
                        const currentCats = editingProvider.categories || [editingProvider.category];
                        if (!currentCats.includes(customCategory.trim())) {
                          setEditingProvider({ ...editingProvider, categories: [...currentCats, customCategory.trim()] });
                        }
                        setCustomCategory('');
                      }
                    }}
                    className="px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Price per Hour (₹)</label>
                <input
                  type="number"
                  required
                  value={editingProvider.pricePerHour}
                  onChange={(e) => setEditingProvider({ ...editingProvider, pricePerHour: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingProvider.location?.lat || 0}
                    onChange={(e) => setEditingProvider({ ...editingProvider, location: { ...editingProvider.location!, lat: Number(e.target.value) } })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingProvider.location?.lng || 0}
                    onChange={(e) => setEditingProvider({ ...editingProvider, location: { ...editingProvider.location!, lng: Number(e.target.value) } })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                <textarea
                  value={editingProvider.description}
                  onChange={(e) => setEditingProvider({ ...editingProvider, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingProvider(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}
