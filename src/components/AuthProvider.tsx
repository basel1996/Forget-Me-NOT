import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User } from '../lib/firebase';
import { Capacitor } from '@capacitor/core';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

interface AuthContextType {
  user: any | null; // Use any to accommodate offline Google users
  loading: boolean;
  offlineLogin: (userData: any) => void;
  offlineLogout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, offlineLogin: () => {}, offlineLogout: () => {} });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [offlineUser, setOfflineUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isOnline = useNetworkStatus();

  useEffect(() => {
    // If not using Capacitor, this feature might not be necessary, but we can store in localStorage
    const storedUser = localStorage.getItem('offlineUser');
    if (storedUser) {
      try {
        setOfflineUser(JSON.parse(storedUser));
      } catch (e) {}
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        // Sync firebase user to offline user
        const userData = { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL };
        setOfflineUser(userData);
        localStorage.setItem('offlineUser', JSON.stringify(userData));
      } else {
        // if Firebase fires null but we have an intentional offline user, keep them logged in
        // until offlineLogout is explicitly called.
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const offlineLogin = (userData: any) => {
    // Determine a uid (Firebase sometimes maps Google sub to uid, but let's carefully ensure consistency if possible)
    // Actually, usually Google's sub is NOT the Firebase uid. However, if offline we must try our best.
    const offlineUserData = { 
      uid: userData.uid || userData.id || userData.sub, 
      email: userData.email, 
      displayName: userData.displayName || userData.name || userData.givenName, 
      photoURL: userData.photoURL || userData.imageUrl || userData.picture 
    };
    setOfflineUser(offlineUserData);
    localStorage.setItem('offlineUser', JSON.stringify(offlineUserData));
  };

  const offlineLogout = () => {
    setOfflineUser(null);
    localStorage.removeItem('offlineUser');
  };

  // If online, prefer Firebase User, but we can just use offlineUser as long as we map correctly
  // Wait, if firebaseUser is present, it's safer to use that.
  const activeUser = firebaseUser || offlineUser;

  return (
    <AuthContext.Provider value={{ user: activeUser, loading, offlineLogin, offlineLogout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

