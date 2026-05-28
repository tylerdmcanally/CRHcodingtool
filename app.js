const levels = ["straightforward", "low", "moderate", "high"];
const levelLabels = {
  straightforward: "Straightforward",
  low: "Low",
  moderate: "Moderate",
  high: "High"
};

const officeCodes = {
  new: {
    straightforward: "99202",
    low: "99203",
    moderate: "99204",
    high: "99205"
  },
  established: {
    straightforward: "99212",
    low: "99213",
    moderate: "99214",
    high: "99215"
  }
};

const telehealthCptCodes = {
  video: {
    new: {
      straightforward: "98000",
      low: "98001",
      moderate: "98002",
      high: "98003"
    },
    established: {
      straightforward: "98004",
      low: "98005",
      moderate: "98006",
      high: "98007"
    }
  },
  audio: {
    new: {
      straightforward: "98008",
      low: "98009",
      moderate: "98010",
      high: "98011"
    },
    established: {
      straightforward: "98012",
      low: "98013",
      moderate: "98014",
      high: "98015"
    }
  }
};

const officeTimeRanges = {
  new: [
    { code: "99202", level: "straightforward", min: 15, max: 29 },
    { code: "99203", level: "low", min: 30, max: 44 },
    { code: "99204", level: "moderate", min: 45, max: 59 },
    { code: "99205", level: "high", min: 60, max: 74 }
  ],
  established: [
    { code: "99212", level: "straightforward", min: 10, max: 19 },
    { code: "99213", level: "low", min: 20, max: 29 },
    { code: "99214", level: "moderate", min: 30, max: 39 },
    { code: "99215", level: "high", min: 40, max: 54 }
  ]
};

const modalityMeta = {
  cvt: {
    label: "CVT",
    route: "Synchronous clinic-based telehealth",
    modifier: "Use local CRH/DSS stop-code routing; external claims commonly use POS 02 when the patient is at a clinic.",
    g2211Eligible: true
  },
  vvc: {
    label: "VVC",
    route: "Synchronous video-to-video telehealth",
    modifier: "Patient-at-home claims commonly use POS 10; non-home telehealth commonly uses POS 02. Modifier policy is payer-dependent.",
    g2211Eligible: true
  },
  phone: {
    label: "Phone",
    route: "Synchronous audio-only care",
    modifier: "Audio-only E/M needs clear medical discussion, assessment/plan, and local DSS/stop-code validation.",
    g2211Eligible: true
  }
};

const state = {
  modality: "cvt",
  patientType: "established",
  payer: "va",
  method: "best"
};

const $ = (id) => document.getElementById(id);

function levelIndex(level) {
  return levels.indexOf(level);
}

function formatLevel(level) {
  return levelLabels[level] || "Not supported";
}

