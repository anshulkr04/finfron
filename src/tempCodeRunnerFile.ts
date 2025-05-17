import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'http://localhost:5001/api',
    headers: {
      'Content-Type': 'application/json',
    },
});

// Add interceptor to include auth token in requests
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export interface Company {
  id: string;
  symbol: string;
  name: string;
  isin: string;
  industry: string;
}

export interface Filing {
  url: string;
  file_type: string;
  summary: string;
  desc: string;
  filing_date: string;
  AI_summary?: string;
}

export interface CompanyFiling {
  _id: string;
  symbol: string;
  sm_name: string;
  sm_isin: string;
  industry: string;
  corporate_filings: Filing[];
}

export interface ProcessedAnnouncement {
  id: string;
  companyId: string;
  company: string;
  ticker: string;
  industry: string;
  category: string;
  sentiment: string;
  date: string;
  summary: string;
  detailedContent: string;
  url?: string;
  fileType?: string;
}

/**
 * Try to extract a headline from the summary text
 */
function extractHeadline(text: string): string {
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

/**
 * Enhanced extraction of category, headline, and structured content from announcement text
 */
export const enhanceAnnouncementData = (announcements: ProcessedAnnouncement[]): ProcessedAnnouncement[] => {
  return announcements.map(announcement => {
    let summary = announcement.summary || '';
    let category = announcement.category;
    let detailedContent = announcement.detailedContent || '';
    
    // If the summary contains structured data markers, extract them
    const categoryMatch = summary.match(/\*\*Category:\*\*\s*([A-Za-z0-9\s&]+)/i);
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
        } else if (summary.match(/vote|voting/i)) {
          category = "Voting Results";
        } else if (summary.match(/investor|analyst|meet/i)) {
          category = "Investor/Analyst Meet";
        } else if (summary.match(/procedural|administrative/i)) {
          category = "Procedural/Administrative";
        }
      }
    }
    
    // Extract and parse headline from content if available
    let headline = '';
    const headlineMatch = summary.match(/\*\*Headline:\*\*\s*([^\n]+)/i);
    if (headlineMatch && headlineMatch[1]) {
      headline = headlineMatch[1].trim();
    } else {
      headline = extractHeadline(summary);
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
    let sentiment = announcement.sentiment;
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
  console.log("Processing announcement data:", data);
  
  // If data is empty or not an array, return test data
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn("Empty or invalid data received, returning test data");
    return generateTestData(3);
  }
  
  const processedData: ProcessedAnnouncement[] = [];
  
  // Check if data is in the new Supabase format (array of objects with ai_summary)
  if (data[0] && 'ai_summary' in data[0]) {
    console.log("Detected Supabase format with ai_summary");
    
    // Process new Supabase format
    data.forEach((item, index) => {
      if (item.ai_summary) {
        // Extract potential company name from summary
        let companyName = item.Symbol || "Unknown Company";
        let ticker = item.Symbol || "";
        let category = item.Category || "Other";
        let sentiment = "Neutral";
        
        // Try to extract company name from direct fields first
        if (item.NewName) {
          companyName = item.NewName;
        } else if (item.Symbol) {
          // If no company name but we have a symbol, use it
          companyName = item.Symbol;
        }
        
        // Simple text analysis to extract information
        const summary = item.ai_summary;
        
        // Try to extract company name (usually at beginning of summary)
        const companyMatch = summary.match(/^([A-Za-z0-9\s.]+)(?:Ltd\.?|Limited|Inc\.?|Corporation|Corp\.?)?\s(?:has|announced|reported|disclosed|declared)/i);
        if (companyMatch && companyMatch[1] && !companyName) {
          companyName = companyMatch[1].trim();
        }
        
        // Try to extract ticker if in format (TICKER:)
        const tickerMatch = summary.match(/\(([A-Z]+)(?::|\.|\))/);
        if (tickerMatch && tickerMatch[1] && !ticker) {
          ticker = tickerMatch[1];
        }
        
        // Determine category based on keywords if not already set
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
        
        // Determine sentiment based on keywords
        if (summary.match(/increase|growth|higher|positive|improvement|grow|up|rise|benefit/i)) {
          sentiment = "Positive";
        } else if (summary.match(/decrease|decline|lower|negative|drop|down|fall|loss/i)) {
          sentiment = "Negative";
        }
        
        // Get date (use current date if not available)
        const currentDate = item.created_at ? 
          new Date(item.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : 
          new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        
        processedData.push({
          id: item.id || `filing-${index}-${Date.now()}`, // Use actual ID if available
          companyId: `company-${companyName.replace(/\s+/g, '-').toLowerCase()}`,
          company: companyName,
          ticker: ticker,
          industry: item.industry || "",
          category: category,
          sentiment: sentiment,
          date: currentDate,
          summary: summary,
          detailedContent: summary,
          url: item.url,
          fileType: item.file_type
        });
      } else {
        console.log("Item has no ai_summary. Adding default item...");
        // For items without ai_summary, add a default formatted entry
        processedData.push({
          id: `filing-${index}-${Date.now()}`, // Generate unique ID
          companyId: `company-unknown-${index}`,
          company: `Company ${index + 1}`,
          ticker: `C${index+1}`,
          industry: "Unknown",
          category: "Other",
          sentiment: "Neutral",
          date: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          summary: "This is a generated summary for an announcement without AI summary.",
          detailedContent: "This is a generated detailed content for an announcement without AI summary.",
          url: undefined,
          fileType: undefined
        });
      }
    });
  } else if (data[0] && 'corporate_filings' in data[0]) {
    console.log("Detected old format with corporate_filings");
    
    // Process old format data with corporate_filings
    data.forEach(company => {
      if (company.corporate_filings && Array.isArray(company.corporate_filings)) {
        company.corporate_filings.forEach((filing: Filing) => {
          // Determine filing category
          let category = "Other";
          if (filing.desc) {
            if (filing.desc.toLowerCase().includes("financial")) category = "Financial Results";
            else if (filing.desc.toLowerCase().includes("meeting")) category = "Board Meeting";
            else if (filing.desc.toLowerCase().includes("board")) category = "Board Meeting";
            else if (filing.desc.toLowerCase().includes("agm")) category = "AGM";
            else if (filing.desc.toLowerCase().includes("results")) category = "Financial Results";
          }
          
          // Determine sentiment (simplified logic)
          let sentiment = "Neutral";
          if (filing.AI_summary) {
            const text = filing.AI_summary.toLowerCase();
            if (text.includes("positive") || text.includes("growth") || text.includes("increase")) {
              sentiment = "Positive";
            } else if (text.includes("negative") || text.includes("decline") || text.includes("decrease")) {
              sentiment = "Negative";
            }
          }
          
          // Format date
          const filingDate = filing.filing_date ? new Date(filing.filing_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : 'Unknown Date';
          
          // Make sure we have a valid company name - this is critical
          const companyName = company.sm_name || company.symbol || "Unknown Company";
          
          processedData.push({
            id: `${company._id}-${filing.filing_date || Date.now()}`,
            companyId: company._id || `company-${Date.now()}`,
            company: companyName,
            ticker: company.symbol || "",
            industry: company.industry || 'Unspecified',
            category: category,
            sentiment: sentiment,
            date: filingDate,
            summary: filing.AI_summary || filing.summary || 'No summary available',
            detailedContent: filing.summary || 'No detailed content available',
            url: filing.url,
            fileType: filing.file_type
          });
        });
      } else {
        console.log("Company has no corporate_filings or it's not an array");
      }
    });
  } else {
    console.warn("Unknown data format - attempting to parse as raw data");
    // Try to handle as raw data (direct from Supabase without wrapping)
    data.forEach((item, index) => {
      // Try to extract company name from various possible fields
      let companyName = "Unknown Company";
      if (item.NewName) companyName = item.NewName;
      else if (item.sm_name) companyName = item.sm_name;
      else if (item.name) companyName = item.name;
      else if (item.Symbol) companyName = item.Symbol;
      else if (item.symbol) companyName = item.symbol;
      
      processedData.push({
        id: `filing-${index}-${Date.now()}`,
        companyId: `company-unknown-${index}`,
        company: companyName,
        ticker: item.symbol || item.Symbol || `C${index+1}`,
        industry: item.industry || "Unknown",
        category: item.Category || "Other",
        sentiment: "Neutral",
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        summary: item.ai_summary || item.nse_bse_summary || JSON.stringify(item).substring(0, 200) + '...',
        detailedContent: item.ai_summary || item.nse_bse_summary || JSON.stringify(item, null, 2),
        url: item.url,
        fileType: item.file_type
      });
    });
  }
  
  // If no data was processed, add test data
  if (processedData.length === 0) {
    console.log("No data processed, adding test announcements");
    return generateTestData(5);
  }
  
  // Sort by date (newest first)
  const sortedData = processedData.sort((a, b) => {
    // Handle cases where date might be a string like 'Unknown Date'
    const dateA = a.date === 'Unknown Date' ? new Date(0) : new Date(a.date);
    const dateB = b.date === 'Unknown Date' ? new Date(0) : new Date(b.date);
    return dateB.getTime() - dateA.getTime();
  });
  
  console.log("Processed data count:", sortedData.length);
  if (sortedData.length > 0) {
    console.log("First processed item:", sortedData[0]);
  }
  
  return sortedData;
};

// Helper function to generate test data
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
    const summary = `**Category:** ${category}\n**Headline:** ${headline}\n\nThis is a test announcement ${i+1} for debugging purposes. Category: ${categories[categoryIndex]}, Sentiment: ${sentiments[sentimentIndex]}. This announcement includes details about a fictional company's activities.`;
    
    testData.push({
      id: `test-${i}-${Date.now()}`,
      companyId: `company-test-${i}`,
      company: `Test Company ${i + 1}`,
      ticker: `TC${i+1}`,
      industry: "Technology",
      category: categories[categoryIndex],
      sentiment: sentiments[sentimentIndex],
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      summary: summary,
      detailedContent: `${summary}\n\n## Additional Details\n\nThis is a detailed content for test announcement ${i+1}. This is generated to ensure the UI is properly displaying announcements.\n\n| Quarter | Revenue | Profit |\n|---------|---------|--------|\n| Q1 2025 | $10M    | $2M    |\n| Q2 2025 | $12M    | $2.5M  |\n\nThe company is performing well overall and expects continued growth in the upcoming quarters.`,
      url: undefined,
      fileType: undefined
    });
  }
  
  return testData;
};

