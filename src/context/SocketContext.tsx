// src/context/SocketContext.tsx - Enhanced error handling and connection management

import React, { createContext, useEffect, useState, useRef, ReactNode, useContext } from 'react';
import { setupSocketConnection, ProcessedAnnouncement, enhanceAnnouncementData } from '../api';

// Define the shape of our context
type SocketContextType = {
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  newAnnouncements: ProcessedAnnouncement[];
  isConnected: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastError: string | null;
  reconnect: () => void; // Add reconnect method
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

  // Function to process new announcements
  const processNewAnnouncement = (data: any) => {
    console.log("Processing new announcement data:", data);
    
    try {
      // Basic validation
      if (!data) {
        console.warn("Received empty announcement data");
        return;
      }
      
      // Extract required fields with fallbacks
      const processedAnnouncement: ProcessedAnnouncement = {
        id: data.corp_id || data.id || `new-${Date.now()}`,
        company: data.companyname || data.company || "Unknown Company",
        ticker: data.symbol || data.Symbol || "",
        category: data.category || data.Category || "Other",
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        summary: data.ai_summary || data.summary || "",
        detailedContent: data.ai_summary || data.summary || "",
        isin: data.isin || data.ISIN || "",
        sentiment: "Neutral", // Default sentiment
        receivedAt: Date.now() // Add timestamp
      };
      
      console.log("Created processed announcement:", processedAnnouncement);
      
      // Apply the enhancement logic
      try {
        const enhancedAnnouncement = enhanceAnnouncementData([processedAnnouncement])[0];
        
        // Update the state with the new announcement
        setNewAnnouncements(prev => {
          // Check for duplicates
          const isDuplicate = prev.some(a => a.id === enhancedAnnouncement.id);
          if (isDuplicate) {
            console.log("Duplicate announcement detected, not adding to state");
            return prev;
          }
          return [enhancedAnnouncement, ...prev];
        });
        
        // Call the callback if provided
        if (onNewAnnouncement) {
          onNewAnnouncement(enhancedAnnouncement);
        }
      } catch (error) {
        console.error("Error enhancing announcement:", error);
        // Still try to use the basic processed announcement
        setNewAnnouncements(prev => {
          const isDuplicate = prev.some(a => a.id === processedAnnouncement.id);
          if (isDuplicate) return prev;
          return [processedAnnouncement, ...prev];
        });
        
        if (onNewAnnouncement) {
          onNewAnnouncement(processedAnnouncement);
        }
      }
    } catch (error) {
      console.error("Error processing announcement:", error);
    }
  };

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
      };
      
      const handleError = (e: any) => {
        console.error("Socket error event received:", e);
        setConnectionStatus('error');
        setLastError(e.detail?.message || 'Unknown connection error');
      };
      
      // Listen for socket events
      window.addEventListener('socket:connect', handleConnect);
      window.addEventListener('socket:disconnect', handleDisconnect);
      window.addEventListener('socket:error', handleError);
      
      return () => {
        // Clean up event listeners
        window.removeEventListener('socket:connect', handleConnect);
        window.removeEventListener('socket:disconnect', handleDisconnect);
        window.removeEventListener('socket:error', handleError);
        
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
      return () => {}; // Empty cleanup if setup failed
    }
  }, []);

  // Method to reconnect socket manually
  const reconnect = () => {
    console.log("Manual reconnection requested");
    setConnectionStatus('connecting');
    
    if (socketRef.current) {
      socketRef.current.reconnect();
    } else {
      // If socket ref is not available, re-initialize
      const socketConnection = setupSocketConnection(processNewAnnouncement);
      setSocket(socketConnection);
      socketRef.current = socketConnection;
    }
  };

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