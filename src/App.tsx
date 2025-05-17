import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import WatchlistPage from './components/watchlist/WatchlistPage';
import CompanyPage from './components/company/CompanyPage';
import AuthRouter from './components/auth/AuthRouter';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { WatchlistProvider } from './context/WatchlistContext';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import { Company, ProcessedAnnouncement } from './api';
import { SocketProvider } from './context/SocketContext'; // Import the SocketProvider
import { useAuth } from './context/AuthContext'; // Import useAuth if available
import { toast } from 'react-hot-toast'; // Add toast notifications (install if not already: npm install react-hot-toast)

// Inner component to access auth context
const AppWithSocket = () => {
  const [activePage, setActivePage] = useState<'dashboard' | 'watchlist' | 'company'>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [watchlistParams, setWatchlistParams] = useState<{ watchlistId?: string }>({});
  const [newAnnouncements, setNewAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const { user } = useAuth(); // Get auth state if available
  const isAuthenticated = !!user; // Derive authentication state from user object

  const handleViewAnnouncements = (company: Company) => {
    setSelectedCompany(company);
    setActivePage('company');
  };

  const handleNavigate = (page: 'home' | 'watchlist' | 'company', params?: { watchlistId?: string }) => {
    if (page === 'home') {
      setActivePage('dashboard');
      setSelectedCompany(null);
    } else if (page === 'watchlist') {
      setActivePage('watchlist');
      if (params?.watchlistId) {
        setWatchlistParams({ watchlistId: params.watchlistId });
      }
    } else if (page === 'company' && selectedCompany) {
      setActivePage('company');
    }
  };

  const handleCompanyClick = (company: Company) => {
    setSelectedCompany(company);
    setActivePage('company');
  };

  // Handle new announcements from socket
  const handleNewAnnouncement = (announcement: ProcessedAnnouncement) => {
    setNewAnnouncements(prev => [announcement, ...prev]);
    
    // Show a toast notification
    toast.success(
      <div>
        <p className="font-medium">{announcement.company}</p>
        <p className="text-sm">{announcement.summary?.substring(0, 80)}...</p>
      </div>, 
      {
        duration: 5000,
        position: 'top-right',
        className: 'announcement-toast',
      }
    );
  };

  // We only want to use socket connections when user is authenticated
  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route path="/auth/*" element={<AuthRouter />} />
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <SocketProvider onNewAnnouncement={handleNewAnnouncement}>
      <Router>
        <FilterProvider>
          <WatchlistProvider>
            <Routes>
              {/* Auth Routes */}
              <Route path="/auth/*" element={<AuthRouter />} />
              
              {/* Protected App Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  {activePage === 'dashboard' ? (
                    <Dashboard 
                      onNavigate={handleNavigate} 
                      onCompanySelect={handleCompanyClick}
                      newAnnouncements={newAnnouncements} // Pass the new announcements
                    />
                  ) : activePage === 'watchlist' ? (
                    <WatchlistPage 
                      onViewAnnouncements={handleViewAnnouncements} 
                      onNavigate={handleNavigate} 
                      watchlistParams={watchlistParams}
                      newAnnouncements={newAnnouncements} // Pass new announcements
                    />
                  ) : (
                    selectedCompany && (
                      <CompanyPage 
                        company={selectedCompany} 
                        onNavigate={handleNavigate}
                        onBack={() => setActivePage('dashboard')} 
                        newAnnouncements={newAnnouncements} // Pass new announcements
                      />
                    )
                  )}
                </ProtectedRoute>
              } />
              
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </WatchlistProvider>
        </FilterProvider>
      </Router>
    </SocketProvider>
  );
};

// Main component
function App() {
  return (
    <AuthProvider>
      <AppWithSocket />
    </AuthProvider>
  );
}

export default App;