import React, { useEffect, useMemo, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactAny = any;
import { motion, AnimatePresence } from 'motion/react';

import { Search, ShieldCheck, AlertTriangle, Clock, X, FileText, Copy, Check, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Card } from './UI';


type PublicVerificationStatus =
  | 'VALID'
  | 'TAMPERED'
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'REVOKED'
  | 'REJECTED'
  | 'PENDING'
  | 'VERIFICATION_UNAVAILABLE';

type PublicVerificationVerdict = {
  status: PublicVerificationStatus;
  isAuthentic: boolean;
  blockchainAnchoringStatus?: string;
  verificationTimestamp?: string;
  tamperDetectionResult?: {
    hashMatches?: boolean;
    details?: string;
  };
  document?: {
    id?: string;
    documentId?: string;
    title?: string;
    documentType?: string;
    sha256Hash?: string;
    blockchainHash?: string;
    issuer?: string;
    ownerName?: string;
    uploadDate?: string;
    uploader?: string;
    ipfsCid?: string;
    storageProvider?: string;
    storagePath?: string;
    originalFileName?: string;
  };
  // allow backend to return richer fields without breaking UI
  [k: string]: any;
};

type SearchResultItem = {
  id?: string;
  documentId?: string;
  title?: string;
  documentType?: string;
  sha256Hash?: string;
  blockchain?: any;
  blockchainHash?: string;
  issuingOrganization?: string;
  ownerName?: string;
  uploader?: string;
  uploadDate?: string;
  status?: string;
  verificationStatus?: string;
  isAuthentic?: boolean;
  expiryDate?: string;
  // extra fields that other backend/public responses may include
  issuer?: string;
  ipfsCid?: string;
  storageProvider?: string;
  originalFileName?: string;
};

const statusToUi = (status?: string) => {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'VALID':
    case 'VERIFIED':
      return {
        label: 'VALID',
        pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <ShieldCheck size={14} />,
      };
    case 'TAMPERED':
      return {
        label: 'TAMPERED',
        pill: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <AlertTriangle size={14} />,
      };
    case 'NOT_FOUND':
      return {
        label: 'NOT FOUND',
        pill: 'bg-slate-50 text-slate-700 border-slate-200',
        icon: <X size={14} />,
      };
    case 'EXPIRED':
      return {
        label: 'EXPIRED',
        pill: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: <Clock size={14} />,
      };
    case 'PENDING':
      return {
        label: 'PENDING',
        pill: 'bg-sky-50 text-sky-700 border-sky-200',
        icon: <Clock size={14} />,
      };
    case 'REVOKED':
      return {
        label: 'REVOKED',
        pill: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <AlertTriangle size={14} />,
      };
    default:
      return {
        label: s || 'UNKNOWN',
        pill: 'bg-slate-50 text-slate-700 border-slate-200',
        icon: <AlertTriangle size={14} />,
      };
  }
};

