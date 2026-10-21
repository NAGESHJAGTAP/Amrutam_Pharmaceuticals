import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  FileText,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { consultationsApi } from '@/lib/api/consultations.api';
import { Consultation } from '@/types/clinical.types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/app/providers/ToastContext';
import { formatApiError } from '@/lib/api/client';

export const PatientConsultationsPage: React.FC = () => {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Cancellation Modal State
  const [cancelModalConsultation, setCancelModalConsultation] = useState<Consultation | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [submittingCancel, setSubmittingCancel] = useState<boolean>(false);

  const { success, error } = useToast();

  const fetchConsultations = () => {
    setLoading(true);
    const statusParam = filterStatus !== 'ALL' ? filterStatus : undefined;

    consultationsApi
      .getMyBookings({ status: statusParam })
      .then((res) => {
        if (res.success && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data as any)?.consultations || [];
          setConsultations(list);
        }
      })
      .catch((err) => {
        error(formatApiError(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchConsultations();
  }, [filterStatus]);

  const handleConfirmCancel = async () => {
    if (!cancelModalConsultation) return;
    setSubmittingCancel(true);

    try {
      await consultationsApi.cancelConsultation(cancelModalConsultation.id, cancelReason);
      success('Consultation cancelled successfully.');
      setCancelModalConsultation(null);
      setCancelReason('');
      fetchConsultations();
    } catch (err) {
      error(formatApiError(err));
    } finally {
      setSubmittingCancel(false);
    }
  };

  return (
    <div style={{ padding: '3.5rem 0 5rem 0', minHeight: '80vh' }}>
      <div className="am-container">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'var(--am-font-editorial)',
                fontSize: '2.25rem',
                fontWeight: 700,
                color: 'var(--am-text-primary)',
              }}
            >
              My Consultations
            </h1>
            <p style={{ color: 'var(--am-text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
              Track scheduled appointments, clinical notes, and prescription records
            </p>
          </div>

          <Link to="/doctors" className="am-btn am-btn-primary">
            <Calendar size={18} /> Book New Consultation
          </Link>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
          {['ALL', 'CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`am-btn am-btn-sm ${filterStatus === st ? 'am-btn-primary' : 'am-btn-outline'}`}
              style={{ borderRadius: 'var(--am-radius-full)', textTransform: 'capitalize' }}
            >
              {st === 'ALL' ? 'All Appointments' : st.toLowerCase().replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Consultation List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="am-card">
                <div className="am-skeleton" style={{ height: '24px', width: '30%', marginBottom: '0.75rem' }} />
                <div className="am-skeleton" style={{ height: '18px', width: '20%' }} />
              </div>
            ))}
          </div>
        ) : consultations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {consultations.map((c) => {
              const docName = c.doctor?.user?.profile
                ? `Dr. ${c.doctor.user.profile.firstName} ${c.doctor.user.profile.lastName}`
                : 'Specialist Doctor';

              const canCancel = c.status === 'CONFIRMED' || c.status === 'PENDING_PAYMENT';

              return (
                <div
                  key={c.id}
                  className="am-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    padding: '1.25rem 1.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--am-radius-md)',
                        backgroundColor: 'var(--am-primary-light)',
                        color: 'var(--am-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {c.doctor?.user?.profile?.firstName?.charAt(0) || 'D'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--am-text-primary)' }}>
                          {docName}
                        </h3>
                        <StatusBadge status={c.status} size="sm" />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8125rem', color: 'var(--am-text-muted)' }}>
                        <span>ID: {c.id.substring(0, 8)}</span>
                        {c.slot && (
                          <span>
                            {new Date(c.slot.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })},{' '}
                            {new Date(c.slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span>{c.currency} {c.feeAmount}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {c.prescription && (
                      <Link to={`/prescriptions/${c.prescription.id}`} className="am-btn am-btn-secondary am-btn-sm">
                        <FileText size={15} /> View Rx
                      </Link>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setCancelModalConsultation(c)}
                        className="am-btn am-btn-outline am-btn-sm"
                        style={{ color: 'var(--am-danger)', borderColor: 'var(--am-danger-border)' }}
                      >
                        <XCircle size={15} /> Cancel
                      </button>
                    )}

                    <Link to={`/consultations/${c.id}`} className="am-btn am-btn-outline am-btn-sm">
                      Details <ChevronRight size={15} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="am-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <Calendar size={44} color="var(--am-sage-400)" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              No Consultations Found
            </h3>
            <p style={{ color: 'var(--am-text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
              {filterStatus !== 'ALL'
                ? `You have no appointments with status "${filterStatus}".`
                : 'You have not booked any appointments yet. Connect with a specialist today.'}
            </p>
            <Link to="/doctors" className="am-btn am-btn-primary">
              Find an Available Doctor
            </Link>
          </div>
        )}

        {/* Cancellation Modal */}
        {cancelModalConsultation && (
          <div className="am-modal-backdrop">
            <div className="am-modal">
              <div className="am-modal-header">
                <h3 style={{ fontSize: '1.1875rem', fontWeight: 700, color: 'var(--am-text-primary)' }}>
                  Cancel Appointment
                </h3>
                <button
                  type="button"
                  onClick={() => setCancelModalConsultation(null)}
                  style={{ color: 'var(--am-text-muted)' }}
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="am-modal-body">
                <p style={{ fontSize: '0.875rem', color: 'var(--am-text-secondary)', marginBottom: '1.25rem' }}>
                  Are you sure you want to cancel this consultation? The slot will be released back to the specialist schedule.
                </p>

                <div className="am-form-group">
                  <label className="am-label" htmlFor="cancel-reason">
                    Reason for Cancellation <span className="am-label-optional">(Optional)</span>
                  </label>
                  <textarea
                    id="cancel-reason"
                    className="am-textarea"
                    rows={3}
                    placeholder="Please specify why you are cancelling this appointment..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="am-modal-footer">
                <button
                  type="button"
                  onClick={() => setCancelModalConsultation(null)}
                  className="am-btn am-btn-outline am-btn-sm"
                  disabled={submittingCancel}
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="am-btn am-btn-danger am-btn-sm"
                  disabled={submittingCancel}
                >
                  {submittingCancel ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
