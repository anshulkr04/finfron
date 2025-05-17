import { notificationApi } from '../api';

export interface Notification {
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

export interface NotificationResponse {
  notifications: Notification[];
  count: number;
  unread_count: number;
}

class NotificationService {
  // Get notifications with optional filters
  async getNotifications(unreadOnly: boolean = false, limit?: number): Promise<NotificationResponse> {
    try {
      const params: { unread_only?: boolean, limit?: number } = {};
      
      if (unreadOnly) {
        params.unread_only = true;
      }
      
      if (limit) {
        params.limit = limit;
      }
      
      const response = await notificationApi.getNotifications(params);
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Mark a single notification as read
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const response = await notificationApi.markAsRead(notificationId);
      return response.data.notification;
    } catch (error) {
      console.error(`Error marking notification ${notificationId} as read:`, error);
      throw error;
    }
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<{ count: number }> {
    try {
      const response = await notificationApi.markAllAsRead();
      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Delete a single notification
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await notificationApi.deleteNotification(notificationId);
    } catch (error) {
      console.error(`Error deleting notification ${notificationId}:`, error);
      throw error;
    }
  }

  // Clear all notifications
  async clearAllNotifications(): Promise<{ count: number }> {
    try {
      const response = await notificationApi.clearAllNotifications();
      return response.data;
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      throw error;
    }
  }

  // Get unread count
  async getUnreadCount(): Promise<number> {
    try {
      const response = await notificationApi.getNotifications({ unread_only: true });
      return response.data.unread_count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  // Format relative time (e.g., "5 minutes ago")
  getRelativeTime(dateString: string): string {
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
  }
}

// Create and export a singleton instance
export const notificationService = new NotificationService();
export default notificationService;