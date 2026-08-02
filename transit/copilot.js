const DEFINITIONS = {
  upt: "Unlinked passenger trips count each boarding, including transfers.",
  vrm: "Vehicle revenue miles measure distance traveled while vehicles are in revenue service.",
  vrh: "Vehicle revenue hours measure time operated in revenue service, including layover and recovery time.",
  voms: "Vehicles operated in maximum service is the number of revenue vehicles required at the peak service level.",
};

const findRequestedMetric = (question) => {
  const text = question.toLowerCase();
  if (text.includes("revenue mile") || text.includes("vrm")) return "vrm";
  if (text.includes("revenue hour") || text.includes("vrh")) return "vrh";
  if (text.includes("vehicle") || text.includes("voms")) return "voms";
  return "upt";
};

const deterministicAnswer = ({ question, facts, release }) => {
  const metric = findRequestedMetric(question);
  const fact = facts.find((item) => item.metric === metric) || facts[0];
  const asksForDefinition = /\b(define|definition|what does|what is upt|what is vrm|what is vrh|what is voms)\b/i.test(question);
  const asksForForecast = /\b(forecast|projection|next month|future)\b/i.test(question);

  if (asksForDefinition) {
    return {
      answer: DEFINITIONS[metric],
      claims: [],
      suggestedView: "explorer",
      caveats: ["Definitions follow the NTD monthly-data context used by this dashboard."],
      release: release?.sourceUpdatedAt || release?.generatedAt || null,
      mode: "deterministic-guide",
    };
  }

  if (asksForForecast) {
    return {
      answer: "Open the Explorer forecast for the selected scope and metric. Forecasts are generated from accepted historical values with rolling-origin validation and include uncertainty intervals.",
      claims: [],
      suggestedView: "explorer",
      caveats: ["The data guide does not create a new forecast or projection."],
      release: release?.sourceUpdatedAt || release?.generatedAt || null,
      mode: "deterministic-guide",
    };
  }

  if (!fact) {
    return {
      answer: "No validated data is available for this selection yet.",
      claims: [],
      suggestedView: "explorer",
      caveats: ["Try a broader scope or a different date range."],
      mode: "deterministic-guide",
    };
  }

  const yoy = Number.isFinite(fact.yoyPercent)
    ? ` The same-month year-over-year change is ${fact.yoyPercent.toFixed(1)}%.`
    : " A comparable prior-year value is not available for this selection.";
  const rolling = Number.isFinite(fact.rolling12Percent)
    ? ` The rolling 12-month change is ${fact.rolling12Percent.toFixed(1)}%.`
    : "";
  return {
    answer: `${fact.label} is ${fact.display} for ${fact.date}.${yoy}${rolling}`,
    claims: [fact.id],
    suggestedView: "explorer",
    caveats: ["This result comes from the adjusted-and-estimated NTD release and is descriptive."],
    release: release?.sourceUpdatedAt || release?.generatedAt || null,
    mode: "deterministic-guide",
  };
};

export const answerTransitQuestion = async ({ question, facts, release }) => {
  const causeQuestion = /\b(why|cause|caused|because|reason for)\b/i.test(question);
  if (causeQuestion) {
    return {
      answer:
        "The NTD monthly dataset can show where and when a change occurred, but it cannot establish why it occurred. Use the Explorer to isolate the affected scope, then verify possible causes with agency service, budget, incident, weather, and policy records.",
      claims: facts.slice(0, 2).map((fact) => fact.id),
      suggestedView: "explorer",
      caveats: ["No causal claim was generated from descriptive NTD data."],
      mode: "causal-guardrail",
    };
  }

  return deterministicAnswer({ question, facts, release });
};

export const resetCopilotLimitsForTests = () => {};
