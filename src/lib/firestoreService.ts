import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db, handleFirestoreError } from './firebase';
import { JournalEntry, LearningSummary, UserProfile, OperationType } from '../types';

export async function syncUserProfile(firebaseUser: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const path = `users/${firebaseUser.uid}`;

  try {
    const existingSnap = await getDoc(userRef);
    const nowIso = new Date().toISOString();

    if (existingSnap.exists()) {
      const data = existingSnap.data() as UserProfile;
      const updatedProfile: UserProfile = {
        ...data,
        displayName: firebaseUser.displayName || data.displayName || 'Learner',
        photoURL: firebaseUser.photoURL || data.photoURL || '',
        lastLoginAt: nowIso,
      };
      await setDoc(userRef, updatedProfile, { merge: true });
      return updatedProfile;
    } else {
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || 'Learner',
        photoURL: firebaseUser.photoURL || '',
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };
      await setDoc(userRef, newProfile);
      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
): () => void {
  const collectionPath = `users/${userId}/entries`;
  const entriesCol = collection(db, 'users', userId, 'entries');
  const q = query(entriesCol, orderBy('timestamp', 'asc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as JournalEntry);
      });
      onUpdate(entries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  return unsubscribe;
}

export async function saveJournalEntry(
  userId: string,
  data: {
    role: 'user' | 'model';
    text: string;
    topic?: string;
  }
): Promise<JournalEntry> {
  const safeRandom = Math.random().toString(36).substring(2, 9);
  const entryId = `entry_${Date.now()}_${safeRandom}`;
  const docPath = `users/${userId}/entries/${entryId}`;
  const docRef = doc(db, 'users', userId, 'entries', entryId);

  const newEntry: JournalEntry = {
    id: entryId,
    userId,
    role: data.role,
    text: data.text,
    createdAt: new Date().toISOString(),
    timestamp: Date.now(),
    ...(data.topic ? { topic: data.topic.trim().substring(0, 100) } : {}),
  };

  try {
    await setDoc(docRef, newEntry);
    return newEntry;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  const docPath = `users/${userId}/entries/${entryId}`;
  const docRef = doc(db, 'users', userId, 'entries', entryId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeToUserSummaries(
  userId: string,
  onUpdate: (summaries: LearningSummary[]) => void,
  onError: (error: Error) => void
): () => void {
  const collectionPath = `users/${userId}/summaries`;
  const summariesCol = collection(db, 'users', userId, 'summaries');
  const q = query(summariesCol, orderBy('timestamp', 'desc'));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const summaries: LearningSummary[] = [];
      snapshot.forEach((docSnap) => {
        summaries.push(docSnap.data() as LearningSummary);
      });
      onUpdate(summaries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );

  return unsubscribe;
}

export async function saveLearningSummary(
  userId: string,
  data: {
    learningSummary: string;
    conceptToRevise: string;
    nextAction: string;
    topic?: string;
  },
  existingSummaryId?: string
): Promise<LearningSummary> {
  const safeRandom = Math.random().toString(36).substring(2, 9);
  const summaryId = existingSummaryId || `summary_${Date.now()}_${safeRandom}`;
  const docPath = `users/${userId}/summaries/${summaryId}`;
  const docRef = doc(db, 'users', userId, 'summaries', summaryId);

  const summaryData: LearningSummary = {
    id: summaryId,
    userId,
    learningSummary: data.learningSummary,
    conceptToRevise: data.conceptToRevise,
    nextAction: data.nextAction,
    createdAt: new Date().toISOString(),
    timestamp: Date.now(),
    ...(data.topic ? { topic: data.topic.trim().substring(0, 100) } : {}),
  };

  try {
    await setDoc(docRef, summaryData, { merge: true });
    return summaryData;
  } catch (error) {
    handleFirestoreError(
      error,
      existingSummaryId ? OperationType.UPDATE : OperationType.CREATE,
      docPath
    );
  }
}

export async function deleteLearningSummary(userId: string, summaryId: string): Promise<void> {
  const docPath = `users/${userId}/summaries/${summaryId}`;
  const docRef = doc(db, 'users', userId, 'summaries', summaryId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
