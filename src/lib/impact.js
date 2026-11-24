// Indicative placeholder factors, NOT measured values: users can edit them in the UI.
// [label, kg CO2e per passenger-km, rupees per km]
export const MODES = {
  car: ['Petrol car (1 person)', 0.17, 9],
  bike: ['Petrol two-wheeler', 0.05, 3],
  bus: ['City bus', 0.03, 1.5],
  metro: ['Metro/rail', 0.03, 1.5],
};

export const defaultFactors = () =>
  Object.fromEntries(Object.entries(MODES).map(([key, v]) => [key, { e: v[1], c: v[2] }]));

export const monthlyTravel = (factor, kmPerDay, days) => ({
  co2: factor.e * kmPerDay * days,
  cost: factor.c * kmPerDay * days,
});

export const commuteSavings = (from, to) => ({
  co2: Math.max(0, from.co2 - to.co2),
  cost: Math.max(0, from.cost - to.cost),
});

/** AHAM rule of thumb (≈8 ft ceilings): CADR ≥ 2/3 of floor area in ft². */
export const purifierCadr = (areaM2) => {
  const sqft = Math.max(0, areaM2) * 10.764;
  const cfm = Math.ceil((sqft * 2) / 3);
  return { cfm, m3h: Math.ceil(((sqft * 2) / 3) * 1.699) };
};

export const reusableComparison = ({
  disposableCost,
  usesPerMonth,
  reusablePrice,
  reusableLifetime,
}) => ({
  disposableMonthly: disposableCost * usesPerMonth,
  reusableMonthly: (reusablePrice * usesPerMonth) / (reusableLifetime || 1),
  breakEvenUses: disposableCost ? Math.ceil(reusablePrice / disposableCost) : null,
});

export const applianceSavings = ({
  conventionalW,
  efficientW,
  hoursPerDay,
  tariff,
  extraPrice,
  gridFactor,
}) => {
  const kwh = Math.max(0, ((conventionalW - efficientW) / 1000) * hoursPerDay * 30);
  const rupees = kwh * tariff;
  return { kwh, rupees, paybackMonths: rupees ? extraPrice / rupees : null, co2: kwh * gridFactor };
};
