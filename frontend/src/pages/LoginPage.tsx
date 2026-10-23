import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  HeartPulse,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  Stethoscope,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { useToast } from '@/app/providers/ToastContext';
import { formatApiError } from '@/lib/api/client';

type RoleTab = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const [selectedRoleTab, setSelectedRoleTab] = useState<RoleTab>(
    (location.state as any)?.registeredRole || 'PATIENT'
  );
  const [email, setEmail] = useState((location.state as any)?.registeredEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(
    (location.state as any)?.message || null
  );

  const { login } = useAuth();
  const { success, warning } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const state = location.state as any;
    if (state?.registeredEmail) {
      setEmail(state.registeredEmail);
    }
    if (state?.registeredRole) {
      setSelectedRoleTab(state.registeredRole);
    }
    if (state?.message) {
      setRegistrationNotice(state.message);
    }
  }, [location.state]);

  const from = (location.state as any)?.from?.pathname;

  // Quick fill helper for review & testing
  const handleQuickFill = (role: RoleTab) => {
    setSelectedRoleTab(role);
    setErrorMessage(null);
    if (role === 'PATIENT') {
      setEmail('rohan.patil@synthetic.local');
      setPassword('PatientDevPass#2026!');
    } else if (role === 'DOCTOR') {
      setEmail('dr.aisha.sharma@synthetic.local');
      setPassword('DoctorDevPass#2026!');
    } else if (role === 'ADMIN') {
      setEmail('admin.amrutam@synthetic.local');
      setPassword('AdminDevPass#2026!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await login({ email: email.trim(), password });

      // Handle MFA challenge redirect
      if ('requiresMfa' in res && res.requiresMfa) {
        navigate('/mfa-verify', { state: { preAuthToken: res.preAuthToken, email } });
        return;
      }

      if ('user' in res && res.user) {
        const authenticatedRole = res.user.role;

        // Role verification notice if sign-in context was different
        if (authenticatedRole !== selectedRoleTab) {
          warning(
            `Authenticated as ${authenticatedRole}. Redirecting to your authorized ${authenticatedRole.toLowerCase()} workspace.`
          );
        } else {
          success(`Welcome back to CareBridge, ${res.user.profile?.firstName || 'User'}!`);
        }

        // Post-login routing strictly based on backend returned role
        if (authenticatedRole === 'DOCTOR') {
          navigate('/doctor/dashboard', { replace: true });
        } else if (authenticatedRole === 'ADMIN') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate(from || '/patient/dashboard', { replace: true });
        }
      }
    } catch (err) {
      setErrorMessage(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: '3.5rem 1.5rem',
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--cb-bg)',
      }}
    >
      <div
        className="cb-card cb-auth-card"
        style={{
          maxWidth: '490px',
          width: '100%',
          background: '#ffffff',
          borderRadius: 'var(--cb-radius-xl)',
          border: '1px solid var(--cb-border)',
          boxShadow: 'var(--cb-shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--cb-radius-md)',
              background: 'linear-gradient(135deg, var(--cb-primary) 0%, var(--cb-primary-dark) 100%)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 4px 12px rgba(11, 93, 59, 0.25)',
            }}
          >
            <HeartPulse size={26} strokeWidth={2.4} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--cb-text-primary)', marginBottom: '0.35rem' }}>
            Sign In to CareBridge
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--cb-text-secondary)' }}>
            Access verified clinical consultations, digital prescriptions & health records
          </p>
        </div>

        {/* Registration Success Banner */}
        {registrationNotice && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--cb-mint, #e8f5e9)',
              border: '1px solid var(--cb-primary-border, #a7f3d0)',
              borderRadius: 'var(--cb-radius-sm)',
              color: 'var(--cb-primary-dark, #0b5d3b)',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
            }}
          >
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <span>{registrationNotice}</span>
          </div>
        )}

        {/* Role Entry Selection Tabs */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--cb-text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            Select Portal Access:
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
              background: 'var(--cb-bg)',
              padding: '0.35rem',
              borderRadius: 'var(--cb-radius-md)',
              border: '1px solid var(--cb-border)',
            }}
          >
            <button
              type="button"
              onClick={() => handleQuickFill('PATIENT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem',
                fontSize: '0.825rem',
                fontWeight: selectedRoleTab === 'PATIENT' ? 700 : 500,
                color: selectedRoleTab === 'PATIENT' ? '#ffffff' : 'var(--cb-text-secondary)',
                backgroundColor: selectedRoleTab === 'PATIENT' ? 'var(--cb-primary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--cb-radius-sm)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <User size={14} /> Patient
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('DOCTOR')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem',
                fontSize: '0.825rem',
                fontWeight: selectedRoleTab === 'DOCTOR' ? 700 : 500,
                color: selectedRoleTab === 'DOCTOR' ? '#ffffff' : 'var(--cb-text-secondary)',
                backgroundColor: selectedRoleTab === 'DOCTOR' ? 'var(--cb-primary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--cb-radius-sm)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <Stethoscope size={14} /> Doctor
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('ADMIN')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem',
                fontSize: '0.825rem',
                fontWeight: selectedRoleTab === 'ADMIN' ? 700 : 500,
                color: selectedRoleTab === 'ADMIN' ? '#ffffff' : 'var(--cb-text-secondary)',
                backgroundColor: selectedRoleTab === 'ADMIN' ? 'var(--cb-primary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--cb-radius-sm)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <ShieldAlert size={14} /> Admin
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--cb-danger-bg)',
              border: '1px solid var(--cb-danger-border)',
              borderRadius: 'var(--cb-radius-sm)',
              color: 'var(--cb-danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
            }}
            role="alert"
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.15rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
            >
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={18}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cb-text-muted)' }}
              />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.4rem',
                  fontSize: '0.925rem',
                  borderRadius: 'var(--cb-radius-sm)',
                  border: '1px solid var(--cb-border)',
                  outline: 'none',
                  color: 'var(--cb-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cb-text-muted)' }}
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '0.65rem 2.5rem 0.65rem 2.4rem',
                  fontSize: '0.925rem',
                  borderRadius: 'var(--cb-radius-sm)',
                  border: '1px solid var(--cb-border)',
                  outline: 'none',
                  color: 'var(--cb-text-primary)',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--cb-text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="cb-btn-signup"
            style={{
              width: '100%',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '0.95rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Security & RBAC Notice */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--cb-border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--cb-text-muted)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem',
          }}
        >
          <ShieldCheck size={14} color="var(--cb-primary)" />
          <span>Argon2id hashing & cryptographically signed JWT sessions</span>
        </div>

        {/* Link to Register */}
        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--cb-text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ fontWeight: 700, color: 'var(--cb-primary)', textDecoration: 'none' }}>
            Register as Patient
          </Link>
        </div>
      </div>
    </div>
  );
};
