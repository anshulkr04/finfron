import React, { createContext, useState, useEffect, useContext } from 'react';
import { registerUser, loginUser, logoutUser, getCurrentUser } from '../api';

interface User {
  UserID: string;
  emailID: string;
  Phone_Number?: string;
  Paid: string;
  AccountType: string;
  created_at: string;
  WatchListID: any;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<{ error: any; data: any; }>;
  signIn: (email: string, password: string) => Promise<{ error: any; data: any; }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any; data: any; }>;
  updatePassword: (password: string) => Promise<{ error: any; data: any; }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
  });

  // Helper function to check the token for debugging
  const checkToken = () => {
    const token = localStorage.getItem('authToken');
    console.log('Current auth token:', token ? `${token.substring(0, 10)}...` : 'none');
    return token;
  };

  useEffect(() => {
    // Check for active session on mount
    const checkSession = async () => {
      // Check if we have a token
      const token = checkToken();
      if (!token) {
        console.log('No auth token found in localStorage');
        setAuthState({
          user: null,
          isLoading: false,
        });
        return;
      }
      
      console.log('Found token in localStorage, attempting to get user data');
      try {
        // Get user data using the token
        const userData = await getCurrentUser();
        console.log('Successfully retrieved user data:', userData);
        setAuthState({
          user: userData,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to get user data:', error);
        // Clear invalid token
        localStorage.removeItem('authToken');
        setAuthState({
          user: null,
          isLoading: false,
        });
      }
    };
    
    checkSession();
  }, []);

  // Authentication methods
  const signUp = async (email: string, password: string) => {
    console.log('Attempting to register user:', email);
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      const data = await registerUser(email, password);
      console.log('Registration response:', data);
      
      // Check if token was received and saved
      checkToken();

      setAuthState({
        user: null, // Don't set user yet since they might need email verification
        isLoading: false,
      });
      return { data, error: null };
    } catch (error: any) {
      console.error('Registration error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { 
        data: null,
        error: {
          message: error.response?.data?.message || 'Registration failed'
        }
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting to login user:', email);
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      const loginResponse = await loginUser(email, password);
      console.log('Login response:', loginResponse);
      
      // Explicitly verify the token was saved
      const token = loginResponse.token;
      if (token) {
        // Save token to localStorage if it's not already saved in loginUser
        localStorage.setItem('authToken', token);
        console.log('Auth token saved to localStorage:', token.substring(0, 10) + '...');
      } else {
        console.error('No token received from login');
        throw new Error('No authentication token received');
      }
      
      // Get user data with the new token
      console.log('Getting user data with new token');
      const userData = await getCurrentUser();
      console.log('Retrieved user data:', userData);
      
      setAuthState({
        user: userData,
        isLoading: false,
      });
      return { data: loginResponse, error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
      return { 
        data: null,
        error: {
          message: error.response?.data?.message || 'Login failed'
        }
      };
    }
  };

  const signOut = async () => {
    console.log('Attempting to logout user');
    setAuthState(prev => ({ ...prev, isLoading: true }));
    try {
      await logoutUser();
      console.log('Logout successful');
      
      // Clear token and user data
      localStorage.removeItem('authToken');
      console.log('Auth token removed from localStorage');
      
      setAuthState({
        user: null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Even if server-side logout fails, we clear local state
      localStorage.removeItem('authToken');
      console.log('Auth token removed from localStorage (after error)');
      
      setAuthState({
        user: null,
        isLoading: false,
      });
    }
  };

  const resetPassword = async (email: string) => {
    // This would need implementation in your backend
    // For now, we'll return an error
    return {
      data: null,
      error: { message: 'Password reset not implemented yet' }
    };
  };

  const updatePassword = async (password: string) => {
    // This would need implementation in your backend
    // For now, we'll return an error
    return {
      data: null,
      error: { message: 'Password update not implemented yet' }
    };
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};