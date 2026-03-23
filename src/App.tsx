import { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Admin from './components/Admin';
import Profile from './components/Profile';
import ProviderDashboard from './components/ProviderDashboard';
import Chat from './components/Chat';
import Subscription from './components/Subscription';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import Contact from './components/Contact';
import { Home, Shield, MessageSquare, X, Menu, Loader2, AlertTriangle, CheckCircle, Clock, User as UserIcon, ShieldCheck, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Toaster } from 'react-hot-toast';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
            <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-500 mb-6 text-sm">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<'customer' | 'provider' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'admin' | 'profile' | 'provider-dashboard' | 'subscription' | 'terms' | 'privacy' | 'contact'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userRole = userDoc.data().role as 'customer' | 'provider' | 'admin';
            setRole(userRole);
            if (userRole === 'admin') setView('admin');
            else if (userRole === 'provider') setView('provider-dashboard');
          } else {
            // Create initial user profile
            const isDefaultAdmin = firebaseUser.email === "geet9873699811@gmail.com" || firebaseUser.email === "geet8377050111@gmail.com";
            const initialRole = isDefaultAdmin ? 'admin' : 'customer';
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              phoneNumber: firebaseUser.phoneNumber,
              role: initialRole,
              createdAt: serverTimestamp()
            });
            setRole(initialRole);
            if (initialRole === 'admin') setView('admin');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    const handleViewChange = (e: any) => {
      if (e.detail) setView(e.detail);
    };
    window.addEventListener('change-view', handleViewChange);

    return () => {
      unsubscribe();
      window.removeEventListener('change-view', handleViewChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="text-slate-400 font-medium animate-pulse">Initializing HomeService Connect...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
        {/* Navigation */}
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 glass-card">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setView('dashboard')}>
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
                  <Home size={20} />
                </div>
                <div>
                  <h1 className="font-black text-lg tracking-tight leading-none">HomeService</h1>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connect</span>
                </div>
              </div>

              {user && (
                <div className="hidden md:flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                  {role === 'customer' && (
                    <button
                      onClick={() => setView('dashboard')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                        view === 'dashboard' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Find Services
                    </button>
                  )}
                  {role === 'provider' && (
                    <button
                      onClick={() => setView('provider-dashboard')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                        view === 'provider-dashboard' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      Provider Dashboard
                    </button>
                  )}
                  {role === 'admin' && (
                    <button
                      onClick={() => setView('admin')}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                        view === 'admin' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <Shield size={14} />
                      Admin Panel
                    </button>
                  )}
                  <button
                    onClick={() => setView('subscription')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                      view === 'subscription' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <CreditCard size={14} />
                    Subscription
                  </button>
                  <button
                    onClick={() => setView('profile')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                      view === 'profile' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <UserIcon size={14} />
                    Profile
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <Auth />
              <button 
                className="md:hidden p-2 text-slate-600"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <Menu />
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {!user ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl"
              >
                <h2 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tighter leading-tight">
                  Your Home, <br />
                  <span className="text-blue-600">Perfectly Managed.</span>
                </h2>
                <p className="text-lg text-slate-500 mb-10 leading-relaxed">
                  Connect with trusted electricians, maids, cooks, tutors, and more. 
                  The ultimate platform for all your household needs.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                      <CheckCircle size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-400 uppercase">Verified</p>
                      <p className="font-bold">Professionals</p>
                    </div>
                  </div>
                  <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                      <Clock size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-400 uppercase">Instant</p>
                      <p className="font-bold">Booking</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {view === 'admin' && role === 'admin' && <Admin />}
              {view === 'dashboard' && <Dashboard setView={setView} />}
              {view === 'provider-dashboard' && role === 'provider' && <ProviderDashboard />}
              {view === 'profile' && <Profile />}
              {view === 'subscription' && <Subscription userRole={role || 'customer'} />}
              {view === 'terms' && <TermsOfService />}
              {view === 'privacy' && <PrivacyPolicy />}
              {view === 'contact' && <Contact />}
            </motion.div>
          )}
        </main>

        {/* Floating Chat Button */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-24 right-6 z-50 w-[350px] md:w-[400px]"
            >
              <Chat />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowChat(!showChat)}
          className={cn(
            "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 active:scale-95",
            showChat ? "bg-slate-900" : "bg-blue-600"
          )}
        >
          {showChat ? <X size={24} /> : <MessageSquare size={24} />}
        </button>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-100 mt-20">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2 opacity-50 grayscale">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                <Home size={16} />
              </div>
              <h1 className="font-black text-sm tracking-tight">HomeService Connect</h1>
            </div>
            <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <button onClick={() => setView('privacy')} className="hover:text-blue-600 transition-colors">Privacy Policy</button>
              <button onClick={() => setView('terms')} className="hover:text-blue-600 transition-colors">Terms of Service</button>
              <button onClick={() => setView('contact')} className="hover:text-blue-600 transition-colors">Contact Us</button>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              © 2026 HomeService Connect. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
