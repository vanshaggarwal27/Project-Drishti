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
  ANALYSIS_LOGS: 'analysis-logs',
  ALERTS: 'alerts',
  NOTIFICATION_LOGS: 'notificationLogs',
  USERS: 'users'
};

// SOS Alerts functions
export const createSOSAlert = async (alertData) => {
  try {
    // Structure data according to new schema
    const sosAlertDoc = {
      // REQUIRED FIELDS from mobile app
      userId: alertData.userId,
      message: alertData.message,
      videoUrl: alertData.videoUrl || null,
      location: {
        latitude: alertData.location.latitude,
        longitude: alertData.location.longitude,
        address: alertData.location.address || 'Address not available'
      },
      createdAt: serverTimestamp(),

      // OPTIONAL FIELDS
      status: 'pending',

      // GEMINI ANALYSIS FIELDS (null initially, filled by AI service)
      geminiAnalysis: null,

      // CONVENIENCE FIELDS (extracted after analysis)
      isEmergency: null,
      primaryService: null,
      analysisConfidence: null,
      lastUpdated: serverTimestamp(),

      // ADMIN REVIEW FIELDS (optional)
      adminReview: null
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.SOS_ALERTS), sosAlertDoc);
    console.log('✅ SOS Alert created with new schema:', docRef.id);
    return docRef.id;
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.warn('⚠️ Firebase permission denied - using fallback storage');
      // Fallback to localStorage for demo purposes
      const localId = `sos_${Date.now()}`;
      const localAlerts = JSON.parse(localStorage.getItem('local_sos_alerts') || '[]');
      const localAlert = {
        id: localId,
        userId: alertData.userId,
        message: alertData.message,
        videoUrl: alertData.videoUrl || null,
        location: alertData.location,
        createdAt: new Date(),
        status: 'pending',
        isEmergency: null
      };
      localAlerts.unshift(localAlert);
      localStorage.setItem('local_sos_alerts', JSON.stringify(localAlerts));
      return localId;
    }
    console.error('❌ Error creating SOS alert:', error);
    throw error;
  }
};

export const getSOSAlerts = async (limitCount = 10) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.SOS_ALERTS),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('❌ Error getting SOS alerts:', error);
    throw error;
  }
};

export const subscribeToSOSAlerts = (callback) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.SOS_ALERTS),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (querySnapshot) => {
      const alerts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(alerts);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn('⚠️ Firebase permission denied - using local storage fallback');
        // Use localStorage as fallback
        const localAlerts = JSON.parse(localStorage.getItem('local_sos_alerts') || '[]');
        callback(localAlerts);
        return () => {}; // Return empty unsubscribe function
      }
      console.error('❌ Error in SOS alerts subscription:', error);
      callback([]); // Return empty array on error
    });
  } catch (error) {
    console.error('❌ Error setting up SOS alerts subscription:', error);
    // Fallback to localStorage
    const localAlerts = JSON.parse(localStorage.getItem('local_sos_alerts') || '[]');
    callback(localAlerts);
    return () => {}; // Return empty unsubscribe function
  }
};

// Analysis Logs functions
export const createAnalysisLog = async (logData) => {
  try {
    const analysisLog = {
      reportId: logData.reportId,
      videoUrl: logData.videoUrl,
      analysis: logData.analysis,
      analyzedAt: serverTimestamp(),
      status: logData.status || 'completed'
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.ANALYSIS_LOGS), analysisLog);
    console.log('✅ Analysis log created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating analysis log:', error);
    throw error;
  }
};

// Notification Logs functions
export const createNotificationLog = async (logData) => {
  try {
    // Validate required fields
    if (!logData.reportId) {
      throw new Error('reportId is required for notification logs');
    }

    const notificationLog = {
      reportId: logData.reportId,
      type: logData.type || 'general',
      emergencyServices: logData.emergencyServices || [],
      publicRecipients: logData.publicRecipients || [],
      sentAt: serverTimestamp(),
      status: logData.status || 'sent',
      // Add optional fields if provided
      ...(logData.userId && { userId: logData.userId }),
      ...(logData.message && { message: logData.message }),
      ...(logData.metadata && { metadata: logData.metadata })
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATION_LOGS), notificationLog);
    console.log('✅ Notification log created:', docRef.id);
    return docRef.id;
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.warn('⚠️ Firebase permission denied - skipping notification log');
      return `local_log_${Date.now()}`;
    }
    console.error('❌ Error creating notification log:', error);
    console.error('Failed log data:', logData);
    throw error;
  }
};

