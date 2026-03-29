import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAuthReady: false, isAdmin: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if user is admin
        const adminEmail = "tanakrit.k@kkumail.com";
        const isDefaultAdmin = firebaseUser.email === adminEmail && firebaseUser.emailVerified;
        
        // Ensure user profile exists in Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const userData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || `${firebaseUser.uid}@no-email.com`,
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
              role: isDefaultAdmin ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, userData);
            setIsAdmin(isDefaultAdmin);
          } else {
            const userData = userDoc.data();
            setIsAdmin(userData.role === 'admin' || isDefaultAdmin);
          }
        } catch (error) {
          console.error("Error checking/creating user profile in Firestore:", error);
          setIsAdmin(isDefaultAdmin);
        }
      } else {
        setIsAdmin(false);
      }
      setUser(firebaseUser);
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthReady, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
