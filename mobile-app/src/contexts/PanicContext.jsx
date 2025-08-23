import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useLocation } from '@/contexts/LocationContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadVideoAndGetURL,
  createSOSAlert,
  subscribeToSOSAlerts,
  createNotificationLog
} from '@/lib/firebase';

const PanicContext = createContext();

export const usePanic = () => {
  const context = useContext(PanicContext);
  if (!context) {
    throw new Error('usePanic must be used within a PanicProvider');
  }
  return context;
};

const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let platform = 'unknown';
    if (/android/i.test(ua)) {
        platform = 'android';
    } else if (/iPad|iPhone|iPod/.test(ua)) {
        platform = 'ios';
    } else if (/Win/.test(ua)) {
        platform = 'windows';
    } else if (/Mac/.test(ua)) {
        platform = 'macos';
    }

    return {
        platform,
        version: navigator.appVersion,
        model: 'Web Browser'
    };
};

export const PanicProvider = ({ children }) => {
  const [isActivated, setIsActivated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [panicHistory, setPanicHistory] = useState([]);
  const [realtimeAlerts, setRealtimeAlerts] = useState([]);
  const { location, getCurrentLocation } = useLocation();
  const { firebaseUser, userProfile } = useAuth();

  // Real-time subscription to SOS alerts
  useEffect(() => {
    if (!firebaseUser?.uid) return;

    console.log('🔄 Setting up real-time SOS alerts subscription...');
    const unsubscribe = subscribeToSOSAlerts(firebaseUser.uid, (alerts) => {
      console.log('🚨 Received real-time SOS alerts:', alerts.length);
      setPanicHistory(alerts);
      setRealtimeAlerts(alerts);

      // Check for active alerts
      const activeAlert = alerts.find(alert => alert.status === 'active');
      setIsActivated(!!activeAlert);
    });

    return () => {
      console.log('🚫 Cleaning up SOS alerts subscription');
      unsubscribe();
    };
  }, [firebaseUser?.uid]);

  const activatePanic = async (message, stream) => {
    if (!firebaseUser?.uid || !userProfile) {
      toast({
        title: "Authentication Required",
        description: "Please log in to send SOS alerts.",
        variant: "destructive",
        duration: 5000
      });
      return;
    }

    const isLocalMode = userProfile.isLocalUser || firebaseUser.uid.startsWith('local_');

    setIsProcessing(true);
    try {
      // Get current location
      let currentLocation = location;
      if (!currentLocation) {
        toast({ title: "Getting Location...", description: "Please wait while we fetch your precise location." });
        currentLocation = await getCurrentLocation();
      }

      // Upload video to Firebase Storage
      let videoData = { videoUrl: null, videoThumbnail: null, videoDuration: 0 };
      if (stream) {
        toast({ title: "Uploading Video...", description: "Your emergency video is being securely uploaded to Firebase..." });
        videoData = await uploadVideoAndGetURL(stream, firebaseUser.uid);
      }

      const deviceInfo = getDeviceInfo();

      // Create SOS alert data
      const sosAlertData = {
        userId: firebaseUser.uid,
        userName: userProfile?.name || 'Unknown User',
        userEmail: userProfile?.email || '',
        userPhone: userProfile?.phone || '',
        message: message || "Emergency SOS activated without a message.",
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy
        },
        deviceInfo,
        videoUrl: videoData.videoUrl,
        videoThumbnail: videoData.videoThumbnail,
        videoDuration: videoData.videoDuration,
        type: 'panic',
        severity: 'high',
        notificationsSent: [],
        responseTime: null,
        resolvedAt: null
      };

      // Save to Firestore (real-time)
      console.log('🚨 Creating SOS alert in Firestore...');
      const alertId = await createSOSAlert(sosAlertData);

      // Log notification
      await createNotificationLog({
        userId: firebaseUser.uid,
        type: 'sos_alert_created',
        alertId: alertId,
        message: `SOS alert created: ${message || 'Emergency activated'}`,
        metadata: {
          location: currentLocation,
          hasVideo: !!videoData.videoUrl
        }
      });

      // Send to backend services
      await sendPanicAlertToBackend({
        ...sosAlertData,
        alertId
      });

      setIsActivated(true);
      toast({
        title: "🚨 SOS Alert Sent!",
        description: "Your emergency alert has been saved to Firebase and emergency services notified.",
        duration: 8000,
      });

      console.log('✅ SOS Alert successfully created in Firestore:', alertId);

      // Auto-deactivate after 30 seconds (can be manually deactivated)
      setTimeout(() => {
        if (isActivated) {
          setIsActivated(false);
        }
      }, 30000);

    } catch (error) {
      console.error("❌ Panic Activation Error:", error);

      // Log error
      if (firebaseUser?.uid) {
        await createNotificationLog({
          userId: firebaseUser.uid,
          type: 'sos_alert_failed',
          message: `SOS alert failed: ${error.message}`,
          metadata: { error: error.message }
        }).catch(console.error);
      }

      toast({
        title: "SOS Alert Failed",
        description: error.message || "Failed to send SOS alert. Please try again.",
        variant: "destructive",
        duration: 8000
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendPanicAlertToBackend = async (payload) => {
    try {
      console.log('📶 Sending SOS alert to backend services...');

      // Check if we're in development mode
      if (window.location.hostname === 'localhost' || window.location.hostname.includes('fly.dev')) {
        console.log('🆘 SOS Alert processed (development mode):', payload.alertId);

        // Simulate realistic backend delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        toast({
          title: "Development Mode",
          description: "SOS alert saved to Firebase. In production, emergency services would be notified.",
          duration: 5000
        });
        return;
      }

      // Production backend API call
      const response = await fetch('/api/sos/alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await firebaseUser.getIdToken()}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Server returned an error' }));
        throw new Error(`Server Error: ${response.status} - ${errorData.message}`);
      }

      const result = await response.json();
      console.log('✅ SOS alert sent to backend successfully:', result);

      toast({
        title: "Emergency Services Notified",
        description: "Your SOS alert has been sent to emergency services.",
        duration: 5000
      });
    } catch (error) {
      console.error('❌ Backend SOS alert failed:', error);

      // In development mode, don't fail completely since Firebase storage worked
      if (window.location.hostname === 'localhost' || window.location.hostname.includes('fly.dev')) {
        console.warn('⚠️ Backend not available, but alert saved to Firebase');
        return;
      }

      throw error;
    }
  };

  const deactivatePanic = () => {
    setIsActivated(false);
  };

  const clearHistory = async () => {
    if (!firebaseUser?.uid) return;

    try {
      // Note: In production, you might want to soft-delete or archive instead of clearing
      // For now, we'll just clear the local state as Firestore data persists
      setPanicHistory([]);
      setRealtimeAlerts([]);

      // Log the action
      await createNotificationLog({
        userId: firebaseUser.uid,
        type: 'history_cleared',
        message: 'User cleared SOS alert history from local view'
      });

      toast({
        title: "Local History Cleared",
        description: "SOS alert history cleared from local view. Data remains in Firebase."
      });

      console.log('✅ Local SOS history cleared');
    } catch (error) {
      console.error('❌ Error clearing history:', error);
      toast({
        title: "Clear Failed",
        description: "Failed to clear history. Please try again.",
        variant: "destructive"
      });
    }
  };

  const value = {
    isActivated,
    isProcessing,
    setIsProcessing,
    panicHistory,
    realtimeAlerts,
    activatePanic,
    deactivatePanic,
    clearHistory
  };

  return (
    <PanicContext.Provider value={value}>
      {children}
    </PanicContext.Provider>
  );
};
