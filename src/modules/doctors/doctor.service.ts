import { Prisma, DoctorVerificationStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';
import { SearchDoctorsQuery, UpdateDoctorInput } from './doctor.schema.js';

export class DoctorService {
  /**
   * Search and filter verified doctors with pagination and sorting.
   */
  public async searchDoctors(query: SearchDoctorsQuery) {
    const pageNum = Number(query.page) > 0 ? Number(query.page) : 1;
    const limitNum = Number(query.limit) > 0 ? Number(query.limit) : 10;
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

    // Filter doctors with available slots on specified date (UTC day boundaries)
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

  /**
   * Retrieves doctor by ID with upcoming availability slots.
   */
  public async getDoctorById(doctorId: string) {
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

    if (!doctor) throw new NotFoundError('Doctor');

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
      availableSlots: doctor.availabilitySlots.map((slot) => ({
        id: slot.id,
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        status: slot.status,
      })),
    };
  }

  /**
   * Updates doctor professional profile.
   * Authorized strictly for the doctor who owns the record or an administrator.
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
