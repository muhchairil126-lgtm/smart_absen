import { GoogleGenAI } from '@google/genai';
import { AttendanceRecord } from './attendanceService';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const aiService = {
  async getAttendanceInsights(records: AttendanceRecord[]) {
    // Check if API key is present (platform injects it as process.env.GEMINI_API_KEY)
    if (!process.env.GEMINI_API_KEY || records.length === 0) return "Analisis AI memerlukan API Key yang valid.";

    // Aggregate data for AI
    const summary = records.slice(0, 50).map(r => ({
      name: r.userName,
      late: r.isLate,
      minutes: r.lateMinutes,
      session: r.session,
      status: r.status
    }));

    const prompt = `Analisis data kehadiran karyawan berikut (max 50 data terakhir):
    ${JSON.stringify(summary)}
    
    Berikan ringkasan singkat dalam Bahasa Indonesia tentang:
    1. Tren kedisiplinan (ketepatan waktu).
    2. Masalah yang ditemukan (siapa yang sering terlambat, dll).
    3. Rekomendasi singkat untuk manajemen.
    
    Format: Point-point singkat.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      return response.text;
    } catch (error) {
      console.error("AI Insight Error:", error);
      return "Gagal memuat analisis AI. Pastikan kuota API mencukupi.";
    }
  }
};