// System Alerts functions
export const createSystemAlert = async (alertData) => {
  try {
    const systemAlert = {
      id: alertData.id || `alert_${Date.now()}`,
      title: alertData.title,
      message: alertData.message,
      severity: alertData.severity || 'medium',
      location: alertData.location,
      radius: alertData.radius || 1000,
      duration: alertData.duration || 60,
      createdAt: serverTimestamp(),
      expiresAt: alertData.expiresAt ? new Date(alertData.expiresAt) : null,
      isActive: true
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.ALERTS), systemAlert);
    console.log('✅ System alert created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating system alert:', error);
    throw error;
  }
};

// Update SOS Alert with Gemini Analysis
export const updateSOSAlertWithAnalysis = async (alertId, analysisData) => {
  try {
    const alertRef = doc(db, COLLECTIONS.SOS_ALERTS, alertId);

    const updateData = {
      geminiAnalysis: {
        is_emergency: analysisData.is_emergency,
        reason: analysisData.reason,
        primary_service: analysisData.primary_service,
        confidence: analysisData.confidence,
        analyzedAt: serverTimestamp(),
        videoUrl: analysisData.videoUrl,
        apiVersion: analysisData.apiVersion || 'gemini-1.5-flash',
        error: false,
        error_message: null
      },
      // Convenience fields for easier querying
      isEmergency: analysisData.is_emergency,
      primaryService: analysisData.primary_service,
      analysisConfidence: analysisData.confidence,
      lastUpdated: serverTimestamp()
    };

    await updateDoc(alertRef, updateData);
    console.log('✅ SOS Alert updated with Gemini analysis:', alertId);
    return alertId;
  } catch (error) {
    console.error('❌ Error updating SOS alert with analysis:', error);
    throw error;
  }
};

// System Alerts subscription
export const subscribeToSystemAlerts = (callback) => {
  try {
    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, COLLECTIONS.ALERTS),
      where('isActive', '==', true),
      limit(50)
    );
    return onSnapshot(q, (querySnapshot) => {
      const alerts = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return bTime - aTime;
        });
      callback(alerts);
    }, (error) => {
      if (error.code === 'failed-precondition' && error.message.includes('index')) {
        console.error('🔥 Firebase composite index required. Create it here:', error.message);
        toast({
          title: "Database Index Required",
          description: "System alerts may be limited. Check console for Firebase index URL.",
          variant: "destructive",
          duration: 10000
        });
      } else {
        console.warn('⚠️ System alerts subscription error:', error.message);
      }
      callback([]); // Return empty array on error
    });
  } catch (error) {
    console.error('❌ Error setting up system alerts subscription:', error);
    callback([]);
    return () => {}; // Return empty unsubscribe function
  }
};

// Get emergency videos (for admin dashboard)
export const getEmergencyVideos = async (limitCount = 20) => {
  try {
    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, COLLECTIONS.SOS_ALERTS),
      where('isEmergency', '==', true),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const alerts = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bTime - aTime;
      });
    return alerts;
  } catch (error) {
    console.error('❌ Error getting emergency videos:', error);
    // Return empty array on error instead of throwing
    return [];
  }
};

// Get videos pending analysis
export const getVideosForAnalysis = async (limitCount = 10) => {
  try {
    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, COLLECTIONS.SOS_ALERTS),
      where('geminiAnalysis', '==', null),
      limit(limitCount * 2) // Get more to filter client-side
    );
    const querySnapshot = await getDocs(q);
    const alerts = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(alert => alert.videoUrl) // Filter for videos on client-side
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bTime - aTime;
      })
      .slice(0, limitCount); // Limit after sorting
    return alerts;
  } catch (error) {
    console.error('❌ Error getting videos for analysis:', error);
    // Return empty array on error instead of throwing
    return [];
  }
};

// Get videos by service type
export const getVideosByService = async (serviceType, limitCount = 20) => {
  try {
    // Simplified query to avoid composite index requirement
    const q = query(
      collection(db, COLLECTIONS.SOS_ALERTS),
      where('primaryService', '==', serviceType),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    const alerts = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bTime - aTime;
      });
    return alerts;
  } catch (error) {
    console.error('❌ Error getting videos by service type:', error);
    // Return empty array on error instead of throwing
    return [];
  }
};

// Get all SOS alerts for admin dashboard (no user filtering)
export const getAllSOSAlertsForAdmin = async (limitCount = 50) => {
  try {
    const q = query(
      collection(db, COLLECTIONS.SOS_ALERTS),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('❌ Error getting all SOS alerts for admin:', error);
    throw error;
  }
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
    if (error.code === 'permission-denied') {
      console.warn('⚠️ Firebase permission denied - using localStorage for user data');
      // Fallback to localStorage
      localStorage.setItem(`user_${userId}`, JSON.stringify({
        ...userData,
        lastUpdated: new Date().toISOString()
      }));
      return;
    }
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
  
  const videoFileName = `sos-videos/${userId}/sos_${Date.now()}.mp4`;
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
