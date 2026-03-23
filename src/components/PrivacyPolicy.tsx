import { motion } from 'motion/react';
import { Shield, Lock, Eye, FileText, Scale } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <Shield size={24} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
      </div>

      <div className="prose prose-slate max-w-none space-y-8 text-slate-600">
        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Eye size={20} className="text-blue-600" />
            1. Information We Collect
          </h2>
          <p>
            We collect information you provide directly to us, such as when you create or modify your account, 
            request services, contact customer support, or otherwise communicate with us. This information 
            may include: name, email, phone number, postal address, profile picture, payment method, 
            service request details, and other information you choose to provide.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Lock size={20} className="text-blue-600" />
            2. How We Use Your Information
          </h2>
          <p>
            We use the information we collect to provide, maintain, and improve our services, such as to 
            facilitate payments, send receipts, provide products and services you request (and send 
            related information), develop new features, provide customer support, and send 
            administrative and marketing communications.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Scale size={20} className="text-blue-600" />
            3. Sharing of Information
          </h2>
          <p>
            We may share the information we collect about you as described in this statement or at the 
            time of collection or sharing, including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>With service providers to enable them to provide the services you request.</li>
            <li>With the general public if you submit content in a public forum, such as blog comments, social media posts, or other features of our services that are viewable by the general public.</li>
            <li>With third parties with whom you choose to let us share information.</li>
          </ul>
        </section>

        <section className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Security of Your Data</h2>
          <p className="text-sm">
            We use industry-standard security measures to protect your personal information from unauthorized 
            access, use, or disclosure. However, no method of transmission over the Internet or method of 
            electronic storage is 100% secure.
          </p>
        </section>
      </div>
    </motion.div>
  );
}
