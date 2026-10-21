import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, Home, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div style={{ minHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8) var(--space-4)' }}>
      <div className="card" style={{ maxWidth: '520px', width: '100%', padding: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
          <HelpCircle size={36} />
        </div>

        <span className="badge badge-neutral" style={{ marginBottom: 'var(--space-2)' }}>
          HTTP 404 • Page Not Found
        </span>

        <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-2)' }}>
          We Couldn't Find That Page
        </h1>

        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)', lineHeight: '1.6', marginBottom: 'var(--space-6)' }}>
          The link you followed may be outdated, the appointment might have expired, or the URL address was typed incorrectly.
        </p>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/" className="cb-btn-signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Home size={16} />
            CareBridge Home
          </Link>
          <Link to="/doctors" className="btn btn-secondary">
            <Search size={16} />
            Find Doctors
          </Link>
        </div>
      </div>
    </div>
  );
};
