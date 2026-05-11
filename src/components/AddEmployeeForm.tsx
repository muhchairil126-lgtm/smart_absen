import React, { useState } from 'react';
import { X, UserPlus, Mail, User, Shield } from 'lucide-react';
import { UserProfile, attendanceService } from '../services/attendanceService';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEmployeeForm({ onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    employeeId: '',
    role: 'employee' as 'employee' | 'admin'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // In a real app we'd use auth invite, here we just prepopulate the profile
      // so when they login with this email it's already there or we just simulate.
      // For this app, I'll store it by its own generated ID or email hash.
      // But to work with the login flow, they need to sign in with Google.
      // So this form effectively "white-lists" or "pre-registers" them.
      
      // We'll use a placeholder UID for now, but in this specific environment's logic
      // let's just make it clear this adds to the list.
      const newProfile: UserProfile = {
        uid: `manual-${Date.now()}`,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        employeeId: formData.employeeId
      };
      
      await attendanceService.createUserProfile(newProfile);
      onSuccess();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        {/* Header decoration */}
        <div className="h-2 bg-emerald-500 w-full" />
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={24} />
        </button>

        <form onSubmit={handleSubmit} className="p-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <UserPlus size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Tambah Karyawan</h2>
              <p className="text-slate-500 text-sm">Daftarkan anggota tim baru</p>
            </div>
          </div>

          <div className="space-y-5">
            <InputGroup 
              icon={<User size={18} />} 
              label="Nama Lengkap" 
              placeholder="Contoh: Budi Santoso"
              value={formData.name}
              onChange={(v) => setFormData({...formData, name: v})}
            />
            
            <InputGroup 
              icon={<Mail size={18} />} 
              label="Email Google" 
              placeholder="email@gmail.com"
              value={formData.email}
              onChange={(v) => setFormData({...formData, email: v})}
            />

            <InputGroup 
              icon={<Shield size={18} />} 
              label="ID Karyawan" 
              placeholder="EMP-001"
              value={formData.employeeId}
              onChange={(v) => setFormData({...formData, employeeId: v})}
            />

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">Role Jabatan</label>
              <select 
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 outline-none focus:border-emerald-500 transition-colors appearance-none"
              >
                <option value="employee">Karyawan</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-10 p-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {loading ? "Menyimpan..." : "Simpan Karyawan"}
          </button>
        </form>
      </div>
    </div>
  );
}

function InputGroup({ icon, label, placeholder, value, onChange }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>
        <input 
          type="text" 
          required
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-700 outline-none focus:border-emerald-500 transition-colors"
        />
      </div>
    </div>
  );
}
