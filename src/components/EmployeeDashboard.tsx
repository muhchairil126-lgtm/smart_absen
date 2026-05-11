import React, { useState, useEffect } from 'react';
import { User as FirebaseUser } from '../lib/firebase';
import { auth, signOut } from '../lib/firebase';
import { 
  attendanceService, 
  UserProfile, 
  AttendanceRecord, 
  AttendanceStatus,
  AttendanceSession,
  LeaveRequest
} from '../services/attendanceService';
import { 
  Clock, 
  MapPin, 
  QrCode, 
  LogOut, 
  History, 
  Bell, 
  CheckCircle2, 
  AlertCircle,
  CreditCard,
  Home,
  Calendar,
  Users
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import IDCard from './IDCard';
import QRScanner from './QRScanner';

interface Props {
  user: FirebaseUser;
  profile: UserProfile;
}

export default function EmployeeDashboard({ user, profile }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab ] = useState<'home' | 'card' | 'leave' | 'history'>('home');
  const [showScanner, setShowScanner] = useState(false);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [showManualMenu, setShowManualMenu] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);

  useEffect(() => {
    fetchTodayRecords();
    fetchAllRecords();
    fetchLeaves();
    fetchEmployees();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      }, (err) => {
        setErrorMsg("Izin lokasi diperlukan untuk absensi.");
      });
    }
  }, []);

  const fetchEmployees = async () => {
    const data = await attendanceService.getAllEmployees();
    setEmployees(data);
  };

  const fetchTodayRecords = async () => {
    const todayData = await attendanceService.getAttendanceToday(profile.uid);
    setRecords(todayData);
  };

  const fetchAllRecords = async () => {
    const data = await attendanceService.getUserAttendance(profile.uid);
    setAllRecords(data);
  };

  const fetchLeaves = async () => {
    const data = await attendanceService.getMyLeaves(profile.uid);
    setLeaves(data);
  };

  const handleLeaveSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLeaveSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const start = formData.get('startDate') as string;
    const end = formData.get('endDate') as string;
    const reason = formData.get('reason') as string;

    try {
      await attendanceService.requestLeave({
        userId: profile.uid,
        userName: profile.name,
        startDate: start,
        endDate: end,
        reason: reason
      });
      setSuccessMsg("Pengajuan cuti berhasil dikirim.");
      setShowLeaveForm(false);
      fetchLeaves();
    } catch (error) {
      setErrorMsg("Gagal mengirim pengajuan cuti.");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const exportToExcel = () => {
    const exportData = allRecords.map(r => ({
      'Tanggal': r.date,
      'Waktu': format(r.timestamp.toDate(), 'HH:mm:ss'),
      'Sesi': r.session === 'morning' ? 'Pagi' : 'Siang',
      'Status': r.status,
      'Terlambat': r.isLate ? 'Ya' : 'Tidak',
      'Menit Terlambat': r.lateMinutes
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Absensi");
    XLSX.writeFile(workbook, `Absensi_${profile.name}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleAbsen = async (status: AttendanceStatus = AttendanceStatus.PRESENT) => {
    setLoading(true);
    try {
      // Get fresh location
      let currentLoc = location;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          currentLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          setLocation(currentLoc);
        } catch (e) {
          console.warn("Using cached location");
        }
      }

      const record = await attendanceService.recordAttendance(profile, status, currentLoc);
      setSuccessMsg(`Absensi ${record.session === 'morning' ? 'Pagi' : 'Siang'} Berhasil!`);
      if (record.isLate) {
         setErrorMsg(`Anda terlambat ${record.lateMinutes} menit.`);
      }
      await fetchTodayRecords();
      setTimeout(() => {
        setSuccessMsg(null);
        setErrorMsg(null);
      }, 5000);
    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal melakukan absensi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const recordManualAttendance = async (emp: UserProfile) => {
    try {
      setManualLoading(true);
      
      // Get fresh location
      let currentLoc = location;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          currentLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          setLocation(currentLoc);
        } catch (e) {
          console.warn("Using cached location");
        }
      }

      await attendanceService.recordAttendance(emp, AttendanceStatus.PRESENT, currentLoc);
      setSuccessMsg(`Absensi ${emp.name} berhasil direkam.`);
      if (emp.uid === profile.uid) {
        fetchTodayRecords();
      }
    } catch (error) {
      setErrorMsg("Gagal merekam absensi.");
    } finally {
      setManualLoading(false);
      setShowManualMenu(false);
      setTimeout(() => {
        setSuccessMsg(null);
        setErrorMsg(null);
      }, 5000);
    }
  };

  const onScanResult = async (data: string) => {
    // data should be 'OFFICE_CHECKIN_CODE' or similar
    console.log("Scanned:", data);
    setShowScanner(false);
    handleAbsen();
  };

  const hasMorning = records.some(r => r.session === AttendanceSession.MORNING);
  const hasAfternoon = records.some(r => r.session === AttendanceSession.AFTERNOON);

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto relative bg-slate-50">
      <header className="flex justify-between items-center px-6 pt-8 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Halo, {profile.name}</h2>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest leading-loose">
            {format(new Date(), 'EEEE, d MMM yyyy')}
          </p>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-500 transition-all shadow-sm"
        >
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 px-6 pb-28">
        <AnimatePresence mode="wait">
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-500 text-white p-4 rounded-2xl mb-6 flex items-center gap-3 shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 size={20} />
              <p className="text-sm font-bold">{successMsg}</p>
            </motion.div>
          )}

          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-amber-500 text-white p-4 rounded-2xl mb-6 flex items-center gap-3 shadow-lg shadow-amber-500/20"
            >
              <AlertCircle size={20} />
              <p className="text-sm font-bold">{errorMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'home' && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 gap-4">
              <AbsenCard 
                title="Sesi Pagi"
                time="07:15"
                done={hasMorning}
                onAbsen={() => handleAbsen()}
                loading={loading}
              />
              <AbsenCard 
                title="Sesi Siang"
                time="13:30"
                done={hasAfternoon}
                onAbsen={() => handleAbsen()}
                loading={loading}
              />
            </div>

            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
               <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl">
                    <MapPin size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800">Lokasi Presensi</h3>
               </div>
               {location ? (
                 <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
                    <span className="text-emerald-500 font-bold uppercase tracking-tighter">Verified</span>
                 </div>
               ) : (
                 <p className="text-xs text-slate-400 animate-pulse italic">Mencari koordinat satelit...</p>
               )}
            </div>

            <button 
              onClick={() => setShowManualMenu(true)}
              className="w-full p-6 bg-white border-2 border-slate-900 text-slate-900 rounded-[2rem] shadow-sm flex items-center justify-between group hover:bg-slate-50 transition-all overflow-hidden relative"
            >
              <div className="relative z-10 text-left">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Terminal Publik</p>
                <h3 className="text-xl font-bold flex items-center gap-2">Pilih Nama Saya <Users size={20} /></h3>
              </div>
              <div className="p-4 bg-slate-100 rounded-2xl group-hover:scale-110 transition-transform relative z-10">
                 <Users size={28} />
              </div>
            </button>

            <button 
              onClick={() => setShowScanner(true)}
              className="w-full p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl flex items-center justify-between group hover:bg-slate-800 transition-all overflow-hidden relative"
            >
              <div className="relative z-10 text-left">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Metode Cepat</p>
                <h3 className="text-xl font-bold flex items-center gap-2">Pindai QR Kantor <QrCode size={20} /></h3>
              </div>
              <div className="p-4 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform relative z-10">
                 <QrCode size={28} />
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            </button>
          </motion.div>
        )}

        {activeTab === 'card' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <IDCard profile={profile} />
            <div className="mt-8 text-center px-6">
               <p className="text-sm text-slate-500 leading-relaxed">
                 Tunjukkan kode ini ke petugas atau scan di terminal absensi untuk verifikasi identitas.
               </p>
            </div>
          </motion.div>
        )}

        {activeTab === 'leave' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Calendar className="text-slate-400" size={20} />
                <h3 className="font-bold text-slate-800">Pengajuan Cuti</h3>
              </div>
              <button 
                onClick={() => setShowLeaveForm(true)}
                className="p-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
              >
                + Ajukan Cuti
              </button>
            </div>

            {leaves.length === 0 ? (
               <div className="bg-white rounded-[2rem] border border-slate-100 p-12 flex flex-col items-center text-center">
                  <div className="p-4 bg-slate-50 rounded-full mb-4 text-slate-300">
                    <Calendar size={40} />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Belum ada pengajuan cuti.</p>
               </div>
            ) : (
              <div className="space-y-3">
                {leaves.map(leave => (
                  <div key={leave.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${
                          leave.status === 'approved' ? 'bg-emerald-50 text-emerald-500' : 
                          leave.status === 'rejected' ? 'bg-red-50 text-red-500' : 
                          'bg-amber-50 text-amber-500'
                        }`}>
                          <Calendar size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 tracking-tight">
                            {format(new Date(leave.startDate), 'd MMM')} - {format(new Date(leave.endDate), 'd MMM yyyy')}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {leave.status}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase ${
                        leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                        leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {leave.status}
                      </span>
                    </div>
                    <div className="pl-14 space-y-2">
                       <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                         "{leave.reason}"
                       </p>
                       {leave.adminComment && (
                         <div className="flex gap-2 items-start text-[10px] text-slate-400 font-medium">
                            <span className="font-black text-slate-500">Admin:</span>
                            <span>{leave.adminComment}</span>
                         </div>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <History className="text-slate-400" size={20} />
                <h3 className="font-bold text-slate-800">Semua Riwayat</h3>
              </div>
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
              >
                <Download size={14} /> EXPORT EXCEL
              </button>
            </div>

            {allRecords.length > 0 && (
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="h-24 w-24 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={[
                            { name: 'Tepat', value: allRecords.filter(r => !r.isLate).length, fill: '#10b981' },
                            { name: 'Terlambat', value: allRecords.filter(r => r.isLate).length, fill: '#f59e0b' }
                          ]} 
                          innerRadius={30} 
                          outerRadius={45} 
                          paddingAngle={5} 
                          dataKey="value"
                        >
                          <Cell key="cell-1" fill="#10b981" />
                          <Cell key="cell-2" fill="#f59e0b" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-800">
                      {Math.round((allRecords.filter(r => !r.isLate).length / allRecords.length) * 100)}%
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-800 text-sm">Persentase Kehadiran</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Berdasarkan data {allRecords.length} sesi absensi</p>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"/> <span className="text-[10px] font-bold text-slate-500">Tepat</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full"/> <span className="text-[10px] font-bold text-slate-500">Lambat</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {allRecords.length === 0 ? (
               <div className="bg-white rounded-[2rem] border border-slate-100 p-12 flex flex-col items-center text-center">
                  <div className="p-4 bg-slate-50 rounded-full mb-4 text-slate-300">
                    <Calendar size={40} />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Belum ada riwayat presensi.</p>
               </div>
            ) : (
              <div className="space-y-3">
                {allRecords.map(record => (
                  <div key={record.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4 text-left">
                      <div className={`p-3 rounded-2xl ${record.isLate ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        {record.isLate ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 capitalize tracking-tight">
                          {record.session === 'morning' ? 'Sesi Pagi' : 'Sesi Siang'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-left">
                           {record.date} • {format(record.timestamp.toDate(), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                    {record.isLate && (
                       <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full uppercase">
                         +{record.lateMinutes}m
                       </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 px-8 py-4 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-40">
        <NavIcon 
          active={activeTab === 'home'} 
          icon={<Home size={22} />} 
          label="Home"
          onClick={() => setActiveTab('home')} 
        />
        <NavIcon 
          active={activeTab === 'card'} 
          icon={<CreditCard size={22} />} 
          label="ID Card"
          onClick={() => setActiveTab('card')} 
        />
        <NavIcon 
          active={activeTab === 'leave'} 
          icon={<Calendar size={22} />} 
          label="Cuti"
          onClick={() => setActiveTab('leave')} 
        />
        <NavIcon 
          active={activeTab === 'history'} 
          icon={<History size={22} />} 
          label="History"
          onClick={() => setActiveTab('history')} 
        />
      </nav>

      {/* Shared Terminal Modal */}
      <AnimatePresence>
        {showManualMenu && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Pilih Karyawan</h3>
                <button onClick={() => setShowManualMenu(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                   <LogOut className="rotate-45" size={24} />
                </button>
              </div>
              
              <div className="p-8 pt-4 space-y-4 max-h-[50vh] overflow-y-auto">
                {employees.length === 0 ? (
                  <p className="text-center text-slate-400 py-4 font-bold uppercase text-[10px] tracking-widest">Tidak ada karyawan</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {employees.map(emp => (
                      <button
                        key={emp.uid}
                        disabled={manualLoading}
                        onClick={() => recordManualAttendance(emp)}
                        className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100 disabled:opacity-50 group"
                      >
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-emerald-400 font-black group-hover:rotate-6 transition-transform">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-slate-800 text-sm tracking-tight">{emp.name}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{emp.employeeId || 'ID UNSET'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {manualLoading && (
                 <div className="p-8 pt-0 flex items-center justify-center">
                   <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                 </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leave Form Modal */}
      <AnimatePresence>
        {showLeaveForm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 pb-4 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Form Pengajuan Cuti</h3>
                <button onClick={() => setShowLeaveForm(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                  <CreditCard size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleLeaveSubmit} className="p-8 pt-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tanggal Mulai</label>
                  <input 
                    name="startDate"
                    type="date" 
                    required
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tanggal Selesai</label>
                  <input 
                    name="endDate"
                    type="date" 
                    required
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Alasan</label>
                  <textarea 
                    name="reason"
                    required
                    rows={3}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder="Contoh: Keperluan keluarga..."
                  ></textarea>
                </div>
                <button 
                  disabled={leaveSubmitting}
                  className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
                >
                  {leaveSubmitting ? 'MENGIRIM...' : 'KIRIM PENGAJUAN'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Special Status Float */}
      <AnimatePresence>
        {activeTab === 'home' && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-4 bg-white/80 backdrop-blur-xl p-3 rounded-3xl shadow-2xl border border-white/20 z-30"
          >
            <StatusIcon emoji="🤒" onClick={() => handleAbsen(AttendanceStatus.SICK)} />
            <StatusIcon emoji="📝" onClick={() => handleAbsen(AttendanceStatus.PERMIT)} />
            <StatusIcon emoji="🔥" onClick={() => handleAbsen(AttendanceStatus.OVERTIME)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <QRScanner 
            onScan={onScanResult} 
            onClose={() => setShowScanner(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AbsenCard({ title, time, done, onAbsen, loading }: any) {
  return (
    <div className={`p-6 rounded-[2rem] border transition-all ${done ? 'bg-white border-slate-100 opacity-50' : 'bg-white border-slate-100 shadow-sm ring-1 ring-slate-100'}`}>
      <div className="flex flex-col items-center text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-lg font-black text-slate-800 mb-4 tracking-tighter">Max {time}</p>
        
        {done ? (
          <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-2 rounded-xl">
            <CheckCircle2 size={14} /> Clear
          </div>
        ) : (
          <button
            disabled={loading}
            onClick={onAbsen}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-emerald-500/20 active:scale-95"
          >
            {loading ? "..." : "Absen"}
          </button>
        )}
      </div>
    </div>
  );
}

function NavIcon({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-emerald-500 scale-110' : 'text-slate-300'}`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </button>
  );
}

function StatusIcon({ emoji, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-emerald-50 rounded-2xl text-2xl transition-all hover:scale-110 active:scale-90"
    >
      {emoji}
    </button>
  );
}
