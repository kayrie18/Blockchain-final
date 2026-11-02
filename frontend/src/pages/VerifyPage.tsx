import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';

export const VerifyPage: React.FC<{ token: string }> = ({ token }) => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleVerify = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      const res = await api.uploadForm('/verification/file', formData, token);
      setResult(res);
    } catch (err: any) {
      setResult({ verdict: 'Verification Failed', isAuthentic: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Verify Document Integrity</h2>
        <p className="text-slate-500 mt-2">Upload a document to check its authenticity against the blockchain</p>
      </div>

      <div className="space-y-6">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-3 border-dashed border-brand-200 bg-white rounded-3xl p-12 flex flex-col items-center justify-center text-center hover:border-brand-500 transition-all cursor-pointer"
        >
          <ShieldCheck className="text-brand-600 mb-4" size={48} />
          <div className="text-lg font-bold text-slate-900">Drop document here to verify</div>
          <p className="text-slate-600 mt-2">We will check its hash against the blockchain</p>
          {file && <div className="text-sm text-emerald-600 mt-4 font-bold">✓ {file.name}</div>}
        </div>
        <input
          ref={fileRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
        />

        {result && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm p-8 text-center">
            <div className={cn("text-4xl font-black mb-4", result.isAuthentic ? 'text-emerald-600' : 'text-rose-600')}>
              {result.isAuthentic ? '✓' : '✗'}
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-2">{result.verdict || result.status}</div>
            <div className="text-slate-600 mb-4">{result.message || (result.isAuthentic ? 'Document authentic' : 'Document tampered/expired/revoked')}</div>
            {result.hash && (
              <div className="text-xs font-mono text-slate-500 bg-slate-100 p-2 rounded-xl break-all">
                Hash: {result.hash}
              </div>
            )}
          </div>
        )}

        {file && (
          <button 
            onClick={handleVerify} 
            disabled={loading}
            className="w-full h-12 bg-brand-600 text-white hover:bg-brand-700 rounded-xl font-medium transition-all flex items-center justify-center disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Document'}
          </button>
        )}
      </div>
    </motion.div>
  );
};
