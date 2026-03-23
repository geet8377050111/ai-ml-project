import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Check, CreditCard, Loader2, Star, ShieldCheck, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PLANS = [
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 9.99,
    features: ['Access to all providers', 'Standard support', 'Up to 5 bookings/month'],
    icon: <Star className="text-blue-500" />
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: 24.99,
    features: ['Priority booking', '24/7 support', 'Unlimited bookings', 'Exclusive discounts'],
    icon: <Zap className="text-yellow-500" />,
    popular: true
  },
  {
    id: 'provider-pro',
    name: 'Provider Pro',
    price: 49.99,
    features: ['Featured listing', 'Lower platform fees', 'Advanced analytics', 'Verified badge'],
    icon: <ShieldCheck className="text-green-500" />,
    forProvider: true
  }
];

export default function Subscription({ userRole }: { userRole: string }) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePaymentSuccess = async (details: any) => {
    if (!auth.currentUser || !selectedPlan) return;
    setLoading(true);
    try {
      const subscriptionData = {
        uid: auth.currentUser.uid,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        status: 'active',
        paypalOrderId: details.id,
        startDate: serverTimestamp(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdAt: serverTimestamp()
      };

      // Save subscription record
      const subRef = doc(db, 'subscriptions', auth.currentUser.uid);
      await setDoc(subRef, subscriptionData);

      // Update user document with subscription status
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        isSubscribed: true,
        subscriptionPlan: selectedPlan.id
      });

      alert(`Successfully subscribed to ${selectedPlan.name}!`);
      setSelectedPlan(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlans = PLANS.filter(plan => 
    userRole === 'provider' ? plan.forProvider : !plan.forProvider
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-10">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Choose Your Plan</h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Unlock premium features and support the platform with our flexible subscription plans.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPlans.map((plan) => (
          <div 
            key={plan.id}
            className={cn(
              "bg-white p-8 rounded-3xl border-2 transition-all flex flex-col h-full",
              plan.popular ? "border-blue-600 shadow-xl scale-105 relative" : "border-slate-100 shadow-sm hover:border-blue-200"
            )}
          >
            {plan.popular && (
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                Most Popular
              </span>
            )}
            
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-slate-50 rounded-2xl">
                {plan.icon}
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-slate-900">₹{plan.price}</p>
                <p className="text-xs text-slate-400 font-bold uppercase">per month</p>
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-4">{plan.name}</h3>
            
            <ul className="space-y-4 mb-8 flex-grow">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="mt-1 bg-green-100 text-green-600 p-0.5 rounded-full">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setSelectedPlan(plan)}
              className={cn(
                "w-full py-4 rounded-2xl font-bold transition-all",
                plan.popular 
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100" 
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              Select {plan.name}
            </button>
          </div>
        ))}
      </div>

      {selectedPlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Checkout</h2>
              <button 
                onClick={() => setSelectedPlan(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl mb-8 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Selected Plan</p>
                <p className="font-bold text-slate-900">{selectedPlan.name}</p>
              </div>
              <p className="text-xl font-black text-blue-600">₹{selectedPlan.price}</p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase text-center mb-2">Pay Securely with PayPal</p>
              <PayPalScriptProvider options={{ clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "test" }}>
                <PayPalButtons
                  style={{ layout: "vertical", shape: "pill" }}
                  createOrder={async () => {
                    const response = await fetch("/api/paypal/create-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ amount: selectedPlan.price, planName: selectedPlan.name }),
                    });
                    const order = await response.json();
                    return order.id;
                  }}
                  onApprove={async (data) => {
                    const response = await fetch("/api/paypal/capture-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orderID: data.orderID }),
                    });
                    const details = await response.json();
                    handlePaymentSuccess(details);
                  }}
                />
              </PayPalScriptProvider>
            </div>

            {loading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={48} />
                <p className="font-bold text-slate-900">Processing Payment...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
