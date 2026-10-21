import React, { useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { useToast } from '@/app/providers/ToastContext';
import { authApi } from '@/lib/api/auth.api';
import {
  User,
  Shield,
  Key,
  Lock,
  Smartphone,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';

export const PatientProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // MFA Setup state
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaQrUri, setMfaQrUri] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpSubmitting, setTotpSubmitting] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }

    try {
      setPwSubmitting(true);
      const res = await authApi.changePassword({ currentPassword, newPassword });
      addToast('success', res.data?.message || 'Password changed successfully. Active sessions revoked.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleOpenMfaSetup = async () => {
    try {
      setMfaLoading(true);
      setTotpError(null);
      setTotpCode('');
      const res = await authApi.setupMfa();
      if (res.data) {
        setMfaSecret(res.data.secret);
        setMfaQrUri(res.data.qrCodeUri);
        setMfaModalOpen(true);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Could not initiate MFA setup.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) {
      setTotpError('Enter the 6-digit verification code from your authenticator app.');
      return;
    }

    try {
      setTotpSubmitting(true);
      setTotpError(null);
      await authApi.verifyMfaSetup(totpCode);
      addToast('success', 'Two-Factor Authentication activated successfully.');
      setMfaModalOpen(false);
      await refreshUser();
    } catch (err: any) {
      setTotpError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setTotpSubmitting(false);
    }
  };

  const handleCopySecret = () => {
    if (mfaSecret) {
      navigator.clipboard.writeText(mfaSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
          Account & Security Settings
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-md)' }}>
          Manage your personal medical profile, authentication credentials, and multi-factor verification.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)' }}>
        
        {/* Profile Information Card */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <User size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                Personal Profile
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Patient identification and communication details
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                Full Legal Name
              </label>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {user?.profile ? `${user.profile.firstName} ${user.profile.lastName}` : (user?.firstName ? `${user.firstName} ${user.lastName}` : 'Verified Patient')}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                Registered Email Address
              </label>
              <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', marginTop: '2px' }}>
                {user?.email}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                Account Classification
              </label>
              <div style={{ marginTop: '4px' }}>
                <span className="badge badge-success">
                  {user?.role} (Verified Patient)
                </span>
              </div>
            </div>

            <div style={{ background: 'var(--color-surface-tint)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', marginTop: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <Shield size={16} color="var(--color-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--color-text-primary)' }}>Data Privacy Guarantee:</strong> Your consultations, clinical notes, and prescription history are encrypted in transit with TLS 1.3 and at rest with AES-256.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Multi-Factor Authentication Card */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <Smartphone size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                Two-Factor Security (MFA)
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Time-based one-time password (TOTP)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                  Multi-Factor Status
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  {user?.mfaEnabled ? 'Your account requires TOTP codes during sign-in.' : 'Additional protection is currently disabled.'}
                </div>
              </div>
              <span className={`badge ${user?.mfaEnabled ? 'badge-success' : 'badge-neutral'}`}>
                {user?.mfaEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>

            {user?.mfaEnabled ? (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <Check size={18} color="#16a34a" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ fontSize: 'var(--font-size-xs)', color: '#166534', lineHeight: '1.5' }}>
                    <strong>Account Protected:</strong> Your account requires an authentication code from Google Authenticator, 1Password, or Authy whenever you sign in.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Secure your electronic health records and medical consultations by requiring a 6-digit authentication code during login.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOpenMfaSetup}
                  disabled={mfaLoading}
                  style={{ width: '100%' }}
                >
                  <Smartphone size={16} />
                  {mfaLoading ? 'Generating Secret...' : 'Setup Two-Factor Authentication'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card" style={{ padding: 'var(--space-6)', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-4)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-full)', background: 'var(--color-surface-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <Key size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
                Password & Session Credentials
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Passwords are authenticated using cryptographic Argon2id key derivation.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} style={{ maxWidth: '560px' }}>
            {pwError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{pwError}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
              <label className="form-label" htmlFor="current-pw">Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="current-pw"
                  type={showCurrent ? 'text' : 'password'}
                  className="form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your existing password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
                  aria-label="Toggle password visibility"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="new-pw">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-pw"
                    type={showNew ? 'text' : 'password'}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
                    aria-label="Toggle password visibility"
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-pw">Confirm New Password</label>
                <input
                  id="confirm-pw"
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>
            </div>

            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Clock size={14} />
              Changing your password will revoke all other active refresh sessions on other devices.
            </p>

            <button
              type="submit"
              className="btn btn-secondary"
              disabled={pwSubmitting}
            >
              <Lock size={16} />
              {pwSubmitting ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>

      {/* MFA Setup Modal */}
      {mfaModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Smartphone size={20} color="var(--color-primary)" />
                Configure Two-Factor Authentication
              </h3>
            </div>
            
            <div className="modal-body">
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
                1. Scan this QR code using Google Authenticator, Authy, or 1Password.
              </p>

              {/* QR Code display */}
              <div style={{ textAlign: 'center', background: '#fff', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-4)' }}>
                {mfaQrUri && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaQrUri)}`}
                    alt="Scan MFA QR code with your authenticator app"
                    style={{ width: '180px', height: '180px', margin: '0 auto', display: 'block' }}
                  />
                )}
              </div>

              {/* Manual code fallback */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)' }}>
                  Or enter manual setup key:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px' }}>
                  <code style={{ background: 'var(--color-surface-tint)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', letterSpacing: '1px', flex: 1, overflowX: 'auto', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                    {mfaSecret}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="btn btn-secondary btn-sm"
                    title="Copy Secret"
                  >
                    {copiedSecret ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleVerifyMfaSetup}>
                {totpError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-3)' }}>
                    {totpError}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                  <label className="form-label" htmlFor="totp-confirm-code">
                    2. Enter the 6-digit code shown in your app:
                  </label>
                  <input
                    id="totp-confirm-code"
                    type="text"
                    className="form-input"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    style={{ letterSpacing: '4px', textAlign: 'center', fontSize: 'var(--font-size-lg)', fontWeight: 'bold' }}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setMfaModalOpen(false)}
                    disabled={totpSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={totpSubmitting || totpCode.length !== 6}
                  >
                    {totpSubmitting ? 'Verifying...' : 'Activate MFA'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
