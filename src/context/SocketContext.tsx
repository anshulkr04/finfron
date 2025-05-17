// src/contexts/SocketContext.tsx
import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { setupSocketConnection, ProcessedAnnouncement } from '../api';
import { enhanceAnnouncementData } from '../api'; // Import this if available

// Define the shape of our context
type SocketContextType = {
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  newAnnouncement?: ProcessedAnnouncement;
  isConnected: boolean;
};

// Create the context
export const SocketContext = createContext<SocketContextType | null>(null);

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
  const [newAnnouncement, setNewAnnouncement] = useState<ProcessedAnnouncement | undefined>(undefined);

  useEffect(() => {
    // Process a new announcement when it comes in
    const processNewAnnouncement = (data: any) => {
      console.log("Received new announcement:", data);
      
      // Process the announcement data to match your application's format
      const processedAnnouncement: ProcessedAnnouncement = {
        id: data.id || data.corp_id || `new-${Date.now()}`,
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
        sentiment: "Neutral" // Default sentiment, will be enhanced below
      };
      
      // Apply the same enhancement logic used for other announcements
      const enhancedAnnouncement = enhanceAnnouncementData([processedAnnouncement])[0];
      
      // Set the new announcement in state
      setNewAnnouncement(enhancedAnnouncement);
      
      // Call the callback if provided
      if (onNewAnnouncement) {
        onNewAnnouncement(enhancedAnnouncement);
      }
    };

    // Set up socket connection
    const socketConnection = setupSocketConnection(processNewAnnouncement);
    setSocket(socketConnection);
    setIsConnected(true);
    
    console.log("Socket connection established");

    // Clean up on unmount
    return () => {
      console.log("Disconnecting socket");
      if (socketConnection) {
        socketConnection.disconnect();
      }
    };
  }, [onNewAnnouncement]);

  // Provide the socket functions and state to consumers
  const contextValue = {
    joinRoom: (room: string) => {
      console.log(`Joining room: ${room}`);
      socket?.joinRoom(room);
    },
    leaveRoom: (room: string) => {
      console.log(`Leaving room: ${room}`);
      socket?.leaveRoom(room);
    },
    newAnnouncement,
    isConnected
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};