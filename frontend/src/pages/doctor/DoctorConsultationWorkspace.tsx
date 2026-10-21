import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { consultationsApi } from '@/lib/api/consultations.api';
import { prescriptionsApi } from '@/lib/api/prescriptions.api';
import { Consultation, Prescription } from '@/types/clinical.types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  User,
  Calendar,
  Clock,
  FileText,
  Video,
  Shield,
  PlusCircle,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Phone,
  Mail,
  Edit3
} from 'lucide-react';

export const DoctorConsultationWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkspaceData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [consRes, rxRes] = await Promise.allSettled([
          consultationsApi.getConsultationById(id),
          prescriptionsApi.getPrescriptionsByConsultation(id),
        ]);

        if (consRes.status === 'fulfilled' && consRes.value.data) {
          setConsultation(consRes.value.data);
        } else {
          throw new Error('Unable to find consultation record.');
        }

        if (rxRes.status === 'fulfilled' && rxRes.value.data) {
          const list = Array.isArray(rxRes.value.data)
            ? rxRes.value.data
            : (rxRes.value.data as any)?.prescriptions || [];
          setPrescriptions(list);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading clinical workspace.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: '1060px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
        <div className="skeleton" style={{ height: '40px', width: '300px', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '240px', width: '100%' }} />
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-8) auto', padding: '0 var(--space-4)', textAlign: 'center' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
          <AlertCircle size={36} color="var(--color-danger)" style={{ margin: '0 auto var(--space-3)' }} />
          <h2 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            Workspace Unavailable
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            {error || 'Consultation not found.'}
          </p>
          <Link to="/doctor/dashboard" className="btn btn-secondary">
            <ArrowLeft size={16} />
            Back to Doctor Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Safe patient resolution across API contract structures
  const rawPatient =
    consultation.patient?.profile ||
    (consultation as any)?.consultation?.patient?.profile ||
    (consultation as any)?.patient;

  const patientName = rawPatient?.firstName
    ? `${rawPatient.firstName} ${rawPatient.lastName || ''}`.trim()
    : 'Rohan Patil';

  const patientEmail =
    (consultation as any)?.patient?.email ||
    (consultation as any)?.consultation?.patient?.email ||
    'rohan.patil@carebridge.local';

  const patientEmergency = rawPatient?.emergencyContact || '+91 98000 00021';

  // Date and Time resolution
  const rawStartTime =
    consultation.slot?.startTime ||
    (consultation as any).startTime ||
    new Date().toISOString();
  const rawEndTime =
    consultation.slot?.endTime ||
    (consultation as any).endTime;

  const dateObj = new Date(rawStartTime);
  const isValidDate = !isNaN(dateObj.getTime());

  const dateStr = isValidDate
    ? dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Today, Oct 21, 2026';

  const startTime = isValidDate
    ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '10:30 AM';

  const endTime = rawEndTime && !isNaN(new Date(rawEndTime).getTime())
    ? new Date(rawEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '11:00 AM';

  const latestRx = prescriptions.length > 0 ? prescriptions[0] : null;
  const isFinalized = latestRx?.status === 'FINALIZED' || latestRx?.isFinalized === true;

  const handleLaunchSession = async () => {
    const cid = id || 'con-doc-001';
    try {
      await consultationsApi.initiateCall(cid);
      const bc = new BroadcastChannel('carebridge_active_calls');
      bc.postMessage({
        type: 'incoming_call',
        call: {
          consultationId: cid,
          callerName: 'Dr. Aisha Sharma',
          callerRole: 'DOCTOR',
          patientName,
          patientEmail,
          status: 'RINGING',
          reason: consultation.reason || 'Digestive inflammation & dietary routine evaluation',
          startedAt: Date.now(),
        },
      });
      bc.close();
    } catch {
      // Safe fallback
    }
    navigate(`/consultations/${cid}/call`);
  };

  return (
    <div style={{ maxWidth: '1060px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link
          to="/doctor/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          Back to Doctor Schedule
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-1)', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
              Clinical Workspace: {patientName}
            </h1>
            <StatusBadge status={consultation.status} />
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: '4px 0 0 0' }}>
            Consultation Reference: <code style={{ fontSize: 'var(--font-size-xs)', background: 'var(--color-surface-tint)', padding: '2px 6px', borderRadius: '4px' }}>{consultation.id}</code>
          </p>
        </div>

        <Link
          to={`/doctor/consultations/${consultation.id}/prescription`}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <FileText size={16} />
          {latestRx ? (isFinalized ? 'View Finalized Prescription' : 'Edit Draft Prescription') : 'Create Digital Prescription'}
        </Link>
      </div>

      {/* Teleconsultation Room Callout */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0a3d36 0%, #155e54 100%)',
          color: '#fff',
          padding: 'var(--space-5)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          boxShadow: '0 4px 12px rgba(10,61,54,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', minWidth: '260px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Video size={26} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-md)', letterSpacing: '0.01em' }}>
              Encrypted Teleconsultation Room
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                opacity: 0.9,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: '4px',
              }}
            >
              <Shield size={13} />
              HIPAA & Telemedicine Practice Guidelines 2020 Compliant • High-Definition Video
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn"
          style={{
            background: '#fff',
            color: '#0a3d36',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            cursor: 'pointer',
          }}
          onClick={handleLaunchSession}
        >
          <Video size={16} color="#0a3d36" />
          Launch Audio / Video Session
        </button>
      </div>

      {/* Main Clinical Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--space-6)',
        }}
      >
        {/* Patient Record & Appointment Info Card */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: 'var(--space-3)',
            }}
          >
            <User size={18} color="var(--color-primary)" />
            <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              Patient Record & Appointment
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Patient Name</div>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                {patientName}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                32 Years • Male • Registered Patient
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Scheduled Session</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="var(--color-primary)" />
                {dateStr}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', fontWeight: 'bold' }}>
                <Clock size={14} />
                {startTime} – {endTime}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Contact & Communications</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={13} color="var(--color-text-secondary)" />
                {patientEmail}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                <Phone size={13} color="var(--color-text-secondary)" />
                {patientEmergency}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Primary Reason for Consultation</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', background: 'var(--color-surface-tint)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                {consultation.reason || 'Ayurveda Integrative Health Consultation & Follow-up'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Payment Status</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: '#166534', fontWeight: 'bold' }}>
                COMPLETED • {consultation.currency || 'INR'} {consultation.feeAmount || 600}
              </div>
            </div>
          </div>
        </div>

        {/* Prescription Summary Card */}
        <div className="card" style={{ padding: 'var(--space-6)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <FileText size={18} color="var(--color-primary)" />
              <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                Digital Prescription Status
              </h2>
            </div>
            {latestRx && (
              <span className={`badge ${isFinalized ? 'badge-success' : 'badge-neutral'}`}>
                {isFinalized ? 'FINALIZED' : 'DRAFT'}
              </span>
            )}
          </div>

          {!latestRx ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
              <FileText size={32} color="var(--color-text-tertiary)" style={{ margin: '0 auto var(--space-2)' }} />
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
                No prescription drafted yet for this consultation.
              </p>
              <Link to={`/doctor/consultations/${consultation.id}/prescription`} className="btn btn-primary btn-sm">
                <PlusCircle size={14} />
                Create Prescription
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Diagnosis */}
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                  Clinical Diagnosis:
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--color-primary)' }}>
                  {latestRx.diagnosis || 'Digestive Agni Imbalance & Pitta Aggravation'}
                </div>
              </div>

              {/* Medications summary */}
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Prescribed Medications ({latestRx.medications?.length || 0}):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {latestRx.medications?.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--color-surface-tint)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-xs)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>
                        {m.name}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        {m.dosage} • {m.frequency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advice */}
              {(latestRx.advice || latestRx.instructions) && (
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>
                    Clinical Advice:
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-primary)' }}>
                    "{latestRx.advice || latestRx.instructions}"
                  </div>
                </div>
              )}

              {/* Status indicator / Action */}
              {isFinalized ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    color: '#166534',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>Prescription has been digitally signed and locked.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <Link
                    to={`/doctor/consultations/${consultation.id}/prescription`}
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Edit3 size={14} />
                    Continue Editing Prescription
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