export const fetchAnnouncements = async (fromDate: string, toDate: string, industry: string = '') => {
  // Send dates in YYYY-MM-DD format (not converting)
  let url = `/corporate_filings?start_date=${fromDate}&end_date=${toDate}`;
  if (industry) {
    url += `&category=${encodeURIComponent(industry)}`;
  }
  
  console.log(`Fetching announcements from ${url}`);
  
  try {
    const response = await apiClient.get(url);
    console.log("API Response:", response.data);
    
    // Handle different response formats
    let processedData: ProcessedAnnouncement[] = [];
    
    if (response.data && response.data.filings) {
      // Format with filings property
      console.log("Processing response.data.filings");
      processedData = processAnnouncementData(response.data.filings);
    } else if (response.data && response.data.count !== undefined && response.data.filings) {
      // Format with count and filings
      console.log("Processing response.data.filings with count");
      processedData = processAnnouncementData(response.data.filings);
    } else if (Array.isArray(response.data)) {
      // Direct array response
      console.log("Processing direct array response");
      processedData = processAnnouncementData(response.data);
    } else {
      // Empty or unknown format
      console.warn("Unknown response format:", response.data);
      processedData = generateTestData(3);
    }
    
    // Apply enhancements to extract and structure categories and headlines
    processedData = enhanceAnnouncementData(processedData);
    
    // If still no data, fallback to test data
    if (processedData.length === 0) {
      console.log("No data processed, using test data");
      processedData = generateTestData(5);
    }
    
    console.log(`Returning ${processedData.length} processed announcements`);
    return processedData;
  } catch (error) {
    console.error("Error fetching announcements:", error);
    // Return test data on error
    const testData = generateTestData(3);
    // Make sure test data also gets enhanced
    const enhancedTestData = enhanceAnnouncementData(testData);
    console.log("Returning test data due to error");
    return enhancedTestData;
  }
};

