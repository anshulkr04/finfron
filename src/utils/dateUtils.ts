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
    const dateObjA = new Date(dateA);
    const dateObjB = new Date(dateB);
    
    // Check if both dates are valid
    if (!isNaN(dateObjA.getTime()) && !isNaN(dateObjB.getTime())) {
      return dateObjB.getTime() - dateObjA.getTime(); // Newest first
    }
    
    // If one date is invalid, prioritize the valid one
    if (!isNaN(dateObjA.getTime())) return -1;
    if (!isNaN(dateObjB.getTime())) return 1;
    
    // If both are invalid, keep original order
    return 0;
  } catch (e) {
    console.error(`Error comparing dates: ${dateA} and ${dateB}`, e);
    return 0;
  }
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