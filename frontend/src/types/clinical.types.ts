import { User } from './auth.types';

export type SlotStatus = 'AVAILABLE' | 'RESERVED' | 'BOOKED' | 'CANCELLED';

export interface AvailabilitySlot {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  createdAt?: string;
}

export interface Doctor {
  id: string;
  userId: string;
  licenseNumber: string;
  specialty: string;
  experienceYears: number;
  consultationFee: number;
  currency: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  user: {
    id: string;
    email: string;
    phone?: string;
    profile?: {
      firstName: string;
      lastName: string;
      dateOfBirth?: string;
      gender?: string;
    };
  };
  name?: string;
  email?: string;
  slots?: AvailabilitySlot[];
}

export type ConsultationStatus =
  | 'PENDING_PAYMENT'
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Consultation {
  id: string;
  consultationNumber?: string;
  patientId: string;
  doctorId: string;
  slotId: string;
  status: ConsultationStatus;
  reason?: string;
  notes?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  feeAmount?: number;
  currency?: string;
  paymentReference?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  patient?: User;
  doctor?: Doctor;
  slot?: AvailabilitySlot;
  prescription?: Prescription;
  prescriptions?: Prescription[];
  payment?: Payment;
}

export type PrescriptionStatus = 'DRAFT' | 'FINALIZED';

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  consultationId: string;
  doctorId: string;
  patientId: string;
  status: PrescriptionStatus;
  isFinalized?: boolean;
  diagnosis?: string;
  advice?: string;
  instructions?: string;
  medications: Medication[];
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
  doctor?: Doctor;
  consultation?: Consultation;
}

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface Payment {
  id: string;
  consultationId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentReference: string;
  providerReference?: string;
  provider?: string;
  createdAt: string;
  updatedAt: string;
}
