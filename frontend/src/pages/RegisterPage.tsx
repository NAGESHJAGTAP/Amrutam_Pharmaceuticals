import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeartPulse, Lock, Mail, User as UserIcon, Phone, ArrowRight, AlertCircle, Stethoscope, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthContext';
import { useToast } from '@/app/providers/ToastContext';
import { formatApiError } from '@/lib/api/client';

type RoleType = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export const RegisterPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<RoleType>('PATIENT');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { register } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    // Backend password complexity check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,128}$/;
    if (!passwordRegex.test(password)) {
      setErrorMessage(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role: selectedRole,
      });

      success(`Account created successfully! Please sign in as ${selectedRole === 'PATIENT' ? 'Patient' : selectedRole === 'DOCTOR' ? 'Doctor' : 'Administrator'}.`);
      navigate('/login', {
        replace: true,
        state: {
          registeredEmail: email.trim(),
          registeredRole: selectedRole,
          registeredName: firstName.trim(),
          message: 'Account registered successfully! Please sign in to access your portal.',
        },
      });
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
          maxWidth: '520px',
          width: '100%',
          background: '#ffffff',
          borderRadius: 'var(--cb-radius-xl)',
          border: '1px solid var(--cb-border)',
          boxShadow: 'var(--cb-shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
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
            Create Your Account
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--cb-text-secondary)' }}>
            Join CareBridge to access teleconsultations, clinical tools & health records
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--cb-text-muted)', marginBottom: '0.45rem', letterSpacing: '0.05em' }}>
            Choose Account Role:
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
              onClick={() => setSelectedRole('PATIENT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.55rem',
                fontSize: '0.825rem',
                fontWeight: selectedRole === 'PATIENT' ? 700 : 500,
                color: selectedRole === 'PATIENT' ? '#ffffff' : 'var(--cb-text-secondary)',
                backgroundColor: selectedRole === 'PATIENT' ? 'var(--cb-primary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--cb-radius-sm)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <UserIcon size={14} /> Patient
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('DOCTOR')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.55rem',
                fontSize: '0.825rem',
                fontWeight: selectedRole === 'DOCTOR' ? 700 : 500,
                color: selectedRole === 'DOCTOR' ? '#ffffff' : 'var(--cb-text-secondary)',
                backgroundColor: selectedRole === 'DOCTOR' ? 'var(--cb-primary)' : 'transparent',
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
              onClick={() => setSelectedRole('ADMIN')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.55rem',
                fontSize: '0.825rem',
                fontWeight: selectedRole === 'ADMIN' ? 700 : 500,
                color: selectedRole === 'ADMIN' ? '#ffffff' : 'var(--cb-text-secondary)',
                backgroundColor: selectedRole === 'ADMIN' ? 'var(--cb-primary)' : 'transparent',
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

        {/* Error Alert */}
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

        <form onSubmit={handleSubmit}>
          {/* Name Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.15rem' }}>
            <div>
              <label
                htmlFor="firstName"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
              >
                First Name *
              </label>
              <div style={{ position: 'relative' }}>
                <UserIcon
                  size={16}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cb-text-muted)' }}
                />
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Rahul"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem 0.65rem 2.2rem',
                    fontSize: '0.9rem',
                    borderRadius: 'var(--cb-radius-sm)',
                    border: '1px solid var(--cb-border)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="lastName"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
              >
                Last Name *
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Patil"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--cb-radius-sm)',
                  border: '1px solid var(--cb-border)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: '1.15rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
            >
              Email Address *
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cb-text-muted)' }}
              />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@example.com"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.2rem',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--cb-radius-sm)',
                  border: '1px solid var(--cb-border)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: '1.15rem' }}>
            <label
              htmlFor="phone"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
            >
              Phone Number (Optional)
            </label>
            <div style={{ position: 'relative' }}>
              <Phone
                size={16}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cb-text-muted)' }}
              />
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.2rem',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--cb-radius-sm)',
                  border: '1px solid var(--cb-border)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Password & Confirm */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
              >
                Password *
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cb-text-muted)' }}
                />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem 0.65rem 2.2rem',
                    fontSize: '0.9rem',
                    borderRadius: 'var(--cb-radius-sm)',
                    border: '1px solid var(--cb-border)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--cb-text-primary)', marginBottom: '0.4rem' }}
              >
                Confirm Password *
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--cb-radius-sm)',
                  border: '1px solid var(--cb-border)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Password requirement hint */}
          <div style={{ fontSize: '0.725rem', color: 'var(--cb-text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
            Must include at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#).
          </div>

          {/* Terms checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              style={{ accentColor: 'var(--cb-primary)', cursor: 'pointer' }}
            />
            <label htmlFor="terms" style={{ fontSize: '0.8rem', color: 'var(--cb-text-secondary)', cursor: 'pointer' }}>
              I agree to the CareBridge Telehealth Terms and Privacy Policy.
            </label>
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
            {submitting ? 'Registering Account...' : `Register as ${selectedRole === 'PATIENT' ? 'Patient' : selectedRole === 'DOCTOR' ? 'Doctor' : 'Administrator'}`}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--cb-text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 700, color: 'var(--cb-primary)', textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
