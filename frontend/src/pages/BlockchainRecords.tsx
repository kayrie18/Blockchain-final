import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link2, ExternalLink, ShieldCheck, Search, Database } from 'lucide-react';
import { Card, Badge } from '../components/UI';
import { api } from '../lib/api';
import { formatDate } from '../utils/helpers';
import { DocumentRecord } from '../types';

interface BlockchainRecordsProps {
  token: string;
}

export const BlockchainRecords: React.FC<BlockchainRecordsProps> = ({ token }) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      // Fetch only verified documents
      const res = await api.get('/search/documents?status=verified&limit=50', token);
      setDocuments(res.items || []);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to fetch records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filtered = documents.filter(doc => 
    doc.title.toLowerCase().includes(search.toLowerCase()) ||
    doc.ownerName.toLowerCase().includes(search.toLowerCase()) ||
    doc.sha256Hash.toLowerCase().includes(search.toLowerCase()) ||
    doc.blockchain?.transactionId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Blockchain Records</h2>
          <p className="text-slate-500">Immutable ledger of verified document hashes</p>
        </div>
        
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search hash or Tx ID..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Database size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No records found</h3>
          <p className="text-slate-500">Wait for documents to be approved and registered</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Document</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Hash (SHA-256)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Blockchain Tx ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-900">{doc.title}</div>
                    <div className="text-xs text-slate-500">{doc.ownerName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 group">
                      <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]" title={doc.sha256Hash}>
                        {doc.sha256Hash}
                      </div>
                      <Link2 size={12} className="text-slate-300 group-hover:text-brand-500 cursor-pointer" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="font-mono text-[10px]">
                        {doc.blockchain?.transactionId?.substring(0, 15)}...
                      </Badge>
                      <ExternalLink size={12} className="text-slate-300 hover:text-brand-500 cursor-pointer" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                       <ShieldCheck size={14} className="text-emerald-500" />
                       {formatDate(doc.createdAt || '')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};
