import React from 'react';
import { motion } from 'motion/react';
import { FileText, ShieldCheck, Users, Clock, AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { Card, Badge } from '../components/UI';
import { formatDate } from '../utils/helpers';
import { ActivityLog, SystemStats } from '../types';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface DashboardOverviewProps {
  metrics: SystemStats | null;
  auditLogs: ActivityLog[];
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ metrics, auditLogs }) => {
  const total = metrics?.totalDocuments || 0;
  const verified = metrics?.totalVerified || 0;
  const trendData = metrics?.activity || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Accessible Records', value: total, icon: FileText, color: 'sky' },
          { label: 'Blockchain Confirmed', value: verified, icon: ShieldCheck, color: 'emerald' },
          { label: 'Pending Anchoring', value: metrics?.totalPending || 0, icon: Clock, color: 'amber' },
          { label: 'Institutional Issuers', value: metrics?.totalIssuers ?? 'Admin only', icon: Users, color: 'amber' },
        ].map((stat, i) => (
          <Card key={i} className="relative overflow-hidden group border-slate-200/60 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 text-slate-700 group-hover:bg-brand-50 group-hover:text-brand-700 transition-colors">
                <stat.icon size={22} />
              </div>
              <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">Live Telemetry</span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </div>
            <div className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase tracking-wider">{stat.label}</div>
            
            {/* Subtle background decoration */}
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={90} />
            </div>
          </Card>
        ))}
      </div>

      {/* Analytics Chart Block */}
      <Card title="Registry Activity" subtitle="Monthly document uploads and blockchain confirmations" className="p-6">
        {trendData.length === 0 || !trendData.some((item: any) => item.Uploads || item.Verifications) ? (
          <div className="py-16 text-center text-sm text-slate-500">No registry activity recorded for this account yet.</div>
        ) : <div className="h-80 w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="uploadsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="verifiedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0f172a', 
                  borderRadius: '12px', 
                  border: 'none', 
                  color: '#f8fafc',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '12px'
                }} 
              />
              <Area type="monotone" dataKey="Uploads" stroke="#0284c7" strokeWidth={3} fillOpacity={1} fill="url(#uploadsGrad)" />
              <Area type="monotone" dataKey="Verifications" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#verifiedGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>}
      </Card>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Activity Log */}
        <Card title="Live Cryptographic Ledger" subtitle="Real-time compliance validation log stream" className="lg:col-span-2 border-slate-200/60 shadow-sm">
          <div className="mt-4 space-y-3">
            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-medium text-sm">No activity recorded on ledger yet</div>
            ) : (
              auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-4 rounded-xl border border-slate-100 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    log.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                    log.type === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    'bg-slate-50 text-slate-600 border border-slate-100'
                  }`}>
                    {log.type === 'success' ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">{log.action}</div>
                      <div className="text-[10px] text-slate-400 font-mono bg-white px-2 py-0.5 rounded border shadow-sm shrink-0">
                        {log.userName || 'System'}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 line-clamp-1 font-semibold">{log.details}</div>
                    <div className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest">{formatDate(log.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Operational Guidance Panel */}
        <div className="space-y-6">
          <Card title="Gated Security Workflow" className="border-slate-200/60 shadow-sm">
            <div className="grid gap-4 mt-2">
              <div className="p-4 rounded-xl border border-brand-100 bg-brand-50/10 border-l-4 border-l-brand-600">
                <div className="flex items-start gap-3">
                   <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-md">
                     <CheckCircle2 size={16} />
                   </div>
                   <div>
                     <div className="text-xs font-black text-brand-900 uppercase tracking-wider">Compliance Seeding</div>
                     <p className="text-[10px] text-brand-700/80 font-bold mt-1 leading-relaxed">
                       Document integrity states are recorded to the blockchain upon verification approval. Access control filters prevent raw data leaking.
                     </p>
                   </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/20 border-l-4 border-l-slate-400">
                <div className="flex items-start gap-3">
                   <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                     <QrCode size={16} />
                   </div>
                   <div>
                     <div className="text-xs font-black text-slate-700 uppercase tracking-wider">Dynamic QR Verification</div>
                     <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">
                       Public deep-linking utilizes dynamic redirect keys. Scanning dynamically loads the verification portal in zero-trust mode.
                     </p>
                   </div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Document Share Distribution" subtitle="Asset classification" className="border-slate-200/60 shadow-sm">
             <div className="mt-4 space-y-4">
               {[
                 { label: 'Degrees & Academic Certificates', percent: 65, color: 'bg-sky-500' },
                 { label: 'Legal Deeds & Contracts', percent: 20, color: 'bg-emerald-500' },
                 { label: 'Organizational Licenses', percent: 15, color: 'bg-amber-500' },
               ].map((item, i) => (
                 <div key={i}>
                   <div className="flex justify-between text-[10px] font-black mb-1 text-slate-500 uppercase tracking-wide">
                     <span>{item.label}</span>
                     <span>{item.percent}%</span>
                   </div>
                   <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border">
                     <div className={`h-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                   </div>
                 </div>
               ))}
             </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};
