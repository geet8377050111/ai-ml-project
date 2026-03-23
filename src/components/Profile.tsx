import { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User, MapPin, Briefcase, Award, Star, Save, Loader2, Search } from 'lucide-react';
import {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
} from '@reach/combobox';
import '@reach/combobox/styles.css';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES = ["Electrician", "Maid", "Cook", "Labour", "Painter", "Dancer", "Home Tutor", "Plumber", "Carpenter", "Welder"];
const EXPERIENCE_LEVELS = ["Junior", "Intermediate", "Senior", "Expert"];

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [providerData, setProviderData] = useState<any>(null);
  const [customCategory, setCustomCategory] = useState('');

  // Nominatim Search State
  const [addressValue, setAddressValue] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!addressValue.trim() || addressValue.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressValue)}&limit=5`);
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Nominatim error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [addressValue]);

  useEffect(() => {
    if (userData?.location?.address) {
      setAddressValue(userData.location.address);
    }
  }, [userData?.location?.address]);

  const handleSelect = async (address: string) => {
    setAddressValue(address);
    const selected = suggestions.find(s => s.display_name === address);
    if (!selected) return;

    try {
      const newLoc = {
        lat: parseFloat(selected.lat),
        lng: parseFloat(selected.lon),
        address: selected.display_name
      };
      
      setUserData({ ...userData, location: newLoc });
      if (providerData) {
        setProviderData({ ...providerData, location: newLoc });
      }

      // Automatically save to Firestore to make it "live"
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          location: newLoc
        });
        if (userData.role === 'provider' && providerData?.id) {
          await updateDoc(doc(db, 'providers', providerData.id), {
            location: newLoc
          });
        }
      }

      toast.success('Current location updated!');
      setSuggestions([]);
    } catch (error) {
      console.error('Error selecting address:', error);
      toast.error('Failed to get location from address');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          setUserData(uData);
          
          if (uData.role === 'provider') {
            const providersRef = collection(db, 'providers');
            const q = query(providersRef, where('uid', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setProviderData({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
            } else {
              setProviderData({
                uid: auth.currentUser.uid,
                name: uData.displayName || '',
                categories: [CATEGORIES[0]],
                skills: [],
                experienceLevel: EXPERIENCE_LEVELS[0],
                certifications: [],
                pricePerHour: 500,
                rating: 5,
                location: uData.location || { lat: 28.6139, lng: 77.2090 },
                serviceAreaRadius: 10,
                availability: true,
                description: ''
              });
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'profile');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const newLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Current GPS Location'
        };
        setUserData({ ...userData, location: newLoc });
        if (providerData) {
          setProviderData({ ...providerData, location: newLoc });
        }

        // Automatically save to Firestore to make it "live"
        if (auth.currentUser) {
          try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              location: newLoc
            });
            if (userData.role === 'provider' && providerData?.id) {
              await updateDoc(doc(db, 'providers', providerData.id), {
                location: newLoc
              });
            }
          } catch (e) {
            console.error("Auto-save location failed:", e);
          }
        }

        setLocating(false);
        toast.success('Live location updated successfully!');
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocating(false);
        toast.error('Failed to get your location. Please check permissions.');
      }
    );
  };

  const handleSave = async () => {
    if (!auth.currentUser || !userData) return;
    setSaving(true);
    try {
      // Update User Doc
      await updateDoc(doc(db, 'users', auth.currentUser.uid), userData);
      
      // Update/Create Provider Doc if role is provider
      if (userData.role === 'provider' && providerData) {
        // Ensure name is synced
        const updatedProvider = { ...providerData, name: userData.displayName, phoneNumber: userData.phoneNumber };
        if (providerData.id) {
          await updateDoc(doc(db, 'providers', providerData.id), updatedProvider);
        } else {
          const ref = doc(collection(db, 'providers'));
          const finalProviderData = { ...updatedProvider, id: ref.id, uid: auth.currentUser.uid };
          await setDoc(ref, finalProviderData);
          setProviderData(finalProviderData);
        }
      }
      toast.success('Profile updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'profile');
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <User className="text-blue-600" />
          General Profile
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Display Name</label>
            <input
              type="text"
              value={userData?.displayName || ''}
              onChange={(e) => {
                const newName = e.target.value;
                setUserData({ ...userData, displayName: newName });
                if (providerData) {
                  setProviderData({ ...providerData, name: newName });
                }
              }}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Role</label>
            <select
              value={userData?.role || 'customer'}
              onChange={(e) => {
                const newRole = e.target.value;
                setUserData({ ...userData, role: newRole });
                if (newRole === 'provider' && !providerData) {
                  setProviderData({
                    uid: auth.currentUser?.uid,
                    name: userData.displayName || '',
                    phoneNumber: userData.phoneNumber || '',
                    categories: [CATEGORIES[0]],
                    skills: [],
                    experienceLevel: EXPERIENCE_LEVELS[0],
                    certifications: [],
                    pricePerHour: 500,
                    rating: 5,
                    location: userData.location || { lat: 28.6139, lng: 77.2090 },
                    serviceAreaRadius: 10,
                    availability: true,
                    description: ''
                  });
                }
              }}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="customer">Customer</option>
              <option value="provider">Service Provider</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Phone Number</label>
            <input
              type="tel"
              value={userData?.phoneNumber || ''}
              onChange={(e) => {
                const newPhone = e.target.value;
                setUserData({ ...userData, phoneNumber: newPhone });
                if (providerData) {
                  setProviderData({ ...providerData, phoneNumber: newPhone });
                }
              }}
              placeholder="+91 9876543210"
              className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Address</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Combobox onSelect={handleSelect}>
                  <div className="relative">
                    <ComboboxInput
                      value={addressValue}
                      onChange={(e) => setAddressValue(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Search for your address..."
                    />
                    <div className="absolute right-3 top-2.5 flex items-center gap-2">
                      {isSearching && <Loader2 className="animate-spin text-blue-600" size={16} />}
                      <Search className="text-slate-400" size={16} />
                    </div>
                  </div>
                  <ComboboxPopover className="z-[100] bg-white border border-slate-100 rounded-xl shadow-xl mt-2 overflow-hidden">
                    <ComboboxList>
                      {suggestions.length > 0 &&
                        suggestions.map((s) => (
                          <ComboboxOption 
                            key={s.place_id} 
                            value={s.display_name}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 transition-colors"
                          />
                        ))}
                    </ComboboxList>
                  </ComboboxPopover>
                </Combobox>
              </div>
              <button
                onClick={handleGetLocation}
                disabled={locating}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 h-[42px]"
                title="Get current location"
              >
                {locating ? <Loader2 className="animate-spin" size={18} /> : <MapPin size={18} />}
                <span className="hidden sm:inline">Locate Me</span>
              </button>
            </div>
            {userData?.location?.lat && (
              <p className="mt-2 text-[10px] text-slate-400 font-mono">
                Coordinates: {userData.location.lat.toFixed(4)}, {userData.location.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>
      </div>

      {userData?.role === 'provider' && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Briefcase className="text-blue-600" />
            Provider Professional Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Service Categories</label>
              <div className="grid grid-cols-2 gap-2 p-4 bg-slate-50 border border-slate-100 rounded-xl max-h-40 overflow-y-auto">
                {CATEGORIES.map(cat => (
                  <label key={cat} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer hover:text-blue-600 transition-colors">
                    <input
                      type="checkbox"
                      checked={providerData?.categories?.includes(cat) || providerData?.category === cat}
                      onChange={(e) => {
                        const currentCats = providerData?.categories || (providerData?.category ? [providerData.category] : []);
                        const newCats = e.target.checked 
                          ? [...currentCats, cat]
                          : currentCats.filter((c: string) => c !== cat);
                        setProviderData({ ...providerData, categories: newCats, category: newCats[0] || '' });
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {cat}
                  </label>
                ))}
                {/* Custom categories already added */}
                {providerData?.categories?.filter((c: string) => !CATEGORIES.includes(c)).map((cat: string) => (
                  <label key={cat} className="flex items-center gap-2 text-sm text-blue-600 font-bold cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          const newCats = providerData.categories.filter((c: string) => c !== cat);
                          setProviderData({ ...providerData, categories: newCats, category: newCats[0] || '' });
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
                  placeholder="Add custom service..."
                  className="flex-1 px-3 py-1.5 text-sm bg-slate-50 border border-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customCategory.trim()) {
                      const currentCats = providerData?.categories || (providerData?.category ? [providerData.category] : []);
                      if (!currentCats.includes(customCategory.trim())) {
                        const newCats = [...currentCats, customCategory.trim()];
                        setProviderData({ ...providerData, categories: newCats, category: newCats[0] || '' });
                      }
                      setCustomCategory('');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                >
                  Add
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 italic">Select all services you can provide. Add custom ones if not listed.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Experience Level</label>
              <select
                value={providerData?.experienceLevel || ''}
                onChange={(e) => setProviderData({ ...providerData, experienceLevel: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {EXPERIENCE_LEVELS.map(lvl => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Price per Hour (₹)</label>
              <input
                type="number"
                value={providerData?.pricePerHour || 0}
                onChange={(e) => setProviderData({ ...providerData, pricePerHour: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Service Area Radius (km)</label>
              <input
                type="number"
                value={providerData?.serviceAreaRadius || 10}
                onChange={(e) => setProviderData({ ...providerData, serviceAreaRadius: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description / Bio</label>
              <textarea
                value={providerData?.description || ''}
                onChange={(e) => setProviderData({ ...providerData, description: e.target.value })}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                placeholder="Tell customers about your expertise..."
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          Save Profile
        </button>
      </div>
    </div>
  );
}