export const fetchIndustries = async () => {
  try {
    const response = await apiClient.get('/company/search');
    // Extract unique industries
    const industries = [...new Set(response.data.companies
      .map((company: Company) => company.industry)
      .filter(Boolean))];
    
    return industries.sort();
  } catch (error) {
    console.error("Error fetching industries:", error);
    return [];
  }
};

// Authentication Methods
export const registerUser = async (email: string, password: string) => {
  const response = await apiClient.post('/register', { email, password });
  if (response.data.token) {
    localStorage.setItem('authToken', response.data.token);
  }
  return response.data;
};

export const loginUser = async (email: string, password: string) => {
  const response = await apiClient.post('/login', { email, password });
  if (response.data.token) {
    localStorage.setItem('authToken', response.data.token);
  }
  return response.data;
};

export const logoutUser = async () => {
  const response = await apiClient.post('/logout');
  localStorage.removeItem('authToken');
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('/user');
  return response.data;
};

// Watchlist Methods
export const getWatchlist = async () => {
  const response = await apiClient.get('/watchlist');
  return response.data;
};

export const addToWatchlist = async (isin: string) => {
  const response = await apiClient.post('/watchlist', { isin });
  return response.data;
};

export const removeFromWatchlist = async (isin: string) => {
  const response = await apiClient.delete(`/watchlist/${isin}`);
  return response.data;
};

export const clearWatchlist = async () => {
  const response = await apiClient.delete('/watchlist');
  return response.data;
};

export const searchCompanies = async (query: string, limit?: number) => {
  let url = `/company/search?q=${encodeURIComponent(query)}`;
  if (limit) {
    url += `&limit=${limit}`;
  }
  const response = await apiClient.get(url);
  return response.data.companies;
};

export default apiClient