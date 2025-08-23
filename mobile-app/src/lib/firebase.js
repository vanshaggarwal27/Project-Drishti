import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from '@/components/ui/use-toast';

const firebaseConfig = {
  apiKey: "AIzaSyC6XtUDmKv0aul-zUL3TRH1i2UxWtgCLU0",
  authDomain: "crowd-monitoring-e1f70.firebaseapp.com",
  projectId: "crowd-monitoring-e1f70",
  storageBucket: "crowd-monitoring-e1f70.firebasestorage.app",
  messagingSenderId: "1069463850395",
  appId: "1:1069463850395:web:f24d177297c60e0c50a53e",
  measurementId: "G-68VH97XQ6V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log('🔥 Firebase initialized successfully!');

// Firestore helper functions
import {
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  serverTimestamp,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';

// Collections
export const COLLECTIONS = {
  SOS_ALERTS: 'sos-alerts',
  NOTIFICATION_LOGS: 'notification-logs',
  DANGER_ALERTS: 'danger-alerts',
  USERS: 'users'
};

// SOS Alerts functions
export const createSOSAlert = async (alertData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.SOS_ALERTS), {
      ...alertData,
      timestamp: serverTimestamp(),
      status: 'active',
      createdAt: serverTimestamp()
    });
    console.log('✅ SOS Alert created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating SOS alert:', error);
    throw error;
  }
};

export const getSOSAlerts = async (userId, limitCount = 10) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.SOS_ALERTS),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('❌ Error getting SOS alerts:', error);
    throw error;
  }
};

export const subscribeToSOSAlerts = (userId, callback) => {
  const q = query(
    collection(db, COLLECTIONS.SOS_ALERTS),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (querySnapshot) => {
    const alerts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(alerts);
  });
};

// Notification Logs functions
export const createNotificationLog = async (logData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATION_LOGS), {
      ...logData,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating notification log:', error);
    throw error;
  }
};

// Danger Alerts functions
export const createDangerAlert = async (alertData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.DANGER_ALERTS), {
      ...alertData,
      timestamp: serverTimestamp(),
      active: true
    });
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating danger alert:', error);
    throw error;
  }
};

export const subscribeToDangerAlerts = (location, radiusKm, callback) => {
  const q = query(
    collection(db, COLLECTIONS.DANGER_ALERTS),
    where('active', '==', true),
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(q, (querySnapshot) => {
    const alerts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Filter by location radius on client side (for simplicity)
    // In production, use GeoFirestore for efficient geo queries
    callback(alerts);
  });
};

// User functions
export const createOrUpdateUser = async (userId, userData) => {
  try {
    await setDoc(doc(db, COLLECTIONS.USERS, userId), {
      ...userData,
      lastUpdated: serverTimestamp()
    }, { merge: true });
    console.log('✅ User data saved to Firestore');
  } catch (error) {
    console.error('❌ Error saving user data:', error);
    throw error;
  }
};

export const getUser = async (userId) => {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting user:', error);
    throw error;
  }
};

const recordStream = (stream, duration) => {
  return new Promise((resolve, reject) => {
    const mediaRecorder = new MediaRecorder(stream);
    const chunks = [];
    let timeout;

    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      clearTimeout(timeout);
      const blob = new Blob(chunks, { type: 'video/mp4' });
      resolve(blob);
    };
    mediaRecorder.onerror = (e) => {
      clearTimeout(timeout);
      reject(e);
    };

    mediaRecorder.start();
    timeout = setTimeout(() => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, duration);
  });
};

export const uploadVideoAndGetURL = async (stream, userId) => {
  if (!stream) {
    throw new Error("No video stream provided.");
  }
  
  console.log('🎥 Starting real video upload to Firebase Storage...');

  toast({
    title: "Uploading Emergency Video",
    description: "Securely uploading your emergency video to Firebase...",
    duration: 3000
  });

  const videoDurationMs = 15000;
  const videoBlob = await recordStream(stream, videoDurationMs);
  
  const videoFileName = `sos-videos/sos_${userId}_${Date.now()}.mp4`;
  const videoRef = ref(storage, videoFileName);

  try {
    const snapshot = await uploadBytes(videoRef, videoBlob);
    const videoUrl = await getDownloadURL(snapshot.ref);

    // Thumbnail generation is complex on the client-side.
    // For now, we'll return a placeholder or null.
    // A robust solution would involve a backend function (e.g., Firebase Cloud Function)
    // to generate a thumbnail after the video is uploaded.
    
    return {
      videoUrl,
      videoThumbnail: null, 
      videoDuration: Math.round(videoDurationMs / 1000),
    };
  } catch (error) {
    console.error("Error uploading video:", error);
    throw new Error("Failed to upload emergency video.");
  }
};
