import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export const ForbiddenPage: React.FC = () => {
  const { user } = useAuth();

  const getDashboardLink = () => {
    if (user?.role === 'DOCTOR') return '/doctor/dashboard';
    if (user?.role === 'ADMIN') return '/admin/dashboard';
    return '/patient/dashboard';
  };

  return (
    <div style={{ minHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <div className="card" style={{ maxWidth: '540px', width: '100%', padding: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-full)', background: '#fee2e2', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
          <ShieldAlert size={36} />
        </div>

        <span className="badge badge-danger" style={{ marginBottom: 'var(--space-2)' }}>
          HTTP 403 • Access Denied
        </span>

        <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
          Restricted Medical Area
        </h1>

        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)', lineHeight: '1.6', marginBottom: 'var(--space-6)' }}>
          Your current account role (<strong>{user?.role || 'ANONYMOUS'}</strong>) does not have authorization to access this clinical or administrative partition. Access events are audited in accordance with telemedicine security standards.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-secondary">
            <Home size={16} />
            Return to Homepage
          </Link>
          {user && (
            <Link to={getDashboardLink()} className="btn btn-primary">
              <ArrowLeft size={16} />
              Return to Your Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
