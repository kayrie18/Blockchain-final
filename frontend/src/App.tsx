import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileUp, 
  ShieldCheck, 
  Search, 
  History, 
  Users, 
  LogOut, 
  Menu, 
  X,
  User as UserIcon,
  Mail,
  EyeOff,
  UserCheck,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from './lib/api';
import { cn } from './lib/utils';
import { User, ActivityLog } from './types';

// Standalone Page Imports
import { DashboardOverview } from './pages/DashboardOverview';
import { UploadPage } from './pages/UploadPage';
import { SearchPage } from './pages/SearchPage';
import { HistoryPage } from './pages/HistoryPage';
import { PendingApprovals } from './pages/PendingApprovals';
import { UserManagement } from './pages/UserManagement';
import { PublicVerifyPage } from './pages/PublicVerifyPage';

import { Avatar } from './components/Avatar';
import { Button, Card, Badge } from './components/UI';

export default function App() {
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard' | 'publicVerify' | 'forgotPassword' | 'resetPassword'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'queue' | 'search' | 'history' | 'admin' | 'profile'>('overview');

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', role: 'User', organization: '', resetToken: '' });
  const [deepLinkVerify, setDeepLinkVerify] = useState<string | undefined>(undefined);
  const [passwordResetToken, setPasswordResetToken] = useState('');

  // Load token and user from localStorage on mount and check deep-linking
  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('auth_user');

      const params = new URLSearchParams(window.location.search);
      const verify = params.get('verify') || params.get('documentId') || params.get('id');
      const pathname = window.location.pathname;
      const emailToken = pathname.startsWith('/verify-email/') ? pathname.replace('/verify-email/', '') : null;
      const resetToken = pathname.startsWith('/reset-password/') ? pathname.replace('/reset-password/', '') : params.get('token');

      if (emailToken) {
        setView('login');
        try {
          setLoading(true);
          setError('');
          const verificationRes = await api.get(`/auth/verify-email/${encodeURIComponent(emailToken)}`);
          setSuccess(verificationRes.message || 'Email verified successfully. Please log in.');
        } catch (err: any) {
          setError(err?.message || 'Email verification failed.');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (resetToken) {
        setPasswordResetToken(resetToken);
        setView('resetPassword');
        return;
      }

      if (verify) {
        setDeepLinkVerify(verify);
        setView('publicVerify');
        return;
      }

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setView('dashboard');
      }
    };

    init();
  }, []);

  const saveAuth = (user: User, token: string) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    setUser(user);
    setToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setToken(null);
    setProfileData(null);
    setView('landing');
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const [metricsRes, logsRes] = await Promise.all([
        api.get('/dashboard/metrics', token),
        api.get('/dashboard/audit?limit=6', token),
      ]);
      setMetrics(metricsRes);
      setAuditLogs(logsRes.logs || []);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to fetch dashboard data:', err);
    }
  };

  const fetchProfile = async () => {
    if (!token) return;
    try {
      const res = await api.get('/users/me', token);
      setProfileData(res.user);
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('Failed to fetch profile:', err);
    }
  };

  // Load data when dashboard or active tabs change
  useEffect(() => {
    if (view === 'dashboard' && token) {
      fetchDashboardData();
      if (activeTab === 'profile') {
        fetchProfile();
      }
    }
  }, [view, token, activeTab]);

  // --- Sign-in/Sign-up Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email: formData.email, password: formData.password });
      saveAuth(res.user, res.token);
      setView('dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/register', { 
        name: formData.name, 
        email: formData.email, 
        password: formData.password, 
        role: formData.role,
        organization: formData.organization || undefined
      });
      saveAuth(res.user, res.token);
      setView('dashboard');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (updatedData: any) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.patch('/users/me', updatedData, token || '');
      setUser(res.user);
      setProfileData(res.user);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/request-password-reset', { email: formData.email });
      setSuccess(res.message || 'If that email is registered, reset instructions have been sent.');
      setView('login');
      setFormData((prev) => ({ ...prev, password: '', resetToken: '' }));
    } catch (err: any) {
      setError(err?.message || 'Password reset request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const token = passwordResetToken || formData.resetToken;
    if (!token) {
      setError('Password reset token is required');
      setLoading(false);
      return;
    }
    try {
      const res = await api.post('/auth/reset-password', { token, password: formData.password });
      setSuccess(res.message || 'Password reset successfully. Please log in.');
      setView('login');
      setFormData((prev) => ({ ...prev, password: '', resetToken: '' }));
      setPasswordResetToken('');
    } catch (err: any) {
      setError(err?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  // --- Views ---

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

        <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
              <ShieldCheck className="text-white" size={22} />
            </div>
            <span className="text-2xl font-black tracking-tight text-white font-sans">ChainVerify</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-slate-300 hover:text-white" onClick={() => setView('login')}>Log In</Button>
            <Button className="bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-600/20 rounded-xl" onClick={() => setView('register')}>Get Started</Button>
          </div>
        </nav>

        <section className="relative flex-1 flex items-center pt-12 pb-24 z-10">
          <div className="max-w-7xl mx-auto px-8 grid lg:grid-cols-2 gap-16 items-center w-full">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-brand-400 text-xs font-semibold tracking-wider uppercase">
                <UserCheck size={14} /> Blockchain Document Integrity Gating
              </div>
              <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.08]">
                Corporate Registry <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-emerald-400">Verified Instantly.</span>
              </h1>
              <p className="text-lg text-slate-400 max-w-lg leading-relaxed">
                Secure your institution's vital documentation with tamper-proof cryptographic anchoring and decentralized compliance workflows.
              </p>
              
              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <Button className="h-14 px-8 text-md font-bold bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-500/10 rounded-2xl" onClick={() => setView('register')}>
                  Launch Organization Portal
                </Button>
                <Button variant="outline" className="h-14 px-8 text-md font-bold border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white rounded-2xl" onClick={() => setView('publicVerify')}>
                  Public Verification Gateway
                </Button>
              </div>

              <div className="pt-6 text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Zero-Trust Local Hashing comparison engine fully operational.</span>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              {/* Glassmorphic Mockup */}
              <div className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800 p-8 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/70" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  </div>
                  <span className="text-xs font-mono text-slate-500">chainverify_ledger.json</span>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-200">ISO_Compliance_2026.pdf</div>
                        <div className="text-[10px] font-mono text-slate-500">Hash: 8a4f91d...b29c</div>
                      </div>
                    </div>
                    <Badge variant="success" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Verified</Badge>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-200">Deed_Transfer_Ref92.docx</div>
                        <div className="text-[10px] font-mono text-slate-500">Hash: 3f1e8a9...cc54</div>
                      </div>
                    </div>
                    <Badge variant="success" className="bg-sky-500/10 text-sky-400 border-sky-500/20">Anchored</Badge>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Block Height: 24,912,851</span>
                  <span>Gas Price: 12 Gwei</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    );
  }

  if (view === 'publicVerify') {
    return <PublicVerifyPage onBack={() => { setView('landing'); setDeepLinkVerify(undefined); }} initialQuery={deepLinkVerify} />;
  }

  if (view === 'login' || view === 'register' || view === 'forgotPassword' || view === 'resetPassword') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-10 pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md z-10"
        >
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
                <ShieldCheck className="text-white" size={22} />
              </div>
              <span className="text-2xl font-black text-white">ChainVerify</span>
            </div>
          </div>
          
          <Card className="bg-slate-900 border-slate-800 p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white text-center mb-2">
              {view === 'login'
                ? 'Institutional Log In'
                : view === 'register'
                  ? 'Organization Setup'
                  : view === 'forgotPassword'
                    ? 'Password Reset Request'
                    : 'Reset Your Password'
              }
            </h2>
            <p className="text-slate-400 text-xs text-center mb-8">
              {view === 'login'
                ? 'Access your administrative auditing control board.'
                : view === 'register'
                  ? 'Create an institutional profile to begin issuing certified assets.'
                  : view === 'forgotPassword'
                    ? 'Enter the email associated with your account to receive password reset instructions.'
                    : 'Enter your new password to restore access to your ChainVerify account.'
              }
            </p>
            
            {error && <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-medium">{error}</div>}
            {success && <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 font-medium">{success}</div>}

            <form
              className="space-y-4"
              onSubmit={
                view === 'login'
                  ? handleLogin
                  : view === 'register'
                    ? handleRegister
                    : view === 'forgotPassword'
                      ? handleRequestPasswordReset
                      : handleResetPassword
              }
            >
              {view === 'register' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Representative Name</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm" 
                      placeholder="Jane Doe" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Organization Name</label>
                    <input 
                      type="text" 
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm" 
                      placeholder="E.g. Massachusetts Institute of Technology" 
                      required 
                    />
                  </div>
                </>
              )}
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Institutional Email</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm" 
                  placeholder="admin@mit.edu" 
                  required 
                />
              </div>

              {view !== 'forgotPassword' && (
                <>
                  {view === 'resetPassword' && !passwordResetToken && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Reset Token</label>
                      <input 
                        type="text"
                        value={formData.resetToken}
                        onChange={(e) => setFormData({ ...formData, resetToken: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm"
                        placeholder="Enter reset token from email"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {view === 'resetPassword' ? 'New Secure Password' : 'Secure Password'}
                    </label>
                    <input 
                      type="password" 
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm" 
                      placeholder="••••••••" 
                      required 
                    />
                  </div>
                </>
              )}
              
              {view === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Designated Role</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-100 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all text-sm"
                  >
                    <option value="User">Public User</option>
                    <option value="Verifier">Verifier (Pending Admin Approval)</option>
                  </select>
                </div>
              )}

              <Button className="w-full h-12 mt-6 bg-brand-600 hover:bg-brand-700 text-white font-bold" type="submit" disabled={loading}>
                {loading ? 'Authenticating...' : (
                  view === 'login'
                    ? 'Execute Connection'
                    : view === 'register'
                      ? 'Generate Profile'
                      : view === 'forgotPassword'
                        ? 'Send Reset Link'
                        : 'Reset Password'
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
              {view === 'login' ? (
                <p className="text-sm text-slate-400">
                  <button
                    onClick={() => { setView('forgotPassword'); setError(''); setSuccess(''); }}
                    className="text-brand-400 font-bold hover:underline"
                  >
                    Forgot Password?
                  </button>
                  <span className="mx-2">•</span>
                  New Organization?
                  <button 
                    onClick={() => { setView('register'); setError(''); setSuccess(''); }}
                    className="ml-2 text-brand-400 font-bold hover:underline"
                  >
                    Register Profile
                  </button>
                </p>
              ) : view === 'register' ? (
                <p className="text-sm text-slate-400">
                  Already Registered?
                  <button 
                    onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                    className="ml-2 text-brand-400 font-bold hover:underline"
                  >
                    Log In
                  </button>
                </p>
              ) : view === 'forgotPassword' ? (
                <p className="text-sm text-slate-400">
                  Remembered your password?
                  <button
                    onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                    className="ml-2 text-brand-400 font-bold hover:underline"
                  >
                    Log In
                  </button>
                  <span className="mx-2">•</span>
                  Need a new account?
                  <button
                    onClick={() => { setView('register'); setError(''); setSuccess(''); }}
                    className="ml-2 text-brand-400 font-bold hover:underline"
                  >
                    Register
                  </button>
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  Remembered your password?
                  <button
                    onClick={() => { setView('login'); setError(''); setSuccess(''); }}
                    className="ml-2 text-brand-400 font-bold hover:underline"
                  >
                    Log In
                  </button>
                </p>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const canAccessAdmin = user?.role === 'Admin';

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Dynamic Responsive Sidebar */}
      <aside className={cn(
        "bg-slate-950 border-r border-slate-800 transition-all duration-300 flex flex-col z-50 text-slate-300 shrink-0",
        isSidebarOpen ? "w-72" : "w-20"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/10">
              <ShieldCheck className="text-white" size={22} />
            </div>
            {isSidebarOpen && <span className="text-xl font-black tracking-tight text-white">ChainVerify</span>}
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'upload', icon: FileUp, label: 'Upload Documents', roles: ['Admin', 'Issuer'] },
            { id: 'queue', icon: ShieldCheck, label: 'Verification Queue', roles: ['Admin', 'Verifier'] },
            { id: 'search', icon: Search, label: 'Secure Registry' },
            { id: 'history', icon: History, label: 'Audit Log' },
            { id: 'profile', icon: UserIcon, label: 'Profile Settings' },
            { id: 'admin', icon: Users, label: 'Admin Dashboard', roles: ['Admin'] },
          ]
          .filter(item => !item.roles || item.roles.includes(user?.role || ''))
          .map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold border-l-4",
                activeTab === item.id 
                  ? "bg-slate-900 border-brand-500 text-white" 
                  : "border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-slate-200"
              )}
            >
              <item.icon size={18} className={cn(activeTab === item.id ? "text-brand-500" : "text-slate-500")} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-900">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all font-semibold text-sm border-l-4 border-transparent hover:border-rose-500"
          >
            <LogOut size={18} />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <header className="h-20 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
              {activeTab === 'overview' ? 'Overview' : activeTab === 'queue' ? 'Verification Queue' : activeTab === 'admin' ? 'Admin Controller' : activeTab === 'history' ? 'Cryptographic Ledger' : activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-slate-900">{user?.name}</div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded border">
                  {user?.role}
                </div>
              </div>
              <Avatar user={user!} size="md" className="border border-slate-200 shadow-sm" />
            </div>
          </div>
        </header>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-700 flex justify-between items-center font-semibold shadow-sm">
            {error}
            <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded"><X size={16} /></button>
          </div>
        )}
        {success && (
          <div className="mx-8 mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-700 flex justify-between items-center font-semibold shadow-sm">
            {success}
            <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 rounded"><X size={16} /></button>
          </div>
        )}

        {/* Dynamic Pages viewport */}
        <div className="p-8 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <DashboardOverview key="overview" metrics={metrics} auditLogs={auditLogs} />
            )}

            {activeTab === 'upload' && (user?.role === 'Admin' || user?.role === 'Issuer') && (
              <UploadPage key="upload" token={token!} userRole={user?.role} onSuccess={(message) => { setSuccess(message); fetchDashboardData(); }} />
            )}

            {activeTab === 'queue' && (user?.role === 'Admin' || user?.role === 'Verifier') && (
              <PendingApprovals key="queue" token={token!} user={user} />
            )}

            {activeTab === 'search' && (
              <SearchPage key="search" token={token!} userId={user!.id} userRole={user!.role} />
            )}

            {activeTab === 'history' && (
              <HistoryPage key="history" token={token!} />
            )}

            {activeTab === 'profile' && profileData && (
              <ProfileView key="profile" user={profileData} onUpdate={handleProfileUpdate} loading={loading} />
            )}

            {activeTab === 'admin' && canAccessAdmin && (
              <UserManagement key="admin" token={token!} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// Dedicated inline ProfileView (optimized for Outfit theme & corporate details)
function ProfileView({ user, onUpdate, loading }: { user: User; onUpdate: (data: any) => void; loading: boolean }) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    organization: user.organization || '',
    password: '',
  });
  const [shareCopied, setShareCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    setFormData({
      name: user.name || '',
      email: user.email || '',
      organization: user.organization || '',
      password: '',
    });
  }, [user]);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      name: formData.name,
      email: formData.email,
      organization: formData.organization,
      ...(formData.password && { password: formData.password }),
    });
  };

  const shareMsg = `ChainVerify Verification Reference\n\nIssuer: ${user.name}\nRole: ${user.role}\nOrganization: ${user.organization || 'N/A'}\nRegistry: ${user.email}\n\nSearch verification hashes via the ChainVerify Public Portal.`;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      <Card title="Account Settings" subtitle="Audit profile metadata and identity registry keys">
        <form onSubmit={handleUpdate} className="space-y-6 mt-6">
          <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
            <Avatar user={user} size="xl" className="border-4 border-white shadow-lg" />
            <div>
              <div className="font-black text-slate-900 text-lg">{user.name}</div>
              <Badge variant="info" className="mt-1">{user.role} Identity Key</Badge>
              <div className="text-xs text-slate-400 mt-2 font-mono">{user.email}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Full Name</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Administrative Email</label>
              <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" required />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Affiliated Organization</label>
            <input type="text" value={formData.organization} onChange={(e) => setFormData({ ...formData, organization: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" placeholder="Harvard Medical School" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Access Key Password (Optional)</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold pr-10"
                placeholder="Unchanged (leave blank)"
              />
              <EyeOff size={16} className="absolute right-3 top-3.5 text-slate-400 cursor-pointer" onClick={() => setShowPassword(!showPassword)} />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl mt-4">
            {loading ? 'Committing Changes...' : 'Save Profile Changes'}
          </Button>
        </form>
      </Card>

      <Card title="Share Cryptographic Credentials" subtitle="Transmit verified organization keys for zero-trust authorization">
        <div className="space-y-4 mt-6">
          <div className="p-4 bg-slate-50 border rounded-xl">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed font-semibold">{shareMsg}</pre>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(shareMsg);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }}
              className="h-10 px-4 text-xs font-bold"
            >
              {shareCopied ? 'Copied to Clipboard!' : 'Copy Credentials'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const subj = encodeURIComponent(`ChainVerify Key — ${user.name}`);
                const body = encodeURIComponent(shareMsg);
                window.location.href = `mailto:?subject=${subj}&body=${body}`;
              }}
              className="h-10 px-4 text-xs font-bold"
            >
              <Mail size={14} /> Send Credential Mail
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
