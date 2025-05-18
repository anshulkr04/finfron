// src/utils/dateUtils.ts

/**
 * Formats a date string into a readable format
 * Handles ISO-format dates like "2025-05-17T13:15:02"
 */
export function formatDate(dateString: string): string {
  try {
    // Handle ISO format
    const date = new Date(dateString);
    
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // Fallback - return original string if parsing fails
    return dateString;
  } catch (e) {
    console.error(`Error formatting date: ${dateString}`, e);
    return dateString;
  }
}

/**
 * Returns a relative time string (e.g., "2 hours ago")
 */
export function getRelativeTimeString(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Unknown date";
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    // Return appropriate time string
    if (diffSec < 60) {
      return "Just now";
    } else if (diffMin < 60) {
      return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
    } else {
      // For older dates, return the formatted date
      return formatDate(dateString);
    }
  } catch (e) {
    console.error(`Error calculating relative time: ${dateString}`, e);
    return "Unknown date";
  }
}

/**
 * Compares two dates for sorting
 * Returns:
 * - positive number if dateA is newer than dateB
 * - negative number if dateA is older than dateB
 * - 0 if dates are equivalent
 */
export function compareDates(dateA: string, dateB: string): number {
  try {
    // Ensure consistent parsing of the ISO 8601 format
    const dateObjA = new Date(dateA);
    const dateObjB = new Date(dateB);
    
    // Check if both dates are valid
    if (!isNaN(dateObjA.getTime()) && !isNaN(dateObjB.getTime())) {
      return dateObjB.getTime() - dateObjA.getTime(); // Newest first
    }
    
    // If dates can't be compared properly, fall back to string comparison
    // This handles cases where the date format might be inconsistent
    return String(dateB).localeCompare(String(dateA));
  } catch (e) {
    console.error(`Error comparing dates: ${dateA} and ${dateB}`, e);
    return 0;
  }
}

/**
 * Consistently sorts announcements by date (newest first), handling multiple date formats
 */
export function sortByNewestDate(items: any[]): any[] {
  return [...items].sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;

    if (!isNaN(timeA) && !isNaN(timeB)) {
      return timeB - timeA; // Newest first
    }

    return 0; // Fallback if date is invalid or missing
  });
}

/**
 * Extract timestamp from various date formats
 */
function getTimestamp(dateStr: string): number | null {
  if (!dateStr) return null;
  
  try {
    // Try direct parsing first (works for ISO format)
    const date = new Date(dateStr);
    
    // Check if parsing was successful
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    
    // Handle "May 18, 2025 at 04:38 PM" format
    const match = dateStr.match(/([A-Za-z]+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s+(AM|PM)/i);
    if (match) {
      const [_, month, day, year, hours, minutes, ampm] = match;
      const monthIndex = getMonthIndex(month);
      let hour = parseInt(hours);
      
      // Convert 12-hour format to 24-hour
      if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      
      return new Date(
        parseInt(year),
        monthIndex,
        parseInt(day),
        hour,
        parseInt(minutes)
      ).getTime();
    }
  } catch (e) {
    console.error(`Error parsing date: ${dateStr}`, e);
  }
  
  return null;
}

/**
 * Get month index from name
 */
function getMonthIndex(monthName: string): number {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                  'july', 'august', 'september', 'october', 'november', 'december'];
  return months.indexOf(monthName.toLowerCase());
}

/**
 * Sorts an array of announcements by date (newest first)
 */
export function sortAnnouncementsByDate(announcements: any[]): any[] {
  return [...announcements].sort((a, b) => {
    // First sort by receivedAt timestamp if available (for real-time announcements)
    if (a.receivedAt && b.receivedAt) {
      const diff = b.receivedAt - a.receivedAt;
      if (diff !== 0) return diff;
    }
    
    // Then sort by the date field
    return compareDates(a.date, b.date);
  });
}