import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, Shield, Mail, Trash2, Edit2, AlertCircle, X, ShieldAlert, Key } from 'lucide-react';
import { Card, Button, Badge } from '../components/UI';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';

interface UserManagementProps {
  token: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ token }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', role: 'User', organization: '' });
  const [editForm, setEditForm] = useState({ role: 'User', verifierStatus: 'PENDING', organization: '' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', token);
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin': return <Badge variant="error" className="gap-1 font-bold"><Shield size={11} />Admin</Badge>;
      case 'Verifier': return <Badge variant="success" className="font-bold">Verifier</Badge>;
      case 'Issuer': return <Badge variant="info" className="font-bold">Issuer</Badge>;
      default: return <Badge variant="warning" className="font-bold">User</Badge>;
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/users', {
        name: addForm.name,
        email: addForm.email,
        password: addForm.password,
        role: addForm.role,
        organization: addForm.organization || undefined
      });
      setSuccess(`Account created successfully for ${addForm.name}`);
      setAddForm({ name: '', email: '', password: '', role: 'User', organization: '' });
      setIsAddOpen(false);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setError('');
    setSuccess('');
    try {
      const res = await api.patch(`/users/${selectedUser.id}/role`, { 
        role: editForm.role,
        verifierStatus: editForm.verifierStatus,
        organization: editForm.organization,
      }, token);
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? res.user : u));
      setSuccess(`Role updated successfully for ${selectedUser.name}`);
      setIsEditOpen(false);
      setSelectedUser(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update user role');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to completely delete ${name}? This action cannot be undone.`)) return;
    setError('');
    try {
      await api.delete(`/users/${id}`, token);
      setUsers(prev => prev.filter(u => u.id !== id));
      setSuccess(`Deleted account for ${name}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const openEditModal = (u: any) => {
    setSelectedUser(u);
    setEditForm({
      role: u.role,
      verifierStatus: u.verifierStatus || (u.isVerifierApproved ? 'APPROVED' : 'PENDING'),
      organization: u.organization || '',
    });
    setIsEditOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <Users className="text-brand-600" /> Administrative Access Controller
          </h2>
          <p className="text-slate-500 text-sm mt-1">Manage global platform credentials and RBAC rules</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg h-11 px-5 font-bold">
          <UserPlus size={18} /> Add Enrolled User
        </Button>
      </div>

      {error && <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 flex items-center gap-3 text-sm font-semibold shadow-sm"><AlertCircle size={18} />{error}</div>}
      {success && <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 flex items-center gap-3 text-sm font-semibold shadow-sm"><Shield size={18} />{success}</div>}

      <Card title="User Enrolment Ledger" subtitle="Review active security keys and regulatory approvals" className="border-slate-200/60 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div></div>
        ) : (
          <div className="space-y-4 mt-4">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50/50 hover:border-slate-200 transition-all duration-200 gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <Avatar user={u} size="md" />
                    <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-lg shadow-sm border">
                      {u.role === 'Admin' ? <Shield size={12} className="text-rose-600" /> : <Users size={12} className="text-slate-400" />}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{u.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Mail size={12} className="text-slate-400" /> {u.email}
                    </div>
                    {u.role === 'Verifier' && <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-500">Verifier status: {u.verifierStatus || (u.isVerifierApproved ? 'APPROVED' : 'PENDING')}</div>}
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                  {getRoleBadge(u.role)}
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" onClick={() => openEditModal(u)}>
                      <Edit2 size={15} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" onClick={() => handleDelete(u.id, u.name)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Gated Authorization Structure" subtitle="Operational guidelines for RBAC rules" className="border-slate-200/60 shadow-sm">
          <ul className="space-y-4 mt-4">
            <li className="flex items-start gap-3 text-xs text-slate-600 leading-relaxed font-semibold">
               <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
               <div>
                 <strong className="text-slate-800">Admin Authority:</strong> Full control board visibility, direct role overrides, physical asset purging, and audit trail ledger exports.
               </div>
            </li>
            <li className="flex items-start gap-3 text-xs text-slate-600 leading-relaxed font-semibold">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
               <div>
                 <strong className="text-slate-800">Regulatory Verifier:</strong> Authorized to perform cryptographic signatures and approve or reject uploaded document hashes.
               </div>
            </li>
            <li className="flex items-start gap-3 text-xs text-slate-600 leading-relaxed font-semibold">
               <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
               <div>
                 <strong className="text-slate-800">Institutional Issuer:</strong> Restricted to staging metadata and uploading files. No ledger write permissions.
               </div>
            </li>
          </ul>
        </Card>
        
        <Card title="Global Platform Directives" subtitle="Status logs" className="border-slate-200/60 shadow-sm">
           <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mt-4 border">
             <span className="text-xs font-bold text-slate-700">Audit Seeding Mode</span>
             <Badge variant="error" className="font-bold">Gated</Badge>
           </div>
           <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mt-2 border">
             <span className="text-xs font-bold text-slate-700">Duplicate Hash Interception</span>
             <Badge variant="success" className="font-bold">Active</Badge>
           </div>
        </Card>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setIsAddOpen(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <UserPlus size={20} className="text-brand-500" /> Create Enrolled User
                </h3>
                <button onClick={() => setIsAddOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Representative Name</label>
                  <input type="text" required value={addForm.name} onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" placeholder="John Doe" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Administrative Email</label>
                  <input type="email" required value={addForm.email} onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" placeholder="johndoe@agency.org" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Organization</label>
                  <input type="text" required={addForm.role === 'Issuer' || addForm.role === 'Verifier'} value={addForm.organization} onChange={(e) => setAddForm(prev => ({ ...prev, organization: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Secure Password</label>
                  <input type="password" required value={addForm.password} onChange={(e) => setAddForm(prev => ({ ...prev, password: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" placeholder="••••••••" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Designated Role</label>
                  <select value={addForm.role} onChange={(e) => setAddForm(prev => ({ ...prev, role: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none bg-white text-sm font-semibold">
                    <option value="User">User / Public Auditor</option>
                    <option value="Issuer">Institutional Issuer</option>
                    <option value="Verifier">Compliance Verifier</option>
                  </select>
                </div>

                <Button type="submit" className="w-full h-11 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-lg mt-4">
                  Register Enrolled User
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {isEditOpen && selectedUser && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setIsEditOpen(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Key size={20} className="text-brand-500" /> Modify Security Gating
                </h3>
                <button onClick={() => setIsEditOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-xl">
                <Avatar user={selectedUser} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-950 truncate">{selectedUser.name}</div>
                  <div className="text-xs text-slate-500 truncate">{selectedUser.email}</div>
                </div>
              </div>

              <form onSubmit={handleUpdateRole} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Organization</label>
                  <input type="text" value={editForm.organization} onChange={(e) => setEditForm(prev => ({ ...prev, organization: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none text-sm font-semibold" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Designated Role</label>
                  <select value={editForm.role} onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-brand-500 outline-none bg-white text-sm font-semibold">
                    <option value="User">User / Public Auditor</option>
                    <option value="Issuer">Institutional Issuer</option>
                    <option value="Verifier">Compliance Verifier</option>
                    <option value="Admin">System Admin</option>
                  </select>
                </div>

                {editForm.role === 'Verifier' && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 border rounded-xl mt-2">
                    <span className="text-xs font-bold text-slate-700">Immediate Verifier Approval</span>
                    <select
                      value={editForm.verifierStatus}
                      onChange={(e) => setEditForm(prev => ({ ...prev, verifierStatus: e.target.value }))}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="REVOKED">Revoked</option>
                    </select>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg mt-4">
                  Commit Gating Policy
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
