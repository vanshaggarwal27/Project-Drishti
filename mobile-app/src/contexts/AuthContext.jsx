import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { toast } from '@/components/ui/use-toast';

// Firebase configuration (using demo mode for now)
const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-project.firebaseapp.com",
  projectId: "demo-project",
  storageBucket: "demo-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "demo-app-id"
};

// Initialize Firebase (in demo mode)
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.log('Firebase running in demo mode');
  auth = null;
  db = null;
}

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedUser = localStorage.getItem('safeguard_user_session');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setUserProfile(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('safeguard_user_session');
      }
    }
    setLoading(false);

    // If Firebase is configured, set up auth listener
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser && !user) {
          // Firebase user exists but no local profile
          console.log('Firebase user detected');
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const login = async (userData) => {
    setLoading(true);
    try {
      // Validate required fields
      if (!userData.name || !userData.email || !userData.phone) {
        throw new Error('Please fill in all required fields');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Validate phone format
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(userData.phone.replace(/[\s\-\(\)]/g, ''))) {
        throw new Error('Please enter a valid phone number');
      }

      const processedUserData = {
        id: `user_${Date.now()}`,
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        phone: userData.phone.trim(),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        safetyStatus: 'safe',
        locationPermission: 'pending'
      };

      // Save to Firebase if available
      if (auth && db) {
        try {
          const firebaseUser = await signInAnonymously(auth);
          await setDoc(doc(db, 'users', firebaseUser.user.uid), processedUserData);
          console.log('✅ User data saved to Firebase');
        } catch (firebaseError) {
          console.warn('Firebase save failed, continuing with local storage:', firebaseError.message);
        }
      }

      // Save to localStorage
      localStorage.setItem('safeguard_user_session', JSON.stringify(processedUserData));
      
      setUser(processedUserData);
      setUserProfile(processedUserData);
      setIsAuthenticated(true);

      toast({
        title: "Welcome to SafeGuard! 👋",
        description: `Hello ${processedUserData.name}! Your account has been created successfully.`,
        duration: 4000
      });

      return processedUserData;
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "Please check your information and try again.",
        variant: "destructive",
        duration: 5000
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('safeguard_user_session');
      setUser(null);
      setUserProfile(null);
      setIsAuthenticated(false);

      if (auth) {
        // Sign out from Firebase if configured
        await auth.signOut();
      }

      toast({
        title: "Goodbye! 👋",
        description: "You have been safely logged out.",
        duration: 3000
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUserProfile = async (updates) => {
    if (!user) return;

    try {
      const updatedProfile = {
        ...userProfile,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      // Save to Firebase if available
      if (auth && db && auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), updatedProfile, { merge: true });
      }

      // Save to localStorage
      localStorage.setItem('safeguard_user_session', JSON.stringify(updatedProfile));
      
      setUserProfile(updatedProfile);
      setUser(updatedProfile);

      return updatedProfile;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUserProfile,
    auth,
    db
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
