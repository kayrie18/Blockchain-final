import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, Copy, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card, Button } from './UI';
import { getBaseUrl } from '../lib/api';

interface QRCodeDisplayProps {
  documentId: string;
  token: string;
  onClose?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ documentId, token, onClose }) => {
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'html' | 'pdf' | null>(null);

  useEffect(() => {
    const fetchQrData = async () => {
      try {
        const baseUrl = getBaseUrl();
        const res = await fetch(`${baseUrl}/api/qr/documents/${documentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch QR data');
        const data = await res.json();
        setQrData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (documentId && token) fetchQrData();
  }, [documentId, token]);

  const handleDownloadCertificate = async (format: 'html' | 'pdf') => {
    try {
      setDownloadingFormat(format);
      const url = `${getBaseUrl()}/api/certificates/verification/${documentId}/download?format=${format}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to download certificate');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `certificate_${documentId}.${format}`;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCopyVerificationUrl = () => {
    if (qrData?.verificationUrl) {
      navigator.clipboard.writeText(qrData.verificationUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-500 mt-4 text-sm">Loading QR code...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900">Error Loading QR Code</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
      <Card className="p-8">
        <div className="space-y-6">
          {/* QR Code Section */}
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">Document Verification QR Code</h2>
            {qrData?.qrCodeDataUrl && (
              <motion.img
                src={qrData.qrCodeDataUrl}
                alt="Verification QR Code"
                className="w-48 h-48 border-2 border-slate-200 rounded-xl p-2 bg-white shadow-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              />
            )}
            <p className="text-xs text-slate-500 text-center max-w-sm">
              Scan this QR code to publicly verify the authenticity of this document without requiring authentication.
            </p>
          </div>

          {/* Document Info */}
          {qrData?.metadata && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
              <h3 className="font-bold text-sm text-slate-900">Document Details</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">Title:</span>
                  <p className="text-slate-900 font-mono">{qrData.metadata.title}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Type:</span>
                  <p className="text-slate-900">{qrData.metadata.documentType}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Owner:</span>
                  <p className="text-slate-900">{qrData.metadata.ownerName}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Organization:</span>
                  <p className="text-slate-900">{qrData.metadata.issuingOrganization}</p>
                </div>
              </div>
            </div>
          )}

          {/* Verification URL */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-900">Verification Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={qrData?.verificationUrl || ''}
                readOnly
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-xs font-mono text-slate-600"
              />
              <Button
                variant="outline"
                onClick={handleCopyVerificationUrl}
                className="gap-1.5"
              >
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Blockchain Status */}
          {qrData?.metadata?.blockchain && (
            <div className={`rounded-xl p-4 border ${
              qrData.metadata.blockchain.confirmed
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-start gap-3">
                {qrData.metadata.blockchain.confirmed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-sm">
                  <p className={`font-bold ${qrData.metadata.blockchain.confirmed ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {qrData.metadata.blockchain.confirmed ? 'Blockchain Confirmed' : 'Blockchain Pending'}
                  </p>
                  <p className={`text-xs mt-1 ${qrData.metadata.blockchain.confirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {qrData.metadata.blockchain.transactionId ? (
                      <>
                        Transaction: <code className="font-mono">{qrData.metadata.blockchain.transactionId.slice(0, 16)}...</code>
                        {qrData.metadata.blockchain.blockNumber && ` • Block: ${qrData.metadata.blockchain.blockNumber}`}
                      </>
                    ) : (
                      'Awaiting blockchain anchoring...'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Download Certificate */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-900">Download Verification Certificate</label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleDownloadCertificate('html')}
                disabled={downloadingFormat === 'pdf'}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {downloadingFormat === 'html' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloadingFormat === 'html' ? 'Downloading...' : 'HTML'}
              </Button>
              <Button
                onClick={() => handleDownloadCertificate('pdf')}
                disabled={downloadingFormat === 'html'}
                className="gap-2 bg-red-600 hover:bg-red-700"
              >
                {downloadingFormat === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {downloadingFormat === 'pdf' ? 'Generating...' : 'PDF'}
              </Button>
            </div>
          </div>

          {/* Close Button */}
          {onClose && (
            <Button onClick={onClose} variant="outline" className="w-full">
              Close
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
