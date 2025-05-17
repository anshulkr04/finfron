import React, { useState, useEffect } from 'react';
import { Key, User, ShieldCheck, AlertCircle } from 'lucide-react';
import angelOneService from '../../services/angelOneService';

interface AngelOneAuthProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

const AngelOneAuth: React.FC<AngelOneAuthProps> = ({ onClose, onSuccess }) => {
  const [apiKey, setApiKey] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  useEffect(() => {
    // Check if already authenticated
    const isAuth = angelOneService.isAuthenticated();
    setIsAuthenticated(isAuth);
    
    if (isAuth) {
      setSuccessMessage('Already connected to Angel One');
    }
    
    // Pre-fill from localStorage if available
    const savedApiKey = localStorage.getItem('angel_api_key');
    const savedClientCode = localStorage.getItem('angel_client_code');
    
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedClientCode) setClientCode(savedClientCode);
  }, []);
  
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // In a real implementation, we would make a call to your server
      // which would then use the Smart API to generate a session
      // For now, we'll simulate success and store the credentials
      
      // Simulating API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo purposes, using a mock token
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
      
      // Store credentials
      angelOneService.setCredentials(apiKey, mockToken, clientCode);
      
      setIsAuthenticated(true);
      setSuccessMessage('Successfully connected to Angel One');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Failed to authenticate. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDisconnect = () => {
    // Clear credentials
    localStorage.removeItem('angel_api_key');
    localStorage.removeItem('angel_token');
    localStorage.removeItem('angel_client_code');
    
    setIsAuthenticated(false);
    setSuccessMessage(null);
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Connect to Angel One</h2>
        {onClose && (
          <button 
            className="text-gray-400 hover:text-gray-600" 
            onClick={onClose}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-lg flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {successMessage && (
        <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg flex items-start">
          <ShieldCheck className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      
      {isAuthenticated ? (
        <div>
          <p className="text-gray-600 mb-4">
            You are connected to Angel One. Your market data is now being fetched from the Angel One API.
          </p>
          <button
            className="w-full py-2.5 px-4 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-opacity-50"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect}>
          <div className="space-y-4">
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="apiKey"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Enter your API key"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="clientCode" className="block text-sm font-medium text-gray-700 mb-1">
                Client Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="clientCode"
                  type="text"
                  value={clientCode}
                  onChange={(e) => setClientCode(e.target.value)}
                  className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="Enter your client code"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>
            
            <div>
              <label htmlFor="totp" className="block text-sm font-medium text-gray-700 mb-1">
                TOTP
              </label>
              <input
                id="totp"
                type="text"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Enter your TOTP"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-opacity-50 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>
      )}
      
      <div className="mt-4 text-sm text-gray-500">
        <p>Need an Angel One account? <a href="https://www.angelone.in/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Sign up here</a></p>
      </div>
    </div>
  );
};

export default AngelOneAuth;