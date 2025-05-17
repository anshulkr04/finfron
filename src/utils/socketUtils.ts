// src/utils/socketUtils.ts

import { ProcessedAnnouncement } from '../api';

/**
 * Merges new announcements with existing ones, ensuring no duplicates.
 * Places new announcements at the beginning of the list.
 * 
 * @param existing Array of existing announcements
 * @param newAnnouncements Array of new announcements to merge
 * @returns Merged array with no duplicates
 */
export const mergeAnnouncements = (
  existing: ProcessedAnnouncement[], 
  newAnnouncements: ProcessedAnnouncement[]
): ProcessedAnnouncement[] => {
  if (!newAnnouncements || newAnnouncements.length === 0) {
    return existing;
  }
  
  // Create a Set of existing IDs for faster lookup
  const existingIds = new Set(existing.map(a => a.id));
  
  // Filter out any duplicates
  const uniqueNewAnnouncements = newAnnouncements.filter(
    announcement => !existingIds.has(announcement.id)
  );
  
  if (uniqueNewAnnouncements.length === 0) {
    return existing;
  }
  
  // Add new announcements at the beginning of the list
  return [...uniqueNewAnnouncements, ...existing];
};

/**
 * Checks if an announcement should be considered "new" based on timestamp
 * 
 * @param announcement The announcement to check
 * @param newAnnouncements Array of announcements marked as new
 * @param maxAgeMs Maximum age in milliseconds to consider an announcement "new" (default: 5 minutes)
 * @returns boolean indicating if the announcement is new
 */
export const isNewAnnouncement = (
  announcement: ProcessedAnnouncement,
  newAnnouncements: ProcessedAnnouncement[] = [],
  maxAgeMs = 5 * 60 * 1000 // 5 minutes
): boolean => {
  // First, check if it's in our explicit newAnnouncements list
  if (newAnnouncements.some(a => a.id === announcement.id)) {
    return true;
  }
  
  // If the announcement has a timestamp and it's recent, consider it new
  if (announcement.date) {
    try {
      const announcementDate = new Date(announcement.date);
      const now = new Date();
      return (now.getTime() - announcementDate.getTime()) < maxAgeMs;
    } catch (e) {
      // If date parsing fails, rely only on the newAnnouncements list
      return false;
    }
  }
  
  return false;
};

/**
 * Filters announcements relevant to a specific company
 * 
 * @param announcements Array of all announcements
 * @param company Company object with name, symbol, and/or isin
 * @returns Filtered array of announcements relevant to the company
 */
export const filterAnnouncementsForCompany = (
  announcements: ProcessedAnnouncement[],
  company: { name?: string; symbol?: string; isin?: string }
): ProcessedAnnouncement[] => {
  if (!announcements || announcements.length === 0) {
    return [];
  }
  
  return announcements.filter(announcement => 
    (company.name && announcement.company === company.name) ||
    (company.symbol && announcement.ticker === company.symbol) ||
    (company.isin && announcement.isin === company.isin)
  );
};

/**
 * Creates socket room names for a company to consistently join the same rooms
 * 
 * @param company Company object with ticker and/or isin
 * @returns Array of room names to join
 */
export const getCompanyRoomNames = (
  company: { ticker?: string; isin?: string; symbol?: string }
): string[] => {
  const rooms: string[] = [];
  
  if (company.ticker) {
    rooms.push(company.ticker);
  }
  
  if (company.symbol && company.symbol !== company.ticker) {
    rooms.push(company.symbol);
  }
  
  if (company.isin) {
    rooms.push(company.isin);
  }
  
  return rooms;
};