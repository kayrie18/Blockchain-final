import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, Hash, Calendar, Building, User, FileText, Download, Eye } from 'lucide-react';
import { Button } from './UI';
import { formatDate } from '../utils/helpers';

interface VerificationDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  verification: any;
  onDownload: () => void;
  onRead: () => void;
}

export const VerificationDetailsModal: React.FC<VerificationDetailsProps> = ({
  isOpen,
  onClose,
  verification,
  onDownload,
  onRead,
}) => {
  if (!verification) return null;

  const isValid = verification.isAuthentic;
  const statusStyles = isValid
    ? { panel: 'from-emerald-600 to-emerald-700', icon: 'text-emerald-500', text: 'text-emerald-600' }
    : { panel: 'from-rose-600 to-rose-700', icon: 'text-rose-500', text: 'text-rose-600' };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${statusStyles.panel} px-8 py-6 flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                {isValid ? (
                  <CheckCircle2 size={32} className="text-white" />
                ) : (
                  <AlertTriangle size={32} className="text-white" />
                )}
                <div>
                  <h2 className="text-2xl font-black text-white">
                    {isValid ? 'Document Verified ✓' : 'Verification Failed ✗'}
                  </h2>
                  <p className="text-white/80 text-sm mt-1">
                    {isValid ? 'This document is authentic and blockchain-verified.' : 'This document could not be verified.'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Document Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Document Details</h3>
                
                <div className="grid gap-4">
                  {verification.title && (
                    <div className="flex items-start gap-4">
                      <FileText size={20} className="text-slate-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Title</p>
                        <p className="text-slate-900 font-semibold mt-1 break-words">{verification.title}</p>
                      </div>
                    </div>
                  )}

                  {verification.documentType && (
                    <div className="flex items-start gap-4">
                      <FileText size={20} className="text-slate-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Document Type</p>
                        <p className="text-slate-900 font-semibold mt-1">{verification.documentType}</p>
                      </div>
                    </div>
                  )}

                  {verification.ownerName && (
                    <div className="flex items-start gap-4">
                      <User size={20} className="text-slate-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Owner Name</p>
                        <p className="text-slate-900 font-semibold mt-1">{verification.ownerName}</p>
                      </div>
                    </div>
                  )}

                  {verification.issuingOrganization && (
                    <div className="flex items-start gap-4">
                      <Building size={20} className="text-slate-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Issuing Organization</p>
                        <p className="text-slate-900 font-semibold mt-1">{verification.issuingOrganization}</p>
                      </div>
                    </div>
                  )}

                  {verification.uploadDate && (
                    <div className="flex items-start gap-4">
                      <Calendar size={20} className="text-slate-400 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Date</p>
                        <p className="text-slate-900 font-semibold mt-1">{formatDate(verification.uploadDate)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Blockchain Information */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Blockchain Verification</h3>
                
                <div className="grid gap-4">
                  <div className="flex items-start gap-4">
                    <Hash size={20} className="text-brand-500 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">SHA-256 Hash</p>
                      <p className="text-slate-900 font-mono text-sm mt-1 break-all bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {verification.hash || verification.document?.sha256Hash || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {verification.blockchain?.transactionId && (
                    <div className="flex items-start gap-4">
                      <Building size={20} className="text-brand-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Blockchain Transaction</p>
                        <p className="text-slate-900 font-mono text-sm mt-1 break-all bg-slate-50 p-3 rounded-xl border border-slate-200">
                          {verification.blockchain.transactionId}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <CheckCircle2 size={20} className={`${statusStyles.icon} mt-1 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Verification Status</p>
                      <p className={`${statusStyles.text} font-black mt-1 text-lg`}>
                        {isValid ? '✓ VERIFIED' : '✗ FAILED'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 border-t">
                <Button
                  onClick={onRead}
                  variant="outline"
                  className="flex-1 h-12 gap-2"
                >
                  <Eye size={18} /> View Document
                </Button>
                <Button
                  onClick={onDownload}
                  className="flex-1 h-12 gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Download size={18} /> Download
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
