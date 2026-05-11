import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile } from '../services/attendanceService';

interface Props {
  profile: UserProfile;
}

export default function IDCard({ profile }: Props) {
  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl max-w-sm mx-auto flex flex-col items-center">
      <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner ring-4 ring-slate-50">
        {profile.name.charAt(0)}
      </div>
      
      <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{profile.name}</h3>
      <p className="text-slate-400 text-sm mb-8 font-medium uppercase tracking-widest">{profile.role}</p>

      <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 mb-6">
        <QRCodeSVG 
          value={profile.uid} 
          size={160}
          level="H"
          includeMargin={true}
        />
      </div>

      <div className="w-full bg-slate-50 p-4 rounded-xl text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Employee ID</p>
        <p className="text-xs font-mono text-slate-600">{profile.uid}</p>
      </div>

      <p className="mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-tighter opacity-50">
        AbsenKita Digital ID Card
      </p>
    </div>
  );
}
