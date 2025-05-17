import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import ResetPasswordForm from './ResetPasswordForm';
import AuthCallback from './AuthCallback';
import { useAuth } from '../../context/AuthContext';

const AuthRouter: React.FC = () => {
  const { user, isLoading } = useAuth();

  // If auth is loading, show a loading spinner
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  // If user is already authenticated, redirect to home
  if (user && window.location.pathname !== '/auth/callback') {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="login" element={
        <AuthLayout title="Welcome Back">
          <LoginForm />
        </AuthLayout>
      } />
      <Route path="register" element={
        <AuthLayout title="Create an Account">
          <RegisterForm />
        </AuthLayout>
      } />
      <Route path="forgot-password" element={
        <AuthLayout>
          <ForgotPasswordForm />
        </AuthLayout>
      } />
      <Route path="reset-password" element={
        <AuthLayout>
          <ResetPasswordForm />
        </AuthLayout>
      } />
      <Route path="callback" element={<AuthCallback />} />
      <Route path="*" element={<Navigate to="/auth/login" replace />} />
    </Routes>
  );
};

export default AuthRouter;