import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link to="/" className="flex items-center">
            <FileText className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="font-semibold text-xl text-gray-900">Filing Insights</span>
          </Link>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {title && (
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
            {title}
          </h1>
        )}
        
        {children}
      </main>
      
      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} Filing Insights. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link to="#" className="text-gray-500 hover:text-gray-700">
              Terms of Service
            </Link>
            <Link to="#" className="text-gray-500 hover:text-gray-700">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;