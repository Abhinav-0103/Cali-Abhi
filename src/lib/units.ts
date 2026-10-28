// Values are stored metric (cm, kg) and converted only for display/input.

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

export function cmFromFtIn(feet: number, inches: number) {
  return Math.round((feet * 12 + inches) * CM_PER_INCH * 10) / 10;
}

export function ftInFromCm(cm: number) {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function kgFromLb(lb: number) {
  return Math.round(lb * KG_PER_LB * 100) / 100;
}

export function lbFromKg(kg: number) {
  return Math.round((kg / KG_PER_LB) * 10) / 10;
}

export function formatHeight(cm: number, unitSystem: "metric" | "imperial") {
  if (unitSystem === "metric") return `${Math.round(cm)} cm`;
  const { feet, inches } = ftInFromCm(cm);
  return `${feet}′${inches}″`;
}

export function formatWeight(kg: number, unitSystem: "metric" | "imperial") {
  return unitSystem === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${lbFromKg(kg)} lb`;
}