const formatMaybeDate = (d?: string | Date | number) => {
  if (!d) return 'N/A';
  let date: Date;
  if (typeof d === 'number') {
    // Unix timestamp (seconds) - convert to milliseconds
    date = new Date(d * 1000);
  } else if (typeof d === 'string') {
    date = new Date(d);
  } else {
    date = d;
  }
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const getBaseUrlLocal = () => {
  return window.location.protocol + '//' + window.location.host;
};

export const PublicVerifyFlow: React.FC<{ initialQuery?: string }> = ({ initialQuery }) => {
  const [activeTab, setActiveTab] = useState<'verify' | 'check'>('verify');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [query, setQuery] = useState(initialQuery || '');
  const [selected, setSelected] = useState<SearchResultItem | null>(null);

  const [searchLoading, setSearchLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [searchError, setSearchError] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const [verification, setVerification] = useState<PublicVerificationVerdict | null>(null);

  const [copied, setCopied] = useState(false);
  const [verifyHashCopied, setVerifyHashCopied] = useState(false);

  // Auto-trigger search and verification when initialQuery is provided (deep link)
  useEffect(() => {
    if (initialQuery) {
      const autoSearchAndVerify = async () => {
        setSearchLoading(true);
        setSearchError('');
        setVerifyError('');
        setVerification(null);
        setSelected(null);
        setStep(2);
        try {
          const qStr = initialQuery.trim();
          const data = await api.get(`/search/public?q=${encodeURIComponent(qStr)}`);
          const docs: SearchResultItem[] = Array.isArray(data)
            ? data
            : Array.isArray(data.documents)
            ? data.documents
            : Array.isArray(data.items)
              ? data.items
              : Array.isArray(data.document)
                ? [data.document]
                : data?.id
                  ? [data]
                  : [];

          if (!docs.length) {
            setSearchError('No verified document found matching your query.');
            setStep(1);
            return;
          }

          const first = docs[0];
          setSelected(first);
          setStep(3);

          // Trigger immediate verification
          setVerifyLoading(true);
          const res = await api.get(`/verification/hash/${first.id || first.documentId}`);
          const v: PublicVerificationVerdict = {
            status: String(res.status || res.verdict || res.verificationStatus || 'UNKNOWN').toUpperCase(),
            isAuthentic: !!res.isAuthentic,
            blockchainAnchoringStatus: res.blockchain?.confirmed
              ? 'CONFIRMED'
              : res.blockchain?.transactionId
                ? 'PENDING'
                : res.blockchainAnchoringStatus,
            verificationTimestamp: res.verificationTimestamp,
            tamperDetectionResult: res.tamperDetectionResult,
            document: {
              id: first.id || first.documentId,
              documentId: first.id || first.documentId,
              title: res.title || first.title,
              documentType: res.documentType || first.documentType,
              sha256Hash: res.hash || res.sha256Hash || first.sha256Hash,
              blockchainHash: res.blockchainHash || res.blockchain?.sha256HashHex,
              issuer: res.issuer || res.issuingOrganization || first.ownerName || first.issuingOrganization,
              ownerName: res.ownerName || first.ownerName,
              uploadDate: res.uploadDate || first.uploadDate,
              uploader: res.uploader,
              blockchain: res.blockchain,
              originalFileName: res.originalFileName,
            },
            ...res,
          };
          setVerification(v);
          setStep(4);
        } catch (err: any) {
          setSearchError(err?.message || 'Verification failed.');
          setStep(1);
        } finally {
          setSearchLoading(false);
          setVerifyLoading(false);
        }
      };
      autoSearchAndVerify();
    }
  }, [initialQuery]);

  // For check uploaded copy
  const [expectedHash, setExpectedHash] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [checkResult, setCheckResult] = useState<PublicVerificationVerdict | null>(null);

  const canVerify = !!query.trim();

  const normalizedResults = useMemo(() => {
    if (!selected) return null;

    // UML enforcement: verification result is ONLY obtained via the VERIFY API call.
    // Search returns metadata only; do not trust any "verificationStatus/isAuthentic" fields from search.
    return {
      id: selected.id || selected.documentId,
      title: selected.title,
      documentType: selected.documentType,
      sha256Hash: selected.sha256Hash,
      issuer: selected.issuer || selected.issuingOrganization || selected.ownerName,
      uploadDate: selected.uploadDate,
      status: selected.status,
      ipfsCid: selected.ipfsCid,
      storageProvider: selected.storageProvider,
      originalFileName: selected.originalFileName,
    };
  }, [selected]);


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;

    setSearchLoading(true);
    setSearchError('');
    setVerifyError('');
    setVerification(null);
    setSelected(null);
    setStep(2);

    try {
      const data = await api.get(`/search/public?q=${encodeURIComponent(query.trim())}`);
      const docs: SearchResultItem[] = Array.isArray(data)
        ? data
        : Array.isArray(data.documents)
        ? data.documents
        : Array.isArray(data.items)
          ? data.items
          : Array.isArray(data.document)
            ? [data.document]
            : data?.id
              ? [data]
              : [];

      if (!docs.length) {
        setSearchError('No verified document found matching your query.');
        setStep(1);
        return;
      }

      // public flow: if multiple, pick first (UI can be extended later)
      const first = docs[0];
      setSelected(first);
      setStep(3);
    } catch (err: any) {
      setSearchError(err?.message || 'Search failed.');
      setStep(1);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!normalizedResults?.id) return;
    // Prevent duplicate verification requests while one is in-flight or after completion.
    if (verifyLoading) return;
    if (verification && step === 4) return;

    setVerifyLoading(true);
    setVerifyError('');
    // Keep the found-card visible while verifying (step 3), but clear prior result.
    setVerification(null);

    try {
      const res = await api.get(`/verification/hash/${normalizedResults.id}`);

      const v: PublicVerificationVerdict = {
        status: String(res.status || res.verdict || res.verificationStatus || 'UNKNOWN').toUpperCase(),
        isAuthentic: !!res.isAuthentic,
        blockchainAnchoringStatus: res.blockchain?.confirmed
          ? 'CONFIRMED'
          : res.blockchain?.transactionId
            ? 'PENDING'
            : res.blockchainAnchoringStatus,
        verificationTimestamp: res.verificationTimestamp,
        tamperDetectionResult: res.tamperDetectionResult,
        document: {
          id: normalizedResults.id,
          documentId: normalizedResults.id,
          title: res.title || normalizedResults.title,
          documentType: res.documentType || normalizedResults.documentType,
          sha256Hash: res.hash || res.sha256Hash || normalizedResults.sha256Hash,
          blockchainHash: res.blockchainHash || res.blockchain?.sha256HashHex,
          issuer: res.issuer || res.issuingOrganization || normalizedResults.issuer,
          ownerName: res.ownerName || normalizedResults.issuer,
          uploadDate: res.uploadDate || normalizedResults.uploadDate,
          uploader: res.uploader,
          blockchain: res.blockchain,
          originalFileName: res.originalFileName,
        },
        ...res,
      };

      setVerification(v);
      setStep(4);
    } catch (err: any) {
      setVerifyError(err?.message || 'Verification failed.');
      // Stay in step 3 so the Verify button can be retried (if user wants).
      setStep(3);
    } finally {
      setVerifyLoading(false);
    }
  };


  const handleCopy = async () => {
    if (!normalizedResults?.sha256Hash) return;
    await navigator.clipboard.writeText(normalizedResults.sha256Hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyVerifyHash = async () => {
    const hash = verification?.document?.sha256Hash;
    if (!hash) return;
    await navigator.clipboard.writeText(hash);
    setVerifyHashCopied(true);
    setTimeout(() => setVerifyHashCopied(false), 1800);
  };

  const handleShareVerification = () => {
    if (!verification) return;
    const docTitle = verification.document?.title || 'Document';
    const hash = verification.document?.sha256Hash || 'N/A';
    const status = (verification.status || 'UNKNOWN').toUpperCase();
    const ts = verification.verificationTimestamp
      ? new Date(verification.verificationTimestamp).toLocaleString()
      : new Date().toLocaleString();
    const subject = encodeURIComponent(`Verification Certificate — ${docTitle}`);
    const body = encodeURIComponent(
      `CHAINVERIFY — DOCUMENT VERIFICATION CERTIFICATE\n` +
      `================================================\n\n` +
      `Document: ${docTitle}\n` +
      `Verification Status: ${status}\n` +
      `SHA-256 Authenticity Hash: ${hash}\n` +
      `Blockchain Anchoring: ${verification.blockchainAnchoringStatus || 'N/A'}\n` +
      `Verified At: ${ts}\n\n` +
      `To independently verify this document, visit the ChainVerify public portal and search for the SHA-256 hash above.\n\n` +
      `This certificate was generated by ChainVerify — Blockchain-Powered Document Integrity.`
    ).replace(/%0A/g, '%0D%0A');
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleCheckUploadedCopy = async () => {
    if (!uploadedFile || !expectedHash.trim()) return;
    setCheckLoading(true);
    setCheckError('');
    setCheckResult(null);

    try {
      // Generate hash of uploaded file
      const fileBuffer = await uploadedFile.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const uploadedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Compare with expected hash
      const hashMatches = uploadedHash.toLowerCase() === expectedHash.trim().toLowerCase();

      const result: PublicVerificationVerdict = {
        status: hashMatches ? 'VALID' : 'TAMPERED',
        isAuthentic: hashMatches,
        verificationTimestamp: new Date().toISOString(),
        tamperDetectionResult: {
          hashMatches,
          details: hashMatches
            ? 'Uploaded file hash matches the expected hash.'
            : 'Uploaded file hash does not match the expected hash.',
        },
        document: {
          sha256Hash: uploadedHash,
          blockchainHash: expectedHash,
        },
      };

      setCheckResult(result);
    } catch (err: any) {
      setCheckError(err?.message || 'Check failed.');
    } finally {
      setCheckLoading(false);
    }
  };

  const uiStatus = statusToUi(verification?.status || verification?.verificationStatus);
  const isVerifiedValid = (verification?.status || '').toUpperCase() === 'VALID';
  const checkUiStatus = statusToUi(checkResult?.status || checkResult?.verificationStatus);
  const isCheckValid = (checkResult?.status || '').toUpperCase() === 'VALID';

  return (
    <div className="mt-2">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('verify')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'verify'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Find Verified Record
        </button>
        <button
          onClick={() => setActiveTab('check')}
          className={`px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'check'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Compare Local Copy
        </button>
      </div>

      {activeTab === 'verify' && (
        <VerifyByHashTab
          step={step}
          query={query}
          setQuery={setQuery}
          selected={selected}
          searchLoading={searchLoading}
          verifyLoading={verifyLoading}
          searchError={searchError}
          verifyError={verifyError}
          verification={verification}
          copied={copied}
          verifyHashCopied={verifyHashCopied}
          normalizedResults={normalizedResults}
          canVerify={canVerify}
          uiStatus={uiStatus}
          isVerifiedValid={isVerifiedValid}
          onSearch={handleSearch}
          onVerify={handleVerify}
          onCopy={handleCopy}
          onCopyVerifyHash={handleCopyVerifyHash}
          onShareVerification={handleShareVerification}
          onClearError={() => setSearchError('')}
        />
      )}

      {activeTab === 'check' && (
        <CheckUploadedCopyTab
          expectedHash={expectedHash}
          setExpectedHash={setExpectedHash}
          uploadedFile={uploadedFile}
          setUploadedFile={setUploadedFile}
          checkLoading={checkLoading}
          checkError={checkError}
          checkResult={checkResult}
          checkUiStatus={checkUiStatus}
          isCheckValid={isCheckValid}
          onCheck={handleCheckUploadedCopy}
          onClearError={() => setCheckError('')}
        />
      )}
    </div>
  );
};

// --- Tab Components ---

interface VerifyByHashTabProps {
  step: 1 | 2 | 3 | 4;
  query: string;
  setQuery: (q: string) => void;
  selected: SearchResultItem | null;
  searchLoading: boolean;
  verifyLoading: boolean;
  searchError: string;
  verifyError: string;
  verification: PublicVerificationVerdict | null;
  copied: boolean;
  verifyHashCopied: boolean;
  normalizedResults: any;
  canVerify: boolean;
  uiStatus: any;
  isVerifiedValid: boolean;
  onSearch: (e: React.FormEvent) => void;
  onVerify: () => void;
  onCopy: () => void;
  onCopyVerifyHash: () => void;
  onShareVerification: () => void;
  onClearError: () => void;
}

const VerifyByHashTab: React.FC<VerifyByHashTabProps> = ({
  step,
  query,
  setQuery,
  selected,
  searchLoading,
  verifyLoading,
  searchError,
  verifyError,
  verification,
  copied,
  verifyHashCopied,
  normalizedResults,
  canVerify,
  uiStatus,
  isVerifiedValid,
  onSearch,
  onVerify,
  onCopy,
  onCopyVerifyHash,
  onShareVerification,
  onClearError,
}) => {
  return (
    <>
      <form onSubmit={onSearch} className="space-y-5">
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search size={18} className="text-slate-400" />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter verified document hash, ID, or issuer metadata"
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500"
              disabled={searchLoading || verifyLoading}
            />
          </div>
          <Button type="submit" disabled={!canVerify || searchLoading} className="h-[54px] px-8 rounded-2xl">
            {searchLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
        {searchError && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
            <span className="text-sm font-bold text-rose-600">{searchError}</span>
            <button type="button" onClick={() => onClearError()} className="w-8 h-8 rounded-full hover:bg-rose-100 flex items-center justify-center">
              <X size={16} className="text-rose-500" />
            </button>
          </div>
        )}
      </form>

      <AnimatePresence>
        {step === 3 && normalizedResults && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-xl">Document found</h3>
                <div className="mt-1 text-xs font-bold text-emerald-600 uppercase tracking-widest">
                  Ready to verify authenticity
                </div>
              </div>
            </div>

            <div className="mt-5 grid md:grid-cols-2 gap-4">
              <ResultField label="Document Name" value={normalizedResults.title || 'N/A'} />
              <ResultField label="Issuer" value={normalizedResults.issuer || 'N/A'} />
              <ResultField label="Upload Date" value={formatMaybeDate(normalizedResults.uploadDate)} />
              <ResultField label="Status" value={normalizedResults.status || 'N/A'} />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">DOCUMENT HASH (SHA-256)</div>
                <div className="mt-2 font-mono text-sm break-all bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-800">
                  {normalizedResults.sha256Hash || 'N/A'}
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onCopy} disabled={!normalizedResults.sha256Hash}>
                  {copied ? (
                    <>
                      <Check size={16} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Copy
                    </>
                  )}
                </Button>
                <Button type="button" variant="brand" onClick={onVerify} disabled={verifyLoading} className="px-8 rounded-2xl">
                  {verifyLoading ? 'Verifying...' : 'VERIFY'}
                </Button>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">This hash references the public verified registry entry. Click VERIFY to confirm blockchain authenticity.</div>
            
            {verifyError && (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
                <span className="text-sm font-bold text-rose-600">{verifyError}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === 4 && verification && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${uiStatus.pill}`}>
                  {uiStatus.icon}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl">Verification Result</h3>
                  <div className={`mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-xl border font-black text-[12px] uppercase tracking-widest ${uiStatus.pill}`}>
                    {uiStatus.icon}
                    {uiStatus.label}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid lg:grid-cols-2 gap-4">
              <ResultField label="Verification Status" value={uiStatus.label} />
              <ResultField label="Document Name" value={verification.document?.title || 'N/A'} />
              <ResultField label="Document Type" value={verification.document?.documentType || 'N/A'} />
              <ResultField label="Document Hash" value={verification.document?.sha256Hash || 'N/A'} mono />
              <ResultField label="Blockchain Hash" value={verification.document?.blockchainHash || verification.blockchain?.sha256HashHex || 'N/A'} mono />
              <ResultField label="Issuer / Uploader" value={verification.document?.issuer || verification.document?.ownerName || 'N/A'} />
              <ResultField label="Upload Date" value={formatMaybeDate(verification.document?.uploadDate)} />
              <ResultField label="Verification Timestamp" value={formatMaybeDate(verification.verificationTimestamp)} />
              <ResultField label="Blockchain Anchoring Status" value={verification.blockchainAnchoringStatus || 'N/A'} />
              <ResultField
                label="Tamper Detection Result"
                value={
                  verification.tamperDetectionResult?.hashMatches === true
                    ? 'HASH MATCHES (NOT TAMPERED)'
                    : verification.tamperDetectionResult?.hashMatches === false
                      ? 'HASH MISMATCH (TAMPERED)'
                      : 'N/A'
                }
              />
            </div>

            {/* Hash Copy + Share Verification */}
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="text-xs uppercase tracking-[0.25em] text-slate-400 font-bold mb-3">Authenticity Hash — Share &amp; Verify Independently</div>
              <div className="font-mono text-xs break-all bg-slate-50 border border-slate-100 rounded-xl p-3 text-slate-700 select-all mb-3">
                {verification.document?.sha256Hash || 'N/A'}
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Share this SHA-256 hash so anyone can independently verify the authenticity of this document on ChainVerify.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCopyVerifyHash}
                  disabled={!verification.document?.sha256Hash}
                  className="rounded-xl"
                >
                  {verifyHashCopied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy Hash</>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onShareVerification}
                  disabled={!verification}
                  className="rounded-xl"
                >
                  <Mail size={15} /> Share Verification
                </Button>
              </div>
            </div>

            {/* Removed redundant verifyError here since it's shown in Step 3 */}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

interface CheckUploadedCopyTabProps {
  expectedHash: string;
  setExpectedHash: (h: string) => void;
  uploadedFile: File | null;
  setUploadedFile: (f: File | null) => void;
  checkLoading: boolean;
  checkError: string;
  checkResult: PublicVerificationVerdict | null;
  checkUiStatus: any;
  isCheckValid: boolean;
  onCheck: () => void;
  onClearError: () => void;
}

const CheckUploadedCopyTab: React.FC<CheckUploadedCopyTabProps> = ({
  expectedHash,
  setExpectedHash,
  uploadedFile,
  setUploadedFile,
  checkLoading,
  checkError,
  checkResult,
  checkUiStatus,
  isCheckValid,
  onCheck,
  onClearError,
}) => {
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="space-y-5">
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-2">Expected SHA-256 Hash</label>
          <input
            type="text"
            value={expectedHash}
            onChange={(e) => setExpectedHash(e.target.value)}
            placeholder="Enter the expected document hash"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
            disabled={checkLoading}
          />
        </div>

        <div>
          <label className="text-sm font-bold text-slate-700 block mb-2">Upload Document Copy</label>
          <div 
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-brand-400 hover:bg-brand-50/30 transition-all cursor-pointer"
          >
            <FileText className="text-brand-600 mb-3" size={32} />
            <div className="text-sm font-bold text-slate-900">Click to upload document copy</div>
            <div className="text-xs text-slate-500 mt-1">For tamper detection comparison only</div>
            {uploadedFile && <div className="text-xs text-emerald-600 mt-3 font-bold">✓ {uploadedFile.name}</div>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx"
            onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>

        <Button onClick={onCheck} disabled={!expectedHash.trim() || !uploadedFile || checkLoading} className="w-full">
          {checkLoading ? 'Checking...' : 'Check Authenticity'}
        </Button>

        {checkError && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
            <span className="text-sm font-bold text-rose-600">{checkError}</span>
            <button type="button" onClick={() => onClearError()} className="w-8 h-8 rounded-full hover:bg-rose-100 flex items-center justify-center">
              <X size={16} className="text-rose-500" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {checkResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${checkUiStatus.pill}`}>
                  {checkUiStatus.icon}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl">Tamper Check Result</h3>
                  <div className={`mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-xl border font-black text-[12px] uppercase tracking-widest ${checkUiStatus.pill}`}>
                    {checkUiStatus.icon}
                    {checkUiStatus.label}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid lg:grid-cols-2 gap-4">
              <ResultField label="Check Status" value={checkUiStatus.label} />
              <ResultField label="Uploaded File Hash" value={checkResult.document?.sha256Hash || 'N/A'} mono />
              <ResultField label="Expected Hash" value={checkResult.document?.blockchainHash || 'N/A'} mono />
              <ResultField label="Verification Timestamp" value={formatMaybeDate(checkResult.verificationTimestamp)} />
              <ResultField
                label="Tamper Detection Result"
                value={
                  checkResult.tamperDetectionResult?.hashMatches === true
                    ? 'HASH MATCHES (NOT TAMPERED)'
                    : checkResult.tamperDetectionResult?.hashMatches === false
                      ? 'HASH MISMATCH (TAMPERED)'
                      : 'N/A'
                }
              />
            </div>

            <div className="mt-6">
              <p className="text-xs text-slate-500">
                This check compares your local document copy against the expected hash inside your browser. It does not create, upload, or store any official record.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const formatDisplayValue = (value: any) => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'N/A';
  return 'N/A';
};

const ResultField: React.FC<{ label: string; value: any; mono?: boolean }> = ({ label, value, mono }) => {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.3em] text-slate-400 font-bold">{label}</div>
      <div className={`mt-2 ${mono ? 'font-mono text-xs break-all' : 'font-semibold'} text-slate-900 ${mono ? 'bg-slate-50 border border-slate-100 rounded-xl p-2' : ''}`}>
        {formatDisplayValue(value)}
      </div>
    </div>
  );
};
