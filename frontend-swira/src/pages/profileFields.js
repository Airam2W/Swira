export const numericFields = [
  ["fastingGlucose", "number", 20, 800, 1, "mg/dL"],
  ["a1c", "number", 2, 20, 0.1, "%"],
  ["age", "number", 1, 120, 1, ""],
  ["weightKg", "number", 2, 350, 0.1, "kg"],
  ["heightCm", "number", 50, 250, 0.1, "cm"],
  ["insulin", "number", 0, 1000, 0.1, "μU/mL"],
  ["triglycerides", "number", 1, 10000, 1, "mg/dL"],
  ["hdl", "number", 1, 300, 1, "mg/dL"],
  ["ldl", "number", 1, 1000, 1, "mg/dL"],
  ["uricAcid", "number", 0, 30, 0.1, "mg/dL"],
  ["poorMentalHealthDays", "number", 0, 30, 1, ""],
];

export const selectFields = [
  ["hypertensionHigh", "yesNo"],
  ["walkingDifficulty", "yesNo"],
  ["sex", "sex"],
  ["physicalActivity30d", "yesNo"],
  ["smokeCurrentOrPast", "yesNo"],
  ["eatsFruitDaily", "yesNo"],
  ["eatsVegetablesDaily", "yesNo"],
  ["frequentAlcohol", "yesNo"],
  ["hasHealthInsurance", "yesNo"],
  ["deferredCareDueToCost", "yesNo"],
  ["education", "education"],
  ["incomeMonthlyMxn", "income"],
];
