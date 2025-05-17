import axios from 'axios';

// Create a reusable axios instance with base configuration
const apiClient = axios.create({
    baseURL: '/api', // Use relative URL to work with both development and production
    headers: {
      'Content-Type': 'application/json',
    },
});

// Fix the auth interceptor
apiClient.interceptors.request.use(
  (config) => {
      const token = localStorage.getItem('authToken');
      
      if (token) {
          // Add token to authorization header
          config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
  },
  (error) => {
      return Promise.reject(error);
  }
);

// Add response interceptor for better error debugging and 401 handling
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            console.error(`[API] Error response: ${error.response.status} for ${error.config?.method?.toUpperCase()} ${error.config?.url}`);
            
            // Handle 401 errors specially
            if (error.response.status === 401) {
                console.error('[API] Authentication error - Token might be invalid or expired');
                // Optional: Redirect to login page or trigger a re-authentication flow
                // window.location.href = '/login'; // Example: Redirect to login
            }
        } else if (error.request) {
            // The request was made but no response was received
            console.error('[API] No response received from server:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('[API] Error setting up request:', error.message);
        }
        
        // Reject the promise so the calling code can handle the error
        return Promise.reject(error);
    }
);

export interface Company {
  id?: string;
  isin: string;
  newname?: string;
  oldname?: string;
  newnsecode?: string;
  oldnsecode?: string;
  newbsecode?: string;
  oldbsecode?: string;
  symbol?: string; // For compatibility with old API responses
  name?: string; // For compatibility with old API responses
}

export interface Filing {
  id?: string;
  Symbol?: string;
  ISIN?: string;
  Category?: string;
  summary?: string;
  ai_summary?: string;
  fileurl?: string;
  date?: string;
  created_at?: string;
  companyname?: string;
  securityid?: string;
}

export interface ProcessedAnnouncement {
  id: string;
  companyId?: string;
  company: string;
  ticker: string;
  industry?: string;
  category: string;
  sentiment?: string;
  date: string;
  summary: string;
  detailedContent: string;
  url?: string;
  fileType?: string;
  isin?: string;
}

// Extract a headline from summary text
export function extractHeadline(text: string): string {
  if (!text) return '';
  
  // First approach: Look for the first sentence that ends with a period
  const firstSentenceMatch = text.match(/^([^.!?]+[.!?])/);
  if (firstSentenceMatch && firstSentenceMatch[1]) {
    return firstSentenceMatch[1].trim();
  }
  
  // Second approach: Just take the first line if it's not too long
  const firstLineMatch = text.match(/^([^\n]+)/);
  if (firstLineMatch && firstLineMatch[1] && firstLineMatch[1].length < 100) {
    return firstLineMatch[1].trim();
  }
  
  // Third approach: Take up to 100 characters from the beginning
  return text.substring(0, 100).trim() + (text.length > 100 ? '...' : '');
}

// Extract ISIN from various possible fields
function extractIsin(item: any): string {
  if (!item) return "";
  
  if (item.ISIN) return item.ISIN;
  if (item.isin) return item.isin;
  if (item.sm_isin) return item.sm_isin;
  
  return "";
}

