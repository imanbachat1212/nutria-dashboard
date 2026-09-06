const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export { ACTIVITY_FACTORS };

export function ageFromDOB(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function calcBMR({ weight, height, age, sex }) {
  if (sex === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  }
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

export function calcTEE({ weight, height, age, sex, activityLevel }) {
  const bmr = calcBMR({ weight, height, age, sex });
  const factor = ACTIVITY_FACTORS[activityLevel] || 1.2;
  return Math.round(bmr * factor);
}

// IOM adequate-intake ratio (14g fiber per 1000 kcal) — the only target formula that's a pure
// function of calories, with no weight/height/age/sex dependency. Exported standalone (prompt-55)
// so a manual-method client's targets can get the same fiber number a calories-only auto-calc
// would produce, without needing any of the other calcTargets inputs.
export function calcFiberTarget(calories) {
  return Math.round(calories / 1000 * 14);
}

export function calcTargets({ weight, height, age, sex, activityLevel, goal }) {
  const bmr = Math.round(calcBMR({ weight, height, age, sex }));
  const tee = calcTEE({ weight, height, age, sex, activityLevel });

  let calories = tee;
  if (goal === "lose") calories = Math.round(tee * 0.8);
  else if (goal === "gain") calories = Math.round(tee * 1.15);

  const protein = Math.round(weight * 2.0);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  const fiber = calcFiberTarget(calories);

  return { method: "auto", bmr, tee, calories, protein, fat, carbs, fiber };
}

export function canComputeTargets(profile) {
  return (
    profile?.weight > 0 &&
    profile?.height > 0 &&
    profile?.sex &&
    profile?.dateOfBirth &&
    profile?.activityLevel
  );
}
