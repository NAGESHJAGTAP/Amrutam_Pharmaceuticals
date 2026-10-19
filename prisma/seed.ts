import { PrismaClient, UserRole, UserStatus, DoctorVerificationStatus, SlotStatus, ConsultationStatus, PaymentStatus } from '@prisma/client';
import { PasswordUtil } from '../src/common/security/password.js';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return await PasswordUtil.hash(password);
}

async function main() {
  console.log('🌱 Starting database seed with synthetic data...');

  // Clean existing data in reverse order of foreign keys
  await prisma.outboxEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing tables.');

  // 1. Seed Synthetic Admin User
  const adminPasswordHash = await hashPassword('AdminDevPass#2026!');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin.amrutam@synthetic.local',
      phone: '+919800000001',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'System',
          lastName: 'Administrator',
          emergencyContact: '+919800000000',
        },
      },
    },
  });
  console.log('✅ Seeded Admin:', adminUser.email);

  // 2. Seed Synthetic Doctors
  const doctorPasswordHash = await hashPassword('DoctorDevPass#2026!');

  const doctorsData = [
    {
      email: 'dr.aisha.sharma@synthetic.local',
      phone: '+919800000010',
      firstName: 'Aisha',
      lastName: 'Sharma',
      licenseNumber: 'AYUSH-MH-2015-00124',
      specialty: 'Ayurveda General Medicine',
      experienceYears: 11,
      consultationFee: 600.00,
      bio: 'BAMS, MD (Ayurveda). Specializing in holistic chronic disease management and lifestyle medicine.',
    },
    {
      email: 'dr.rajesh.kulkarni@synthetic.local',
      phone: '+919800000011',
      firstName: 'Rajesh',
      lastName: 'Kulkarni',
      licenseNumber: 'AYUSH-MH-2018-00456',
      specialty: 'Panchakarma & Detox',
      experienceYears: 8,
      consultationFee: 850.00,
      bio: 'BAMS with fellowship in traditional Panchakarma therapies and metabolic rejuvenation.',
    },
    {
      email: 'dr.meera.deshmukh@synthetic.local',
      phone: '+919800000012',
      firstName: 'Meera',
      lastName: 'Deshmukh',
      licenseNumber: 'AYUSH-MH-2016-00789',
      specialty: 'Ayurvedic Dermatology',
      experienceYears: 10,
      consultationFee: 750.00,
      bio: 'Expert in herbal dermatology, treating eczema, psoriasis, and chronic skin conditions.',
    },
  ];

  const createdDoctors = [];

  for (const doc of doctorsData) {
    const user = await prisma.user.create({
      data: {
        email: doc.email,
        phone: doc.phone,
        passwordHash: doctorPasswordHash,
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
        profile: {
          create: {
            firstName: doc.firstName,
            lastName: doc.lastName,
          },
        },
        doctor: {
          create: {
            licenseNumber: doc.licenseNumber,
            specialty: doc.specialty,
            experienceYears: doc.experienceYears,
            consultationFee: doc.consultationFee,
            currency: 'INR',
            bio: doc.bio,
            verificationStatus: DoctorVerificationStatus.VERIFIED,
          },
        },
      },
      include: {
        doctor: true,
      },
    });
    createdDoctors.push(user.doctor!);
    console.log(`✅ Seeded Doctor: Dr. ${doc.firstName} ${doc.lastName} (${doc.specialty})`);
  }

  // 3. Seed Synthetic Patients
  const patientPasswordHash = await hashPassword('PatientDevPass#2026!');

  const patient1User = await prisma.user.create({
    data: {
      email: 'rohan.patil@synthetic.local',
      phone: '+919800000021',
      passwordHash: patientPasswordHash,
      role: UserRole.PATIENT,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Rohan',
          lastName: 'Patil',
          gender: 'Male',
          emergencyContact: '+919800000020',
        },
      },
    },
  });

  const patient2User = await prisma.user.create({
    data: {
      email: 'priya.shinde@synthetic.local',
      phone: '+919800000022',
      passwordHash: patientPasswordHash,
      role: UserRole.PATIENT,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Priya',
          lastName: 'Shinde',
          gender: 'Female',
          emergencyContact: '+919800000020',
        },
      },
    },
  });

  console.log('✅ Seeded Patients: Rohan Patil & Priya Shinde');

  // 4. Seed Future Availability Slots for Doctor 1 (Dr. Aisha Sharma)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setUTCHours(9, 0, 0, 0); // 09:00 UTC

  const slot1Start = new Date(tomorrow);
  const slot1End = new Date(tomorrow);
  slot1End.setUTCMinutes(30); // 09:00 - 09:30 UTC

  const slot2Start = new Date(tomorrow);
  slot2Start.setUTCMinutes(30);
  const slot2End = new Date(tomorrow);
  slot2End.setUTCHours(10, 0, 0, 0); // 09:30 - 10:00 UTC

  const slot3Start = new Date(tomorrow);
  slot3Start.setUTCHours(10, 0, 0, 0);
  const slot3End = new Date(tomorrow);
  slot3End.setUTCMinutes(30); // 10:00 - 10:30 UTC

  const createdSlot1 = await prisma.availabilitySlot.create({
    data: {
      doctorId: createdDoctors[0].id,
      startTime: slot1Start,
      endTime: slot1End,
      status: SlotStatus.RESERVED,
    },
  });

  const createdSlot2 = await prisma.availabilitySlot.create({
    data: {
      doctorId: createdDoctors[0].id,
      startTime: slot2Start,
      endTime: slot2End,
      status: SlotStatus.AVAILABLE,
    },
  });

  await prisma.availabilitySlot.create({
    data: {
      doctorId: createdDoctors[0].id,
      startTime: slot3Start,
      endTime: slot3End,
      status: SlotStatus.AVAILABLE,
    },
  });

  console.log('✅ Seeded Availability Slots for Dr. Aisha Sharma');

  // 5. Seed 1 Active Scheduled Consultation for Patient 1 on Slot 1
  const consultation = await prisma.consultation.create({
    data: {
      consultationNumber: `CON-${Date.now()}-001`,
      patientId: patient1User.id,
      doctorId: createdDoctors[0].id,
      slotId: createdSlot1.id,
      status: ConsultationStatus.SCHEDULED,
      reason: 'Routine seasonal joint discomfort and digestive wellness consultation',
      startTime: slot1Start,
      endTime: slot1End,
      payment: {
        create: {
          paymentReference: `PAY-REF-${Date.now()}-001`,
          providerReference: `MOCK-TXN-${Date.now()}-001`,
          provider: 'MOCK_GATEWAY',
          amount: createdDoctors[0].consultationFee,
          currency: 'INR',
          status: PaymentStatus.COMPLETED,
        },
      },
    },
  });

  console.log(`✅ Seeded Consultation: ${consultation.consultationNumber} (SCHEDULED)`);

  // 6. Seed Initial Audit Log
  await prisma.auditLog.create({
    data: {
      actorId: adminUser.id,
      action: 'SYSTEM_DATABASE_SEEDED',
      entityType: 'System',
      entityId: 'ROOT',
      details: {
        message: 'Database seeded with synthetic development data',
        timestamp: new Date().toISOString(),
      },
      ipAddress: '127.0.0.1',
    },
  });

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
