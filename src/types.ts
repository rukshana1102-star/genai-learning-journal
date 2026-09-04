export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
  timestamp: number;
  topic?: string;
}

export interface LearningSummary {
  id: string;
  userId: string;
  learningSummary: string;
  conceptToRevise: string;
  nextAction: string;
  createdAt: string;
  timestamp: number;
  topic?: string;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}
