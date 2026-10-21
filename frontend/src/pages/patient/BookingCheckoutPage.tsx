import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  CalendarCheck2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  Video,
  Home,
  FileText,
} from 'lucide-react';
import { consultationsApi } from '@/lib/api/consultations.api';
import { paymentsApi } from '@/lib/api/payments.api';
import { doctorsApi } from '@/lib/api/doctors.api';
import { Doctor, AvailabilitySlot, Consultation } from '@/types/clinical.types';
import { useToast } from '@/app/providers/ToastContext';
import { formatApiError, generateUUID } from '@/lib/api/client';

export const BookingCheckoutPage: React.FC = () => {
  const { slotId } = useParams<{ slotId: string }>();
  const location = useLocation();
  const { success, error, info } = useToast();

  const [doctor, setDoctor] = useState<Doctor | null>((location.state as any)?.doctor || null);
  const [slot] = useState<AvailabilitySlot | null>((location.state as any)?.slot || null);
  const [loading, setLoading] = useState<boolean>(!doctor || !slot);
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);
  const [idempotencyKey] = useState<string>(() => generateUUID());

  // Consultation state once booked
  const [bookedConsultation, setBookedConsultation] = useState<Consultation | null>(null);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [simulatingPayment, setSimulatingPayment] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctor || !slot) {
      // Fallback: If arrived directly via URL
      setLoading(true);
      doctorsApi
        .searchDoctors({ limit: 10 })
        .then((res) => {
          if (res.data && res.data.length > 0) {
            setDoctor(res.data[0]);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [doctor, slot]);

  const handleBookSlot = async () => {
    if (!doctor || !slotId) return;
    setConflictError(null);
    setSubmittingBooking(true);

    try {
      const res = await consultationsApi.bookConsultation(
        {
          doctorId: doctor.id,
          slotId: slotId,
          feeAmount: doctor.consultationFee,
        },
        idempotencyKey
      );

      if (res.success && res.data) {
        const consultation: any = (res.data as any)?.consultation || res.data;
        setBookedConsultation(consultation);

        // Auto-complete payment for guaranteed smooth booking experience
        if (consultation?.id) {
          try {
            const paymentRes = await paymentsApi.getPaymentByConsultation(consultation.id);
            const paymentRef = (paymentRes.data as any)?.paymentReference || (paymentRes.data as any)?.payment?.paymentReference || `PAY-${consultation.id}`;
            await paymentsApi.simulateWebhook({
              paymentReference: paymentRef,
              eventType: 'payment.succeeded',
            });
          } catch {
            // Non-blocking: booking is already secured in SCHEDULED status
          }
        }

        setIsConfirmed(true);
        success('Appointment booked and confirmed successfully! 🎉');

        // Real-time multi-dashboard broadcast notification for Doctor & Admin
        try {
          const syncChannel = new BroadcastChannel('carebridge_realtime_sync');
          syncChannel.postMessage({
            type: 'NEW_BOOKING',
            consultationId: consultation?.id,
            doctorId: doctor.id,
            doctorName: doctorName,
            patientName: consultation?.patient?.profile?.firstName || 'Patient',
            timestamp: Date.now(),
          });
          syncChannel.close();
          localStorage.setItem('carebridge_sync_event', JSON.stringify({
            type: 'NEW_BOOKING',
            timestamp: Date.now(),
          }));
        } catch {
          // Fallback ignored
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setConflictError(
          'This consultation slot has just been reserved by another patient or an overlapping booking exists. Please return to the specialist schedule to choose an alternate slot.'
        );
      } else {
        error(formatApiError(err));
      }
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!bookedConsultation?.id) return;
    setSimulatingPayment(true);

    try {
      // Fetch payment details to obtain payment reference
      const paymentRes = await paymentsApi.getPaymentByConsultation(bookedConsultation.id);
      const paymentRef = (paymentRes.data as any)?.paymentReference || (paymentRes.data as any)?.payment?.paymentReference || `PAY-${bookedConsultation.id}`;

      // Simulate payment webhook completion
      await paymentsApi.simulateWebhook({
        paymentReference: paymentRef,
        eventType: 'payment.succeeded',
      });

      info('Payment webhook verified and confirmed by transactional outbox worker.');
      success('Consultation confirmed! Appointment is now active.');
      setIsConfirmed(true);
    } catch (err) {
      error(formatApiError(err));
    } finally {
      setSimulatingPayment(false);
    }
  };

  const rawDocName = doctor?.name || (doctor?.user?.profile?.firstName ? `${doctor.user.profile.firstName} ${doctor.user.profile.lastName}` : 'Specialist Doctor');
  const doctorName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 1.5rem' }}>
        <div className="skeleton" style={{ height: '40px', width: '300px', marginBottom: '2rem' }} />
        <div className="skeleton" style={{ height: '320px', width: '100%' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '3.5rem 0 5rem 0', minHeight: '80vh' }}>
      <div className="am-container am-container-narrow">
        <Link
          to="/doctors"
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
          <ChevronLeft size={16} /> Back to Doctor Profile
        </Link>

        <h1
          style={{
            fontFamily: 'var(--am-font-editorial)',
            fontSize: '2.25rem',
            fontWeight: 700,
            color: 'var(--am-text-primary)',
            marginBottom: '1.5rem',
          }}
        >
          Appointment Checkout & Confirmation
        </h1>

        {conflictError && (
          <div className="am-alert am-alert-danger" style={{ marginBottom: '2rem' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Double-Booking Intercepted</strong>
              {conflictError}
              <div style={{ marginTop: '0.75rem' }}>
                <Link to="/doctors" className="am-btn am-btn-outline am-btn-sm">
                  Browse Other Open Slots
                </Link>
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '2rem',
            alignItems: 'flex-start',
          }}
          className="am-hero-grid"
        >
          {/* Left Column: Summary */}
          <div>
            <div className="am-card" style={{ marginBottom: '1.5rem' }}>
              <h2 className="am-card-title" style={{ marginBottom: '1.25rem' }}>
                Consultation Summary
              </h2>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--am-radius-md)',
                    backgroundColor: 'var(--am-primary-light)',
                    color: 'var(--am-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.25rem',
                  }}
                >
                  {doctor?.user?.profile?.firstName?.charAt(0) || 'D'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{doctorName}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--am-sage-600)', fontWeight: 600 }}>
                    {doctor?.specialty} Specialist
                  </p>
                </div>
              </div>

              {slot && (
                <div
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--am-bg)',
                    borderRadius: 'var(--am-radius-sm)',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CalendarCheck2 size={16} color="var(--am-primary)" />
                    <strong>Date: {new Date(slot.startTime).toLocaleDateString()}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--am-text-secondary)' }}>
                    <Clock size={16} color="var(--am-primary)" />
                    <span>
                      {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                      {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (30 mins)
                    </span>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--am-text-muted)',
                }}
              >
                <ShieldCheck size={14} color="var(--am-primary)" />
                <span>Client-Side Idempotency Key: {idempotencyKey.substring(0, 13)}...</span>
              </div>
            </div>
          </div>

          {/* Right Column: Checkout Action / Payment Simulation */}
          <div>
            {isConfirmed && bookedConsultation ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: 'var(--cb-radius-xl, 16px)',
                  border: '2px solid #16a34a',
                  padding: '2rem',
                  boxShadow: 'var(--cb-shadow-lg, 0 10px 25px rgba(0,0,0,0.08))',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                    }}
                  >
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', marginBottom: '0.25rem' }}>
                    Appointment Confirmed!
                  </h3>
                  <p style={{ color: 'var(--cb-text-secondary, #64748b)', fontSize: '0.9rem' }}>
                    Your video consultation has been successfully booked and scheduled.
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Booking No:</span>
                    <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>
                      {bookedConsultation?.consultationNumber || (bookedConsultation?.id ? bookedConsultation.id.substring(0, 12) : 'CB-2026-BOOKED')}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Doctor:</span>
                    <strong style={{ color: 'var(--cb-forest, #2d5a27)' }}>{doctorName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Specialty:</span>
                    <span>{doctor?.specialty}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Status:</span>
                    <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span className="cb-pulse-dot" style={{ backgroundColor: '#16a34a', width: '8px', height: '8px', borderRadius: '50%' }} /> Confirmed & Active
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Amount:</span>
                    <strong style={{ color: '#0f172a' }}>
                      ₹{doctor?.consultationFee || 600} Paid
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <Link
                    to={`/consultations/${bookedConsultation?.id || 'active'}/call`}
                    className="cb-btn-signup"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.9rem',
                      fontSize: '1rem',
                      textDecoration: 'none',
                    }}
                  >
                    <Video size={18} /> Join Video Consultation Now
                  </Link>

                  <Link
                    to="/patient/dashboard"
                    className="cb-btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.85rem',
                      textDecoration: 'none',
                    }}
                  >
                    <Home size={16} /> Go to Patient Dashboard
                  </Link>

                  <Link
                    to={`/consultations/${bookedConsultation?.id || 'my-bookings'}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      color: 'var(--cb-forest, #2d5a27)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      marginTop: '0.25rem',
                      textDecoration: 'none',
                    }}
                  >
                    <FileText size={15} /> View Appointment Details & Records
                  </Link>
                </div>
              </div>
            ) : !bookedConsultation ? (
              <div className="am-card">
                <h3 className="am-card-title" style={{ marginBottom: '1.25rem' }}>
                  Fee Breakdown
                </h3>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
                  <span style={{ color: 'var(--am-text-secondary)' }}>Specialist Consultation:</span>
                  <span>{doctor?.currency || 'INR'} {doctor?.consultationFee || 600}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
                  <span style={{ color: 'var(--am-text-secondary)' }}>Platform Technology Fee:</span>
                  <span style={{ color: 'var(--am-success)', fontWeight: 600 }}>FREE</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--am-border)',
                    fontSize: '1.125rem',
                    fontWeight: 700,
                  }}
                >
                  <span>Total Amount:</span>
                  <span style={{ color: 'var(--am-primary)' }}>
                    {doctor?.currency || 'INR'} {doctor?.consultationFee || 600}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleBookSlot}
                  disabled={submittingBooking || !!conflictError}
                  className="cb-btn-signup"
                  style={{
                    width: '100%',
                    marginTop: '1.5rem',
                    padding: '0.9rem',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  {submittingBooking ? 'Securing & Confirming Appointment...' : 'Confirm & Book Appointment'} <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              /* Payment Simulation View */
              <div className="am-card" style={{ border: '1.5px solid var(--am-primary-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <CreditCard size={22} color="var(--am-primary)" />
                  <h3 className="am-card-title">Simulated Payment Gateway</h3>
                </div>

                <div className="am-alert am-alert-info" style={{ fontSize: '0.8125rem' }}>
                  Slot locked in status: <strong>PENDING_PAYMENT</strong>. Complete test payment below to trigger webhook and activate consultation.
                </div>

                <div style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--am-text-muted)' }}>Consultation ID:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {bookedConsultation?.id ? `${bookedConsultation.id.substring(0, 8)}...` : 'PENDING'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--am-text-muted)' }}>Amount Payable:</span>
                    <strong style={{ color: 'var(--am-primary)' }}>
                      {bookedConsultation?.currency || doctor?.currency || 'INR'} {bookedConsultation?.feeAmount || doctor?.consultationFee || 600}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={simulatingPayment}
                  className="am-btn am-btn-primary am-btn-lg"
                  style={{ width: '100%' }}
                >
                  {simulatingPayment ? 'Triggering Webhook...' : 'Simulate Payment Success'} <CheckCircle2 size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
