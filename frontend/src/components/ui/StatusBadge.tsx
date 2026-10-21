import React from 'react';
import { ConsultationStatus, PrescriptionStatus, SlotStatus, PaymentStatus } from '@/types/clinical.types';

interface StatusBadgeProps {
  status: ConsultationStatus | PrescriptionStatus | SlotStatus | PaymentStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normStatus = status?.toUpperCase();

  let badgeClass = 'am-badge-neutral';
  let label = status;

  switch (normStatus) {
    case 'SCHEDULED':
    case 'CONFIRMED':
    case 'COMPLETED':
    case 'FINALIZED':
    case 'AVAILABLE':
    case 'ACTIVE':
    case 'VERIFIED':
      badgeClass = 'am-badge-success';
      label = normStatus === 'AVAILABLE' ? 'Open' : normStatus === 'SCHEDULED' ? 'Scheduled' : normStatus.replace('_', ' ');
      break;

    case 'PENDING_PAYMENT':
    case 'PENDING':
    case 'RESERVED':
      badgeClass = 'am-badge-warning';
      label = normStatus === 'PENDING_PAYMENT' ? 'Pending Payment' : normStatus;
      break;

    case 'IN_PROGRESS':
    case 'DRAFT':
      badgeClass = 'am-badge-info';
      label = normStatus.replace('_', ' ');
      break;

    case 'CANCELLED':
    case 'FAILED':
    case 'REJECTED':
      badgeClass = 'am-badge-danger';
      label = normStatus;
      break;

    default:
      badgeClass = 'am-badge-neutral';
      label = status;
  }

  return (
    <span className={`am-badge ${badgeClass} ${size === 'sm' ? 'am-badge-sm' : ''}`}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          opacity: 0.8,
        }}
      />
      {label}
    </span>
  );
};
