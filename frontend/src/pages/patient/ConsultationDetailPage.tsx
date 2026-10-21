import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  FileText,
  ChevronLeft,
  AlertTriangle,
  XCircle,
  Video,
} from 'lucide-react';
import { consultationsApi } from '@/lib/api/consultations.api';
import { paymentsApi } from '@/lib/api/payments.api';
import { Consultation, Payment } from '@/types/clinical.types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/providers/ToastContext';
import { formatApiError } from '@/lib/api/client';

export const ConsultationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Cancellation State
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);

  const { success, error } = useToast();

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const res = await consultationsApi.getConsultationById(id);
      if (res.success && res.data) {
        setConsultation(res.data);
      }

      // Fetch payment
      try {
        const payRes = await paymentsApi.getPaymentByConsultation(id);
        if (payRes.success && payRes.data) {
          setPayment(payRes.data);
        }
      } catch {
        // Handled: payment not yet created
      }
    } catch (err) {
      error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleConfirmCancel = async () => {
    if (!id) return;
    setCancelling(true);

    try {
      await consultationsApi.cancelConsultation(id, cancelReason);
      success('Consultation cancelled successfully.');
      setShowCancelModal(false);
      fetchData();
    } catch (err) {
      error(formatApiError(err));
    } finally {
      setCancelling(false);
    }
  };

  const docName = consultation?.doctor?.user?.profile
    ? `Dr. ${consultation.doctor.user.profile.firstName} ${consultation.doctor.user.profile.lastName}`
    : consultation?.doctor?.name
    ? consultation.doctor.name
    : 'Dr. Aisha Sharma';

  const canCancel = consultation?.status === 'CONFIRMED' || consultation?.status === 'PENDING_PAYMENT';

  return (
    <div style={{ padding: '3.5rem 0 5rem 0', minHeight: '80vh' }}>
      <div className="am-container am-container-narrow">
        <Link
          to="/patient/consultations"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--am-text-secondary)',
            fontSize: '0.875rem',
            fontWeight: 600,
            marginBottom: '1.75rem',
          }}
        >
          <ChevronLeft size={16} /> Back to Consultations
        </Link>

        {loading ? (
          <div className="am-card">
            <div className="am-skeleton" style={{ height: '32px', width: '40%', marginBottom: '1rem' }} />
            <div className="am-skeleton" style={{ height: '20px', width: '25%', marginBottom: '2rem' }} />
            <div className="am-skeleton" style={{ height: '180px', width: '100%' }} />
          </div>
        ) : consultation ? (
          <div>
            {/* Header Title & Status */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '2rem',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    color: 'var(--am-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Appointment #{consultation.id.substring(0, 8)}
                </span>
                <h1
                  style={{
                    fontFamily: 'var(--am-font-editorial)',
                    fontSize: '2.25rem',
                    fontWeight: 700,
                    color: 'var(--am-text-primary)',
                    marginTop: '0.25rem',
                  }}
                >
                  Clinical Consultation
                </h1>
              </div>
              <StatusBadge status={consultation.status} />
            </div>

            {/* Doctor Info Card */}
            <div className="am-card" style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: 'var(--am-radius-md)',
                    backgroundColor: 'var(--am-primary-light)',
                    color: 'var(--am-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.35rem',
                  }}
                >
                  {consultation.doctor?.user?.profile?.firstName?.charAt(0) || 'D'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{docName}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--am-sage-600)', fontWeight: 600 }}>
                    {consultation.doctor?.specialty} Specialist • License {consultation.doctor?.licenseNumber}
                  </p>
                </div>
              </div>
            </div>

            {/* Appointment Details Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.75rem',
              }}
            >
              {/* Scheduled Time */}
              <div className="am-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Calendar size={18} color="var(--am-primary)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Scheduled Slot</h4>
                </div>
                {consultation.slot || consultation.startTime ? (
                  <div style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
                    <div>
                      <strong>Date:</strong> {new Date(consultation.slot?.startTime || consultation.startTime!).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ color: 'var(--am-text-secondary)', marginTop: '0.25rem' }}>
                      <strong>Time:</strong> {new Date(consultation.slot?.startTime || consultation.startTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(consultation.slot?.endTime || consultation.endTime || new Date(new Date(consultation.slot?.startTime || consultation.startTime!).getTime() + 30 * 60000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--am-text-muted)' }}>Slot metadata synchronized</p>
                )}
              </div>

              {/* Payment Details */}
              <div className="am-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <CreditCard size={18} color="var(--am-primary)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Payment & Billing</h4>
                </div>
                <div style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
                  <div>
                    <strong>Consultation Fee:</strong> {consultation.currency} {consultation.feeAmount}
                  </div>
                  {payment && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--am-text-muted)' }}>
                      Ref: <span style={{ fontFamily: 'monospace' }}>{payment.paymentReference}</span>
                    </div>
                  )}
                  <div style={{ marginTop: '0.5rem' }}>
                    <StatusBadge status={payment?.status || 'PENDING'} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Prescriptions Section */}
            {consultation.prescription && (
              <div
                className="am-card"
                style={{
                  border: '1.5px solid var(--am-primary-border)',
                  backgroundColor: 'var(--am-primary-light)',
                  marginBottom: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <FileText size={24} color="var(--am-primary)" />
                  <div>
                    <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--am-primary)' }}>
                      Finalized Digital Prescription Available
                    </h4>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--am-text-secondary)' }}>
                      Medication dosages and clinical dietary directions are cryptographically locked.
                    </p>
                  </div>
                </div>
                <Link to={`/prescriptions/${consultation.prescription.id}`} className="am-btn am-btn-primary am-btn-sm">
                  View & Print Prescription
                </Link>
              </div>
            )}

            {/* Actions Bar */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              {consultation.status !== 'CANCELLED' && (
                <Link
                  to={`/consultations/${consultation.id}/call`}
                  className="cb-btn cb-btn-primary cb-btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                >
                  <Video size={16} /> Join Video Consultation
                </Link>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="am-btn am-btn-outline am-btn-sm"
                  style={{ color: 'var(--am-danger)', borderColor: 'var(--am-danger-border)' }}
                >
                  <XCircle size={16} /> Cancel Consultation
                </button>
              )}
            </div>

            {/* Cancellation Modal */}
            {showCancelModal && (
              <div className="am-modal-backdrop">
                <div className="am-modal">
                  <div className="am-modal-header">
                    <h3 style={{ fontSize: '1.1875rem', fontWeight: 700 }}>Cancel Consultation</h3>
                    <button type="button" onClick={() => setShowCancelModal(false)}>
                      <XCircle size={20} />
                    </button>
                  </div>
                  <div className="am-modal-body">
                    <p style={{ fontSize: '0.875rem', color: 'var(--am-text-secondary)', marginBottom: '1rem' }}>
                      Are you sure you want to cancel appointment #{consultation.id.substring(0, 8)}?
                    </p>
                    <div className="am-form-group">
                      <label className="am-label" htmlFor="cancel-res">Reason</label>
                      <textarea
                        id="cancel-res"
                        className="am-textarea"
                        rows={3}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Please let us know your reason for cancellation..."
                      />
                    </div>
                  </div>
                  <div className="am-modal-footer">
                    <button
                      type="button"
                      onClick={() => setShowCancelModal(false)}
                      className="am-btn am-btn-outline am-btn-sm"
                      disabled={cancelling}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCancel}
                      className="am-btn am-btn-danger am-btn-sm"
                      disabled={cancelling}
                    >
                      {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="am-card" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
            <AlertTriangle size={44} color="var(--am-warning)" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Consultation Not Found</h3>
            <p style={{ color: 'var(--am-text-secondary)', marginBottom: '1.5rem' }}>
              The requested consultation record could not be found or you do not have permission to view it.
            </p>
            <Link to="/patient/consultations" className="am-btn am-btn-primary">
              Return to Consultations
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
