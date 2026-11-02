import React, { useState } from 'react';
import { Search, FileText, CheckCircle2, X } from 'lucide-react';
import { Button } from './UI';
import { api, getBaseUrl } from '../lib/api';
import { AnimatePresence, motion } from 'motion/react';

export const PublicSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setResults([]);
    
    try {
      const data = await api.get(`/search/public?q=${encodeURIComponent(query)}`);
      
      // Normalize response: handle both array and single document formats
      let resultArray: any[] = [];
      if (Array.isArray(data.items)) {
        resultArray = data.items;
      } else if (Array.isArray(data.documents)) {
        resultArray = data.documents;
      } else if (data.document) {
        resultArray = [data.document];
      } else if (data.id) {
        // Single document object
        resultArray = [data];
      }
      
      if (resultArray.length === 0) {
        setError('No verified documents found matching your query.');
      } else {
        setResults(resultArray);
      }
    } catch (err: any) {
      setError(err?.message || 'Verification search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const API_SERVER = getBaseUrl();

  return (
    <div className="mt-12 w-full max-w-xl relative">
      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
          <Search className="text-slate-400 group-focus-within:text-brand-500 transition-colors" size={20} />
        </div>
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter Document ID or Hash to verify..." 
          className="w-full pl-14 pr-32 py-5 rounded-2xl border-2 border-slate-100 bg-white placeholder-slate-400 shadow-xl shadow-slate-200/50 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none text-slate-800 font-medium transition-all"
        />
        <div className="absolute inset-y-2 right-2">
          <Button type="submit" disabled={loading} className="h-full px-6 rounded-xl shadow-lg">
            {loading ? 'Scanning...' : 'Verify'}
          </Button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <span className="text-sm font-bold text-rose-600">{error}</span>
          <button onClick={() => setError('')}><X size={16} className="text-rose-400" /></button>
        </div>
      )}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-full mt-4 left-0 right-0 bg-white border border-emerald-100 shadow-2xl p-6 rounded-3xl z-50 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500" />
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">Verified Document{results.length > 1 ? 's' : ''}</h3>
                  <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-0.5">
                    {results.length} result{results.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setResults([])}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {results.map((resultItem) => (
                <div key={resultItem.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Document Title</div>
                      <div className="text-slate-900 font-semibold mt-2">{resultItem.title}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Document Type</div>
                      <div className="text-slate-900 font-semibold mt-2">{resultItem.documentType || 'Not specified'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Issuer Organization</div>
                      <div className="text-slate-900 font-semibold mt-2">{resultItem.issuingOrganization}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Issuer / Uploader</div>
                      <div className="text-slate-900 font-semibold mt-2">{resultItem.ownerName}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Upload Date</div>
                      <div className="text-slate-900 font-semibold mt-2">{resultItem.uploadDate ? new Date(resultItem.uploadDate).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">Status</div>
                      <div className={`mt-2 font-semibold ${resultItem.isAuthentic ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {resultItem.isAuthentic ? '✓ Authentic' : '✗ Tampered'}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold mb-2">SHA-256 Hash</div>
                      <div className="text-brand-600 font-mono text-xs break-all bg-slate-100 p-2 rounded border border-slate-200">
                        {resultItem.sha256Hash}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <a
                      href={`${API_SERVER}/api/documents/public/${resultItem.id}/view`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-100 bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-600 transition hover:border-brand-500"
                    >
                      <FileText size={16} /> Read
                    </a>
                    <a
                      href={`${API_SERVER}/api/documents/public/${resultItem.id}/download`}
                      download
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-600 transition hover:bg-brand-100"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
