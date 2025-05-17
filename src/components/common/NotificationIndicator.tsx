// src/components/common/NotificationIndicator.tsx

import React, { useEffect, useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { Bell, ChevronUp } from 'lucide-react';
import { ProcessedAnnouncement } from '../../api';
import { useSocket } from '../../context/SocketContext';

interface NotificationIndicatorProps {
  onViewNewAnnouncements?: () => void;
}

/**
 * A floating notification indicator that shows when new announcements arrive
 * and allows users to quickly navigate to them
 */
const NotificationIndicator: React.FC<NotificationIndicatorProps> = ({
  onViewNewAnnouncements
}) => {
  const { newAnnouncements, connectionStatus } = useSocket();
  const [isVisible, setIsVisible] = useState(false);
  const [count, setCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(
    localStorage.getItem('notificationAudio') !== 'disabled'
  );

  // Create audio element for notification sound
  const notificationSound = React.useMemo(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      return audio;
    }
    return null;
  }, []);

  // Toggle notification sound
  const toggleAudio = () => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    localStorage.setItem('notificationAudio', newState ? 'enabled' : 'disabled');
  };

  // Update on new announcements
  useEffect(() => {
    if (newAnnouncements && newAnnouncements.length > 0) {
      setCount(newAnnouncements.length);
      setIsVisible(true);
      
      // Play sound if enabled
      if (audioEnabled && notificationSound) {
        notificationSound.play().catch(err => {
          console.warn('Could not play notification sound:', err);
        });
      }
    } else {
      setIsVisible(false);
    }
  }, [newAnnouncements, audioEnabled, notificationSound]);

  // Listen for the custom event for new announcements
  useEffect(() => {
    const handleNewAnnouncement = (event: CustomEvent<ProcessedAnnouncement>) => {
      if (event.detail) {
        // Show toast notification
        toast.success(
          <div>
            <div className="font-medium">{event.detail.company}</div>
            <div className="text-sm">
              {event.detail.summary?.substring(0, 80)}
              {event.detail.summary?.length > 80 ? '...' : ''}
            </div>
          </div>,
          {
            duration: 5000,
            position: 'top-right',
            className: 'announcement-toast',
            icon: '🔔',
          }
        );
        
        // Update our count
        setCount(prev => prev + 1);
        setIsVisible(true);
        
        // Play sound if enabled
        if (audioEnabled && notificationSound) {
          notificationSound.play().catch(err => {
            console.warn('Could not play notification sound:', err);
          });
        }
      }
    };
    
    window.addEventListener('new-announcement-received', handleNewAnnouncement as EventListener);
    
    return () => {
      window.removeEventListener('new-announcement-received', handleNewAnnouncement as EventListener);
    };
  }, [audioEnabled, notificationSound]);

  // Connection status changes
  useEffect(() => {
    // Show connected/disconnected toasts
    if (connectionStatus === 'connected') {
      toast.success("Live updates connected!", { 
        id: "socket-connected",
        duration: 3000 
      });
    } else if (connectionStatus === 'disconnected') {
      toast.error("Live updates disconnected", {
        id: "socket-disconnected",
        duration: 3000
      });
    } else if (connectionStatus === 'error') {
      toast.error("Connection error - Notifications may be delayed", {
        id: "socket-error",
        duration: 5000
      });
    }
  }, [connectionStatus]);

  // Don't show anything if no new announcements
  if (!isVisible) {
    return <Toaster />;
  }

  return (
    <>
      <Toaster />
      <div className="fixed bottom-6 right-6 z-50 scale-in-animation">
        <div className="flex flex-col items-end space-y-2">
          {/* Audio toggle */}
          <button
            onClick={toggleAudio}
            className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors"
            title={audioEnabled ? "Disable notification sound" : "Enable notification sound"}
          >
            {audioEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            )}
          </button>
          
          {/* Main notification button */}
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center transition-colors"
            onClick={onViewNewAnnouncements}
            aria-label={`${count} new announcements, click to view`}
          >
            <span className="badge-pulse mr-2 flex items-center justify-center">
              <Bell size={16} />
            </span>
            <span className="font-medium mr-1">{count} new announcement{count !== 1 ? 's' : ''}</span>
            <ChevronUp size={14} />
          </button>
        </div>
      </div>
    </>
  );
};

export default NotificationIndicator;