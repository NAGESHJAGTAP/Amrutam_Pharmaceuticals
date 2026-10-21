import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/app/router/ProtectedRoute';

// Public Pages
import { HomePage } from '@/pages/HomePage';
import { DoctorDirectoryPage } from '@/pages/DoctorDirectoryPage';
import { DoctorDetailPage } from '@/pages/DoctorDetailPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { MfaVerifyPage } from '@/pages/MfaVerifyPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Patient Pages
import { PatientDashboardPage } from '@/pages/patient/PatientDashboardPage';
import { PatientConsultationsPage } from '@/pages/patient/PatientConsultationsPage';
import { ConsultationDetailPage } from '@/pages/patient/ConsultationDetailPage';
import { PatientPrescriptionsPage } from '@/pages/patient/PatientPrescriptionsPage';
import { PatientProfilePage } from '@/pages/patient/PatientProfilePage';
import { BookingCheckoutPage } from '@/pages/patient/BookingCheckoutPage';

// Doctor Pages
import { DoctorDashboardPage } from '@/pages/doctor/DoctorDashboardPage';
import { DoctorAvailabilityPage } from '@/pages/doctor/DoctorAvailabilityPage';
import { DoctorConsultationWorkspace } from '@/pages/doctor/DoctorConsultationWorkspace';
import { PrescriptionEditorPage } from '@/pages/doctor/PrescriptionEditorPage';

// Admin Pages
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';

// Clinical Telemedicine Video Call Room
import { VideoCallRoomPage } from '@/pages/consultation/VideoCallRoomPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Dedicated Clinical Video Call Room Route (Full viewport) */}
      <Route
        path="/consultations/:id/call"
        element={
          <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN']}>
            <VideoCallRoomPage />
          </ProtectedRoute>
        }
      />

      <Route element={<AppLayout />}>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/mfa-verify" element={<MfaVerifyPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        {/* Authenticated Doctor Directory & Consultation Booking Routes */}
        <Route
          path="/doctors"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN']}>
              <DoctorDirectoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctors/:id"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN']}>
              <DoctorDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctors/:doctorId"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN']}>
              <DoctorDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Patient Portal Routes */}
        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/consultations"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <PatientConsultationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/consultations/:id"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <ConsultationDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/prescriptions"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <PatientPrescriptionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <PatientProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/booking/:slotId"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <BookingCheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/book/:slotId"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <BookingCheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/book/:doctorId/:slotId"
          element={
            <ProtectedRoute allowedRoles={['PATIENT', 'ADMIN']}>
              <BookingCheckoutPage />
            </ProtectedRoute>
          }
        />

        {/* Doctor Clinical Portal Routes */}
        <Route
          path="/doctor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
              <DoctorDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/availability"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
              <DoctorAvailabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/consultations/:id"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
              <DoctorConsultationWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/consultations/:id/prescription"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
              <PrescriptionEditorPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Operational Portal */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Catch-All */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
