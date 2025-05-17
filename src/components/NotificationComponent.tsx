import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, ExternalLink, Calendar, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';

// Notification interface matching the server structure
interface Notification {
  id: string;
  UserID: string;
  FilingID: string;
  ISIN: string;
  Category: string;
  Title: string;
  created_at: string;
  read: boolean;
  notified: boolean;
}

const NotificationComponent = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Fetch notifications on component mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Set up polling for notifications (every 60 seconds)
      const intervalId = setInterval(fetchNotifications, 60000);
      
      return () => clearInterval(intervalId);
    }
  }, [user]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch notifications from API
  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const response = await apiClient.get('/notifications');
      
      if (response.data) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (id: string) => {
    try {
      await apiClient.put(`/notifications/${id}/mark-read`);
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await apiClient.put('/notifications/mark-all-read');
      
      // Update local state
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({ ...notification, read: true }))
      );
      
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // If not read, mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Here you could navigate to the filing details or company page
    // For example: navigate(`/filings/${notification.FilingID}`);
  };

  // Format relative time (e.g., "5 minutes ago")
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffSeconds < 86400) {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  return (
    <div className="relative" ref={notificationRef}>
      {/* Bell icon with notification badge */}
      <button
        className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center transform translate-x-1/4 -translate-y-1/4">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Notification dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {/* Dropdown header */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800"
                onClick={markAllAsRead}
              >
                Mark all as read
              </button>
            )}
          </div>
          
          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Bell size={20} className="text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notification.read ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500">{notification.Category || 'Corporate Filing'}</span>
                          <span className="text-xs text-gray-400">{getRelativeTime(notification.created_at)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">{notification.Title}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <FileText size={12} className="mr-1" />
                          <span>ISIN: {notification.ISIN}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Dropdown footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-center">
            <button
              className="text-xs text-indigo-600 hover:text-indigo-800"
              onClick={() => {/* Navigate to all notifications */}}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationComponent;