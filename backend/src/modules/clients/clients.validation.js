import { z } from "zod";

const profileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.string().optional(),
  sex: z.enum(["male", "female"]).optional(),
  lifeStage: z.enum(["none", "pregnant", "lactating"]).optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  startWeight: z.number().positive().optional(),
  goalWeight: z.number().positive().optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
  goal: z.enum(["lose", "maintain", "gain"]).optional(),
  occupation: z.string().optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  waterIntake: z.number().min(0).optional(),
  dietaryPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  intolerances: z.array(z.string()).optional(),
  foodsToAvoid: z.array(z.string()).optional(),
}).optional();

const labSchema = z.object({
  name: z.string().min(1),
  value: z.any(),
  unit: z.string().optional(),
  reference: z.string().optional(),
  date: z.string().optional(),
});

const clinicalSchema = z.object({
  labs: z.array(labSchema).optional(),
  medicalHistory: z.array(z.string()).optional(),
  nutritionDiagnosis: z.string().optional(),
  monitoring: z.string().optional(),
}).optional();

const targetsSchema = z.object({
  method: z.enum(["auto", "manual"]).optional(),
  bmr: z.number().optional(),
  tee: z.number().optional(),
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
}).optional();

const driTargetsSchema = z.object({
  method: z.enum(["auto", "manual"]).optional(),
  computedAt: z.string().optional(),
  vitaminA: z.number().min(0).optional(),
  vitaminC: z.number().min(0).optional(),
  vitaminD: z.number().min(0).optional(),
  vitaminE: z.number().min(0).optional(),
  vitaminK: z.number().min(0).optional(),
  vitaminB1: z.number().min(0).optional(),
  vitaminB2: z.number().min(0).optional(),
  vitaminB3: z.number().min(0).optional(),
  vitaminB5: z.number().min(0).optional(),
  vitaminB6: z.number().min(0).optional(),
  vitaminB12: z.number().min(0).optional(),
  folate: z.number().min(0).optional(),
  calcium: z.number().min(0).optional(),
  iron: z.number().min(0).optional(),
  magnesium: z.number().min(0).optional(),
  phosphorus: z.number().min(0).optional(),
  potassium: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  zinc: z.number().min(0).optional(),
  copper: z.number().min(0).optional(),
  manganese: z.number().min(0).optional(),
  selenium: z.number().min(0).optional(),
}).optional();

export const createClientSchema = z.object({
  body: z.object({
    phone: z.string().min(1),
    status: z.enum(["lead", "active", "inactive"]).optional(),
    serviceType: z.array(z.enum(["diet", "gym", "classes"])).optional(),
    profile: profileSchema,
    clinical: clinicalSchema,
    targets: targetsSchema,
    driTargets: driTargetsSchema,
    assignedTo: z.string().optional(),
  }),
});

export const updateClientSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    phone: z.string().min(1).optional(),
    status: z.enum(["lead", "active", "inactive"]).optional(),
    serviceType: z.array(z.enum(["diet", "gym", "classes"])).optional(),
    profile: profileSchema,
    clinical: clinicalSchema,
    targets: targetsSchema,
    driTargets: driTargetsSchema,
    assignedTo: z.string().nullable().optional(),
  }),
});

export const listClientsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(["lead", "active", "inactive"]).optional(),
    search: z.string().optional(),
  }),
});

export const createNoteSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    content: z.string().min(1),
  }),
});