// Enhanced extraction of category, headline, and structured content from announcement text
export const enhanceAnnouncementData = (announcements: ProcessedAnnouncement[]): ProcessedAnnouncement[] => {
  return announcements.map(announcement => {
    let summary = announcement.summary || '';
    let category = announcement.category;
    let detailedContent = announcement.detailedContent || '';
    
    // Use improved regex pattern for category extraction
    const categoryMatch = summary.match(/\*\*Category:\*\*\s*([A-Za-z0-9\s&\/\-\(\)]+)/i);
    if (categoryMatch && categoryMatch[1]) {
      category = categoryMatch[1].trim();
    } else {
      // Try to determine category based on content if not explicitly marked
      if (!category || category === "Other") {
        if (summary.match(/dividend|payout|distribution/i)) {
          category = "Dividend";
        } else if (summary.match(/financial|results|quarter|profit|revenue|earning/i)) {
          category = "Financial Results";
        } else if (summary.match(/merger|acquisition|acqui|takeover/i)) {
          category = "Mergers & Acquisitions";
        } else if (summary.match(/board|director|appoint|management/i)) {
          category = "Board Meeting";
        } else if (summary.match(/AGM|annual general meeting/i)) {
          category = "AGM";
        }
      }
    }
    
    // Extract and parse headline from content with improved regex
    let headline = '';
    const headlineMatch = summary.match(/\*\*Headline:\*\*\s*(.*?)(?=\s*(?:\*\*|\#\#|$))/is);
    if (headlineMatch && headlineMatch[1]) {
      headline = headlineMatch[1].trim().replace(/\n+/g, ' '); // Clean up multi-line headlines
    } else {
      // Fallback method: extract first sentence
      const cleanSummary = summary
        .replace(/\*\*Category:\*\*.*?(?=\*\*|$)/is, '')
        .trim();
      
      const firstSentenceMatch = cleanSummary.match(/^([^.!?]+[.!?])/);
      
      if (firstSentenceMatch && firstSentenceMatch[1]) {
        headline = firstSentenceMatch[1].trim();
      } else {
        headline = cleanSummary.substring(0, 80) + (cleanSummary.length > 80 ? '...' : '');
      }
    }
    
    // Format the summary as structured markdown if it's not already
    if (!summary.includes("**Category:**") && !summary.includes("**Headline:**")) {
      // Restructure the summary into a more standard format
      const structuredSummary = `**Category:** ${category}\n**Headline:** ${headline}\n\n${summary}`;
      summary = structuredSummary;
      
      // Also enhance the detailed content if it's identical to the summary
      if (detailedContent === announcement.summary) {
        detailedContent = structuredSummary;
      }
    }
    
    // Parse out the sentiment more accurately if possible
    let sentiment = announcement.sentiment || "Neutral";
    
    if (summary.match(/increase|growth|higher|positive|improvement|grow|up|rise|benefit|profit|success/i)) {
      sentiment = "Positive";
    } else if (summary.match(/decrease|decline|lower|negative|drop|down|fall|loss|concern|risk|adverse/i)) {
      sentiment = "Negative";
    }
    
    return {
      ...announcement,
      category,
      sentiment,
      summary,
      detailedContent
    };
  });
};

// Process and flatten the announcement data from the API
export const processAnnouncementData = (data: any[]): ProcessedAnnouncement[] => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return generateTestData(3);
  }
  
  const processedData: ProcessedAnnouncement[] = [];
  
  data.forEach((item, index) => {
    // Extract important fields
    const isin = extractIsin(item);
    const companyName = item.companyname || item.NewName || item.OldName || item.Symbol || "Unknown Company";
    const ticker = item.symbol || item.Symbol || item.newnsecode || item.oldnsecode || "";
    const category = item.Category || item.category || "Other";
    const summary = item.ai_summary || item.summary || "";
    const date = item.date || item.created_at || new Date().toISOString();
    
    // Format date for display
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Determine sentiment based on content analysis
    let sentiment = "Neutral";
    if (summary.match(/increase|growth|higher|positive|improvement|grow|up|rise|benefit|profit|success/i)) {
      sentiment = "Positive";
    } else if (summary.match(/decrease|decline|lower|negative|drop|down|fall|loss|concern|risk|adverse/i)) {
      sentiment = "Negative";
    }
    
    processedData.push({
      id: item.id || item.corp_id || `filing-${index}-${Date.now()}`,
      company: companyName,
      ticker: ticker,
      category: category,
      sentiment: sentiment,
      date: formattedDate,
      summary: summary,
      detailedContent: summary,
      url: item.fileurl || item.url,
      isin: isin
    });
  });
  
  // If no data was processed, add test data
  if (processedData.length === 0) {
    return generateTestData(3);
  }
  
  // Sort by date (newest first)
  return processedData.sort((a, b) => {
    const dateA = a.date === 'Unknown Date' ? new Date(0) : new Date(a.date);
    const dateB = b.date === 'Unknown Date' ? new Date(0) : new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
};

// Generate test data for development
const generateTestData = (count: number): ProcessedAnnouncement[] => {
  const testData: ProcessedAnnouncement[] = [];
  const categories = ["Financial Results", "Dividend", "Mergers & Acquisitions", "Board Meeting", "AGM"];
  const sentiments = ["Positive", "Negative", "Neutral"];
  
  for (let i = 0; i < count; i++) {
    const categoryIndex = i % categories.length;
    const sentimentIndex = i % sentiments.length;
    const category = categories[categoryIndex];
    
    // Create more realistic test data with formatting
    const headline = `Test Announcement ${i+1} for ${category}`;
    const summary = `**Category:** ${category}\n**Headline:** ${headline}\n\nThis is a test announcement ${i+1} for debugging purposes.`;
    
    testData.push({
      id: `test-${i}-${Date.now()}`,
      company: `Test Company ${i + 1}`,
      ticker: `TC${i+1}`,
      category: categories[categoryIndex],
      sentiment: sentiments[sentimentIndex],
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      summary: summary,
      detailedContent: `${summary}\n\n## Additional Details\n\nThis is a detailed content for test announcement ${i+1}.`,
      isin: `TEST${i}1234567890`
    });
  }
  
  return testData;
};

// Fetch announcements from the server
export const fetchAnnouncements = async (fromDate: string = '', toDate: string = '', category: string = '') => {
  // Format dates as YYYY-MM-DD if not already
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(fromDate)) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    fromDate = thirtyDaysAgo.toISOString().split('T')[0];
  }
  
  if (!dateRegex.test(toDate)) {
    const today = new Date();
    toDate = today.toISOString().split('T')[0];
  }
  
  // Build URL with proper parameters
  let url = `/corporate_filings?start_date=${fromDate}&end_date=${toDate}`;
  if (category) {
    url += `&category=${encodeURIComponent(category)}`;
  }
  
  try {
    const response = await apiClient.get(url);
    
    let processedData: ProcessedAnnouncement[] = [];
    
    if (response.data && response.data.filings) {
      processedData = processAnnouncementData(response.data.filings);
    } else if (Array.isArray(response.data)) {
      processedData = processAnnouncementData(response.data);
    } else {
      processedData = generateTestData(3);
    }
    
    return enhanceAnnouncementData(processedData);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return enhanceAnnouncementData(generateTestData(3));
  }
};

// Authentication Methods
export const registerUser = async (email: string, password: string) => {
  try {
    const response = await apiClient.post('/register', { email, password });
    if (response.data && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const response = await apiClient.post('/login', { email, password });
    if (response.data && response.data.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  try {
    await apiClient.post('/logout');
    localStorage.removeItem('authToken');
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error("Logout error:", error);
    // Even if logout fails on the server, remove the token locally
    localStorage.removeItem('authToken');
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await apiClient.get('/user');
    return response.data;
  } catch (error) {
    console.error("Error getting current user:", error);
    // Handle 401 errors
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      localStorage.removeItem('authToken');
    }
    throw error;
  }
};

// Watchlist Methods
export const getWatchlist = async () => {
  try {
    const response = await apiClient.get('/watchlist');
    return response.data;
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    throw error;
  }
};

export const createWatchlist = async (watchlistName: string) => {
  try {
    const response = await apiClient.post('/watchlist', {
      operation: 'create',
      watchlistName: watchlistName
    });
    return response.data;
  } catch (error) {
    console.error("Error creating watchlist:", error);
    throw error;
  }
};

export const addToWatchlist = async (isin: string, watchlistId: string) => {
  try {
    const response = await apiClient.post('/watchlist', {
      operation: 'add_isin',
      watchlist_id: watchlistId,
      isin: isin
    });
    return response.data;
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    throw error;
  }
};

export const removeFromWatchlist = async (isin: string, watchlistId: string) => {
  try {
    const response = await apiClient.delete(`/watchlist/${watchlistId}/isin/${isin}`);
    return response.data;
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    throw error;
  }
};

export const clearWatchlist = async (watchlistId: string) => {
  try {
    const response = await apiClient.post(`/watchlist/${watchlistId}/clear`);
    return response.data;
  } catch (error) {
    console.error("Error clearing watchlist:", error);
    throw error;
  }
};

export const deleteWatchlist = async (watchlistId: string) => {
  try {
    const response = await apiClient.delete(`/watchlist/${watchlistId}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting watchlist:", error);
    throw error;
  }
};

export const searchCompanies = async (query: string, limit?: number) => {
  try {
    let url = `/company/search?q=${encodeURIComponent(query)}`;
    if (limit) {
      url += `&limit=${limit}`;
    }
    const response = await apiClient.get(url);
    return response.data.companies || [];
  } catch (error) {
    console.error("Error searching companies:", error);
    throw error;
  }
};

// Setup Socket.IO connection for real-time updates
import { io, Socket } from 'socket.io-client';

// Other existing code...

// Replace the existing setupSocketConnection function with this one
export const setupSocketConnection = (onNewAnnouncement: (data: any) => void) => {
  // Create socket connection
  const socket: Socket = io('/', {
    // Use the same path as your server
    path: '/socket.io',
    // Automatically reconnect if connection is lost
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
  });

  socket.on('error', (error) => {
    console.error('Socket connection error:', error);
  });

  // Listen for new announcements
  socket.on('new_announcement', (data) => {
    console.log('Received new announcement:', data);
    onNewAnnouncement(data);
  });

  // Listen for status updates
  socket.on('status', (data) => {
    console.log('Socket status update:', data.message);
  });

  // Return methods to interact with the socket
  return {
    // Join a room to receive updates about specific companies or ISINs
    joinRoom: (room: string) => {
      console.log(`Joining room: ${room}`);
      socket.emit('join', { room });
    },
    
    // Leave a room to stop receiving updates about specific companies or ISINs
    leaveRoom: (room: string) => {
      console.log(`Leaving room: ${room}`);
      socket.emit('leave', { room });
    },
    
    // Disconnect the socket when no longer needed
    disconnect: () => {
      console.log('Disconnecting socket');
      socket.disconnect();
    }
  };
};

export default apiClient;