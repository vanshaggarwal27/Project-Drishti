import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DangerAlertProvider } from '@/contexts/DangerAlertContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { PanicProvider } from '@/contexts/PanicContext';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import SOSAlerts from '@/pages/SOSAlerts';
import Settings from '@/pages/Settings';
import SOSHistory from '@/pages/SOSHistory';
import BottomNavigation from '@/components/BottomNavigation';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-yellow-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SafeGuard...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to dashboard if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-yellow-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SafeGuard...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

// Main App Routes Component
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Legacy routes for existing features (protected) */}
      <Route
        path="/legacy"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-white via-yellow-50 to-amber-50 relative overflow-hidden">
              {/* Decorative background elements */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-200/20 rounded-full blur-3xl floating"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-200/15 rounded-full blur-3xl floating" style={{animationDelay: '1s'}}></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-100/30 rounded-full blur-2xl floating" style={{animationDelay: '2s'}}></div>
              </div>

              <div className="relative z-10 flex flex-col min-h-screen">
                <main className="flex-1 pb-20">
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/alerts" element={<AlertFeed />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/history" element={<SOSHistory />} />
                  </Routes>
                </main>
                
                <Navigation />
                <PanicButton />
                <DangerAlert />
              </div>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <Helmet>
        <title>SafeGuard - Personal Safety Dashboard</title>
        <meta name="description" content="Modern personal safety app with AI-powered monitoring and emergency features" />
        <meta name="theme-color" content="#fbbf24" />
      </Helmet>
      
      <AuthProvider>
        <LocationProvider>
          <PanicProvider>
            <DangerAlertProvider>
              <AppRoutes />
              <Toaster />
            </DangerAlertProvider>
          </PanicProvider>
        </LocationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