function formatList(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function setSegment(name, value) {
  state[name] = value;
  document.querySelectorAll(`[data-bind="${name}"] button`).forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
  update();
}

function calculateDataLevel() {
  const tests = Number($("testsCount").value) || 0;
  const notes = Number($("notesCount").value) || 0;
  const testsAndDocumentsCount = tests + notes;
  const independentHistorian = $("independentHistorian").checked;
  const categoryOneCount = testsAndDocumentsCount + (independentHistorian ? 1 : 0);
  const independentInterpretation = $("independentInterpretation").checked;
  const externalDiscussion = $("externalDiscussion").checked;

  if (
    (categoryOneCount >= 3 && independentInterpretation) ||
    (categoryOneCount >= 3 && externalDiscussion) ||
    (independentInterpretation && externalDiscussion)
  ) {
    return "high";
  }

  if (categoryOneCount >= 3 || independentInterpretation || externalDiscussion) {
    return "moderate";
  }

  if (testsAndDocumentsCount >= 2 || independentHistorian) {
    return "low";
  }

  return "straightforward";
}

function calculateMdmLevel() {
  const selected = [
    $("problems").value,
    calculateDataLevel(),
    $("risk").value
  ].sort((a, b) => levelIndex(a) - levelIndex(b));

  return selected[1];
}

function getMdmElements(result) {
  return [
    { label: "Problems", level: $("problems").value },
    { label: "Data", level: result.dataLevel },
    { label: "Risk", level: $("risk").value }
  ];
}

function getMdmSupportText(result) {
  const elements = getMdmElements(result);
  const supporting = elements.filter((item) => levelIndex(item.level) >= levelIndex(result.mdmLevel));
  const limiting = elements.filter((item) => levelIndex(item.level) < levelIndex(result.mdmLevel));
  const higher = elements.filter((item) => levelIndex(item.level) > levelIndex(result.mdmLevel));
  const supportNames = formatList(supporting.map((item) => item.label));

  let mdmText = `MDM is ${formatLevel(result.mdmLevel).toLowerCase()} because ${supportNames} support that level or higher.`;
  if (limiting.length) {
    mdmText += ` ${formatList(limiting.map((item) => `${item.label} is ${formatLevel(item.level).toLowerCase()}`))}.`;
  }
  if (higher.length && supporting.length < 2) {
    mdmText += " A single higher element does not set the level by itself.";
  }

  if (!isTelehealthEAndMEligible()) {
    return getEligibilityHoldReason();
  }

  if (result.selectedMethod === "Time") {
    return `${mdmText} Time supports a higher code than MDM, so Best supported selects the time-based level when same-date clinician time is documented.`;
  }

  if (result.timeCode && levelIndex(result.mdmLevel) > levelIndex(result.timeCalc.base.level)) {
    return `${mdmText} MDM supports a higher code than time, so Best supported avoids undercoding based on minutes alone.`;
  }

  if (result.timeCode && result.timeCode === result.mdmCode) {
    return `${mdmText} Time supports the same level.`;
  }

  return mdmText;
}

function renderMdmBreakdown(result) {
  const container = $("mdmBreakdown");
  container.innerHTML = "";
  getMdmElements(result).forEach((item) => {
    const cell = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = item.label;
    value.textContent = formatLevel(item.level);
    cell.append(label, value);
    container.appendChild(cell);
  });
}

function calculateOfficeTime(minutes, patientType) {
  const ranges = officeTimeRanges[patientType];
  let base = ranges.find((range) => minutes >= range.min && minutes <= range.max);
  let prolonged = null;

  if (!base && minutes > ranges[ranges.length - 1].max) {
    base = ranges[ranges.length - 1];
    const isCommercial = state.payer === "commercial";
    const firstThreshold = patientType === "new" ? (isCommercial ? 75 : 89) : (isCommercial ? 55 : 69);
    const code = isCommercial ? "99417" : "G2212";

    if (minutes >= firstThreshold) {
      prolonged = {
        code,
        units: Math.floor((minutes - firstThreshold) / 15) + 1,
        threshold: firstThreshold
      };
    }
  }

  return { base, prolonged };
}

function codeForLevel(level, patientType, modality, payer) {
  if (payer !== "medicare") {
    const family = modality === "phone" ? "audio" : "video";
    return telehealthCptCodes[family][patientType][level];
  }

  return officeCodes[patientType][level];
}

function timeCodeForLevel(timeBase, patientType, modality, payer) {
  if (!timeBase) return null;
  return codeForLevel(timeBase.level, patientType, modality, payer);
}

function calculatePrimary() {
  const patientType = state.patientType;
  const payer = state.payer;
  const modality = state.modality;
  const minutes = Number($("timeMinutes").value) || 0;
  const mdmLevel = calculateMdmLevel();
  const dataLevel = calculateDataLevel();
  const timeCalc = calculateOfficeTime(minutes, patientType);
  const mdmCode = codeForLevel(mdmLevel, patientType, modality, payer);
  const timeCode = timeCodeForLevel(timeCalc.base, patientType, modality, payer);

  let primaryCode = mdmCode;
  let selectedMethod = "MDM";
  let reason = `Based on ${formatLevel(mdmLevel).toLowerCase()} MDM.`;

  if (state.method === "time") {
    primaryCode = timeCode || "No time code";
    selectedMethod = "Time";
    reason = timeCode ? `Based on ${minutes} documented minutes.` : "Documented time does not meet the first E/M threshold.";
  } else if (state.method === "best") {
    if (timeCode && levelIndex(timeCalc.base.level) > levelIndex(mdmLevel)) {
      primaryCode = timeCode;
      selectedMethod = "Time";
      reason = `Time supports ${timeCode}; MDM supports ${mdmCode}.`;
    } else {
      primaryCode = mdmCode;
      selectedMethod = "MDM";
      reason = timeCode ? `MDM supports ${mdmCode}; time supports ${timeCode}.` : `MDM supports ${mdmCode}.`;
    }
  }

  return {
    modality,
    patientType,
    payer,
    minutes,
    mdmLevel,
    dataLevel,
    mdmCode,
    timeCode,
    timeCalc,
    primaryCode,
    selectedMethod,
    reason
  };
}

function getEligibilityIssues() {
  const issues = [];
  if (!$("synchronous").checked) issues.push("synchronous clinician-patient interaction is not documented");
  if (!$("patientPresent").checked) issues.push("patient presence and consent/modality are not documented");
  if (!$("notJustResults").checked) issues.push("the contact appears administrative or limited to brief result notification");
  if (state.modality === "phone" && (Number($("timeMinutes").value) || 0) <= 10) {
    issues.push("audio-only encounters require more than 10 minutes of medical discussion documented");
  }
  return issues;
}

function getEligibilityHoldReason() {
  const issues = getEligibilityIssues();
  if (!issues.length) return "";
  return `E/M held: ${formatList(issues)}.`;
}

function isTelehealthEAndMEligible() {
  return getEligibilityIssues().length === 0;
}

function getG2211Status(result) {
  const longitudinal = $("longitudinal").checked;
  const modifier25 = $("modifier25").checked;
  const preventiveException = $("preventiveException").checked;

  if (!longitudinal) {
    return { type: "warn", text: "Do not add G2211 unless the visit reflects longitudinal focal-point care or ongoing care for a serious/complex condition." };
  }

  if (modifier25 && !preventiveException) {
    return { type: "stop", text: "G2211 is generally denied when the associated office/outpatient E/M has modifier 25, except specified Medicare preventive-service situations." };
  }

  if (modifier25 && preventiveException) {
    return { type: "ok", text: "G2211 may be considered with modifier 25 only for specified Medicare preventive-service situations when documentation supports longitudinal complexity." };
  }

  return { type: "ok", text: "Consider G2211 only when the E/M code is otherwise supported and documentation shows longitudinal focal-point care or ongoing care for a serious/complex condition." };
}

function buildWarnings(result) {
  const warnings = [];
  const procedure = $("minorProcedure").checked;
  const modifier25 = $("modifier25").checked;
  const timeDocumented = $("timeDocumented").checked;
  const eligible = isTelehealthEAndMEligible();

  if (!eligible) {
    warnings.push({ type: "stop", text: getEligibilityHoldReason() });
  }

  if (state.modality === "phone" && state.patientType === "new") {
    warnings.push({ type: "warn", text: "New-patient audio-only E/M may be payer-restricted. Confirm VA facility and payer policy before using a new-patient telephone E/M code." });
  }

  if (state.modality === "phone" && !timeDocumented && result.selectedMethod === "Time") {
    warnings.push({ type: "stop", text: "Telephone encounters selected by time require clear clinician time documentation." });
  }

  if (result.selectedMethod === "Time" && !timeDocumented) {
    warnings.push({ type: "stop", text: "Time-based code selection requires same-date clinician time documentation." });
  }

  if (procedure && !modifier25) {
    warnings.push({ type: "warn", text: "A same-day procedure or preventive service may need modifier 25 only when the problem-oriented E/M is significant and separately identifiable." });
  }

  if (result.primaryCode === "No time code") {
    warnings.push({ type: "warn", text: "The time entered does not meet the first E/M threshold. Recheck MDM support or local staff-visit policy." });
  }

  if (state.payer === "va") {
    warnings.push({ type: "warn", text: "Confirm local stop codes, DSS crediting, and encounter form setup." });
  }

  if (state.payer === "medicare" && state.modality !== "phone") {
    warnings.push({ type: "warn", text: "For Medicare-style telehealth, validate place of service and modifier policy for patient location. VVC from home commonly differs from CVT clinic-based telehealth." });
  }

  if (state.payer === "commercial") {
    warnings.push({ type: "warn", text: "CPT telehealth mode maps to 98000-98015; do not use this mode for Medicare without policy confirmation." });
  }

  return warnings;
}

function getRouteItems(result) {
  const meta = modalityMeta[result.modality];
  const items = [
    { type: "ok", text: `${meta.label}: ${meta.route}. ${meta.modifier}` }
  ];

  if (result.modality === "cvt" && $("techData").checked) {
    items.push({ type: "ok", text: "CVT site data counts when the clinician reviews it and uses it in assessment or management." });
  }

  if (result.modality === "phone") {
    items.push({ type: "warn", text: "Administrative calls and brief result notifications should route outside E/M." });
  }

  return items;
}

function buildDocumentation(result) {
  const problems = $("problems").selectedOptions[0].text;
  const risk = $("risk").selectedOptions[0].text;
  const dataParts = [];
  const modality = modalityMeta[result.modality];
  const eligibility = isTelehealthEAndMEligible() ? "E/M eligibility checks passed" : getEligibilityHoldReason();

  const tests = Number($("testsCount").value) || 0;
  const notes = Number($("notesCount").value) || 0;
  if (tests) dataParts.push(`${tests} test(s) ordered/reviewed`);
  if (notes) dataParts.push(`${notes} external note(s) or unique source(s) reviewed`);
  if ($("independentHistorian").checked) dataParts.push("independent historian obtained");
  if ($("independentInterpretation").checked) dataParts.push("independent interpretation performed");
  if ($("externalDiscussion").checked) dataParts.push("management/test interpretation discussed with external clinician or qualified source");
  if ($("techData").checked && result.modality === "cvt") dataParts.push("telehealth site support data reviewed when applicable");

  const addOns = [];
  if ($("modifier25").checked) addOns.push("Separate problem-oriented E/M work supports modifier 25.");
  if ($("longitudinal").checked) addOns.push("Longitudinal focal-point care or ongoing serious/complex condition management reviewed for G2211 support.");

  return [
    `Recommended code route: ${result.primaryCode} (${state.payer === "medicare" ? "office/outpatient E/M family" : "telemedicine E/M family"}).`,
    `CRH modality: ${modality.label}. ${eligibility}. ${modality.modifier}`,
    `Selection basis: ${result.selectedMethod}. ${result.reason}`,
    `MDM support: ${formatLevel(result.mdmLevel)} overall. Problems: ${problems}. Data: ${formatLevel(result.dataLevel)}${dataParts.length ? ` (${dataParts.join("; ")})` : ""}. Risk: ${risk}.`,
    `Time support: ${result.minutes} minute(s) documented on the date of encounter${result.timeCode ? `, supporting ${result.timeCode}` : ""}.`,
    addOns.length ? `Add-on/procedure checks: ${addOns.join(" ")}` : "Add-on/procedure checks: none selected."
  ].join("\n\n");
}

function renderPills(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    const pill = document.createElement("div");
    pill.className = `pill ${item.type}`;
    pill.textContent = item.text;
    container.appendChild(pill);
  });
}

