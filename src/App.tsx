import React, { useState, useEffect } from 'react';
import { 
  auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from './lib/firebase';
import { attendanceService, UserProfile, AttendanceRecord, AttendanceStatus } from './services/attendanceService';
import { 
  Users, 
  Calendar, 
  BarChart3, 
  LogOut, 
  Clock, 
  MapPin, 
  QrCode, 
  UserPlus,
  Bell,
  CheckCircle2,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { format } from 'date-fns';

// Components
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        let userProfile = await attendanceService.getUserProfile(firebaseUser.uid);
        
        if (!userProfile) {
          // If first user, make admin, otherwise employee
          const allUsers = await attendanceService.getAllEmployees();
          const role = allUsers.length === 0 ? 'admin' : 'employee';
          
          userProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            role: role,
          };
          await attendanceService.createUserProfile(userProfile);
        }
        setProfile(userProfile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {profile.role === 'admin' ? (
        <AdminDashboard user={user} profile={profile} />
      ) : (
        <EmployeeDashboard user={user} profile={profile} />
      )}
    </div>
  );
}
