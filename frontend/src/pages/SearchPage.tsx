import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search as SearchIcon, 
  ShieldCheck, 
  FileText, 
  ChevronRight, 
  Hash, 
  Download, 
  QrCode, 
  Share2, 
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  Clock,
  Mail,
  Copy,
  Check,
  ScanSearch
} from 'lucide-react';
import { Card, Button, Badge } from '../components/UI';
import { VerificationDetailsModal } from '../components/VerificationDetailsModal';
import { api, getBaseUrl } from '../lib/api';
import { formatDate } from '../utils/helpers';
import { cn } from '../lib/utils';
import { DocumentRecord } from '../types';

interface SearchPageProps {
  token: string;
  userId: string;
  userRole: string;
}

export const SearchPage: React.FC<SearchPageProps> = ({ token, userId, userRole }) => {
  const [query, setQuery] = useState('');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultsTitle, setResultsTitle] = useState('Recently Registered');
  const [verificationStatuses, setVerificationStatuses] = useState<Record<string, any>>({});
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [selectedVerificationId, setSelectedVerificationId] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [emailHashDocument, setEmailHashDocument] = useState<DocumentRecord | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
  const [analysisById, setAnalysisById] = useState<Record<string, { loading?: boolean; error?: string; data?: any }>>({});

  const handleSearch = async (q?: string) => {
    const searchTerm = q !== undefined ? q : query;
    setLoading(true);
    setVerificationStatuses({}); // Reset verification statuses on new search
    try {
      const endpoint = searchTerm.trim() 
        ? `/search/documents?q=${encodeURIComponent(searchTerm)}&limit=20`
        : `/search/documents?limit=10`;
      
      const res = await api.get(endpoint, token);
      const docs = res.items || [];
      setDocuments(docs);
      setResultsTitle(searchTerm.trim() ? `Search Results for "${searchTerm}"` : 'Recently Registered');
    } catch (err) {
      if (import.meta.env.DEV) console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const performManualVerification = async (docId: string) => {
    if (verifyingIds.has(docId)) return; // Prevent duplicate requests
    
    const newVerifyingIds = new Set(verifyingIds);
    newVerifyingIds.add(docId);
    setVerifyingIds(newVerifyingIds);
    
    try {
      const res = await api.get(`/verification/hash/${docId}`, token);
      setVerificationStatuses(prev => ({ ...prev, [docId]: res }));
      // Auto-open modal on successful verification
      setSelectedVerificationId(docId);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error(`Verification failed for ${docId}:`, err);
      setVerificationStatuses(prev => ({ ...prev, [docId]: { error: err.message } }));
    } finally {
      const newIds = new Set(verifyingIds);
      newIds.delete(docId);
      setVerifyingIds(newIds);
    }
  };

  const handleShare = async (docId: string) => {
    const shareUrl = `${window.location.origin}/?tab=search&id=${docId}`;
    await navigator.clipboard.writeText(shareUrl);
    setNotificationMessage('Secure deep link copied to clipboard.');
    window.setTimeout(() => setNotificationMessage(''), 3000);
  };

  const handleCopyHash = async (doc: DocumentRecord) => {
    if (!doc.sha256Hash) return;
    await navigator.clipboard.writeText(doc.sha256Hash);
    setCopiedHashId(doc.id);
    window.setTimeout(() => setCopiedHashId(null), 2000);
  };

  const handleEmailHash = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailHashDocument) return;
    setEmailSending(true);
    setNotificationMessage('');
    try {
      const result = await api.post(`/documents/${emailHashDocument.id}/email-hash`, {
        recipientEmail,
        message: emailMessage,
      }, token);
      setNotificationMessage(result.message || 'SHA-256 hash sent successfully.');
      setEmailHashDocument(null);
      setRecipientEmail('');
      setEmailMessage('');
    } catch (err: any) {
      setNotificationMessage(err?.message || 'Unable to send SHA-256 hash. Please check the email configuration.');
    } finally {
      setEmailSending(false);
    }
  };

  const handleAnalyzeDocument = async (doc: DocumentRecord) => {
    setAnalysisById((current) => ({ ...current, [doc.id]: { loading: true } }));
    try {
      const result = await api.post('/ai/analyze-document', { documentId: doc.id }, token);
      setAnalysisById((current) => ({ ...current, [doc.id]: { data: result.data } }));
    } catch (err: any) {
      setAnalysisById((current) => ({ ...current, [doc.id]: { error: err?.message || 'AI analysis unavailable' } }));
    }
  };

  const handleRead = (docId: string) => {
    void openDocumentFile(docId, 'view');
  };

  const handleDownload = (docId: string) => {
    void openDocumentFile(docId, 'download');
  };

  const openDocumentFile = async (docId: string, action: 'view' | 'download') => {
    const previewWindow = action === 'view' ? window.open('about:blank', '_blank') : null;
    try {
      const response = await fetch(`${getBaseUrl()}/api/documents/${docId}/${action}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || 'Document request failed');
      }
      const file = await response.blob();
      const objectUrl = URL.createObjectURL(file);
      if (action === 'view' && previewWindow) {
        previewWindow.location.href = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } else {
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        const disposition = response.headers.get('Content-Disposition') || '';
        const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
        anchor.download = filename || docId;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (err: any) {
      previewWindow?.close();
      setNotificationMessage(err?.message || 'Document request failed');
    }
  };

  useEffect(() => {
    handleSearch();
    
    // Deep Link: Verify if ID is in URL (manual verification only)
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) {
      performManualVerification(idParam);
    }
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge variant="success" className="gap-1"><CheckCircle2 size={12}/> Verified</Badge>;
      case 'pending': return <Badge variant="warning">Pending</Badge>;
      case 'rejected': return <Badge variant="error">Rejected</Badge>;
      default: return <Badge variant="info">{status}</Badge>;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8 relative">
      

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all text-lg shadow-sm"
            placeholder="Search documents by ID, title, owner, or hash..."
          />
        </div>
        <Button onClick={() => handleSearch()} disabled={loading} className="px-10 h-[60px] text-lg shadow-xl shadow-brand-500/20">
          {loading ? 'Analyzing...' : 'Execute Search'}
        </Button>
      </div>

      <div className="space-y-4">
        {notificationMessage && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 shadow-sm">
            {notificationMessage}
          </div>
        )}
        <div className="flex items-center justify-between px-2">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{resultsTitle}</h3>
           <span className="text-xs font-bold text-slate-400">{documents.length} secure records loaded</span>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white border border-slate-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : documents.length === 0 ? (
          <Card className="text-center py-20 bg-slate-50/50 border-dashed border-2">
            <SearchIcon size={56} className="mx-auto text-slate-200 mb-6" />
            <h3 className="text-xl font-black text-slate-900 mb-2">Registry is Silent</h3>
            <p className="text-slate-500">No documents match your query in the blockchain records.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="hover:shadow-xl transition-all group border-slate-100 hover:border-brand-200">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-2">
                  <div className="flex items-start gap-5 flex-1 min-w-0">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-brand-600 group-hover:text-white transition-all duration-300">
                      <FileText size={28} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h4 className="font-black text-slate-900 text-lg truncate">{doc.title}</h4>
                        {getStatusBadge(doc.status || 'pending')}
                        {verificationStatuses[doc.id] && !verificationStatuses[doc.id].error && (
                          <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                            verificationStatuses[doc.id].isAuthentic ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                             {verificationStatuses[doc.id].isAuthentic ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                             {verificationStatuses[doc.id].isAuthentic ? "Verified Authentic" : "Verification Failed"}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-500 flex flex-wrap gap-x-6 gap-y-2 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-500"/> {doc.issuingOrganization}</span>
                        <span className="flex items-center gap-1.5"><ChevronRight size={14}/> {doc.ownerName}</span>
                        <span className="flex items-center gap-1.5"><Clock size={14}/> {formatDate(doc.createdAt)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="max-w-full text-[10px] font-mono font-bold text-slate-500 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                          <Hash size={12} className="text-brand-500 shrink-0" />
                          <code className="select-all break-all">{doc.sha256Hash}</code>
                          <button type="button" title="Copy SHA-256" onClick={() => handleCopyHash(doc)} className="shrink-0 text-slate-500 hover:text-brand-700">
                            {copiedHashId === doc.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                      {(userRole === 'Admin' || String(doc.uploadedBy) === userId) && (
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={analysisById[doc.id]?.loading}
                            onClick={() => handleAnalyzeDocument(doc)}
                            className="h-9 px-3 gap-2 text-xs"
                          >
                            <ScanSearch size={14} />
                            {analysisById[doc.id]?.loading ? 'Analyzing...' : 'Analyze for Anomalies'}
                          </Button>
                          {analysisById[doc.id]?.error && <p role="alert" className="mt-2 text-xs text-rose-700">{analysisById[doc.id].error}</p>}
                          {analysisById[doc.id]?.data && (
                            <section aria-label="AI document anomaly analysis" className="mt-3 border-l-2 border-amber-500 bg-amber-50/70 px-3 py-2 text-xs text-slate-700">
                              <p className="font-bold">AI anomaly risk: {analysisById[doc.id].data.riskLevel} · Confidence {Math.round(analysisById[doc.id].data.confidence * 100)}%</p>
                              <ul className="mt-1 list-disc pl-4">{analysisById[doc.id].data.findings.map((finding: string, index: number) => <li key={`${index}-${finding}`}>{finding}</li>)}</ul>
                              <p className="mt-2">{analysisById[doc.id].data.recommendation}</p>
                              <p className="mt-1 text-slate-500">Supplemental text analysis only; SHA-256/blockchain verification remains authoritative.</p>
                            </section>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0 self-end lg:self-center flex-wrap">
                    {doc.status === "verified" && !verificationStatuses[doc.id] && (
                      <Button 
                        onClick={() => performManualVerification(doc.id)}
                        disabled={verifyingIds.has(doc.id)}
                        variant="brand" 
                        className="h-12 px-6 text-xs gap-2 shadow-lg shadow-brand-500/20"
                      >
                        <ShieldCheck size={16} /> {verifyingIds.has(doc.id) ? 'Verifying...' : 'Verify'}
                      </Button>
                    )}
                    {verificationStatuses[doc.id] && !verificationStatuses[doc.id].error && (
                      <>
                        <Button 
                          onClick={() => handleRead(doc.id)} 
                          variant="brand" 
                          className="h-12 px-6 text-xs gap-2 shadow-lg shadow-brand-500/20"
                        >
                          <Eye size={16} /> Read
                        </Button>
                        <Button 
                          onClick={() => handleDownload(doc.id)} 
                          variant="brand" 
                          className="h-12 px-6 text-xs gap-2 shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Download size={16} /> Download
                        </Button>
                      </>
                    )}
                    <Button onClick={() => handleShare(doc.id)} variant="outline" className="h-12 w-12 p-0 hover:bg-slate-50">
                      <Share2 size={18} />
                    </Button>
                    {(userRole === 'Admin' || String(doc.uploadedBy) === userId) && doc.status === 'verified' && doc.blockchain?.confirmed && (
                      <Button
                        onClick={() => setEmailHashDocument(doc)}
                        variant="outline"
                        className="h-12 px-4 gap-2"
                        title="Email the stored SHA-256 hash"
                      >
                        <Mail size={16} /> Email Hash
                      </Button>
                    )}
                    {verificationStatuses[doc.id] && !verificationStatuses[doc.id].error && (
                      <Button 
                        onClick={() => setSelectedVerificationId(doc.id)}
                        variant="ghost" 
                        className="h-12 px-6 text-xs font-black uppercase tracking-widest text-brand-600 hover:text-brand-700 gap-2"
                      >
                        Details <ExternalLink size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {emailHashDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !emailSending && setEmailHashDocument(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-hash-title"
            className="w-full max-w-lg space-y-5 rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="email-hash-title" className="text-lg font-bold text-slate-900">Send SHA-256 Hash</h2>
              <button type="button" aria-label="Close" disabled={emailSending} onClick={() => setEmailHashDocument(null)} className="p-2 text-slate-500 hover:text-slate-900">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Document:</span> {emailHashDocument.title}</p>
              <p className="font-mono text-xs break-all select-all">{emailHashDocument.sha256Hash}</p>
            </div>
            <form onSubmit={handleEmailHash} className="space-y-4">
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                Recipient email
                <input type="email" required maxLength={254} value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                Optional message
                <textarea maxLength={1000} rows={3} value={emailMessage} onChange={(event) => setEmailMessage(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={emailSending} onClick={() => setEmailHashDocument(null)}>Cancel</Button>
                <Button type="submit" disabled={emailSending}>{emailSending ? 'Sending...' : 'Send SHA-256'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}

      <VerificationDetailsModal
        isOpen={selectedVerificationId !== null}
        onClose={() => setSelectedVerificationId(null)}
        verification={selectedVerificationId ? verificationStatuses[selectedVerificationId] : null}
        onDownload={() => {
          if (selectedVerificationId) {
            handleDownload(selectedVerificationId);
          }
        }}
        onRead={() => {
          if (selectedVerificationId) {
            handleRead(selectedVerificationId);
          }
        }}
      />
    </motion.div>
  );
};