function update() {
  const result = calculatePrimary();
  const g2211 = getG2211Status(result);
  const warnings = buildWarnings(result);
  const routeItems = getRouteItems(result);
  const eligible = isTelehealthEAndMEligible();
  const displayCode = eligible ? result.primaryCode : "Review";

  $("routeChip").textContent = modalityMeta[result.modality].label;
  $("mdmChip").textContent = formatLevel(result.mdmLevel);
  $("dataLevel").textContent = formatLevel(result.dataLevel);
  $("timeOutput").textContent = `${result.minutes} min`;
  $("primaryCode").textContent = displayCode;
  document.querySelector(".code-card").classList.toggle("review", !eligible);
  $("primaryLabel").textContent = eligible
    ? `${modalityMeta[result.modality].label} ${result.patientType} E/M`
    : "Not ready for E/M coding";
  $("basisText").textContent = eligible ? result.reason : getEligibilityHoldReason();
  $("routeResult").textContent = modalityMeta[result.modality].label;
  $("mdmResult").textContent = `${formatLevel(result.mdmLevel)} (${result.mdmCode})`;
  $("timeResult").textContent = result.timeCode || "Not met";
  $("basisResult").textContent = result.selectedMethod;
  renderMdmBreakdown(result);
  $("supportNote").textContent = getMdmSupportText(result);

  const addOns = [...routeItems, g2211];
  if (result.timeCalc.prolonged && state.modality !== "phone" && state.payer === "medicare") {
    addOns.push({
      type: "ok",
      text: `${result.timeCalc.prolonged.code} x${result.timeCalc.prolonged.units} may be supported when ${result.minutes} minutes are documented and the payer accepts this prolonged-service code.`
    });
  }
  renderPills($("addons"), addOns);
  renderPills($("warnings"), warnings);
  $("documentationText").value = buildDocumentation(result);
}

