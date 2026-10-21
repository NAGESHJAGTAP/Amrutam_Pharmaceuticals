import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const AppLayout: React.FC = () => {
  return (
    <div className="cb-app-layout">
      <Navbar />
      <main className="cb-main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
