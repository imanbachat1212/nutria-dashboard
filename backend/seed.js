import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "./src/config/env.js";
import Permission from "./src/modules/users/permission.model.js";
import Role from "./src/modules/users/role.model.js";
import User from "./src/modules/users/user.model.js";
import Client from "./src/modules/clients/client.model.js";
import Food from "./src/modules/foods/food.model.js";
import Setting from "./src/modules/settings/setting.model.js";
import { calcTargets } from "./src/lib/calc/targets.js";
import SEED_FOODS from "./src/modules/foods/foods.seed.js";

const PERMISSION_KEYS = [
  "users.create", "users.read", "users.update", "users.delete",
  "clients.create", "clients.read", "clients.update", "clients.delete",
  "clients.clinical.read", "clients.clinical.write",
  "foods.create", "foods.read", "foods.update", "foods.delete",
  "meals.create", "meals.read", "meals.update", "meals.delete",
  "mealplans.create", "mealplans.read", "mealplans.update", "mealplans.delete",
  "journal.create", "journal.read", "journal.update", "journal.delete",
  "appointments.create", "appointments.read", "appointments.update", "appointments.delete",
  "leads.create", "leads.read", "leads.update", "leads.delete",
  "intake.create", "intake.read", "intake.update", "intake.delete",
  // gym.* retired — Gym Booking merged into Appointments (gym-machine / gym-class types),
  // gated by appointments.* like every other appointment type.
  "messages.create", "messages.read", "messages.update", "messages.delete",
  "reports.create", "reports.read",
  "billing.create", "billing.read", "billing.update", "billing.delete",
  "automation.create", "automation.read", "automation.update", "automation.delete",
  "settings.read", "settings.update",
  "cms.create", "cms.read", "cms.update", "cms.delete",
  "audit.read",
  "media.upload",
  "webhooks.manage",
  "outbox.read",
];

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Upsert permissions
  for (const key of PERMISSION_KEYS) {
    await Permission.findOneAndUpdate({ key }, { key }, { upsert: true });
  }
  console.log(`Seeded ${PERMISSION_KEYS.length} permissions`);

  // Dietitian role — all permissions
  const dietitian = await Role.findOneAndUpdate(
    { name: "dietitian" },
    { name: "dietitian", permissions: PERMISSION_KEYS },
    { upsert: true, new: true }
  );
  console.log("Seeded dietitian role");

  // Assistant role — everything except clients.clinical.*
  const assistantPerms = PERMISSION_KEYS.filter(
    (k) => !k.startsWith("clients.clinical.")
  );
  const assistant = await Role.findOneAndUpdate(
    { name: "assistant" },
    { name: "assistant", permissions: assistantPerms },
    { upsert: true, new: true }
  );
  console.log("Seeded assistant role");

  // Admin user
  const adminEmail = "admin@nutri.app";
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    const hashed = await bcrypt.hash("admin123", 12);
    await User.create({
      email: adminEmail,
      password: hashed,
      name: "Admin",
      role: dietitian._id,
    });
    console.log(`Created admin user: ${adminEmail} / admin123`);
  } else {
    console.log("Admin user already exists");
  }

  // Staff directory — dietitians + trainers referenced by appointments.staffId.
  // Fixed IDs so the frontend's mock CLINICIANS/TRAINERS lists can hardcode matching
  // ids without depending on Mongo-generated ObjectIds from a particular seed run.
  // All get the dietitian role (full permissions) — no separate trainer role exists yet
  // (out of scope per the Appointments/Gym Booking merge), these are reference/display
  // accounts, not accounts anyone logs into.
  const STAFF = [
    { id: "6a0000000000000000000001", email: "sura.hawli@nutri.app", name: "Sura Hawli" },
    { id: "6a0000000000000000000002", email: "rim.khoury@nutri.app", name: "Rim Khoury" },
    { id: "6a0000000000000000000003", email: "marwan.zein@nutri.app", name: "Marwan Zein" },
    { id: "6a0000000000000000000004", email: "nour.saliba@nutri.app", name: "Nour Saliba" },
    { id: "6a0000000000000000000005", email: "jad.aoun@nutri.app", name: "Jad Aoun" },
    { id: "6a0000000000000000000006", email: "rita.sleiman@nutri.app", name: "Rita Sleiman" },
  ];
  for (const s of STAFF) {
    const existingStaff = await User.findOne({ email: s.email });
    if (!existingStaff) {
      const hashed = await bcrypt.hash(Math.random().toString(36), 12);
      await User.create({
        _id: new mongoose.Types.ObjectId(s.id),
        email: s.email,
        password: hashed,
        name: s.name,
        role: dietitian._id,
      });
      console.log(`Created staff user: ${s.name}`);
    }
  }

  // Sample client
  const samplePhone = "+96171234567";
  const existingClient = await Client.findOne({ phone: samplePhone });
  if (!existingClient) {
    const targets = calcTargets({
      weight: 71.4,
      height: 168,
      age: 32,
      sex: "female",
      activityLevel: "moderate",
      goal: "lose",
    });
    await Client.create({
      phone: samplePhone,
      status: "active",
      serviceType: ["diet", "gym"],
      profile: {
        firstName: "Rana",
        lastName: "Khoury",
        email: "rana.khoury@example.com",
        dateOfBirth: new Date("1994-03-15"),
        sex: "female",
        height: 168,
        weight: 71.4,
        startWeight: 78.2,
        goalWeight: 64,
        activityLevel: "moderate",
        goal: "lose",
        occupation: "Architect",
        sleepHours: 7,
        waterIntake: 2.5,
        dietaryPreferences: ["Mediterranean", "Low added sugar"],
        allergies: ["Peanuts"],
        intolerances: ["Lactose"],
        foodsToAvoid: ["Shellfish"],
      },
      targets,
      clinical: {
        labs: [
          { name: "HbA1c", value: "5.4", unit: "%", reference: "< 5.7", date: new Date("2025-05-10") },
          { name: "Vitamin D", value: "22", unit: "ng/mL", reference: "30–100", date: new Date("2025-05-10") },
          { name: "Ferritin", value: "18", unit: "ng/mL", reference: "12–150", date: new Date("2025-05-10") },
        ],
        medicalHistory: ["PCOS (managed)", "Vitamin D deficiency"],
        nutritionDiagnosis: "Excessive energy intake related to irregular meal timing as evidenced by 6.8 kg weight gain over 8 months.",
        monitoring: "Track weight weekly, labs in 3 months",
      },
    });
    console.log("Created sample client: Rana Khoury");
  } else {
    console.log("Sample client already exists");
  }

  // Group class types (Settings → Services) — seeds the same 3 values that used to be
  // hardcoded in appointments.validation.js, so existing gym-class appointments/flows see no
  // change. Non-destructive: only sets the default if the key doesn't already exist.
  await Setting.findOneAndUpdate(
    { key: "gymClassTypes" },
    {
      $setOnInsert: {
        key: "gymClassTypes",
        value: ["Pilates", "Zumba", "Yoga"],
        description: "Group class types offered — populates the Group class name dropdown in the New Appointment dialog.",
      },
    },
    { upsert: true }
  );
  console.log("Seeded gymClassTypes setting");

  // Foods
  await seedFoods();
  await migrateSugarSodiumToNull();
  await migrateBarcodeRemoval();

  await mongoose.disconnect();
  console.log("Seed complete");
}

