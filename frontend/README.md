# CareBridge — Full-Stack Telemedicine Platform Frontend

A production-quality digital healthcare interface engineered for **CareBridge Telehealth**. Built with **React 18**, **Vite**, **TypeScript (Strict Mode)**, **Axios**, **React Router v6**, and a custom Vanilla CSS design system.

The visual design is faithfully inspired by the modern healthcare benchmark while embodying CareBridge's original identity, colors, and verified backend integrations.

---

## 1. Architectural Philosophy & Design System

The CareBridge frontend merges clinical reliability, security compliance, and trustworthy patient ergonomics.

- **Primary Colors:**
  - Primary Forest Green: `#0B5D3B` (hover: `#084A30`)
  - Dark Green: `#084A30`
  - Secondary Healthcare Teal: `#329CB3`
  - Soft Mint: `#EAF5EF`
  - Background Canvas: `#F7F9F7`
  - Clean White Surfaces: `#FFFFFF`
  - Main Text: `#17231D`
  - Secondary Text: `#68756E`
  - Border: `#E1E8E3`
- **Typography:**
  - Interface Typography: *Plus Jakarta Sans* (clarity, modern legibility)
  - Editorial Accents: *Playfair Display*
  - Handwritten Script: *Caveat* (for trust touches like "Better Health Brighter Tomorrow")
- **Design Tokens:** Defined centrally in `src/styles/tokens.css` with semantic CSS custom properties.
- **Iconography:** Lucide React icons used consistently across public, patient, doctor, and admin interfaces.

---

## 2. Directory Structure

```text
frontend/
├── index.html                     # Semantic HTML5 entrypoint with Google Fonts
├── package.json                   # React 18, React Router v6, Axios, Lucide React
├── tsconfig.json                  # Strict TypeScript configuration with @/* alias
├── vite.config.ts                 # Dev server on :3000 with backend proxy to :4000
├── public/
│   └── images/
│       ├── hero-doctor.jpg        # High-resolution healthcare specialist hero banner
│       └── doctor-male.jpg        # Professional doctor portrait for directory cards
└── src/
    ├── app/
    │   ├── providers/
    │   │   ├── AuthContext.tsx    # Session management, token storage & event listeners
    │   │   └── ToastContext.tsx   # Live region accessible notifications
    │   └── router/
    │       ├── AppRoutes.tsx      # Declarative routing with layout outlet
    │       └── ProtectedRoute.tsx # Role-aware route guards (PATIENT, DOCTOR, ADMIN)
    ├── components/
    │   ├── layout/
    │   │   ├── Navbar.tsx         # Responsive CareBridge header with search & user menu
    │   │   ├── Footer.tsx         # CareBridge footer with newsletter & compliance badges
    │   │   └── AppLayout.tsx      # Main page shell wrapper
    │   └── ui/
    │       └── StatusBadge.tsx    # Semantic appointment & slot status indicators
    ├── lib/
    │   └── api/
    │       ├── client.ts          # Centralized Axios with correlation IDs & silent refresh
    │       ├── auth.api.ts        # Register, login, MFA verify/setup, change-password
    │       ├── doctors.api.ts     # Search practitioners, doctor profiles & slot queries
    │       ├── consultations.api.ts # Booking with idempotency keys, schedule & cancel
    │       ├── prescriptions.api.ts # Digital Rx drafting, medication rows & finalization
    │       └── payments.api.ts    # Consultation payment status & webhook simulation
    ├── pages/
    │   ├── HomePage.tsx           # Full landing page recreating reference sections
    │   ├── DoctorDirectoryPage.tsx# Specialty pills, search, sort & doctor cards
    │   ├── DoctorDetailPage.tsx   # Doctor bio, clinical fee & slot selection grid
    │   ├── LoginPage.tsx          # Argon2id authentication, role entry tabs & quick-fill
    │   ├── RegisterPage.tsx       # Patient onboarding form with strict password validation
    │   ├── MfaVerifyPage.tsx      # TOTP 6-digit challenge confirmation
    │   ├── ForbiddenPage.tsx      # 403 clinical permission boundary
    │   ├── NotFoundPage.tsx       # 404 resource missing page
    │   ├── patient/
    │   │   ├── PatientDashboardPage.tsx    # Next consultation spotlight & quick actions
    │   │   ├── PatientConsultationsPage.tsx # Filterable appointment tabs & cancel modal
    │   │   ├── ConsultationDetailPage.tsx  # Timeline, payments & clinical status
    │   │   ├── PatientPrescriptionsPage.tsx# Prescribed medications table & print view
    │   │   ├── PatientProfilePage.tsx      # Account credentials & TOTP MFA setup modal
    │   │   └── BookingCheckoutPage.tsx     # Atomic slot booking with Idempotency-Key
    │   ├── doctor/
    │   │   ├── DoctorDashboardPage.tsx     # Today's queue, appointment metrics & schedule
    │   │   ├── DoctorAvailabilityPage.tsx  # Slot creator with 30-min duration steps
    │   │   ├── DoctorConsultationWorkspace.tsx # Clinical workspace & teleconsult callout
    │   │   └── PrescriptionEditorPage.tsx  # Multi-medication dynamic editor & signed locking
    │   └── admin/
    │       └── AdminDashboardPage.tsx      # Real-time healthz, readyz & doctor registry
    ├── styles/
    │   ├── tokens.css             # Color, typography, spacing & transition design tokens
    │   ├── reset.css              # Modern CSS reset & accessibility focus rings
    │   ├── components.css         # Buttons, badges, cards, tables, forms & modals
    │   ├── global.css             # Application layout & navigation styles
    │   └── home.css               # Landing page layouts matching reference structure
    └── types/
        ├── api.types.ts           # ApiResponse, ApiError, Pagination
        ├── auth.types.ts          # User, Roles, AuthTokens, MfaData
        └── clinical.types.ts      # Doctor, Slot, Consultation, Prescription, Payment
```

