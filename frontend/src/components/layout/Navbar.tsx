import React, { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthContext';
import { useToast } from '@/app/providers/ToastContext';
import {
  HeartPulse,
  Search,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  FileText,
  Stethoscope,
  ChevronDown,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await logout();
    info('You have safely signed out of your CareBridge session.');
    setUserDropdownOpen(false);
    navigate('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/doctors?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const isPatient = user?.role === 'PATIENT';
  const isDoctor = user?.role === 'DOCTOR';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <header className="cb-navbar-wrapper">
      <div className="cb-container cb-navbar-inner">
        {/* Brand Logo with leafy heart-pulse emblem */}
        <Link to={!isAuthenticated ? '/' : isPatient ? '/patient/dashboard' : isDoctor ? '/doctor/dashboard' : '/admin/dashboard'} className="cb-logo" onClick={() => setMobileMenuOpen(false)}>
          <div className="cb-logo-icon">
            <HeartPulse size={22} strokeWidth={2.4} />
          </div>
          <div className="cb-logo-meta">
            <span className="cb-logo-title">CareBridge</span>
            <span className="cb-logo-tagline">
              {!isAuthenticated
                ? 'Telehealth Platform'
                : isPatient
                ? 'Patient Portal'
                : isDoctor
                ? 'Doctor Workspace'
                : 'Admin Console'}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links — Public Landing Links OR Authenticated Role Workspace Links */}
        <nav className="cb-nav-menu" aria-label="Main Navigation">
          {!isAuthenticated ? (
            <>
              <NavLink
                to="/"
                className={({ isActive }) => `cb-nav-item ${isActive && location.pathname === '/' ? 'active' : ''}`}
              >
                Home
              </NavLink>
              <a href="/#services" className="cb-nav-item">
                Services
              </a>
              <a href="/#how-it-works" className="cb-nav-item">
                How It Works
              </a>
              <a href="/#about" className="cb-nav-item">
                About
              </a>
              <a href="/#contact" className="cb-nav-item">
                Contact
              </a>
            </>
          ) : (
            <>
              {isPatient && (
                <>
                  <NavLink
                    to="/patient/dashboard"
                    className={({ isActive }) => `cb-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <LayoutDashboard size={16} /> Dashboard
                  </NavLink>
                  <NavLink
                    to="/patient/consultations"
                    className={({ isActive }) => `cb-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Calendar size={16} /> Appointments
                  </NavLink>
                  <NavLink
                    to="/patient/prescriptions"
                    className={({ isActive }) => `cb-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <FileText size={16} /> Prescriptions
                  </NavLink>
                </>
              )}

              {isDoctor && (
                <>
                  <NavLink
                    to="/doctor/dashboard"
                    className={({ isActive }) => `cb-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <LayoutDashboard size={16} /> Clinical Workspace
                  </NavLink>
                  <NavLink
                    to="/doctor/availability"
                    className={({ isActive }) => `cb-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Calendar size={16} /> Availability Slots
                  </NavLink>
                </>
              )}

              {isAdmin && (
                <>
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) => `cb-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <LayoutDashboard size={16} /> Admin Operations
                  </NavLink>
                  <NavLink
                    to="/admin/doctors"
                    className={({ isActive }) => `cb-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Stethoscope size={16} /> Doctor Approvals
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>

        {/* Right Action Cluster */}
        <div className="cb-navbar-actions">
          {/* Search Trigger */}
          <div className="cb-search-action-wrap">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="cb-nav-search-form">
                <input
                  type="text"
                  placeholder="Search doctors, symptoms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="cb-nav-search-input"
                />
                <button type="submit" className="cb-nav-search-submit" aria-label="Submit search">
                  <Search size={16} />
                </button>
                <button
                  type="button"
                  className="cb-nav-search-close"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search"
                >
                  <X size={16} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="cb-icon-btn"
                onClick={() => setSearchOpen(true)}
                title="Search Doctors"
                aria-label="Open search"
              >
                <Search size={19} />
              </button>
            )}
          </div>

          {/* Authenticated User Menu or Public Sign In/Up */}
          {isAuthenticated ? (
            <div className="cb-user-dropdown-container">
              <button
                type="button"
                className="cb-user-pill-btn"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                aria-expanded={userDropdownOpen}
              >
                <div className="cb-user-avatar">
                  {user?.profile?.firstName
                    ? user.profile.firstName.charAt(0).toUpperCase()
                    : user?.email.charAt(0).toUpperCase()}
                </div>
                <div className="cb-user-info-text">
                  <span className="cb-user-name">
                    {user?.profile?.firstName || user?.email.split('@')[0]}
                  </span>
                  <span className="cb-user-role-badge">{user?.role}</span>
                </div>
                <ChevronDown size={14} className="cb-chevron" />
              </button>

              {userDropdownOpen && (
                <div className="cb-dropdown-menu">
                  <div className="cb-dropdown-header">
                    <div className="cb-dropdown-user-name">
                      {user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : user?.email}
                    </div>
                    <div className="cb-dropdown-user-email">{user?.email}</div>
                  </div>

                  <div className="cb-dropdown-items">
                    {isPatient && (
                      <>
                        <Link
                          to="/patient/dashboard"
                          onClick={() => setUserDropdownOpen(false)}
                          className="cb-dropdown-item"
                        >
                          <LayoutDashboard size={16} /> Patient Dashboard
                        </Link>
                        <Link
                          to="/patient/consultations"
                          onClick={() => setUserDropdownOpen(false)}
                          className="cb-dropdown-item"
                        >
                          <Calendar size={16} /> My Consultations
                        </Link>
                        <Link
                          to="/patient/prescriptions"
                          onClick={() => setUserDropdownOpen(false)}
                          className="cb-dropdown-item"
                        >
                          <FileText size={16} /> Prescriptions
                        </Link>
                      </>
                    )}

                    {isDoctor && (
                      <>
                        <Link
                          to="/doctor/dashboard"
                          onClick={() => setUserDropdownOpen(false)}
                          className="cb-dropdown-item"
                        >
                          <LayoutDashboard size={16} /> Doctor Workspace
                        </Link>
                        <Link
                          to="/doctor/availability"
                          onClick={() => setUserDropdownOpen(false)}
                          className="cb-dropdown-item"
                        >
                          <Calendar size={16} /> Slot Schedule Manager
                        </Link>
                      </>
                    )}

                    {isAdmin && (
                      <Link
                        to="/admin/dashboard"
                        onClick={() => setUserDropdownOpen(false)}
                        className="cb-dropdown-item"
                      >
                        <LayoutDashboard size={16} /> Admin Operations
                      </Link>
                    )}

                    <Link
                      to="/patient/profile"
                      onClick={() => setUserDropdownOpen(false)}
                      className="cb-dropdown-item"
                    >
                      <UserIcon size={16} /> Profile & Settings
                    </Link>
                  </div>

                  <div className="cb-dropdown-footer">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="cb-dropdown-item cb-logout-item"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cb-auth-buttons">
              <Link to="/login" className="cb-btn-login">
                Login
              </Link>
              <Link to="/register" className="cb-btn-signup">
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile menu trigger */}
          <button
            type="button"
            className="cb-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="cb-mobile-drawer">
          <nav className="cb-mobile-nav">
            {!isAuthenticated ? (
              <>
                <Link to="/" onClick={() => setMobileMenuOpen(false)} className="cb-mobile-link">
                  Home
                </Link>
                <a href="/#services" onClick={() => setMobileMenuOpen(false)} className="cb-mobile-link">
                  Services
                </a>
                <a href="/#how-it-works" onClick={() => setMobileMenuOpen(false)} className="cb-mobile-link">
                  How It Works
                </a>
                <a href="/#about" onClick={() => setMobileMenuOpen(false)} className="cb-mobile-link">
                  About
                </a>
                <a href="/#contact" onClick={() => setMobileMenuOpen(false)} className="cb-mobile-link">
                  Contact
                </a>
              </>
            ) : null}

            {isAuthenticated ? (
              <div className="cb-mobile-auth-section">
                {isPatient && (
                  <>
                    <Link
                      to="/patient/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="cb-mobile-link"
                    >
                      <LayoutDashboard size={18} /> Patient Dashboard
                    </Link>
                    <Link
                      to="/patient/consultations"
                      onClick={() => setMobileMenuOpen(false)}
                      className="cb-mobile-link"
                    >
                      <Calendar size={18} /> My Consultations
                    </Link>
                    <Link
                      to="/patient/prescriptions"
                      onClick={() => setMobileMenuOpen(false)}
                      className="cb-mobile-link"
                    >
                      <FileText size={18} /> Prescriptions
                    </Link>
                  </>
                )}
                {isDoctor && (
                  <Link
                    to="/doctor/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="cb-mobile-link"
                  >
                    <Stethoscope size={18} /> Doctor Workspace
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="cb-mobile-link"
                  >
                    <LayoutDashboard size={18} /> Admin Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="cb-btn-login"
                  style={{ marginTop: '1rem', width: '100%', color: 'var(--cb-danger)' }}
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            ) : (
              <div className="cb-mobile-auth-buttons">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="cb-btn-login"
                  style={{ textAlign: 'center' }}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="cb-btn-signup"
                  style={{ textAlign: 'center' }}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
