import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  setDoc,
  doc,
  getDoc,
  orderBy,
  Timestamp,
  onSnapshot,
  serverTimestamp,
  FieldValue,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  isAfter, 
  setHours, 
  setMinutes, 
  format, 
  differenceInMinutes 
} from 'date-fns';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export enum AttendanceStatus {
  PRESENT = 'present',
  PERMIT = 'permit',
  SICK = 'sick',
  OVERTIME = 'overtime'
}

export enum AttendanceSession {
  MORNING = 'morning',
  AFTERNOON = 'afternoon'
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  employeeId?: string;
}

export interface AttendanceRecord {
  id?: string;
  userId: string;
  userName: string;
  date: string;
  timestamp: Timestamp | FieldValue;
  session: AttendanceSession;
  status: AttendanceStatus;
  location?: {
    latitude: number;
    longitude: number;
  };
  isLate: boolean;
  lateMinutes: number;
  overtimeMinutes: number;
}

export interface LeaveRequest {
  id?: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp | FieldValue;
  adminComment?: string;
}

const ATTENDANCE_COLLECTION = 'attendance';
const USERS_COLLECTION = 'users';
const LEAVES_COLLECTION = 'leaves';

export const attendanceService = {
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, USERS_COLLECTION, uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${USERS_COLLECTION}/${uid}`);
      return null;
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(db, USERS_COLLECTION, profile.uid), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${USERS_COLLECTION}/${profile.uid}`);
    }
  },

  async getAllEmployees(): Promise<UserProfile[]> {
    try {
      const q = query(collection(db, USERS_COLLECTION), where('role', '==', 'employee'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
      return [];
    }
  },

  async recordAttendance(
    user: UserProfile, 
    status: AttendanceStatus, 
    location?: { latitude: number; longitude: number }
  ): Promise<AttendanceRecord> {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    
    // Determine session
    // Morning: before 11:00
    // Afternoon: after 11:00
    const currentHour = now.getHours();
    const session = currentHour < 11 ? AttendanceSession.MORNING : AttendanceSession.AFTERNOON;
    
    // Check if late
    let isLate = false;
    let lateMinutes = 0;
    
    if (session === AttendanceSession.MORNING) {
      const deadline = setMinutes(setHours(now, 7), 15);
      if (isAfter(now, deadline)) {
        isLate = true;
        lateMinutes = differenceInMinutes(now, deadline);
      }
    } else {
      const deadline = setMinutes(setHours(now, 13), 30);
      if (isAfter(now, deadline)) {
        isLate = true;
        lateMinutes = differenceInMinutes(now, deadline);
      }
    }

    // Check for overtime (after 18:00)
    let overtimeMinutes = 0;
    const overtimeCutoff = setMinutes(setHours(now, 18), 0);
    if (isAfter(now, overtimeCutoff)) {
      overtimeMinutes = differenceInMinutes(now, overtimeCutoff);
      // If the user was just "present", we can upgrade it to "overtime" status
      if (status === AttendanceStatus.PRESENT) {
        status = AttendanceStatus.OVERTIME;
      }
    }

    const record: AttendanceRecord = {
      userId: user.uid,
      userName: user.name,
      date: today,
      timestamp: serverTimestamp(),
      session,
      status,
      location,
      isLate,
      lateMinutes,
      overtimeMinutes
    };

    try {
      const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), record);
      return { ...record, id: docRef.id, timestamp: Timestamp.fromDate(now) };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, ATTENDANCE_COLLECTION);
      throw error;
    }
  },

  async getAttendanceToday(uid: string): Promise<AttendanceRecord[]> {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const q = query(
        collection(db, ATTENDANCE_COLLECTION), 
        where('userId', '==', uid),
        where('date', '==', today)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data() as AttendanceRecord, id: doc.id }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, ATTENDANCE_COLLECTION);
      return [];
    }
  },

  async getUserAttendance(uid: string): Promise<AttendanceRecord[]> {
    try {
      const q = query(
        collection(db, ATTENDANCE_COLLECTION), 
        where('userId', '==', uid),
        orderBy('timestamp', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data() as AttendanceRecord, id: doc.id }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, ATTENDANCE_COLLECTION);
      return [];
    }
  },

  async getAllAttendance(): Promise<AttendanceRecord[]> {
    try {
      const q = query(collection(db, ATTENDANCE_COLLECTION), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data() as AttendanceRecord, id: doc.id }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, ATTENDANCE_COLLECTION);
      return [];
    }
  },

  subscribeToAttendance(callback: (records: AttendanceRecord[]) => void) {
    const q = query(collection(db, ATTENDANCE_COLLECTION), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ ...doc.data() as AttendanceRecord, id: doc.id }));
      callback(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, ATTENDANCE_COLLECTION);
    });
  },

  async requestLeave(leave: Omit<LeaveRequest, 'id' | 'createdAt' | 'status'>): Promise<LeaveRequest> {
    const newLeave: Omit<LeaveRequest, 'id'> = {
      ...leave,
      status: 'pending',
      createdAt: serverTimestamp()
    };
    try {
      const docRef = await addDoc(collection(db, LEAVES_COLLECTION), newLeave);
      return { ...newLeave, id: docRef.id, createdAt: Timestamp.now() } as LeaveRequest;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, LEAVES_COLLECTION);
      throw error;
    }
  },

  async getMyLeaves(uid: string): Promise<LeaveRequest[]> {
    try {
      const q = query(
        collection(db, LEAVES_COLLECTION), 
        where('userId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data() as LeaveRequest, id: doc.id }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, LEAVES_COLLECTION);
      return [];
    }
  },

  async getAllLeaves(): Promise<LeaveRequest[]> {
    try {
      const q = query(collection(db, LEAVES_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ ...doc.data() as LeaveRequest, id: doc.id }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, LEAVES_COLLECTION);
      return [];
    }
  },

  async updateLeaveStatus(leaveId: string, status: 'approved' | 'rejected', adminComment?: string): Promise<void> {
    try {
      const leaveRef = doc(db, LEAVES_COLLECTION, leaveId);
      await setDoc(leaveRef, { status, adminComment }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${LEAVES_COLLECTION}/${leaveId}`);
    }
  },

  subscribeToLeaves(callback: (leaves: LeaveRequest[]) => void) {
    const q = query(collection(db, LEAVES_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const leaves = snapshot.docs.map(doc => ({ ...doc.data() as LeaveRequest, id: doc.id }));
      callback(leaves);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, LEAVES_COLLECTION);
    });
  },

  async deleteEmployee(uid: string): Promise<void> {
    try {
      const userRef = doc(db, USERS_COLLECTION, uid);
      await deleteDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${USERS_COLLECTION}/${uid}`);
    }
  }
};
