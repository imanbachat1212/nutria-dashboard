import { z } from "zod";

const TYPES = [
  "consult-initial",
  "consult-followup",
  "try-out",
  "assessment",
  "gym-machine",
  "gym-class",
];

const commonFields = {
  staffId: z.string().min(1),
  status: z.enum(["confirmed", "pending", "completed", "no-show", "cancelled"]).optional(),
  dateTime: z.string().min(1),
  durationMin: z.number().int().positive().optional(),
  room: z.string().optional(),
  notes: z.string().optional(),
};

const oneToOneSchema = (type) =>
  z.object({
    type: z.literal(type),
    client: z.string().min(1),
    ...commonFields,
  });

const tryOutSchema = z.object({
  type: z.literal("try-out"),
  client: z.string().min(1),
  category: z.enum(["diet", "gym"]),
  ...commonFields,
});


const attendeeInputSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
});

const gymMachineSchema = z.object({
  type: z.literal("gym-machine"),
  capacity: z.number().int().positive().max(50).optional(),
  attendees: z.array(attendeeInputSchema).optional(),
  ...commonFields,
});


const gymClassSchema = z.object({
  type: z.literal("gym-class"),
  name: z.string().trim().min(1),
  capacity: z.number().int().positive().max(50).optional(),
  attendees: z.array(attendeeInputSchema).optional(),
  ...commonFields,
});

const appointmentBodySchema = z.discriminatedUnion("type", [
  oneToOneSchema("consult-initial"),
  oneToOneSchema("consult-followup"),
  tryOutSchema,
  oneToOneSchema("assessment"),
  gymMachineSchema,
  gymClassSchema,
]);

export const createAppointmentSchema = z.object({
  body: appointmentBodySchema,
});

export const updateAppointmentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    client: z.string().optional(),
    staffId: z.string().optional(),
    name: z.string().optional(),
    category: z.enum(["diet", "gym"]).optional(),
    status: z.enum(["confirmed", "pending", "completed", "no-show", "cancelled"]).optional(),
    dateTime: z.string().optional(),
    durationMin: z.number().int().positive().optional(),
    room: z.string().optional(),
    notes: z.string().optional(),
    capacity: z.number().int().positive().max(50).optional(),
  }),
});

export const listAppointmentsSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    type: z.enum(TYPES).optional(),
    category: z.enum(["diet", "gym"]).optional(),
    staffId: z.string().optional(),
  }),
});

export const addAttendeeSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    clientId: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(["booked", "waitlist", "checked-in", "no-show", "cancelled"]).optional(),
    source: z.enum(["dashboard", "whatsapp", "instagram", "web"]).optional(),
  }),
});

export const updateAttendeeSchema = z.object({
  params: z.object({
    id: z.string().min(1),
    clientId: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(["booked", "waitlist", "checked-in", "no-show", "cancelled"]),
  }),
});
