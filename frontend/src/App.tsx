import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@/app/providers/ToastContext';
import { AuthProvider } from '@/app/providers/AuthContext';
import { AppRoutes } from '@/app/router/AppRoutes';
import { IncomingCallModal } from '@/components/consultation/IncomingCallModal';
import '@/styles/global.css';

export const App: React.FC = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ToastProvider>
        <AuthProvider>
          <IncomingCallModal />
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
