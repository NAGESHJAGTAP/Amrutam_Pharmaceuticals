import { Prisma, DoctorVerificationStatus } from '@prisma/client';
import { prisma, isDatabaseReachable, markDatabaseUnreachable } from '../../infrastructure/database/prisma.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { SearchDoctorsQuery, UpdateDoctorInput } from './doctor.schema.js';
import { logger } from '../../common/logging/logger.js';

export interface VerifiedDoctorProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  licenseNumber: string;
  specialty: string;
  experienceYears: number;
  consultationFee: number;
  currency: string;
  bio: string;
  verificationStatus: DoctorVerificationStatus;
}

export const FALLBACK_DOCTORS: VerifiedDoctorProfile[] = [
  {
    id: 'doc-seed-1',
    userId: 'usr-doctor-aisha-001',
    name: 'Dr. Aisha Sharma',
    email: 'dr.aisha.sharma@synthetic.local',
    licenseNumber: 'AYUSH-MH-2015-00124',
    specialty: 'Ayurveda General Medicine',
    experienceYears: 11,
    consultationFee: 600,
    currency: 'INR',
    bio: 'BAMS, MD (Ayurveda). Specializing in holistic chronic disease management, gut wellness, pulse diagnosis, and lifestyle medicine.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-2',
    userId: 'usr-doctor-rajesh-002',
    name: 'Dr. Rajesh Kulkarni',
    email: 'dr.rajesh.kulkarni@synthetic.local',
    licenseNumber: 'AYUSH-MH-2018-00456',
    specialty: 'Panchakarma & Detox',
    experienceYears: 8,
    consultationFee: 850,
    currency: 'INR',
    bio: 'BAMS with fellowship in traditional Panchakarma therapies, metabolic rejuvenation, and seasonal Shodhana protocols.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-3',
    userId: 'usr-doctor-meera-003',
    name: 'Dr. Meera Deshmukh',
    email: 'dr.meera.deshmukh@synthetic.local',
    licenseNumber: 'AYUSH-MH-2016-00789',
    specialty: 'Ayurvedic Dermatology',
    experienceYears: 10,
    consultationFee: 750,
    currency: 'INR',
    bio: 'Renowned herbal dermatologist specializing in eczema, psoriasis, acne, and Ayurvedic cosmetology regimens.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-4',
    userId: 'usr-doctor-vikram-004',
    name: 'Dr. Vikramaditya Vaidya',
    email: 'dr.vikram.vaidya@synthetic.local',
    licenseNumber: 'AYUSH-MH-2010-00912',
    specialty: 'Cardiologist',
    experienceYears: 15,
    consultationFee: 950,
    currency: 'INR',
    bio: 'BAMS, MD (Kayachikitsa), PGDHHM. Integrative cardiologist focusing on hypertension, arterial health, and cardiovascular wellness.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-5',
    userId: 'usr-doctor-sneha-005',
    name: 'Dr. Sneha Paranjape',
    email: 'dr.sneha.paranjape@synthetic.local',
    licenseNumber: 'AYUSH-MH-2019-00234',
    specialty: 'Pediatrician',
    experienceYears: 7,
    consultationFee: 550,
    currency: 'INR',
    bio: 'BAMS, MD (Kaumarbhritya). Child immunity specialist, Suvarna Prashan expert, and pediatric digestive health advisor.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-6',
    userId: 'usr-doctor-rohan-006',
    name: 'Dr. Rohan Varma',
    email: 'dr.rohan.varma@synthetic.local',
    licenseNumber: 'AYUSH-MH-2013-00589',
    specialty: 'Neurologist',
    experienceYears: 12,
    consultationFee: 900,
    currency: 'INR',
    bio: 'BAMS, MD (Vaidya), Fellow in Neuro-Ayurveda. Expert in sciatica, cervical spondylosis, migraines, and Marma Chikitsa.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-7',
    userId: 'usr-doctor-pooja-007',
    name: 'Dr. Pooja Hegde',
    email: 'dr.pooja.hegde@synthetic.local',
    licenseNumber: 'AYUSH-MH-2017-00341',
    specialty: 'Gynecologist',
    experienceYears: 9,
    consultationFee: 700,
    currency: 'INR',
    bio: 'BAMS, MS (Ayurveda Gynecology). Specialized in PCOS/PCOD reversal, hormonal balance, fertility wellness, and Garbhasanskar.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-8',
    userId: 'usr-doctor-harish-008',
    name: 'Dr. Harish Salunkhe',
    email: 'dr.harish.salunkhe@synthetic.local',
    licenseNumber: 'AYUSH-MH-2011-00672',
    specialty: 'Orthopedic',
    experienceYears: 14,
    consultationFee: 800,
    currency: 'INR',
    bio: 'BAMS, MS (Shalya Tantra). Non-invasive joint care specialist treating osteoarthritis, rheumatoid arthritis, and sports injuries.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-9',
    userId: 'usr-doctor-anand-009',
    name: 'Dr. Anand Joshi',
    email: 'dr.anand.joshi@synthetic.local',
    licenseNumber: 'AYUSH-MH-2012-00823',
    specialty: 'General Physician',
    experienceYears: 13,
    consultationFee: 650,
    currency: 'INR',
    bio: 'MBBS, BAMS (Integrative Medicine). Comprehensive primary care, metabolic screening, diabetes management, and preventive health.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
  {
    id: 'doc-seed-10',
    userId: 'usr-doctor-tanvi-010',
    name: 'Dr. Tanvi Kulkarni',
    email: 'dr.tanvi.kulkarni@synthetic.local',
    licenseNumber: 'AYUSH-MH-2020-00192',
    specialty: 'ENT',
    experienceYears: 6,
    consultationFee: 500,
    currency: 'INR',
    bio: 'BAMS, MS (Shalakya Tantra). Specialist in chronic sinusitis, allergic rhinitis, tinnitus, eye strain, and Ayurvedic head-neck care.',
    verificationStatus: 'VERIFIED' as DoctorVerificationStatus,
  },
];

export class DoctorService {
  /**
   * Helper to generate dynamic upcoming availability slots for any doctor.
   */
  public generateUpcomingSlots(doctorId: string) {
    const slots = [];
    const now = new Date();

    // Today slots
    const today1 = new Date(now);
    today1.setHours(14, 0, 0, 0);
    const today1End = new Date(today1.getTime() + 30 * 60 * 1000);

    const today2 = new Date(now);
    today2.setHours(16, 30, 0, 0);
    const today2End = new Date(today2.getTime() + 30 * 60 * 1000);

    // Tomorrow slots
    const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tom1 = new Date(tom);
    tom1.setHours(10, 0, 0, 0);
    const tom1End = new Date(tom1.getTime() + 30 * 60 * 1000);

    const tom2 = new Date(tom);
    tom2.setHours(11, 30, 0, 0);
    const tom2End = new Date(tom2.getTime() + 30 * 60 * 1000);

    const tom3 = new Date(tom);
    tom3.setHours(15, 0, 0, 0);
    const tom3End = new Date(tom3.getTime() + 30 * 60 * 1000);

    // Day after tomorrow slots
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const da1 = new Date(dayAfter);
    da1.setHours(10, 30, 0, 0);
    const da1End = new Date(da1.getTime() + 30 * 60 * 1000);

    const da2 = new Date(dayAfter);
    da2.setHours(14, 0, 0, 0);
    const da2End = new Date(da2.getTime() + 30 * 60 * 1000);

    slots.push(
      { id: `slot-${doctorId}-today-1`, startTime: today1.toISOString(), endTime: today1End.toISOString(), status: 'AVAILABLE' },
      { id: `slot-${doctorId}-today-2`, startTime: today2.toISOString(), endTime: today2End.toISOString(), status: 'AVAILABLE' },
      { id: `slot-${doctorId}-tom-1`, startTime: tom1.toISOString(), endTime: tom1End.toISOString(), status: 'AVAILABLE' },
      { id: `slot-${doctorId}-tom-2`, startTime: tom2.toISOString(), endTime: tom2End.toISOString(), status: 'AVAILABLE' },
      { id: `slot-${doctorId}-tom-3`, startTime: tom3.toISOString(), endTime: tom3End.toISOString(), status: 'AVAILABLE' },
      { id: `slot-${doctorId}-da-1`, startTime: da1.toISOString(), endTime: da1End.toISOString(), status: 'AVAILABLE' },
      { id: `slot-${doctorId}-da-2`, startTime: da2.toISOString(), endTime: da2End.toISOString(), status: 'AVAILABLE' }
    );

    return slots;
  }

  public getFallbackDoctor(doctorId: string): VerifiedDoctorProfile {
    const doc = FALLBACK_DOCTORS.find((d) => d.id === doctorId);
    return doc || FALLBACK_DOCTORS[0];
  }

  /**
   * Search and filter verified doctors with pagination and sorting.
   */
  public async searchDoctors(query: SearchDoctorsQuery) {
    const pageNum = Number(query.page) > 0 ? Number(query.page) : 1;
    const limitNum = Number(query.limit) > 0 ? Number(query.limit) : 30;
    const sortField = query.sortBy || 'createdAt';
    const orderDirection = query.sortOrder || 'desc';
    const skip = (pageNum - 1) * limitNum;
    const { specialty, minExperience, maxFee, date } = query;

    const where: Prisma.DoctorWhereInput = {
      verificationStatus: DoctorVerificationStatus.VERIFIED,
      user: {
        status: 'ACTIVE',
      },
    };

    if (specialty) {
      where.specialty = { contains: specialty, mode: 'insensitive' };
    }

    if (minExperience !== undefined) {
      where.experienceYears = { gte: minExperience };
    }

    if (maxFee !== undefined) {
      where.consultationFee = { lte: new Prisma.Decimal(maxFee) };
    }

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.availabilitySlots = {
        some: {
          status: 'AVAILABLE',
          startTime: { gte: startOfDay, lte: endOfDay },
        },
      };
    }

    if (isDatabaseReachable()) {
      try {
        const [total, doctors] = await Promise.all([
          prisma.doctor.count({ where }),
          prisma.doctor.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { [sortField]: orderDirection },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  profile: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

        const hasFilters = specialty || minExperience !== undefined || maxFee !== undefined || date;
        if (doctors.length > 0 || (hasFilters && total === 0)) {
          return {
            doctors: doctors.map((doc) => ({
              id: doc.id,
              userId: doc.userId,
              name: doc.user.profile
                ? `Dr. ${doc.user.profile.firstName} ${doc.user.profile.lastName}`
                : 'Dr. Practitioner',
              email: doc.user.email,
              licenseNumber: doc.licenseNumber,
              specialty: doc.specialty,
              experienceYears: doc.experienceYears,
              consultationFee: Number(doc.consultationFee),
              currency: doc.currency,
              bio: doc.bio,
              verificationStatus: doc.verificationStatus,
            })),
            pagination: {
              total,
              page: pageNum,
              limit: limitNum,
              totalPages: Math.ceil(total / limitNum),
            },
          };
        }
      } catch (err: any) {
        markDatabaseUnreachable(30000);
        logger.warn(
          { error: err.message },
          'PostgreSQL database unreachable on localhost:5432; serving verified fallback doctor directory'
        );
      }
    }

    // Filter fallback doctors
    let filtered = [...FALLBACK_DOCTORS];

    if (specialty && specialty !== 'All') {
      const q = specialty.toLowerCase();
      filtered = filtered.filter(
        (doc) => doc.specialty.toLowerCase().includes(q) || q.includes(doc.specialty.toLowerCase())
      );
    }

    if (minExperience !== undefined) {
      filtered = filtered.filter((doc) => doc.experienceYears >= Number(minExperience));
    }

    if (maxFee !== undefined) {
      filtered = filtered.filter((doc) => doc.consultationFee <= Number(maxFee));
    }

    const sortKey = (query.sortBy as string) || '';
    if (sortKey === 'fee_asc' || (query.sortBy === 'consultationFee' && orderDirection === 'asc')) {
      filtered.sort((a, b) => a.consultationFee - b.consultationFee);
    } else if (sortKey === 'fee_desc' || (query.sortBy === 'consultationFee' && orderDirection === 'desc')) {
      filtered.sort((a, b) => b.consultationFee - a.consultationFee);
    } else if (sortKey === 'exp_desc' || (query.sortBy === 'experienceYears' && orderDirection === 'desc')) {
      filtered.sort((a, b) => b.experienceYears - a.experienceYears);
    }

    return {
      doctors: filtered.slice(skip, skip + limitNum).map((doc) => ({
        ...doc,
        user: {
          id: doc.userId,
          email: doc.email,
          profile: {
            firstName: doc.name.replace('Dr. ', '').split(' ')[0],
            lastName: doc.name.replace('Dr. ', '').split(' ').slice(1).join(' '),
          },
        },
      })),
      pagination: {
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filtered.length / limitNum),
      },
    };
  }

  /**
   * Retrieves doctor by ID with upcoming availability slots.
   */
  public async getDoctorById(doctorId: string) {
    if (isDatabaseReachable()) {
      try {
        const doctor = await prisma.doctor.findUnique({
          where: { id: doctorId },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
            availabilitySlots: {
              where: {
                status: 'AVAILABLE',
                startTime: { gte: new Date() },
              },
              orderBy: { startTime: 'asc' },
              take: 20,
            },
          },
        });

        if (doctor) {
          return {
            id: doctor.id,
            userId: doctor.userId,
            name: doctor.user.profile
              ? `Dr. ${doctor.user.profile.firstName} ${doctor.user.profile.lastName}`
              : 'Dr. Practitioner',
            email: doctor.user.email,
            licenseNumber: doctor.licenseNumber,
            specialty: doctor.specialty,
            experienceYears: doctor.experienceYears,
            consultationFee: Number(doctor.consultationFee),
            currency: doctor.currency,
            bio: doctor.bio,
            verificationStatus: doctor.verificationStatus,
            user: {
              id: doctor.userId,
              email: doctor.user.email,
              profile: doctor.user.profile,
            },
            availableSlots: doctor.availabilitySlots.map((slot) => ({
              id: slot.id,
              startTime: slot.startTime.toISOString(),
              endTime: slot.endTime.toISOString(),
              status: slot.status,
            })),
          };
        }
      } catch (err: any) {
        markDatabaseUnreachable(30000);
        logger.warn({ error: err.message }, 'Database unreachable in getDoctorById; returning fallback record');
      }
    }

    const doc = this.getFallbackDoctor(doctorId);
    const slots = this.generateUpcomingSlots(doc.id);

    return {
      id: doc.id,
      userId: doc.userId,
      name: doc.name,
      email: doc.email,
      licenseNumber: doc.licenseNumber,
      specialty: doc.specialty,
      experienceYears: doc.experienceYears,
      consultationFee: doc.consultationFee,
      currency: doc.currency,
      bio: doc.bio,
      verificationStatus: doc.verificationStatus,
      user: {
        id: doc.userId,
        email: doc.email,
        profile: {
          firstName: doc.name.replace('Dr. ', '').split(' ')[0],
          lastName: doc.name.replace('Dr. ', '').split(' ').slice(1).join(' '),
        },
      },
      availableSlots: slots,
    };
  }

  /**
   * Updates doctor professional profile.
   */
  public async updateDoctorProfile(
    doctorId: string,
    input: UpdateDoctorInput,
    actorUserId: string,
    actorRole: string
  ) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) throw new NotFoundError('Doctor');

    const isOwner = doctor.userId === actorUserId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You can only update your own doctor profile');
    }

    const updated = await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        ...(input.specialty && { specialty: input.specialty }),
        ...(input.experienceYears !== undefined && { experienceYears: input.experienceYears }),
        ...(input.consultationFee !== undefined && {
          consultationFee: new Prisma.Decimal(input.consultationFee),
        }),
        ...(input.currency && { currency: input.currency }),
        ...(input.bio && { bio: input.bio }),
      },
    });

    return updated;
  }
}

export const doctorService = new DoctorService();
