import { motion } from 'motion/react';
import { FileText, Scale, CheckCircle, AlertCircle } from 'lucide-react';

export default function TermsOfService() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-100"
    >
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
          <FileText size={24} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Terms of Service</h1>
      </div>

      <div className="prose prose-slate max-w-none space-y-8 text-slate-600">
        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Scale size={20} className="text-blue-600" />
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using the HomeService Connect platform, you agree to be bound by these 
            Terms of Service and all applicable laws and regulations. If you do not agree with any 
            part of these terms, you are prohibited from using or accessing this site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <CheckCircle size={20} className="text-blue-600" />
            2. Use License
          </h2>
          <p>
            Permission is granted to temporarily download one copy of the materials (information or 
            software) on HomeService Connect's website for personal, non-commercial transitory 
            viewing only. This is the grant of a license, not a transfer of title, and under this 
            license you may not:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Modify or copy the materials.</li>
            <li>Use the materials for any commercial purpose, or for any public display.</li>
            <li>Attempt to decompile or reverse engineer any software contained on the website.</li>
            <li>Remove any copyright or other proprietary notations from the materials.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
            <AlertCircle size={20} className="text-blue-600" />
            3. Disclaimer
          </h2>
          <p>
            The materials on HomeService Connect's website are provided on an 'as is' basis. 
            HomeService Connect makes no warranties, expressed or implied, and hereby disclaims 
            and negates all other warranties including, without limitation, implied warranties 
            or conditions of merchantability, fitness for a particular purpose, or non-infringement 
            of intellectual property or other violation of rights.
          </p>
        </section>

        <section className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <h2 className="text-lg font-bold text-blue-900 mb-2">Service Provider Responsibility</h2>
          <p className="text-sm text-blue-800">
            Service providers are independent contractors and not employees of HomeService Connect. 
            HomeService Connect is not responsible for the quality, safety, or legality of the 
            services provided by independent professionals.
          </p>
        </section>
      </div>
    </motion.div>
  );
}