async function seedFoods() {
  let inserted = 0;
  let updated = 0;

  for (const f of SEED_FOODS) {
    const result = await Food.findOneAndUpdate(
      { name: f.name },
      {
        $set: {
          nameAr: f.nameAr,
          category: f.category,
          source: f.source,
          servingSize: 100,
          servingUnit: "g",
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          fiber: f.fiber || 0,
        },
        $setOnInsert: { sugar: null, sodium: null },
      },
      { upsert: true, new: true, rawResult: true }
    );
    if (result.lastErrorObject?.updatedExisting) {
      updated++;
    } else {
      inserted++;
    }
  }

  console.log(`Foods: ${inserted} inserted, ${updated} updated`);
}

async function migrateSugarSodiumToNull() {
  const result = await Food.updateMany(
    { sugar: 0, sodium: 0 },
    { $set: { sugar: null, sodium: null } }
  );
  console.log(`Migration: set sugar/sodium to null on ${result.modifiedCount} foods`);
}

async function migrateBarcodeRemoval() {
  const unset = await Food.updateMany(
    { barcode: { $exists: true } },
    { $unset: { barcode: "" } }
  );
  if (unset.modifiedCount > 0) {
    console.log(`Migration: removed barcode field from ${unset.modifiedCount} foods`);
  }
  try {
    await Food.collection.dropIndex("barcode_1");
    console.log("Migration: dropped barcode_1 index");
  } catch {
    // index doesn't exist — nothing to do
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