function resetWorkflow() {
  state.modality = "cvt";
  state.patientType = "established";
  state.payer = "va";
  state.method = "best";
  $("synchronous").checked = true;
  $("patientPresent").checked = true;
  $("techData").checked = true;
  $("notJustResults").checked = true;
  $("problems").value = "moderate";
  $("testsCount").value = 1;
  $("notesCount").value = 1;
  $("independentHistorian").checked = false;
  $("independentInterpretation").checked = false;
  $("externalDiscussion").checked = false;
  $("risk").value = "moderate";
  $("timeMinutes").value = 30;
  $("timeDocumented").checked = true;
  $("minorProcedure").checked = false;
  $("modifier25").checked = false;
  $("preventiveException").checked = false;
  $("longitudinal").checked = true;
  document.querySelectorAll(".segmented").forEach((segment) => {
    const name = segment.dataset.bind;
    segment.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === state[name]);
    });
  });
  update();
}

document.querySelectorAll(".segmented").forEach((segment) => {
  segment.style.setProperty("--items", segment.querySelectorAll("button").length);
  segment.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-value]");
    if (!button) return;
    setSegment(segment.dataset.bind, button.dataset.value);
  });
});

document.querySelectorAll("input, select").forEach((input) => {
  input.addEventListener("input", update);
  input.addEventListener("change", update);
});

$("copyBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("documentationText").value);
  $("copyBtn").textContent = "Copied";
  window.setTimeout(() => {
    $("copyBtn").textContent = "Copy Summary";
  }, 1200);
});

$("printBtn").addEventListener("click", () => window.print());
$("resetBtn").addEventListener("click", resetWorkflow);

update();
