import React, { useState } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import { X, Camera } from 'lucide-react';

interface Props {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-4 text-white hover:bg-white/10 rounded-full transition-colors"
      >
        <X size={32} />
      </button>

      <div className="w-full max-w-sm aspect-square relative rounded-3xl overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20">
        <BarcodeScannerComponent
          width="100%"
          height="100%"
          onUpdate={(err, result) => {
            if (result) {
              onScan(result.getText());
            }
          }}
        />
        {/* Scanning focus area */}
        <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
            <div className="w-full h-full border-2 border-emerald-500/50 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-full mb-4">
           <Camera size={16} />
           <span className="text-xs font-bold uppercase tracking-widest">Scanning Active</span>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Pindai Kode QR</h3>
        <p className="text-white/50 text-sm">Arahkan kamera ke kode QR ID Karyawan</p>
      </div>
    </div>
  );
}
