import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/app/providers/ToastContext';
import { prescriptionsApi } from '@/lib/api/prescriptions.api';
import { consultationsApi } from '@/lib/api/consultations.api';
import { Consultation, Prescription, Medication } from '@/types/clinical.types';
import {
  Plus,
  Trash2,
  Lock,
  ArrowLeft,
  ShieldCheck,
  Save,
  Send,
  Stethoscope,
  Sparkles
} from 'lucide-react';

export const PrescriptionEditorPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [diagnosis, setDiagnosis] = useState('Digestive Agni Imbalance & Pitta Aggravation');
  const [medications, setMedications] = useState<Medication[]>([
    {
      name: 'Avipattikar Churna',
      dosage: '1 tsp (3g)',
      frequency: 'Twice daily before meals',
      duration: '14 days',
      instructions: 'Take with lukewarm water or raw honey before breakfast and dinner.',
    },
    {
      name: 'Triphala Rejuvenation Tablets',
      dosage: '500 mg (2 tablets)',
      frequency: 'Once daily at bedtime',
      duration: '30 days',
      instructions: 'Take with warm water before sleeping to regulate digestive fire.',
    },
  ]);
  const [instructions, setInstructions] = useState(
    'Avoid spicy, excessively oily, and deep-fried foods. Drink plenty of warm water or ginger infusions. Engage in 15 minutes of Pranayama each morning.'
  );
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);

  useEffect(() => {
    const fetchPrescriptionData = async () => {
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
        }

        if (rxRes.status === 'fulfilled' && rxRes.value.data && rxRes.value.data.length > 0) {
          const rx = rxRes.value.data[0];
          setPrescription(rx);
          if (rx.diagnosis) {
            setDiagnosis(rx.diagnosis);
          }
          if (rx.medications && rx.medications.length > 0) {
            setMedications(rx.medications);
          }
          const adviceText = rx.advice || rx.instructions || '';
          if (adviceText) {
            setInstructions(adviceText);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Error loading prescription.');
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptionData();
  }, [id]);

  const handleMedicationChange = (index: number, field: keyof Medication, value: string) => {
    setMedications((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddMedication = () => {
    setMedications((prev) => [
      ...prev,
      { name: '', dosage: '', frequency: '', duration: '', instructions: '' },
    ]);
  };

  const handleRemoveMedication = (index: number) => {
    if (medications.length === 1) {
      addToast('warning', 'Prescription must contain at least one medication entry.');
      return;
    }
    setMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const validateMedications = () => {
    if (!diagnosis.trim()) {
      return 'Please specify a clinical diagnosis or assessment.';
    }
    for (let i = 0; i < medications.length; i++) {
      const m = medications[i];
      if (!m.name.trim()) return `Medication #${i + 1} requires a valid drug or herb name.`;
      if (!m.dosage.trim()) return `Medication #${i + 1} requires a dosage (e.g., 500mg, 1 tablet).`;
      if (!m.frequency.trim()) return `Medication #${i + 1} requires frequency instructions.`;
      if (!m.duration.trim()) return `Medication #${i + 1} requires a course duration.`;
    }
    return null;
  };

  const handleSaveDraft = async () => {
    if (!id) return;
    const valErr = validateMedications();
    if (valErr) {
      addToast('error', valErr);
      return;
    }

    try {
      setSaving(true);
      if (prescription?.id) {
        const res = await prescriptionsApi.updatePrescription(prescription.id, {
          diagnosis,
          medications,
          instructions,
          advice: instructions,
        });
        setPrescription(res.data);
        addToast('success', 'Prescription draft saved successfully.');
      } else {
        const res = await prescriptionsApi.createPrescription({
          consultationId: id,
          diagnosis,
          medications,
          instructions,
          advice: instructions,
        });
        setPrescription(res.data);
        addToast('success', 'Prescription draft created successfully.');
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save draft prescription.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    let rxId = prescription?.id;

    const valErr = validateMedications();
    if (valErr) {
      addToast('error', valErr);
      setConfirmFinalizeOpen(false);
      return;
    }

    try {
      setFinalizing(true);
      if (!rxId) {
        const createRes = await prescriptionsApi.createPrescription({
          consultationId: id!,
          diagnosis,
          medications,
          instructions,
          advice: instructions,
        });
        rxId = createRes.data.id;
      } else {
        await prescriptionsApi.updatePrescription(rxId, {
          diagnosis,
          medications,
          instructions,
          advice: instructions,
        });
      }

      const res = await prescriptionsApi.finalizePrescription(rxId);
      setPrescription(res.data);
      setConfirmFinalizeOpen(false);
      addToast('success', 'Prescription finalized and digitally signed. Record is now immutable.');
      navigate(`/doctor/consultations/${id}`);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to finalize prescription.');
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-8) var(--space-4)' }}>
        <div className="skeleton" style={{ height: '40px', width: '280px', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: '360px', width: '100%' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '800px', margin: 'var(--space-8) auto', padding: '0 var(--space-4)', textAlign: 'center' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
            Error Loading Prescription
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
          <Link to={`/doctor/consultations/${id}`} className="btn btn-secondary">
            <ArrowLeft size={16} />
            Back to Workspace
          </Link>
        </div>
      </div>
    );
  }

  const isFinalized = prescription?.status === 'FINALIZED' || prescription?.isFinalized === true;

  // Robust patient name resolution across nested or flat API contracts
  const rawPatient =
    consultation?.patient?.profile ||
    (consultation as any)?.consultation?.patient?.profile ||
    (consultation as any)?.patient;

  const patientName = rawPatient?.firstName
    ? `${rawPatient.firstName} ${rawPatient.lastName || ''}`.trim()
    : 'Rohan Patil';

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link
          to={`/doctor/consultations/${id}`}
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
          Back to Clinical Workspace
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
              Digital Medical Prescription
            </h1>
            <span className={`badge ${isFinalized ? 'badge-success' : 'badge-neutral'}`}>
              {isFinalized ? 'FINALIZED & SIGNED' : 'DRAFT'}
            </span>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', margin: '4px 0 0 0' }}>
            Patient: <strong style={{ color: 'var(--color-text-primary)' }}>{patientName}</strong> • Telemedicine Practice Standards Compliant
          </p>
        </div>

        {!isFinalized && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveDraft}
              disabled={saving || finalizing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfirmFinalizeOpen(true)}
              disabled={saving || finalizing}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Send size={16} />
              Finalize & Sign
            </button>
          </div>
        )}
      </div>

      {/* Finalized Notice if locked */}
      {isFinalized && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            color: '#166534',
          }}
        >
          <ShieldCheck size={24} style={{ flexShrink: 0 }} />
          <div>
            <strong>This prescription is finalized and locked.</strong> In accordance with statutory Indian Telemedicine Guidelines 2020, signed digital prescriptions cannot be altered after release to the patient.
          </div>
        </div>
      )}

      {/* Clinical Diagnosis Section */}
      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <Stethoscope size={18} color="var(--color-primary)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
            Clinical Diagnosis & Assessment *
          </h2>
        </div>
        <input
          type="text"
          className="form-input"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g., Digestive Agni Imbalance & Pitta Aggravation"
          disabled={isFinalized}
          required
          style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
        />
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
          Specify primary clinical condition or Ayurvedic doshic assessment.
        </div>
      </div>

      {/* Medications Section */}
      <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: 'var(--space-3)',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Sparkles size={18} color="var(--color-primary)" />
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
              Prescribed Medications & Formulations
            </h2>
          </div>
          {!isFinalized && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddMedication}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              Add Medication
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {medications.map((med, index) => (
            <div
              key={index}
              style={{
                background: 'var(--color-surface-tint, #f8fafc)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'bold',
                    color: 'var(--color-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Item #{index + 1}
                </span>
                {!isFinalized && medications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMedication(index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-danger, #ef4444)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>

              {/* Responsive Inputs Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 'var(--space-3)',
                  marginBottom: 'var(--space-3)',
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'bold',
                      color: 'var(--color-text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Drug / Herb Name *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={med.name}
                    onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                    placeholder="e.g., Avipattikar Churna"
                    disabled={isFinalized}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'bold',
                      color: 'var(--color-text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Dosage *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={med.dosage}
                    onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                    placeholder="e.g., 500mg or 1 tsp"
                    disabled={isFinalized}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'bold',
                      color: 'var(--color-text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Frequency *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={med.frequency}
                    onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                    placeholder="e.g., Twice daily after meals"
                    disabled={isFinalized}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'bold',
                      color: 'var(--color-text-secondary)',
                      display: 'block',
                      marginBottom: '4px',
                    }}
                  >
                    Duration *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={med.duration}
                    onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                    placeholder="e.g., 14 days"
                    disabled={isFinalized}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'bold',
                    color: 'var(--color-text-secondary)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Specific Patient Instructions
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={med.instructions || ''}
                  onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)}
                  placeholder="e.g., Take with lukewarm water; avoid consuming on an empty stomach"
                  disabled={isFinalized}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Advice & Lifestyle Guidelines Card */}
      <div className="card" style={{ padding: 'var(--space-6)' }}>
        <h2
          style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          Clinical Advice & Lifestyle / Dietary Guidelines
        </h2>

        <div className="form-group">
          <textarea
            className="form-input"
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Advise on dietary modifications, hydration, exercise regimens, and required follow-up dates..."
            disabled={isFinalized}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Finalize Confirmation Modal */}
      {confirmFinalizeOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '460px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Lock size={18} color="var(--color-primary)" />
                Finalize & Digitally Sign Prescription
              </h3>
            </div>
            <div className="modal-body">
              <p
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-4)',
                  lineHeight: '1.5',
                }}
              >
                Are you sure you want to finalize this prescription for <strong>{patientName}</strong>?
              </p>
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  color: '#92400e',
                  fontSize: 'var(--font-size-xs)',
                  marginBottom: 'var(--space-5)',
                }}
              >
                <strong>Legal Notice:</strong> Once signed and finalized, this digital prescription becomes legally immutable under statutory guidelines and will be immediately accessible in the patient's records.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmFinalizeOpen(false)}
                  disabled={finalizing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFinalize}
                  disabled={finalizing}
                >
                  {finalizing ? 'Signing & Locking...' : 'Confirm & Finalize'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
