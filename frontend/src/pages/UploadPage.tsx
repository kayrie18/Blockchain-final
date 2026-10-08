import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileUp, ShieldCheck, Copy, Check, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { Card, Button, Badge } from '../components/UI';
import { generateSHA256 } from '../utils/helpers';

interface UploadingFile {
  id: string;
  file: File;
  title: string;
  ownerName: string;
  issuingOrganization: string;
  documentType: string;
  progress: number;
  status: 'idle' | 'processing' | 'anchored' | 'pending' | 'error';
  error?: string;
  uploadedHash?: string;
}

interface UploadPageProps {
  token: string;
  onSuccess: (message: string) => void;
  userRole?: string;
}

export const UploadPage: React.FC<UploadPageProps> = ({ token, onSuccess, userRole = 'User' }) => {
  const [queue, setQueue] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // RBAC: Only Admin and Issuer can upload
  const canUpload = userRole === 'Admin' || userRole === 'Issuer';

  // Common defaults for easy bulk uploads
  const [defaultFields, setDefaultFields] = useState({
    ownerName: '',
    issuingOrganization: '',
    documentType: 'Degree',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'txt'];

  const queuedCount = queue.length;
  const anchoredCount = queue.filter(item => item.status === 'anchored').length;
  const pendingCount = queue.filter(item => item.status === 'pending').length;
  const processingCount = queue.filter(item => item.status === 'processing').length;
  const errorCount = queue.filter(item => item.status === 'error').length;

  const validateFile = (file: File): string | null => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return `Format '.${ext}' not allowed. PDF, Office, WebP, Text, or Images only.`;
    }
    if (file.size > 20 * 1024 * 1024) {
      return 'File size exceeds institutional limit of 20MB.';
    }
    return null;
  };

  const handleFileSelection = (selectedFiles: FileList) => {
    setGlobalError('');
    const newItems: UploadingFile[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const validationError = validateFile(file);

      if (validationError) {
        setGlobalError(validationError);
        continue;
      }

      // Check duplicate in active queue
      if (queue.some(q => q.file.name === file.name && q.file.size === file.size)) {
        continue;
      }

      const fileTitle = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      newItems.push({
        id: `${Date.now()}-${i}-${Math.random()}`,
        file,
        title: fileTitle,
        ownerName: defaultFields.ownerName,
        issuingOrganization: defaultFields.issuingOrganization,
        documentType: defaultFields.documentType,
        progress: 0,
        status: 'idle',
      });
    }

    setQueue(prev => [...prev, ...newItems]);
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files);
    }
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const updateQueueField = (id: string, field: keyof UploadingFile, value: any) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const copyToClipboard = async (id: string, hash?: string) => {
    if (!hash) return;
    await navigator.clipboard.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Batch anchoring routine
  const startAnchoring = async () => {
    setGlobalError('');
    const pending = queue.filter(item => item.status === 'idle' || item.status === 'error');
    if (!pending.length) return;

    let uploadAccepted = false;
    let chainConfirmed = false;
    for (const item of pending) {
      // Validate metadata fields
      if (!item.title.trim() || !item.ownerName.trim() || !item.issuingOrganization.trim()) {
        updateQueueField(item.id, 'status', 'error');
        updateQueueField(item.id, 'error', 'All metadata fields are required.');
        continue;
      }

      // Step 1: Client Hashing (0% -> 30%)
      updateQueueField(item.id, 'status', 'processing');
      updateQueueField(item.id, 'progress', 10);
      
      let clientHash = '';
      try {
        clientHash = await generateSHA256(item.file);
        updateQueueField(item.id, 'progress', 30);
      } catch (err: any) {
        updateQueueField(item.id, 'status', 'error');
        updateQueueField(item.id, 'error', 'Failed client hash computation.');
        continue;
      }

      // Step 2: Upload and wait for the backend result.
      try {
        const formData = new FormData();
        formData.append('document', item.file);
        formData.append('title', item.title);
        formData.append('ownerName', item.ownerName);
        formData.append('issuingOrganization', item.issuingOrganization);
        formData.append('documentType', item.documentType);

        const res: any = await api.uploadForm('/documents/upload', formData, token);

        uploadAccepted = true;
        const blockchainConfirmed = res.status === 'verified' && res.document?.blockchain?.confirmed === true;
        chainConfirmed ||= blockchainConfirmed;
        updateQueueField(item.id, 'progress', blockchainConfirmed ? 100 : 90);
        updateQueueField(item.id, 'status', blockchainConfirmed ? 'anchored' : 'pending');
        updateQueueField(item.id, 'error', blockchainConfirmed ? '' : 'Uploaded and stored, but blockchain anchoring is pending.');
        updateQueueField(item.id, 'uploadedHash', res.document?.sha256Hash || clientHash);
      } catch (err: any) {
        updateQueueField(item.id, 'status', 'error');
        updateQueueField(item.id, 'error', err?.message || 'Server upload failed.');
      }
    }

    if (uploadAccepted) {
      onSuccess(chainConfirmed
        ? 'Document uploaded and blockchain confirmation received.'
        : 'Document uploaded, but blockchain confirmation is pending.');
    }
  };

  const isUploading = queue.some(item => item.status === 'processing');

  // Show restriction message for non-uploaders
  const restrictionMessage = !canUpload ? `Only Admins and Issuers can upload documents. Your role: ${userRole}` : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8 font-sans">
      {restrictionMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 flex items-center gap-3 text-sm font-semibold">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{restrictionMessage}</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <FileUp className="text-brand-600" /> Secure Asset Anchor
          </h2>
          <p className="text-slate-500 text-sm mt-1">Register institutional documents on the blockchain ledger</p>
        </div>
        <div className="flex gap-3">
          {queue.length > 0 && (
            <Button variant="outline" onClick={() => setQueue([])} disabled={isUploading || !canUpload} className="rounded-xl h-11 px-5 border-slate-200">
              Clear Queue
            </Button>
          )}
          <Button 
            onClick={startAnchoring} 
            disabled={isUploading || !queue.some(q => q.status === 'idle' || q.status === 'error') || !canUpload}
            title={!canUpload ? `Only Admins and Issuers can upload (Your role: ${userRole})` : undefined}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg h-11 px-6 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {!canUpload ? 'Access Denied' : isUploading ? 'Anchoring Queue...' : 'Anchor Staged Files'}
          </Button>
        </div>
      </div>

      {globalError && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 flex items-center gap-3 text-sm font-semibold shadow-sm animate-pulse-subtle">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{globalError}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200/60 shadow-sm">
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-[0.3em]">Queued Assets</div>
          <div className="text-3xl font-black text-slate-900 mt-4">{queuedCount}</div>
          <div className="text-xs text-slate-500 mt-2">Document hashes ready for wallet anchoring</div>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <div className="text-sm font-semibold text-slate-500 uppercase tracking-[0.3em]">Anchored</div>
          <div className="text-3xl font-black text-slate-900 mt-4">{anchoredCount}</div>
          <div className="text-xs text-slate-500 mt-2">Verified on-chain records in your staging session</div>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <div className="grid gap-2 mt-2">
            <div className="flex items-center justify-between text-xs text-slate-500 uppercase tracking-[0.3em] font-semibold"><span>In Progress</span><span>{processingCount}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-500 uppercase tracking-[0.3em] font-semibold"><span>Chain Pending</span><span>{pendingCount}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-500 uppercase tracking-[0.3em] font-semibold"><span>Errors</span><span>{errorCount}</span></div>
          </div>
          <div className="text-xs text-slate-500 mt-4">Live queue monitoring for compliance and batch readiness.</div>
        </Card>
      </div>

      {/* Bulk Presets Card */}
      <Card title="Batch Metadata Presets" subtitle="Speed up bulk uploads by setting default fields" className="border-slate-200/60 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Default Issuer</label>
            <input 
              type="text" 
              value={defaultFields.issuingOrganization}
              onChange={(e) => {
                setDefaultFields(prev => ({ ...prev, issuingOrganization: e.target.value }));
                queue.forEach(q => { if (q.status === 'idle') updateQueueField(q.id, 'issuingOrganization', e.target.value); });
              }}
              placeholder="E.g. ChainVerify Labs"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Default Owner / Subject</label>
            <input 
              type="text" 
              value={defaultFields.ownerName}
              onChange={(e) => {
                setDefaultFields(prev => ({ ...prev, ownerName: e.target.value }));
                queue.forEach(q => { if (q.status === 'idle') updateQueueField(q.id, 'ownerName', e.target.value); });
              }}
              placeholder="Bulk recipient"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Default Asset Type</label>
            <select 
              value={defaultFields.documentType}
              onChange={(e) => {
                setDefaultFields(prev => ({ ...prev, documentType: e.target.value }));
                queue.forEach(q => { if (q.status === 'idle') updateQueueField(q.id, 'documentType', e.target.value); });
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none bg-white text-sm font-semibold"
            >
              <option>Degree</option>
              <option>Contract</option>
              <option>Certificate</option>
              <option>License</option>
              <option>Document</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Drag & Drop Zone */}
      <div 
        onDragEnter={canUpload ? handleDrag : undefined}
        onDragOver={canUpload ? handleDrag : undefined}
        onDragLeave={canUpload ? handleDrag : undefined}
        onDrop={canUpload ? handleDrop : undefined}
        onClick={canUpload ? () => fileInputRef.current?.click() : undefined}
        className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all ${canUpload ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} relative overflow-hidden flex flex-col items-center justify-center min-h-[220px] ${
          dragActive 
            ? 'border-brand-500 bg-brand-50/20' 
            : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50/50'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file"
          multiple
          disabled={!canUpload}
          onChange={(e) => { if (e.target.files && canUpload) handleFileSelection(e.target.files); }}
          className="hidden"
        />
        <FileUp className={`${canUpload ? 'text-brand-600' : 'text-slate-300'} mb-4 animate-bounce`} size={40} />
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{canUpload ? 'Drag & Drop Assets Here' : 'Upload Restricted'}</h3>
        <p className="text-slate-500 text-sm mt-1.5 max-w-sm mx-auto">
          {canUpload ? 'Click to select files. Supports PDF, Office, Text, and Images up to 20MB.' : `Only Admins and Issuers can upload. Your role: ${userRole}`}
        </p>
      </div>

      {/* Visual Upload Queue */}
      <AnimatePresence>
        {queue.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Staged Assets ({queue.length})</h3>
            
            <div className="space-y-4">
              {queue.map((item) => (
                <Card key={item.id} className="border-slate-200/60 shadow-sm relative overflow-hidden">
                  <div className="grid lg:grid-cols-[auto_1fr_auto] items-start lg:items-center gap-6 p-1">
                    {/* File Icon / Type */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border text-slate-500 flex items-center justify-center shrink-0">
                      <FileText size={22} />
                    </div>

                    {/* Metadata Input Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 min-w-0">
                      <div className="space-y-1 md:col-span-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Title</label>
                        <input 
                          type="text" 
                          value={item.title} 
                          onChange={(e) => updateQueueField(item.id, 'title', e.target.value)}
                          disabled={item.status === 'processing' || item.status === 'anchored'}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none text-xs font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Subject Owner</label>
                        <input 
                          type="text" 
                          value={item.ownerName} 
                          onChange={(e) => updateQueueField(item.id, 'ownerName', e.target.value)}
                          disabled={item.status === 'processing' || item.status === 'anchored'}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none text-xs font-semibold"
                          placeholder="Recipient name"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Issuing Agency</label>
                        <input 
                          type="text" 
                          value={item.issuingOrganization} 
                          onChange={(e) => updateQueueField(item.id, 'issuingOrganization', e.target.value)}
                          disabled={item.status === 'processing' || item.status === 'anchored'}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none text-xs font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Class</label>
                        <select 
                          value={item.documentType} 
                          onChange={(e) => updateQueueField(item.id, 'documentType', e.target.value)}
                          disabled={item.status === 'processing' || item.status === 'anchored'}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none text-xs font-semibold"
                        >
                          <option>Degree</option>
                          <option>Contract</option>
                          <option>Certificate</option>
                          <option>License</option>
                          <option>Document</option>
                        </select>
                      </div>
                    </div>

                    {/* Staging actions / status */}
                    <div className="flex items-center gap-4 shrink-0 justify-end self-end lg:self-center">
                      {item.status === 'idle' && (
                        <button 
                          onClick={() => removeFromQueue(item.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      
                      {item.status === 'processing' && (
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-black text-brand-600 uppercase tracking-wider">Anchoring ({item.progress}%)</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border">
                            <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${item.progress}%` }} />
                          </div>
                        </div>
                      )}

                      {item.status === 'anchored' && (
                        <div className="flex items-center gap-2">
                          <Badge variant="success" className="gap-1 font-bold">
                            <ShieldCheck size={12} /> Anchored
                          </Badge>
                          <Button 
                            variant="outline" 
                            className="h-8 w-8 p-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg"
                            onClick={() => copyToClipboard(item.id, item.uploadedHash)}
                            title="Copy Anchored SHA-256 Hash"
                          >
                            {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                          </Button>
                        </div>
                      )}

                      {item.status === 'error' && (
                        <div className="flex items-center gap-2 max-w-[200px]">
                          <Badge variant="error" className="shrink-0">Failed</Badge>
                          <span className="text-[10px] text-rose-600 font-bold truncate" title={item.error}>{item.error}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cryptographic hash info after success */}
                  {item.status === 'anchored' && item.uploadedHash && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-4 text-xs font-mono bg-slate-50 p-2.5 rounded-xl border">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Ledger Block Hash</span>
                      <span className="text-slate-700 break-all select-all font-semibold">{item.uploadedHash}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
