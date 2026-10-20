import React from 'react';
import './App.css';

export const App: React.FC = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-wrapper">
            <div className="brand-icon">CB</div>
            <span className="brand-name">CareBridge</span>
            <span className="brand-tag">Telehealth</span>
          </div>
          <nav className="header-nav">
            <a href="#specialists" className="nav-link">Specialists</a>
            <a href="#consultations" className="nav-link">Consultations</a>
            <a href="#prescriptions" className="nav-link">Prescriptions</a>
            <button type="button" className="btn-header">Sign In</button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <section className="hero-card">
          <h1 className="hero-title">Professional Telehealth & Clinical Consultations</h1>
          <p className="hero-subtitle">
            CareBridge connects patients with certified clinical specialists through secure,
            audited appointments, real-time availability scheduling, and tamper-evident digital prescriptions.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn-primary">Find a Doctor</button>
            <button type="button" className="btn-secondary">Doctor Portal</button>
          </div>
        </section>

        <section className="grid-features">
          <div className="feature-card">
            <span className="feature-badge">Scheduling</span>
            <h3 className="feature-title">Anti-Double-Booking</h3>
            <p className="feature-desc">
              PostgreSQL exclusion constraints prevent overlapping slot allocations, guaranteeing reliable scheduling.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-badge">Security</span>
            <h3 className="feature-title">Multi-Factor Auth</h3>
            <p className="feature-desc">
              Argon2id password hashing, TOTP MFA, rotating JWTs, and audit logging safeguard sensitive health data.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-badge">Prescriptions</span>
            <h3 className="feature-title">Structured Rx</h3>
            <p className="feature-desc">
              Clinical medication schedules, dietary instructions, and immutable finalized digital prescriptions.
            </p>
          </div>
        </section>

        <div className="status-card">
          <span className="status-label">API Gateway Proxy Configuration</span>
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span>Connected: {apiBaseUrl} (Proxy target: :4000)</span>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} CareBridge Telehealth Platform. All clinical data protected under healthcare compliance standards.</p>
      </footer>
    </div>
  );
};

export default App;
