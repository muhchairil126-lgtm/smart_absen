# Security Specification - AbsenKita

## Data Invariants
1. **User Identity**: A user can only create/update their own profile document in `/users/{userId}` where `userId == request.auth.uid`.
2. **Role Integrity**: Only existing admins can assign or change roles. New users default to 'employee' (except the first user, which we'll handle by allowing if no admins exist). *Correction*: Actually, the code handles first user logic. Rules should strictly prevent role updates by non-admins.
3. **Attendance Ownership**: An employee can only create and read their own attendance records.
4. **Admin Supremacy**: Admins have full read access to all collections and can manage users.
5. **Session Constraints**: Attendance records must have a session of 'morning' or 'afternoon'.
6. **Temporal Integrity**: `timestamp` in attendance must be `request.time`.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: `setDoc(doc(db, 'users', 'victim_uid'), { role: 'admin', ... })` as `attacker_uid`.
2. **Privilege Escalation**: `updateDoc(doc(db, 'users', 'my_uid'), { role: 'admin' })` as an employee.
3. **Orphaned Attendance**: `addDoc(collection(db, 'attendance'), { userId: 'not_me', ... })`.
4. **ID Poisoning**: `setDoc(doc(db, 'users', 'a'.repeat(1500)), { ... })`.
5. **Resource Exhaustion**: `addDoc(collection(db, 'attendance'), { userName: 'x'.repeat(1024 * 1024), ... })`.
6. **Query Scraping**: `getDocs(collection(db, 'attendance'))` as an employee (expecting all records).
7. **Bypassing Server Time**: `addDoc(collection(db, 'attendance'), { timestamp: Timestamp.fromDate(new Date('2020-01-01')), ... })`.
8. **Shadow Field Injection**: `setDoc(doc(db, 'users', 'my_uid'), { ..., ghostField: true })`.
9. **Email Spoofing**: `setDoc(doc(db, 'users', 'my_uid'), { email: 'admin@company.com', ... })` without verification.
10. **State Corruption**: `updateDoc(doc(db, 'attendance', 'record_id'), { isLate: false })` by the employee after being marked late.
11. **PII Leak**: `getDoc(doc(db, 'users', 'other_user_id'))` by a non-admin.
12. **Unauthorized Deletion**: `deleteDoc(doc(db, 'users', 'other_user_id'))` by an employee.

## Test Runner (Logic Overview)
The `firestore.rules.test.ts` (conceptual) will assert `PERMISSION_DENIED` for all the above, while allowing valid operations.
