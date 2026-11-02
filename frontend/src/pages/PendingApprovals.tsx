import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, XCircle, Clock, FileText, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { Card, Button, Badge } from '../components/UI';
import { api } from '../lib/api';
import { formatDate } from '../utils/helpers';
import { DocumentRecord } from '../types';

interface PendingApprovalsProps {
  token: string;
  user: any;
}

export const PendingApprovals: React.FC<PendingApprovalsProps> = ({ token, user }) => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Rejection modal state
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await api.get('/management/pending', token);
      setDocuments(res.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch pending documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setError('');
    try {
      await api.post(`/management/approve/${id}`, {}, token);
      setSuccess('Document approved and registered on blockchain.');
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingDocId || !rejectReason.trim()) return;

    setActionLoading(rejectingDocId);
    setError('');
    try {
      await api.post(`/management/reject/${rejectingDocId}`, { reason: rejectReason.trim() }, token);
      setSuccess('Document rejected.');
      setDocuments(prev => prev.filter(doc => doc.id !== rejectingDocId));
      setRejectingDocId(null);
      setRejectReason('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-brand-600" /> Compliance Queue
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {user.role === 'Admin' 
              ? 'Compliance monitoring: Pending cryptographic anchoring requests.' 
              : `Authorized compliance verifier for ${user.organization}.`}
          </p>
        </div>
        <Badge variant="warning" className="h-8 px-4 font-black">{documents.length} Staged</Badge>
      </div>

      {user.role === 'Verifier' && (
        <Card className="bg-brand-50/10 border-brand-200 py-4 px-6 shadow-sm border-l-4 border-l-brand-600">
          <div className="flex items-center gap-3 text-brand-800 text-xs font-bold uppercase tracking-wider">
            <AlertCircle size={16} />
            <span>ORGANIZATIONAL RESTRICTION GATING ACTIVE: You are restricted to auditing assets issued by {user.organization}.</span>
          </div>
        </Card>
      )}

      {error && <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center gap-3 text-sm font-semibold shadow-sm"><XCircle size={18} />{error}</div>}
      {success && <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 flex items-center gap-3 text-sm font-semibold shadow-sm"><ShieldCheck size={18} />{success}</div>}

      {documents.length === 0 ? (
        <Card className="text-center py-20 border-dashed border-2">
          <Clock size={44} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-black text-slate-950 uppercase tracking-tight">Compliance Queue is Silent</h3>
          <p className="text-slate-500 text-sm mt-1.5">No documents are currently awaiting auditing verification.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover:border-slate-300 hover:shadow-md transition-all border-slate-200/60 shadow-sm">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 p-1">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                    <FileText className="text-amber-600" size={24} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{doc.title}</h4>
                    <div className="text-xs font-bold text-slate-500 mt-2 flex flex-wrap gap-x-6 gap-y-1.5 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-500"/> {doc.issuingOrganization}</span>
                      <span className="flex items-center gap-1.5">Subject: <strong className="text-slate-700">{doc.ownerName}</strong></span>
                      <span className="flex items-center gap-1.5">Class: <strong className="text-slate-700">{doc.documentType}</strong></span>
                    </div>
                    <div className="mt-3 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <span className="px-2 py-0.5 bg-slate-100 rounded border">SUBMITTED BY {(doc as any).uploadedBy?.name || 'Authorized Submitter'}</span>
                       <span>•</span>
                       <span>Staged: {formatDate(doc.uploadDate || '')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0 self-end xl:self-center">
                  <Button 
                    variant="outline" 
                    className="h-11 px-5 text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-bold uppercase tracking-wider rounded-xl"
                    onClick={() => setRejectingDocId(doc.id)}
                    disabled={!!actionLoading}
                  >
                    Reject Asset
                  </Button>
                  <Button 
                    variant="brand" 
                    className="h-11 px-6 shadow-lg shadow-brand-500/10 text-xs font-bold uppercase tracking-wider rounded-xl bg-brand-600 hover:bg-brand-700 text-white"
                    onClick={() => handleApprove(doc.id)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === doc.id ? 'Anchoring...' : (
                      <>
                        <ShieldCheck size={16} /> Sign &amp; Anchor on Blockchain
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dynamic Rejection Modal */}
      <AnimatePresence>
        {rejectingDocId && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setRejectingDocId(null)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <ShieldAlert size={20} className="text-rose-500" /> Reject Compliance Asset
                </h3>
                <button onClick={() => setRejectingDocId(null)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Provide Rejection Rationale</label>
                  <textarea 
                    required 
                    rows={4}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-sm font-semibold resize-none"
                    placeholder="Enter reason for compliance rejection..."
                  />
                </div>

                <div className="flex gap-3 mt-4">
                  <Button type="button" variant="outline" className="flex-1 h-11 text-xs font-bold rounded-xl" onClick={() => setRejectingDocId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/10 text-xs">
                    Reject Compliance
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
