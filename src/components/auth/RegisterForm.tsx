import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const RegisterForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { signUp } = useAuth();

  // Password strength check
  const getPasswordStrength = (password: string): { strength: number; feedback: string } => {
    if (!password) return { strength: 0, feedback: 'Password is required' };
    
    let strength = 0;
    let feedback = '';
    
    // Length check
    if (password.length >= 8) {
      strength += 1;
    } else {
      feedback = 'Password should be at least 8 characters';
      return { strength, feedback };
    }
    
    // Contains uppercase
    if (/[A-Z]/.test(password)) strength += 1;
    // Contains lowercase
    if (/[a-z]/.test(password)) strength += 1;
    // Contains numbers
    if (/[0-9]/.test(password)) strength += 1;
    // Contains special characters
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    if (strength < 3) {
      feedback = 'Add uppercase, numbers or special characters to strengthen';
    } else if (strength < 5) {
      feedback = 'Good password strength';
    } else {
      feedback = 'Strong password';
    }
    
    return { strength, feedback };
  };
  
  const passwordCheck = getPasswordStrength(password);
  const passwordStrengthColor = () => {
    if (passwordCheck.strength <= 2) return 'bg-rose-500';
    if (passwordCheck.strength <= 3) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Validate password strength
    if (passwordCheck.strength < 3) {
      setError('Please use a stronger password: ' + passwordCheck.feedback);
      return;
    }
    
    setIsLoading(true);

    try {
      const { error, data } = await signUp(email, password);

      if (error) {
        setError(error.message);
      } else {
        // Store email in localStorage to identify pending users
        localStorage.setItem('pendingEmailConfirmation', email);
        
        // Show success message
        setRegistrationSuccess(true);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (registrationSuccess) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-600 mb-6">
            We've sent a confirmation link to <strong>{email}</strong>. 
            Please check your email and click the link to verify your account.
          </p>
          <div className="mt-6">
            <Link 
              to="/auth/login" 
              className="text-indigo-600 font-medium hover:text-indigo-800"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Create Account</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-lg flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 w-full py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 w-full py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            
            {/* Password strength meter */}
            {password && (
              <div className="mt-2">
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${passwordStrengthColor()}`} 
                    style={{ width: `${(passwordCheck.strength / 5) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{passwordCheck.feedback}</p>
              </div>
            )}
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`pl-10 w-full py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${
                  confirmPassword && password !== confirmPassword
                    ? "border-rose-300"
                    : "border-gray-300"
                }`}
                placeholder="••••••••"
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-rose-600 mt-1">Passwords do not match</p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 px-4 rounded-lg text-white font-medium ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-black hover:bg-gray-800"
            } transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-opacity-50`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>Creating account...</span>
              </div>
            ) : (
              "Create Account"
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm">
          <span className="text-gray-600">Already have an account? </span>
          <Link to="/auth/login" className="text-indigo-600 font-medium hover:text-indigo-800">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;