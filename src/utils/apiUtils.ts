// apiUtils.ts
import { ProcessedAnnouncement } from '../api'; // Adjust path as needed

// Available categories from the API
export const AVAILABLE_CATEGORIES = [
  "Annual Report", "Agreements/MoUs", "Anti-dumping Duty", "Buyback",
  "Bonus/Stock Split", "Change in Address", "Change in MOA",
  "Clarifications/Confirmations", "Closure of Factory", "Concall Transcript",
  "Consolidation of Shares", "Credit Rating", "Debt Reduction",
  "Debt & Financing", "Delisting", "Demerger", "Change in KMP",
  "Demise of KMP", "Disruption of Operations", "Divestitures", "DRHP",
  "Expansion", "Financial Results", "Fundraise - Preferential Issue",
  "Fundraise - QIP", "Fundraise - Rights Issue", "Global Pharma Regulation",
  "Incorporation/Cessation of Subsidiary", "Increase in Share Capital",
  "Insolvency and Bankruptcy", "Interest Rates Updates", "Investor Presentation",
  "Investor/Analyst Meet", "Joint Ventures", "Litigation & Notices",
  "Mergers/Acquisitions", "Name Change", "New Order", "New Product",
  "One Time Settlement (OTS)", "Open Offer", "Operational Update", "PLI Scheme",
  "Procedural/Administrative", "Reduction in Share Capital",
  "Regulatory Approvals/Orders", "Trading Suspension", "USFDA", 
  "Voting Results", "Other", "Board Meeting", "Dividend", "AGM",
  "Mergers & Acquisitions"
];

/**
 * Standardized function to extract category from announcement text
 * @param text The summary or content text
 * @param defaultCategory Default category if none is found
 * @returns Extracted category
 */
export function extractCategory(text: string | undefined, defaultCategory: string = "Other"): string {
  if (!text) return defaultCategory;
  
  // Use a more inclusive regex pattern for category extraction
  const categoryMatch = text.match(/\*\*Category:\*\*\s*([A-Za-z0-9\s&\/\-\(\)]+)/i);
  
  if (categoryMatch && categoryMatch[1]) {
    const extractedCategory = categoryMatch[1].trim();
    
    // Check if the extracted category is in our list of known categories
    if (AVAILABLE_CATEGORIES.includes(extractedCategory)) {
      return extractedCategory;
    }
    
    // Try to find a close match
    const possibleMatch = AVAILABLE_CATEGORIES.find(cat => 
      extractedCategory.toLowerCase().includes(cat.toLowerCase()) || 
      cat.toLowerCase().includes(extractedCategory.toLowerCase())
    );
    
    if (possibleMatch) {
      return possibleMatch;
    }
  }
  
  // If no match found, try to determine category based on content keywords
  if (text.match(/dividend|payout|distribution/i)) {
    return "Dividend";
  } else if (text.match(/financial|results|quarter|profit|revenue|earning/i)) {
    return "Financial Results";
  } else if (text.match(/merger|acquisition|acqui|takeover/i)) {
    return "Mergers & Acquisitions";
  } else if (text.match(/board|director|appoint|management/i)) {
    return "Board Meeting";
  } else if (text.match(/AGM|annual general meeting/i)) {
    return "AGM";
  } else if (text.match(/vote|voting/i)) {
    return "Voting Results";
  } else if (text.match(/investor|analyst|meet/i)) {
    return "Investor/Analyst Meet";
  } else if (text.match(/procedural|administrative/i)) {
    return "Procedural/Administrative";
  }
  
  return defaultCategory;
}

/**
 * Standardized function to extract headline from announcement text
 * @param text The summary or content text
 * @param defaultHeadline Default headline if none is found
 * @returns Extracted headline
 */
export function extractHeadline(text: string | undefined, defaultHeadline: string = "No headline available"): string {
  if (!text) return defaultHeadline;
  
  // Use an improved regex that can handle multi-line headlines
  const headlineMatch = text.match(/\*\*Headline:\*\*\s*(.*?)(?=\s*(?:\*\*|\#\#|$))/is);
  
  if (headlineMatch && headlineMatch[1] && headlineMatch[1].trim()) {
    // Clean up any newlines in the headline text for display
    return headlineMatch[1].trim().replace(/\n+/g, ' ');
  }
  
  // If no headline match, try to extract the first meaningful sentence after removing category
  const cleanSummary = text
    .replace(/\*\*Category:\*\*.*?(?=\*\*|$)/is, '')
    .trim();
  
  const firstSentenceMatch = cleanSummary.match(/^([^.!?]+[.!?])/);
  
  if (firstSentenceMatch && firstSentenceMatch[1]) {
    return firstSentenceMatch[1].trim();
  }
  
  // If still nothing, return first 80 chars of summary
  return cleanSummary.substring(0, 80) + (cleanSummary.length > 80 ? '...' : '');
}

/**
 * Determine sentiment based on content
 */
export function determineSentiment(text: string | undefined): "Positive" | "Negative" | "Neutral" {
  if (!text) return "Neutral";
  
  const lowerText = text.toLowerCase();
  
  // Positive indicators
  if (/increase|growth|higher|positive|improvement|grow|up|rise|benefit|profit|success/i.test(lowerText)) {
    return "Positive";
  }
  
  // Negative indicators
  if (/decrease|decline|lower|negative|drop|down|fall|loss|concern|risk|adverse/i.test(lowerText)) {
    return "Negative";
  }
  
  return "Neutral";
}

/**
 * Enhanced version of announcement data processing
 */
export function enhanceAnnouncementData(announcements: ProcessedAnnouncement[]): ProcessedAnnouncement[] {
  return announcements.map(announcement => {
    // Extract category using the consistent function
    const category = extractCategory(announcement.summary, announcement.category);
    
    // Extract and clean headline using the consistent function
    const headline = extractHeadline(announcement.summary);
    
    // Determine sentiment using the consistent function
    const sentiment = announcement.sentiment || determineSentiment(announcement.summary);
    
    let summary = announcement.summary || '';
    let detailedContent = announcement.detailedContent || '';
    
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
    
    return {
      ...announcement,
      category,
      sentiment,
      summary,
      detailedContent
    };
  });
}

export default {
  AVAILABLE_CATEGORIES,
  extractCategory,
  extractHeadline,
  determineSentiment,
  enhanceAnnouncementData
};