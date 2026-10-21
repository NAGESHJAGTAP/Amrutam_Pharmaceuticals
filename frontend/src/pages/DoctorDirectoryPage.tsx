import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ArrowUpDown, Star, ArrowRight, UserCheck } from 'lucide-react';
import { doctorsApi } from '@/lib/api/doctors.api';
import { Doctor } from '@/types/clinical.types';
import '@/styles/home.css';

const SPECIALTIES = [
  'All',
  'General Physician',
  'Dermatologist',
  'Pediatrician',
  'Gynecologist',
  'Cardiologist',
  'Orthopedic',
  'Neurologist',
  'ENT',
  'Ayurveda General Medicine',
  'Panchakarma & Detox',
  'Ayurvedic Dermatology',
];

export const DoctorDirectoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState<'fee_asc' | 'fee_desc' | 'exp_desc'>('exp_desc');

  const selectedSpecialty = searchParams.get('specialty') || 'All';

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const specialtyParam = selectedSpecialty !== 'All' ? selectedSpecialty : undefined;

    doctorsApi
      .searchDoctors({ specialty: specialtyParam, limit: 30 })
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setDoctors(res.data);
        }
      })
      .catch(() => {
        // Handled: empty list
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSpecialty]);

  const handleSpecialtyChange = (specialty: string) => {
    if (specialty === 'All') {
      searchParams.delete('specialty');
    } else {
      searchParams.set('specialty', specialty);
    }
    setSearchParams(searchParams);
  };

  const filteredDoctors = useMemo(() => {
    let list = [...doctors];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((doc) => {
        const fullName = `${doc.user?.profile?.firstName || ''} ${doc.user?.profile?.lastName || ''}`.toLowerCase();
        const specialty = (doc.specialty || '').toLowerCase();
        const license = (doc.licenseNumber || '').toLowerCase();
        return fullName.includes(q) || specialty.includes(q) || license.includes(q);
      });
    }

    if (sortBy === 'fee_asc') {
      list.sort((a, b) => Number(a.consultationFee) - Number(b.consultationFee));
    } else if (sortBy === 'fee_desc') {
      list.sort((a, b) => Number(b.consultationFee) - Number(a.consultationFee));
    } else if (sortBy === 'exp_desc') {
      list.sort((a, b) => b.experienceYears - a.experienceYears);
    }

    return list;
  }, [doctors, searchTerm, sortBy]);

  return (
    <div style={{ padding: '3.5rem 0 5rem 0', minHeight: '80vh', backgroundColor: 'var(--cb-bg)' }}>
      <div className="cb-container">
        {/* Page Header */}
        <div style={{ maxWidth: '640px', marginBottom: '2.5rem' }}>
          <div className="cb-section-eyebrow">
            <span className="cb-section-eyebrow-bar" />
            <span>Find Verified Doctors</span>
          </div>
          <h1 className="cb-section-heading">Find the Right Doctor for Your Health Needs</h1>
          <p className="cb-section-subheading">
            Browse verified clinical specialists, inspect real-time consultation fees, and book guaranteed appointment slots.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 'var(--cb-radius-xl)',
            border: '1px solid var(--cb-border)',
            padding: '1.25rem 1.5rem',
            marginBottom: '2.5rem',
            boxShadow: 'var(--cb-shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: '480px' }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cb-text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search by doctor name or specialty..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.4rem',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--cb-radius-pill)',
                  border: '1px solid var(--cb-border)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowUpDown size={16} color="var(--cb-text-muted)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--cb-text-secondary)', fontWeight: 600 }}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--cb-radius-md)',
                  border: '1px solid var(--cb-border)',
                  backgroundColor: '#ffffff',
                  color: 'var(--cb-text-primary)',
                  cursor: 'pointer',
                }}
              >
                <option value="exp_desc">Most Experienced</option>
                <option value="fee_asc">Consultation Fee: Low to High</option>
                <option value="fee_desc">Consultation Fee: High to Low</option>
              </select>
            </div>
          </div>

          {/* Specialty Filter Pills */}
          <div className="cb-specialty-pills-wrap" style={{ marginBottom: 0 }}>
            {SPECIALTIES.map((spec) => (
              <button
                key={spec}
                type="button"
                className={`cb-specialty-pill ${selectedSpecialty === spec ? 'active' : ''}`}
                onClick={() => handleSpecialtyChange(spec)}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Doctor Grid */}
        {loading ? (
          <div style={{ padding: '4rem 0', textAlign: 'center' }}>
            <div className="cb-pulse-dot" style={{ margin: '0 auto 1rem', width: '16px', height: '16px' }} />
            <div style={{ color: 'var(--cb-text-secondary)', fontSize: '0.95rem' }}>
              Loading verified doctor profiles...
            </div>
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              background: '#ffffff',
              borderRadius: 'var(--cb-radius-xl)',
              border: '1px solid var(--cb-border)',
            }}
          >
            <UserCheck size={48} color="var(--cb-text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--cb-text-primary)', marginBottom: '0.5rem' }}>
              No Doctors Found Matching Your Filter
            </h3>
            <p style={{ color: 'var(--cb-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Try clearing your search query or selecting "All" specialties to see all available practitioners.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                handleSpecialtyChange('All');
              }}
              className="cb-btn-signup"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="cb-doctor-grid">
            {filteredDoctors.map((doc, idx) => {
              const rawName = doc.name || (doc.user?.profile?.firstName ? `${doc.user.profile.firstName} ${doc.user.profile.lastName}` : 'Specialist Doctor');
              const doctorDisplayName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`;

              return (
                <div key={doc.id} className="cb-doctor-card">
                  <div className="cb-doctor-card-media">
                    <img
                      src={idx % 2 === 0 ? '/images/doctor-male.jpg' : '/images/hero-doctor.jpg'}
                      alt={doctorDisplayName}
                      className="cb-doctor-card-img"
                    />
                    <div className="cb-availability-badge">
                      <span className="cb-pulse-dot" /> Available Today
                    </div>
                  </div>

                  <div className="cb-doctor-card-body">
                    <h3 className="cb-doc-card-name">
                      {doctorDisplayName}
                    </h3>
                    <div className="cb-doc-card-specialty">{doc.specialty}</div>

                  <div className="cb-doc-card-meta-row">
                    <div className="cb-doc-card-rating">
                      <Star size={15} fill="#EAB308" color="#EAB308" />
                      <span>4.9 (180+ reviews)</span>
                    </div>
                    <div>{doc.experienceYears}+ Years Exp.</div>
                  </div>

                  <div className="cb-doc-card-fee-wrap">
                    <span className="cb-doc-card-fee">₹{doc.consultationFee}</span>
                    <span className="cb-doc-card-fee-sub">Consultation Fee</span>
                  </div>

                  <Link to={`/doctors/${doc.id}`} className="cb-doc-card-cta">
                    Book Appointment <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
};
