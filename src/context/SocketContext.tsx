// src/context/SocketContext.tsx - Updated with improved event handling

import React, { createContext, useEffect, useState, useRef, useCallback, ReactNode, useContext } from 'react';
import { setupSocketConnection, ProcessedAnnouncement, enhanceAnnouncementData } from '../api';
import { toast } from 'react-hot-toast';
import { sortByNewestDate } from '../utils/dateUtils'; // Make sure you have this package installed

// Define the shape of our context
type SocketContextType = {
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  newAnnouncements: ProcessedAnnouncement[];
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastError: string | null;
  reconnect: () => void;
};

// Create the context
export const SocketContext = createContext<SocketContextType | null>(null);

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
  onNewAnnouncement?: (announcement: ProcessedAnnouncement) => void;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({
  children,
  onNewAnnouncement
}) => {
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('connecting');
  const [lastError, setLastError] = useState<string | null>(null);
  const [newAnnouncements, setNewAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const activeRooms = useRef<Set<string>>(new Set());
  const socketRef = useRef<any>(null);
  const processedAnnouncementIds = useRef<Set<string>>(new Set()); // Track IDs to prevent duplicates

  // Function to display a toast notification for new announcements
  const showAnnouncementToast = useCallback((announcement: ProcessedAnnouncement) => {
    toast.success(
      <div>
        <div className="font-medium">{announcement.company}</div>
        <div className="text-sm">
          {announcement.summary?.substring(0, 80)}
          {announcement.summary?.length > 80 ? '...' : ''}
        </div>
      </div>,
      {
        duration: 5000,
        position: 'top-right',
        className: 'announcement-toast',
        icon: '🔔',
      }
    );
  }, []);

  // Enhanced function to process new announcements
  const processNewAnnouncement = useCallback((data: any) => {
    console.log("Socket context: Processing new announcement:", data);

    try {
      // Skip empty data
      if (!data) {
        console.warn("Received empty announcement data");
        return;
      }

      // Extract a unique ID for deduplication
      const announcementId = data.corp_id || data.id || data.dedup_id || `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Skip if we've already processed this ID
      if (processedAnnouncementIds.current.has(announcementId)) {
        console.log(`Already processed announcement ${announcementId}, skipping`);
        return;
      }

      // Mark as processed to prevent duplicates
      processedAnnouncementIds.current.add(announcementId);

      // Prepare processed announcement
      const processedAnnouncement: ProcessedAnnouncement = {
        id: announcementId,
        company: data.companyname || data.company || "Unknown Company",
        ticker: data.symbol || data.Symbol || "",
        category: data.category || data.Category || "Other",
        date: data.date || data.created_at || new Date().toISOString(),
        summary: data.ai_summary || data.summary || "",
        detailedContent: data.ai_summary || data.summary || "",
        isin: data.isin || data.ISIN || "",
        sentiment: "Neutral", // Default sentiment
        // receivedAt: Date.now(), // Add timestamp
        isNew: true // Mark as new
      };

      console.log("Socket context: Created processed announcement:", processedAnnouncement);

      // Enhance the announcement data
      try {
        const enhancedAnnouncement = enhanceAnnouncementData([processedAnnouncement])[0];

        // Update newAnnouncements state - IMPORTANT for components to rerender
        setNewAnnouncements(prev => {
          const updated = [...prev, enhancedAnnouncement];
          return sortByNewestDate(updated);
        });

        // Dispatch a custom DOM event so components can react directly
        const event = new CustomEvent('new-announcement-received', {
          detail: enhancedAnnouncement
        });
        window.dispatchEvent(event);

        // Show toast notification
        showAnnouncementToast(enhancedAnnouncement);

        // Call the callback if provided
        if (onNewAnnouncement) {
          onNewAnnouncement(enhancedAnnouncement);
        }
      } catch (enhanceError) {
        console.error("Error enhancing announcement:", enhanceError);
        // Still try to use the basic announcement
        setNewAnnouncements(prev => [processedAnnouncement, ...prev]);

        // Still show notification and call callback
        showAnnouncementToast(processedAnnouncement);

        if (onNewAnnouncement) {
          onNewAnnouncement(processedAnnouncement);
        }
      }
    } catch (error) {
      console.error("Error processing announcement:", error);
    }
  }, [onNewAnnouncement, showAnnouncementToast]);

  // Initialize socket connection
  useEffect(() => {
    console.log("Initializing socket connection...");
    setConnectionStatus('connecting');

    try {
      // Set up socket connection
      const socketConnection = setupSocketConnection(processNewAnnouncement);
      setSocket(socketConnection);
      socketRef.current = socketConnection;

      console.log("Socket connection initialized");

      // Set up event listeners for connection status
      const handleConnect = () => {
        console.log("Socket connected event received");
        setIsConnected(true);
        setConnectionStatus('connected');
        setLastError(null);

        // Clear old announcement IDs on reconnection to prevent issues
        processedAnnouncementIds.current.clear();

        // Show connection toast
        toast.success("Live updates connected!", {
          id: "socket-connected",
          duration: 3000,
          position: "bottom-right"
        });

        // Rejoin all active rooms
        Array.from(activeRooms.current).forEach(room => {
          console.log(`Rejoining room after connection: ${room}`);
          socketConnection.joinRoom(room);
        });
      };

      const handleDisconnect = () => {
        console.log("Socket disconnected event received");
        setIsConnected(false);
        setConnectionStatus('disconnected');

        // Show disconnection toast
        toast.error("Live updates disconnected", {
          id: "socket-disconnected",
          duration: 3000,
          position: "bottom-right"
        });
      };

      const handleError = (e: any) => {
        console.error("Socket error event received:", e);
        setConnectionStatus('error');
        setLastError(e.detail?.message || 'Unknown connection error');
      };

      // Custom event handler for new announcements - helps with direct component updates
      const handleNewAnnouncementEvent = (event: any) => {
        if (event.detail && typeof event.detail === 'object') {
          console.log("Received custom new-announcement event:", event.detail);
          // Trigger any components listening to this event
        }
      };

      // Listen for socket events
      window.addEventListener('socket:connect', handleConnect);
      window.addEventListener('socket:disconnect', handleDisconnect);
      window.addEventListener('socket:error', handleError);
      window.addEventListener('new-announcement-received', handleNewAnnouncementEvent);

      return () => {
        // Clean up event listeners
        window.removeEventListener('socket:connect', handleConnect);
        window.removeEventListener('socket:disconnect', handleDisconnect);
        window.removeEventListener('socket:error', handleError);
        window.removeEventListener('new-announcement-received', handleNewAnnouncementEvent);

        // Disconnect socket
        if (socketConnection) {
          console.log("Cleaning up socket connection");
          socketConnection.disconnect();
        }
      };
    } catch (error) {
      console.error("Error setting up socket connection:", error);
      setConnectionStatus('error');
      setLastError(`Failed to initialize socket: ${error instanceof Error ? error.message : String(error)}`);
      return () => { }; // Empty cleanup if setup failed
    }
  }, [processNewAnnouncement, showAnnouncementToast]);

  // Method to reconnect socket manually
  const reconnect = useCallback(() => {
    console.log("Manual reconnection requested");
    setConnectionStatus('connecting');

    // Clear the processed announcements set to ensure we don't miss any
    processedAnnouncementIds.current.clear();

    if (socketRef.current) {
      socketRef.current.reconnect();
    } else {
      // If socket ref is not available, re-initialize
      const socketConnection = setupSocketConnection(processNewAnnouncement);
      setSocket(socketConnection);
      socketRef.current = socketConnection;
    }
  }, [processNewAnnouncement]);

  // Context value
  const contextValue: SocketContextType = {
    joinRoom: (room: string) => {
      if (!room) return;

      // Store the room to rejoin later if needed
      activeRooms.current.add(room);

      if (socketRef.current) {
        socketRef.current.joinRoom(room);
      } else {
        console.warn(`Cannot join room ${room}: Socket not initialized`);
      }
    },
    leaveRoom: (room: string) => {
      if (!room) return;

      // Remove from active rooms
      activeRooms.current.delete(room);

      if (socketRef.current) {
        socketRef.current.leaveRoom(room);
      }
    },
    newAnnouncements,
    isConnected,
    connectionStatus,
    lastError,
    reconnect
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};