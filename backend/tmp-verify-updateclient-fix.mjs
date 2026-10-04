import mongoose from "mongoose";
import "dotenv/config";
import Client from "./src/modules/clients/client.model.js";
import { updateClient } from "./src/modules/clients/clients.service.js";

await mongoose.connect(process.env.MONGO_URI);

// Disposable test client — unlikely-to-collide phone, never touches real data.
const test = await Client.create({
  phone: "+10000000001",
  status: "lead",
  profile: {
    firstName: "VerifyFix",
    lastName: "Tester",
    sex: "female",
    dateOfBirth: new Date("2020-01-01"),
    height: 100,
    weight: 16,
    goal: "maintain",
  },
});
console.log("Created test client:", test._id.toString());
console.log("Before patch, profile:", JSON.stringify(test.profile));

// The exact shape of patch that wiped Theia: a partial profile with just one field.
const actor = { permissions: ["*"] };
await updateClient(test._id.toString(), { profile: { dateOfBirth: new Date("2020-01-01") } }, actor);

const after = await Client.findById(test._id).lean();
console.log("After partial-profile PATCH, profile:", JSON.stringify(after.profile));

const survived = after.profile.firstName === "VerifyFix" && after.profile.lastName === "Tester" && after.profile.height === 100 && after.profile.weight === 16 && after.profile.goal === "maintain";
console.log(survived ? "PASS: unmentioned fields survived the partial patch" : "FAIL: fields were wiped");

await Client.deleteOne({ _id: test._id });
console.log("Test client deleted.");

await mongoose.disconnect();
process.exit(survived ? 0 : 1);
