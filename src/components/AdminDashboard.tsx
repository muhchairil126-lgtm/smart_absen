import React, { useState, useEffect } from 'react';
import { User as FirebaseUser, signOut } from '../lib/firebase';
import { auth } from '../lib/firebase';
import { 
  attendanceService, 
  UserProfile, 
  AttendanceRecord,
  AttendanceStatus,
  LeaveRequest 
} from '../services/attendanceService';
import { 
  Users, 
  BarChart3, 
  History, 
  LogOut, 
  UserPlus, 
  Search,
  TrendingUp,
  Clock,
  AlertTriangle,
  QrCode,
  MapPin,
  CheckCircle2,
  Calendar,
  Trash2,
  Printer
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import AddEmployeeForm from './AddEmployeeForm';
import QRScanner from './QRScanner';
import IDCard from './IDCard';
import { aiService } from '../services/aiService';
import { Sparkles, Download, FileSpreadsheet } from 'lucide-react';

interface Props {
  user: FirebaseUser;
  profile: UserProfile;
}

export default function AdminDashboard({ user, profile }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab ] = useState<'stats' | 'records' | 'employees' | 'recap' | 'leaves'>('stats');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualMenu, setShowManualMenu] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [selectedEmpForCard, setSelectedEmpForCard] = useState<UserProfile | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    const unsubAttend = attendanceService.subscribeToAttendance((data) => {
      setRecords(data);
    });
    const unsubLeaves = attendanceService.subscribeToLeaves((data) => {
      setLeaves(data);
    });
    fetchEmployees();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      }, (err) => {
        console.error("Geolocation error:", err);
      });
    }

    return () => {
      unsubAttend();
      unsubLeaves();
    };
  }, []);

  const fetchEmployees = async () => {
    const data = await attendanceService.getAllEmployees();
    setEmployees(data);
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const handleExportAll = () => {
    const exportData = records.map(r => ({
      'Nama Karyawan': r.userName,
      'Tanggal': r.date,
      'Waktu': format(r.timestamp.toDate(), 'HH:mm:ss'),
      'Sesi': r.session === 'morning' ? 'Pagi' : 'Siang',
      'Status': r.status,
      'Terlambat': r.isLate ? 'Ya' : 'Tidak',
      'Menit Terlambat': r.lateMinutes,
      'Menit Lembur': r.overtimeMinutes || 0
    }));
    exportToExcel(exportData, `Semua_Absensi_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportRecap = () => {
    const recapData = employees.map(emp => {
      const empRecords = records.filter(r => r.userId === emp.uid);
      const totalPresent = empRecords.length;
      const totalLate = empRecords.filter(r => r.isLate).length;
      const totalLateMinutes = empRecords.reduce((acc, curr) => acc + curr.lateMinutes, 0);
      const totalOvertimeMinutes = empRecords.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0);
      
      return {
        'Nama': emp.name,
        'Email': emp.email,
        'ID Karyawan': emp.employeeId || '-',
        'Total Kehadiran': totalPresent,
        'Total Terlambat (Kali)': totalLate,
        'Total Menit Terlambat': totalLateMinutes,
        'Total Menit Lembur': totalOvertimeMinutes
      };
    });
    exportToExcel(recapData, `Rekap_Absensi_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleUpdateLeave = async (leaveId: string, status: 'approved' | 'rejected') => {
    const comment = window.prompt(`Alasan ${status === 'approved' ? 'menyetujui' : 'menolak'} (opsional):`);
    try {
      await attendanceService.updateLeaveStatus(leaveId, status, comment || undefined);
      setNotification(`Status cuti telah diperbarui.`);
    } catch (e) {
      setNotification(`Gagal memperbarui status cuti.`);
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteEmployee = async (uid: string, name: string) => {
    if (window.confirm(`Hapus karyawan ${name}? Data profil akan dihapus.`)) {
      try {
        await attendanceService.deleteEmployee(uid);
        setNotification(`Karyawan ${name} telah dihapus.`);
        fetchEmployees();
      } catch (e) {
        setNotification("Gagal menghapus karyawan.");
      }
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handlePrintCard = () => {
    window.print();
  };

  const onScanEmployee = async (scannedUid: string) => {
    setShowScanner(false);
    const emp = employees.find(e => e.uid === scannedUid);
    if (emp) {
      await recordManualAttendance(emp);
    } else {
      setNotification("Karyawan tidak ditemukan.");
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const recordManualAttendance = async (emp: UserProfile) => {
    try {
      setManualLoading(true);
      
      // Try to get fresh location if possible
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
          console.warn("Could not get fresh location for manual entry, using last known.");
        }
      }

      await attendanceService.recordAttendance(emp, AttendanceStatus.PRESENT, currentLoc);
      setNotification(`Absensi ${emp.name} berhasil direkam.`);
    } catch (e) {
      setNotification("Gagal merekam absensi.");
    } finally {
      setManualLoading(false);
      setShowManualMenu(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Stats calculation
  const lateCount = records.filter(r => r.isLate).length;
  const overtimeCount = records.filter(r => r.status === 'overtime').length;
  const sickCount = records.filter(r => r.status === 'sick' || r.status === 'permit').length;

  const chartData = [
    { name: 'Tepat Waktu', value: Math.max(0, records.length - lateCount), fill: '#10b981' },
    { name: 'Terlambat', value: lateCount, fill: '#f59e0b' },
    { name: 'Overtime', value: overtimeCount, fill: '#6366f1' },
    { name: 'Izin/Sakit', value: sickCount, fill: '#ef4444' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-slate-900 text-slate-100 p-8">
        <div className="flex items-center gap-4 mb-14">
          <div className="bg-emerald-500 p-3 rounded-[1.25rem] shadow-lg shadow-emerald-500/20">
            <Users className="w-6 h-6 text-slate-900" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter">AbsenKita</h1>
        </div>

        <nav className="flex-1 space-y-3">
          <NavBtn active={activeTab === 'stats'} icon={<BarChart3 />} label="Ringkasan" onClick={() => setActiveTab('stats')} />
          <NavBtn active={activeTab === 'records'} icon={<History />} label="Log Absensi" onClick={() => setActiveTab('records')} />
          <NavBtn active={activeTab === 'leaves'} icon={<Calendar />} label="Pengajuan Cuti" onClick={() => setActiveTab('leaves')} />
          <NavBtn active={activeTab === 'recap'} icon={<FileSpreadsheet />} label="Rekap Data" onClick={() => setActiveTab('recap')} />
          <NavBtn active={activeTab === 'employees'} icon={<Users />} label="Karyawan" onClick={() => setActiveTab('employees')} />
        </nav>

        <div className="mt-auto space-y-4">
           <button 
             onClick={() => setShowManualMenu(true)}
             className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all text-white font-black shadow-xl"
           >
            <Users size={20} /> PILIH NAMA
           </button>
           <button 
            onClick={() => setShowScanner(true)}
            className="w-full flex items-center justify-center gap-3 p-4 bg-emerald-500 hover:bg-emerald-400 rounded-2xl transition-all text-slate-900 font-black shadow-xl shadow-emerald-500/10"
           >
            <QrCode size={20} /> SCAN ID
           </button>
           <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors text-slate-400 font-bold"
           >
            <LogOut className="w-5 h-5" /> Keluar
           </button>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-12 overflow-y-auto pb-24 lg:pb-12">
        <header className="flex justify-between items-start mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-2 capitalize">
              {activeTab === 'stats' ? 'Dashboard Utama' : 
               activeTab === 'records' ? 'Log Aktivitas' : 
               activeTab === 'recap' ? 'Rekap Kehadiran' :
               activeTab === 'leaves' ? 'Manajemen Cuti' :
               'Daftar Karyawan'}
            </h2>
            <p className="text-slate-400 font-medium">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </div>
          
          <div className="lg:hidden">
             <button onClick={() => setShowScanner(true)} className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg"><QrCode /></button>
          </div>
        </header>

        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-[60] flex items-center gap-3"
            >
              <CheckCircle2 className="text-emerald-500" size={18} />
              <span className="text-sm font-bold">{notification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'stats' && (
          <div className="space-y-10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
              <StatCard label="Hadir Hari Ini" value={records.filter(r => r.date === format(new Date(), 'yyyy-MM-dd')).length} color="emerald" icon={<TrendingUp />} />
              <StatCard label="Total Terlambat" value={lateCount} color="amber" icon={<Clock />} />
              <StatCard label="Izin/Sakit" value={sickCount} color="red" icon={<AlertTriangle />} />
              <StatCard label="User Aktif" value={employees.length} color="indigo" icon={<Users />} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 bg-white p-8 lg:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-xl text-slate-800 tracking-tight">Perbandingan Status</h3>
                  <div className="flex gap-2">
                    <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                    <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                    <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
                  </div>
                </div>
                <div className="h-72">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f8fafc' }}
                      />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                   </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                 <h3 className="font-black text-xl text-slate-800 mb-8 text-center tracking-tight">Kesehatan Tim</h3>
                 <div className="h-56 w-full relative">
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={chartData} 
                        innerRadius={70} 
                        outerRadius={90} 
                        paddingAngle={8} 
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={1500}
                      >
                         {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <p className="text-4xl font-black text-slate-800 tracking-tighter">
                        {records.length > 0 ? Math.round(((records.length - lateCount) / records.length) * 100) : 0}%
                      </p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Efficiency</p>
                   </div>
                 </div>
                 <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                    {chartData.map(item => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase truncate">{item.name}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* AI Insights Section */}
            <AIInsights records={records} />
          </div>
        )}

        {activeTab === 'records' && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex flex-col gap-1">
                 <h3 className="font-black text-xl text-slate-800 tracking-tight">Log Kehadiran Semua</h3>
                 <button 
                  onClick={handleExportAll}
                  className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-500 transition-colors tracking-widest"
                 >
                   <Download size={14} /> Export to Excel
                 </button>
               </div>
               <div className="relative w-full md:w-72">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                  type="text" 
                  placeholder="Cari nama karyawan..." 
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 transition-all font-medium"
                  onChange={(e) => setSearchTerm(e.target.value)}
                 />
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-5">Identitas</th>
                    <th className="px-8 py-5">Waktu Presensi</th>
                    <th className="px-8 py-5">Sesi</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.filter(r => r.userName.toLowerCase().includes(searchTerm.toLowerCase())).map(record => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-500">
                             {record.userName.charAt(0)}
                           </div>
                           <span className="font-bold text-slate-800">{record.userName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm text-slate-500 whitespace-nowrap">
                        <span className="font-mono text-emerald-600 font-bold">{format(record.timestamp.toDate(), 'HH:mm')}</span>
                        <span className="mx-2 opacity-30">|</span>
                        <span className="text-slate-400 uppercase text-[10px] font-black tracking-widest">{format(record.timestamp.toDate(), 'dd MMM yyyy')}</span>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-full ${record.session === 'morning' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                          {record.session === 'morning' ? 'Morning' : 'Afternoon'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${record.status === 'overtime' ? 'bg-indigo-500' : record.isLate ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                           <span className={`text-[10px] uppercase font-black tracking-widest ${record.status === 'overtime' ? 'text-indigo-600' : record.isLate ? 'text-amber-600' : 'text-emerald-600'}`}>
                             {record.status === 'overtime' ? 'Lembur' : record.isLate ? 'Terlambat' : 'Tepat Waktu'}
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end">
                          {record.lateMinutes > 0 && (
                            <span className="text-[10px] font-bold text-amber-500">+{record.lateMinutes}m Late</span>
                          )}
                          {record.overtimeMinutes > 0 && (
                            <span className="text-[10px] font-bold text-indigo-500">+{record.overtimeMinutes}m OT</span>
                          )}
                          {record.lateMinutes === 0 && record.overtimeMinutes === 0 && (
                            <CheckCircle2 size={16} className="text-emerald-200" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden text-left">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex flex-col gap-1">
                 <h3 className="font-black text-xl text-slate-800 tracking-tight">Antrean Pengajuan Cuti</h3>
                 <p className="text-slate-400 text-xs font-medium">Setujui atau tolak permintaan cuti karyawan.</p>
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-5">Karyawan</th>
                    <th className="px-8 py-5">Periode Cuti</th>
                    <th className="px-8 py-5">Alasan</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {leaves.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-slate-400 text-sm font-bold uppercase tracking-widest leading-loose">Tidak ada pengajuan aktif.</td>
                    </tr>
                  )}
                  {leaves.map(leave => (
                    <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center font-bold">
                             {leave.userName.charAt(0)}
                           </div>
                           <span className="font-bold text-slate-800">{leave.userName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-sm text-slate-500 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{format(new Date(leave.startDate), 'dd/MM')}</span>
                        <span className="mx-2 text-slate-300">→</span>
                        <span className="font-bold text-slate-800">{format(new Date(leave.endDate), 'dd/MM/yy')}</span>
                      </td>
                      <td className="px-8 py-6 max-w-xs">
                        <p className="text-xs text-slate-500 font-medium truncate italic" title={leave.reason}>"{leave.reason}"</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                          leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                          leave.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        {leave.status === 'pending' ? (
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => handleUpdateLeave(leave.id!, 'approved')}
                              className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleUpdateLeave(leave.id!, 'rejected')}
                              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1 text-right">
                            <span className="text-[10px] font-bold text-slate-400 capitalize">{leave.status}</span>
                            {leave.adminComment && <span className="text-[9px] text-slate-300 italic truncate max-w-[100px]">{leave.adminComment}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'recap' && (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden text-left">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex flex-col gap-1">
                 <h3 className="font-black text-xl text-slate-800 tracking-tight">Rekapitulasi Karyawan</h3>
                 <p className="text-slate-400 text-xs font-medium">Ringkasan performa kehadiran seluruh masa aktif.</p>
               </div>
               <button 
                onClick={handleExportRecap}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black rounded-2xl transition-all shadow-xl shadow-emerald-500/10 text-xs"
               >
                 <Download size={16} /> UNDUH REKAP EXCEL
               </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-5">Karyawan</th>
                    <th className="px-8 py-5 text-center">Hadiah</th>
                    <th className="px-8 py-5 text-center">Terlambat</th>
                    <th className="px-8 py-5 text-center">Lembur</th>
                    <th className="px-8 py-5 text-right">Performa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {employees.map(emp => {
                    const empRecords = records.filter(r => r.userId === emp.uid);
                    const totalPresent = empRecords.length;
                    const totalLate = empRecords.filter(r => r.isLate).length;
                    const totalOvertimeMinutes = empRecords.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0);
                    const efficiency = totalPresent > 0 ? Math.round(((totalPresent - totalLate) / totalPresent) * 100) : 0;

                    return (
                      <tr key={emp.uid} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{emp.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{emp.employeeId || 'No ID'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center font-mono font-bold text-slate-600">{totalPresent}</td>
                        <td className="px-8 py-6 text-center font-mono font-bold text-amber-600">{totalLate}</td>
                        <td className="px-8 py-6 text-center font-mono font-bold text-indigo-600">{totalOvertimeMinutes}m</td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${efficiency > 80 ? 'bg-emerald-500' : efficiency > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${efficiency}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-slate-400">{efficiency}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            <motion.button 
              whileHover={{ y: -5 }}
              onClick={() => setShowAddForm(true)}
              className="bg-emerald-50 border-4 border-dashed border-emerald-100 rounded-[2.5rem] p-10 flex flex-col items-center justify-center gap-4 group transition-colors hover:bg-emerald-100/50"
            >
              <div className="p-5 bg-white rounded-3xl shadow-xl shadow-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                <UserPlus size={32} />
              </div>
              <div className="text-center">
                <span className="block font-black text-xl text-emerald-700 tracking-tight">Karyawan Baru</span>
                <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest mt-1">Manual Signup</p>
              </div>
            </motion.button>

            {employees.map((emp, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={emp.uid} 
                className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-xl transition-all"
              >
                 <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-emerald-400 font-black text-2xl group-hover:rotate-6 transition-transform">
                       {emp.name.charAt(0)}
                    </div>
                    <div>
                       <h4 className="font-black text-lg text-slate-800 tracking-tight">{emp.name}</h4>
                       <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{emp.employeeId || 'ID UNSET'}</p>
                    </div>
                 </div>
                 <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <button 
                      onClick={() => setSelectedEmpForCard(emp)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-emerald-500 transition-colors"
                    >
                       <QrCode size={14} /> Cetak ID
                    </button>
                    <button 
                      onClick={() => handleDeleteEmployee(emp.uid, emp.name)}
                      className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-red-500 transition-colors"
                    >
                       <Trash2 size={14} /> Hapus
                    </button>
                 </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed lg:hidden bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-between items-center shadow-2xl z-[45]">
          <MobileNavBtn active={activeTab === 'stats'} icon={<BarChart3 />} onClick={() => setActiveTab('stats')} />
          <MobileNavBtn active={activeTab === 'records'} icon={<History />} onClick={() => setActiveTab('records')} />
          <MobileNavBtn active={activeTab === 'leaves'} icon={<Calendar />} onClick={() => setActiveTab('leaves')} />
          <MobileNavBtn active={activeTab === 'recap'} icon={<FileSpreadsheet />} onClick={() => setActiveTab('recap')} />
          <MobileNavBtn active={activeTab === 'employees'} icon={<Users />} onClick={() => setActiveTab('employees')} />
      </nav>

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
              
              <div className="p-8 pt-4 space-y-4 max-h-[60vh] overflow-y-auto">
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
        {showAddForm && (
          <AddEmployeeForm 
            onClose={() => setShowAddForm(false)} 
            onSuccess={() => {
              setShowAddForm(false);
              fetchEmployees();
              setNotification("Karyawan berhasil ditambahkan!");
              setTimeout(() => setNotification(null), 3000);
            }} 
          />
        )}
        {showScanner && (
          <QRScanner 
            onScan={onScanEmployee} 
            onClose={() => setShowScanner(false)} 
          />
        )}
        {selectedEmpForCard && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-6 print:p-0 print:bg-white print:fixed">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full print:shadow-none print:p-0"
            >
               <div className="flex justify-between items-center mb-6 print:hidden">
                 <h3 className="font-black text-xl text-slate-800">Cetak Digital ID</h3>
                 <button onClick={() => setSelectedEmpForCard(null)} className="text-slate-300 hover:text-slate-500 transition-colors">
                   <LogOut className="rotate-45" size={24} />
                 </button>
               </div>
               
               <IDCard profile={selectedEmpForCard} />
               
               <div className="mt-8 flex gap-4 print:hidden">
                 <button 
                   onClick={() => setSelectedEmpForCard(null)}
                   className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-[10px] tracking-widest"
                 >
                   Batal
                 </button>
                 <button 
                   onClick={handlePrintCard}
                   className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"
                 >
                   <Printer size={16} /> Cetak Sekarang
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavBtn({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black text-sm tracking-tight ${active ? 'bg-emerald-500 text-slate-900 shadow-xl shadow-emerald-500/10 translate-x-2' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
      {React.cloneElement(icon, { size: 20 })}
      {label}
    </button>
  );
}

function MobileNavBtn({ active, icon, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`p-3 rounded-2xl transition-all ${active ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-300'}`}
    >
      {React.cloneElement(icon, { size: 24 })}
    </button>
  );
}

function AIInsights({ records }: { records: AttendanceRecord[] }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getAIAnalysis = async () => {
    setLoading(true);
    const text = await aiService.getAttendanceInsights(records);
    setInsight(text);
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 p-8 lg:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-12 -mr-8 -mt-8 text-emerald-500/10 group-hover:scale-110 transition-transform">
        <Sparkles size={120} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="text-emerald-400 animate-pulse" size={24} />
          <h3 className="text-xl font-black tracking-tight">AI Attendance Insight</h3>
        </div>

        {insight ? (
          <div className="space-y-4">
            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
              {insight}
            </div>
            <button 
              onClick={() => setInsight(null)}
              className="text-[10px] font-black uppercase text-emerald-400 tracking-widest hover:underline"
            >
              Tutup Analisis
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-slate-400 text-sm max-w-lg">
              Gunakan kecerdasan buatan untuk menganalisis tren kehadiran, mendeteksi pola keterlambatan, dan mendapatkan saran manajemen secara otomatis.
            </p>
            <button
              onClick={getAIAnalysis}
              disabled={loading}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black rounded-2xl transition-all disabled:opacity-50"
            >
              {loading ? "Menganalisis..." : "Generate Analysis"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: any) {
  const colorMap: any = {
    emerald: 'bg-emerald-500 text-emerald-500',
    amber: 'bg-amber-500 text-amber-500',
    red: 'bg-red-500 text-red-500',
    indigo: 'bg-indigo-500 text-indigo-500'
  };

  return (
    <div className={`p-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all`}>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{label}</p>
      <div className="flex items-end justify-between">
        <h3 className="text-4xl font-black text-slate-800 tracking-tighter">{value}</h3>
        <div className={`p-3 rounded-2xl ${colorMap[color].split(' ')[0]} bg-opacity-10 ${colorMap[color].split(' ')[1]}`}>
           {React.cloneElement(icon, { size: 20 })}
        </div>
      </div>
    </div>
  );
}
