import { z } from 'zod';

/**
 * Structured schema for individual prescribed medication items.
 */
export const medicationItemSchema = z.object({
  name: z.string().min(1, 'Medication name is required').max(200),
  dosage: z.string().min(1, 'Dosage is required (e.g., 500mg, 1 tablet)').max(100),
  frequency: z.string().min(1, 'Frequency is required (e.g., Twice daily after meals)').max(100),
  duration: z.string().min(1, 'Duration is required (e.g., 7 days, 1 month)').max(100),
  instructions: z.string().max(500).optional(),
});

export const createPrescriptionSchema = {
  body: z.object({
    consultationId: z.string().min(1, 'Consultation ID is required'),
    diagnosis: z.string().min(1).default('Ayurveda Clinical Assessment & Wellness Plan').optional(),
    medications: z
      .array(medicationItemSchema)
      .min(1, 'Prescription must contain at least one medication item'),
    advice: z.string().max(2000).optional(),
    instructions: z.string().max(2000).optional(),
  }),
};

export const updatePrescriptionSchema = {
  params: z.object({
    prescriptionId: z.string().min(1, 'Prescription ID is required'),
  }),
  body: z.object({
    diagnosis: z.string().min(1).max(2000).optional(),
    medications: z
      .array(medicationItemSchema)
      .min(1, 'Prescription must contain at least one medication item')
      .optional(),
    advice: z.string().max(2000).optional(),
    instructions: z.string().max(2000).optional(),
  }),
};

export const finalizePrescriptionSchema = {
  params: z.object({
    prescriptionId: z.string().min(1, 'Prescription ID is required'),
  }),
};

export const getPrescriptionByIdSchema = {
  params: z.object({
    prescriptionId: z.string().min(1, 'Prescription ID is required'),
  }),
};

export const getPrescriptionsByConsultationSchema = {
  params: z.object({
    consultationId: z.string().min(1, 'Consultation ID is required'),
  }),
};

export type MedicationItem = z.infer<typeof medicationItemSchema>;
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema.body>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema.body>;