---

## 3. Implemented Routes & API Endpoint Mapping

| Page Route | Access Level | Implemented Backend API Endpoints |
|---|---|---|
| `/` | Public | `GET /api/v1/doctors?limit=6` |
| `/doctors` | Public | `GET /api/v1/doctors` (search, specialty filtering, sorting) |
| `/doctors/:id` | Public | `GET /api/v1/doctors/:id`, `GET /api/v1/availability/slots?doctorId=...` |
| `/login` | Public | `POST /api/v1/auth/login` |
| `/register` | Public | `POST /api/v1/auth/register` (Patients only) |
| `/mfa-verify` | Public (Pre-auth) | `POST /api/v1/auth/mfa/verify-login` |
| `/patient/dashboard` | Patient (`PATIENT`) | `GET /api/v1/consultations/my-bookings` |
| `/patient/consultations` | Patient (`PATIENT`) | `GET /api/v1/consultations/my-bookings`, `POST /api/v1/consultations/:id/cancel` |
| `/patient/consultations/:id` | Patient (`PATIENT`) | `GET /api/v1/consultations/:id`, `GET /api/v1/payments/consultation/:id` |
| `/booking/:slotId` | Patient (`PATIENT`) | `POST /api/v1/consultations/book` (with `Idempotency-Key`), `POST /api/v1/payments/simulate-webhook` |
| `/patient/prescriptions` | Patient (`PATIENT`) | `GET /api/v1/prescriptions/:id`, `GET /api/v1/prescriptions/consultation/:id` |
| `/patient/profile` | Patient (`PATIENT`) | `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`, `POST /api/v1/auth/mfa/setup`, `POST /api/v1/auth/mfa/verify-setup` |
| `/doctor/dashboard` | Doctor (`DOCTOR`) | `GET /api/v1/consultations/doctor-schedule` |
| `/doctor/availability` | Doctor (`DOCTOR`) | `GET /api/v1/availability/slots`, `POST /api/v1/availability/slots`, `DELETE /api/v1/availability/slots/:id` |
| `/doctor/consultations/:id` | Doctor (`DOCTOR`) | `GET /api/v1/consultations/:id`, `GET /api/v1/prescriptions/consultation/:id` |
| `/doctor/consultations/:id/prescription` | Doctor (`DOCTOR`) | `POST /api/v1/prescriptions`, `PATCH /api/v1/prescriptions/:id`, `POST /api/v1/prescriptions/:id/finalize` |
| `/admin/dashboard` | Admin (`ADMIN`) | `GET /healthz`, `GET /readyz`, `GET /metrics`, `GET /api/v1/doctors` |

---

## 4. Role-Based Authentication & Pre-Seeded Test Credentials

| Role | Synthetic Email | Password | Authorized Destination |
|---|---|---|---|
| **Patient** | `rohan.patil@synthetic.local` | `PatientDevPass#2026!` | `/patient/dashboard` |
| **Doctor** | `dr.aisha.sharma@synthetic.local` | `DoctorDevPass#2026!` | `/doctor/dashboard` |
| **Admin** | `admin.amrutam@synthetic.local` | `AdminDevPass#2026!` | `/admin/dashboard` |

---

## 5. Local Setup & Execution Instructions

### Prerequisites
- Node.js 20+
- Backend running on `http://localhost:4000` (or configured via `VITE_API_BASE_URL`)

### Development Server
```bash
# Run frontend dev server on http://localhost:3000
npm run frontend:dev

# Or directly from workspace root:
npm --prefix frontend run dev
```

### Production Build & Typecheck
```bash
# Typecheck
npm run frontend:lint

# Production Build
npm run frontend:build
```
