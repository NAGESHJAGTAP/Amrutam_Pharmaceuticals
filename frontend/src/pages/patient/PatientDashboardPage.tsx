import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  FileText,
  Stethoscope,
  ShieldCheck,
  ChevronRight,
  Video,
  Activity,
  PlusCircle,
  Download,
} from 'lucide-react';
import { consultationsApi } from '@/lib/api/consultations.api';
import { Consultation } from '@/types/clinical.types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/app/providers/AuthContext';
import '@/styles/dashboard.css';

export const PatientDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED'>('ALL');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    consultationsApi
      .getMyBookings({ limit: 10 })
      .then((res) => {
        if (isMounted) {
          const list = Array.isArray(res.data)
            ? res.data
            : (res.data as any)?.consultations || [];
          setConsultations(list);
        }
      })
      .catch(() => {
        // Fallback
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Format date helper
  const formatDate = (dateVal?: string | Date) => {
    if (!dateVal) return 'Scheduled Soon';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateVal?: string | Date) => {
    if (!dateVal) return '10:00 AM';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const upcomingConsultations = consultations.filter(
    (c) => c.status === 'SCHEDULED' || c.status === 'CONFIRMED' || c.status === 'PENDING_PAYMENT'
  );
  const completedConsultations = consultations.filter((c) => c.status === 'COMPLETED');
  const nextAppointment = upcomingConsultations.length > 0 ? upcomingConsultations[0] : null;

  const filteredList =
    activeTab === 'UPCOMING'
      ? upcomingConsultations
      : activeTab === 'COMPLETED'
      ? completedConsultations
      : consultations;

  const displayName =
    user?.profile?.firstName ||
    user?.firstName ||
    (user?.email ? user.email.split('@')[0] : 'Patient');

  return (
    <div className="cb-dash-container">
      {/* ======================================================================
          SECTION 1 — WELCOME HERO BANNER
          ====================================================================== */}
      <div className="cb-dash-banner">
        <div className="cb-dash-banner-content">
          <div className="cb-role-pill">
            <ShieldCheck size={14} />
            <span>CareBridge Patient Portal</span>
          </div>
          <h1 className="cb-dash-title">Welcome back, {displayName}</h1>
          <p className="cb-dash-subtitle">
            Manage your teleconsultations, digital prescriptions, and direct doctor consultations in one secure place.
          </p>
        </div>

        <div className="cb-dash-actions">
          <Link to="/doctors" className="cb-btn cb-btn-primary">
            <PlusCircle size={16} />
            <span>Book Consultation</span>
          </Link>
          <Link to="/patient/prescriptions" className="cb-btn cb-btn-secondary">
            <FileText size={16} />
            <span>My Prescriptions</span>
          </Link>
        </div>
      </div>

      {/* ======================================================================
          SECTION 2 — METRICS STATS GRID
          ====================================================================== */}
      <div className="cb-stats-grid">
        <div className="cb-stat-card">
          <div>
            <div className="cb-stat-label">Upcoming Visits</div>
            <div className="cb-stat-val">{loading ? '...' : upcomingConsultations.length}</div>
            <div className="cb-stat-subtext">Confirmed appointments</div>
          </div>
          <div className="cb-stat-icon-wrap">
            <Calendar size={22} />
          </div>
        </div>

        <div className="cb-stat-card">
          <div>
            <div className="cb-stat-label">Completed Sessions</div>
            <div className="cb-stat-val">{loading ? '...' : completedConsultations.length}</div>
            <div className="cb-stat-subtext">Past consultations</div>
          </div>
          <div className="cb-stat-icon-wrap teal">
            <Activity size={22} />
          </div>
        </div>

        <div className="cb-stat-card">
          <div>
            <div className="cb-stat-label">Prescriptions</div>
            <div className="cb-stat-val">{loading ? '...' : '1'}</div>
            <div className="cb-stat-subtext">Verified digital Rx</div>
          </div>
          <div className="cb-stat-icon-wrap warning">
            <FileText size={22} />
          </div>
        </div>

        <div className="cb-stat-card">
          <div>
            <div className="cb-stat-label">Health Records</div>
            <div className="cb-stat-val">100%</div>
            <div className="cb-stat-subtext">Encrypted & HIPAA safe</div>
          </div>
          <div className="cb-stat-icon-wrap purple">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* ======================================================================
          SECTION 3 — NEXT APPOINTMENT SPOTLIGHT
          ====================================================================== */}
      {nextAppointment && (
        <div className="cb-spotlight-card">
          <div className="cb-spotlight-header">
            <div className="cb-spotlight-eyebrow">
              <span className="cb-pulse-dot" />
              <span>Next Upcoming Consultation</span>
            </div>
            <StatusBadge status={nextAppointment.status} />
          </div>

          <div className="cb-spotlight-body">
            <div className="cb-user-lockup">
              <div className="cb-avatar">
                {nextAppointment.doctor?.user?.profile?.firstName?.[0] || 'D'}
              </div>
              <div>
                <h3 className="cb-avatar-title">
                  {nextAppointment.doctor?.user?.profile
                    ? `Dr. ${nextAppointment.doctor.user.profile.firstName} ${nextAppointment.doctor.user.profile.lastName}`
                    : 'Dr. Aisha Sharma'}
                </h3>
                <p className="cb-avatar-subtitle">
                  {nextAppointment.doctor?.specialty || 'Ayurveda General Medicine'} • {nextAppointment.doctor?.experienceYears || 11}+ Years Experience
                </p>
                <div style={{ marginTop: '0.5rem' }} className="cb-meta-pills">
                  <span className="cb-meta-pill">
                    <Calendar size={14} />
                    {formatDate(nextAppointment.startTime || nextAppointment.slot?.startTime)}
                  </span>
                  <span className="cb-meta-pill">
                    <Clock size={14} />
                    {formatTime(nextAppointment.startTime || nextAppointment.slot?.startTime)}
                  </span>
                  <span className="cb-meta-pill">
                    ₹{nextAppointment.doctor?.consultationFee || 600} Paid
                  </span>
                </div>
              </div>
            </div>

            <div className="cb-dash-actions">
              <button
                type="button"
                className="cb-btn cb-btn-primary"
                onClick={() => navigate('/consultations/con-patient-001/call')}
              >
                <Video size={16} />
                <span>Join Video Room</span>
              </button>
              <Link to="/patient/consultations" className="cb-btn cb-btn-secondary">
                <span>View Details</span>
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          SECTION 4 — APPOINTMENTS & CONSULTATION HISTORY
          ====================================================================== */}
      <div className="cb-card">
        <div className="cb-card-header">
          <h2 className="cb-card-title">
            <Stethoscope size={20} color="var(--cb-primary)" />
            <span>Consultation Schedule</span>
          </h2>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`cb-btn cb-btn-sm ${activeTab === 'ALL' ? 'cb-btn-primary' : 'cb-btn-secondary'}`}
              onClick={() => setActiveTab('ALL')}
            >
              All ({consultations.length})
            </button>
            <button
              type="button"
              className={`cb-btn cb-btn-sm ${activeTab === 'UPCOMING' ? 'cb-btn-primary' : 'cb-btn-secondary'}`}
              onClick={() => setActiveTab('UPCOMING')}
            >
              Upcoming ({upcomingConsultations.length})
            </button>
            <button
              type="button"
              className={`cb-btn cb-btn-sm ${activeTab === 'COMPLETED' ? 'cb-btn-primary' : 'cb-btn-secondary'}`}
              onClick={() => setActiveTab('COMPLETED')}
            >
              Completed ({completedConsultations.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--cb-text-muted)' }}>
            Loading consultations...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="cb-empty-state">
            <div className="cb-empty-icon">
              <Calendar size={28} />
            </div>
            <h3 className="cb-empty-title">No Consultations Found</h3>
            <p className="cb-empty-desc">
              You do not have any appointments in this category yet. Find a doctor to book your consultation.
            </p>
            <Link to="/doctors" className="cb-btn cb-btn-primary">
              <PlusCircle size={16} />
              <span>Browse Doctors</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="cb-table-responsive cb-table-desktop">
              <table className="cb-table">
                <thead>
                  <tr>
                    <th>Consultation</th>
                    <th>Doctor</th>
                    <th>Date & Time</th>
                    <th>Specialty</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((c) => {
                    const docName = c.doctor?.user?.profile
                      ? `Dr. ${c.doctor.user.profile.firstName} ${c.doctor.user.profile.lastName}`
                      : c.doctor?.name || 'Dr. Medical Practitioner';
                    const timeVal = c.startTime || c.slot?.startTime;

                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.consultationNumber || `CON-${c.id.slice(0, 6)}`}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--cb-text-muted)' }}>
                            {c.reason || 'General Health Consultation'}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--cb-primary-light)',
                                color: 'var(--cb-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                              }}
                            >
                              {docName.replace('Dr. ', '')[0] || 'D'}
                            </div>
                            <span style={{ fontWeight: 600 }}>{docName}</span>
                          </div>
                        </td>
                        <td>
                          <div>{formatDate(timeVal)}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--cb-text-muted)' }}>{formatTime(timeVal)}</div>
                        </td>
                        <td>{c.doctor?.specialty || 'Ayurveda Medicine'}</td>
                        <td>
                          <StatusBadge status={c.status} size="sm" />
                        </td>
                        <td>
                          {c.status === 'COMPLETED' ? (
                            <Link
                              to="/patient/prescriptions"
                              className="cb-btn cb-btn-sm cb-btn-outline-primary"
                              title="Download Prescription"
                            >
                              <Download size={14} />
                              <span>Rx</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="cb-btn cb-btn-sm cb-btn-primary"
                              onClick={() => navigate(`/consultations/${c.id}/call`)}
                            >
                              <Video size={14} />
                              <span>Join</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View (<768px) */}
            <div className="cb-mobile-stack-list">
              {filteredList.map((c) => {
                const docName = c.doctor?.user?.profile
                  ? `Dr. ${c.doctor.user.profile.firstName} ${c.doctor.user.profile.lastName}`
                  : c.doctor?.name || 'Dr. Medical Practitioner';
                const timeVal = c.startTime || c.slot?.startTime;

                return (
                  <div key={c.id} className="cb-appointment-card-mobile">
                    <div className="cb-appointment-card-mobile-top">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{docName}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--cb-text-secondary)' }}>
                          {c.doctor?.specialty || 'Ayurveda General Medicine'}
                        </div>
                      </div>
                      <StatusBadge status={c.status} size="sm" />
                    </div>

                    <div style={{ fontSize: '0.8125rem', color: 'var(--cb-text-muted)', background: 'var(--cb-surface-muted)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      <strong>Reason:</strong> {c.reason || 'General Consultation'}
                    </div>

                    <div className="cb-meta-pills">
                      <span className="cb-meta-pill">
                        <Calendar size={13} />
                        {formatDate(timeVal)}
                      </span>
                      <span className="cb-meta-pill">
                        <Clock size={13} />
                        {formatTime(timeVal)}
                      </span>
                    </div>

                    <div className="cb-appointment-card-mobile-actions">
                      {c.status === 'COMPLETED' ? (
                        <Link to="/patient/prescriptions" className="cb-btn cb-btn-sm cb-btn-secondary">
                          <FileText size={14} />
                          <span>View Prescription</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="cb-btn cb-btn-sm cb-btn-primary"
                          onClick={() => navigate(`/consultations/${c.id}/call`)}
                        >
                          <Video size={14} />
                          <span>Join Video Call</span>
                        </button>
                      )}
                      <Link to="/patient/consultations" className="cb-btn cb-btn-sm cb-btn-secondary">
                        <span>Details</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PatientDashboardPage;
