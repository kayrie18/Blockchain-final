import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card, Button } from '../components/UI';
import { PublicVerifyFlow } from '../components/PublicVerifyFlow';

interface PublicVerifyPageProps {
  onBack: () => void;
  initialQuery?: string;
}

export const PublicVerifyPage: React.FC<PublicVerifyPageProps> = ({ onBack, initialQuery }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-600 font-semibold">Public Verification</p>
            <h1 className="mt-4 text-4xl font-extrabold text-slate-900 leading-tight font-sans">
              Verify Document Authenticity Without Signing In.
            </h1>
            <p className="mt-4 text-slate-600 max-w-2xl leading-relaxed">
              Search the public verified registry and confirm authenticity with a blockchain-backed record. Optional file copy checks are performed locally in your browser only.
            </p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onBack}>
            <ArrowLeft size={18} /> Back to Home
          </Button>
        </div>

        <Card title="Public Verify" subtitle="Search verified documents by ID or hash, then click VERIFY to confirm authenticity.">
          <PublicVerifyFlow initialQuery={initialQuery} />
        </Card>
      </div>
    </div>
  );
};

