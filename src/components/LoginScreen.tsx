import React from 'react';
import { auth, GoogleAuthProvider, signInWithPopup } from '../lib/firebase';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck } from 'lucide-react';

export default function LoginScreen() {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 shadow-2xl z-10 text-center"
      >
        <div className="inline-flex items-center justify-center p-4 bg-emerald-500/20 rounded-2xl mb-6">
          <ShieldCheck className="w-12 h-12 text-emerald-400" />
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">AbsenKita</h1>
        <p className="text-emerald-200/60 mb-8">Sistem Manajemen Kehadiran Karyawan Modern</p>

        <button
          onClick={handleLogin}
          className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 group"
        >
          <LogIn className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          Masuk dengan Google
        </button>

        <p className="mt-8 text-xs text-white/30 uppercase tracking-widest font-mono">
          Powered by Google Cloud
        </p>
      </motion.div>
    </div>
  );
}
