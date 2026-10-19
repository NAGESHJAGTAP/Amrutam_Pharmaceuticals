import { prisma } from '../../infrastructure/database/prisma.js';
import { NotFoundError } from '../../common/errors/app-error.js';
import { UpdateProfileInput } from './profile.schema.js';

export class ProfileService {
  /**
   * Retrieves profile by user ID.
   */
  public async getProfileByUserId(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            emergencyContact: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundError('Profile');
    }

    return user;
  }

  /**
   * Updates user profile fields with audit logging.
   */
  public async updateProfile(
    userId: string,
    input: UpdateProfileInput,
    correlationId?: string,
    ipAddress?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new NotFoundError('Profile');
    }

    const updatedProfile = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({
        where: { userId },
        data: {
          ...(input.firstName && { firstName: input.firstName }),
          ...(input.lastName && { lastName: input.lastName }),
          ...(input.dateOfBirth && { dateOfBirth: new Date(input.dateOfBirth) }),
          ...(input.gender && { gender: input.gender }),
          ...(input.emergencyContact && { emergencyContact: input.emergencyContact }),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'PROFILE_UPDATED',
          entityType: 'Profile',
          entityId: profile.id,
          details: { updatedFields: Object.keys(input) },
          ipAddress,
          correlationId,
        },
      });

      return profile;
    });

    return updatedProfile;
  }
}

export const profileService = new ProfileService();
