"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Select,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Accordion,
  Checkbox,
  ScrollArea,
  Divider,
  Badge,
  Box
} from "@mantine/core";
import {
  IconInfoCircle,
  IconFlask,
  IconMicroscope,
  IconTool,
  IconAdjustments,
  IconShieldCheck,
  IconCalculator,
  IconFileDescription,
  IconCheck,
  IconChevronDown
} from "@tabler/icons-react";
import type { VariableFormData } from "@/types/forms";

// Variable type options (for now, just pH - will expand later)
const VARIABLE_TYPE_OPTIONS = [
  { value: "PHVariable", label: "pH" }
  // Future: DIC, TA, pCO2, etc.
];

// Measurement method options
const MEASUREMENT_METHOD_OPTIONS = [
  { value: "measured", label: "Measured directly" },
  { value: "calculated", label: "Calculated from other variables" }
];

// Measurement type options
const MEASUREMENT_TYPE_OPTIONS = [
  { value: "discrete", label: "Discrete bottle samples" },
  { value: "continuous", label: "Continuous autonomous sensors" }
];

interface VariableModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: VariableFormData) => void;
  initialData?: VariableFormData;
}

interface PHCalibrationData {
  calibration_type?: string;
  technique_description?: string;
  dye_type_and_manufacturer?: string;
  dye_purified?: boolean;
  correction_for_unpurified_dye?: string;
  dye_correction_method?: string;
  ph_of_standards?: string;
  calibration_temperature?: string;
  frequency?: string;
  last_calibration_date?: string;
  method_reference?: string;
  calibration_certificates?: string;
}

interface PHInstrumentData {
  instrument_type?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  precision?: string;
  accuracy?: string;
  calibration?: PHCalibrationData;
}

interface ExtendedVariableFormData extends VariableFormData {
  measurement_method?: string;
  measurement_type?: string;
  // pH-specific fields
  ph_report_temperature?: string;
  measurement_temperature?: string;
  temperature_correction_method?: string;
  analyzing_instrument?: PHInstrumentData;
  // Analysis fields
  analyzing_method?: string;
  sampling_method?: string;
  field_replicate_information?: string;
  // QC fields
  qc_steps_taken?: string;
  qc_researcher?: { name?: string; email?: string };
  qc_researcher_institution?: string;
  uncertainty?: string;
  uncertainty_definition?: string;
  // Calculation fields
  calculation_method?: string;
  calculation_parameters?: string;
  calculation_software?: string;
  calculation_software_version?: string;
  // Additional fields
  missing_value_indicators?: string;
  method_reference?: string;
  other_detailed_information?: string;
  weather_or_climate_quality?: string;
}

// Define required fields for each section
type SectionConfig = {
  requiredFields: string[];
  allOptional?: boolean;
};

const getSectionConfigs = (
  isMeasured: boolean,
  showFullPHCalibration: boolean
): Record<string, SectionConfig> => ({
  basic: {
    requiredFields: [
      "long_name",
      "dataset_variable_name",
      "variable_type",
      "variable_unit",
      "measurement_method",
      ...(isMeasured ? ["measurement_type"] : [])
    ]
  },
  sampling: {
    requiredFields: [],
    allOptional: true
  },
  analysis: {
    requiredFields: showFullPHCalibration ? ["ph_report_temperature"] : [],
    allOptional: !showFullPHCalibration
  },
  instrument: {
    requiredFields: [
      "analyzing_instrument.instrument_type",
      "analyzing_instrument.precision",
      "analyzing_instrument.accuracy"
    ]
  },
  calibration: {
    requiredFields: [
      "analyzing_instrument.calibration.dye_type_and_manufacturer",
      "analyzing_instrument.calibration.calibration_type",
      "analyzing_instrument.calibration.technique_description"
    ]
  },
  calculation: {
    requiredFields: ["calculation_method"]
  },
  qc: {
    requiredFields: [],
    allOptional: true
  },
  additional: {
    requiredFields: [],
    allOptional: true
  }
});

// Helper to get nested value from formData
const getNestedValue = (obj: any, path: string): any => {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
};

// Calculate section progress
const getSectionProgress = (
  formData: ExtendedVariableFormData,
  config: SectionConfig
): {
  filled: number;
  total: number;
  allOptional: boolean;
  complete: boolean;
} => {
  if (config.allOptional) {
    return { filled: 0, total: 0, allOptional: true, complete: true };
  }

  const total = config.requiredFields.length;
  const filled = config.requiredFields.filter((field) => {
    const value = getNestedValue(formData, field);
    return value !== undefined && value !== null && value !== "";
  }).length;

  return {
    filled,
    total,
    allOptional: false,
    complete: filled === total
  };
};

// Progress badge component
const ProgressBadge: React.FC<{
  filled: number;
  total: number;
  allOptional: boolean;
  complete: boolean;
}> = ({ filled, total, allOptional, complete }) => {
  if (allOptional) {
    return (
      <Badge variant="light" color="gray" size="sm">
        Optional
      </Badge>
    );
  }

  if (complete) {
    return (
      <Badge
        variant="light"
        color="green"
        size="sm"
        leftSection={<IconCheck size={12} />}
      >
        Complete
      </Badge>
    );
  }

  if (filled === 0) {
    return (
      <Badge variant="light" color="orange" size="sm">
        {total} required
      </Badge>
    );
  }

  return (
    <Badge variant="light" color="blue" size="sm">
      {filled} of {total}
    </Badge>
  );
};

export default function VariableModal({
  opened,
  onClose,
  onSave,
  initialData
}: VariableModalProps) {
  const [formData, setFormData] = useState<ExtendedVariableFormData>({});
  const [openSections, setOpenSections] = useState<string[]>(["basic"]);

  // Reset state when modal opens with new data
  useEffect(() => {
    if (opened) {
      setFormData(initialData || {});
      setOpenSections(["basic"]);
    }
  }, [opened, initialData]);

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateNestedField = (parent: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...((prev[parent as keyof ExtendedVariableFormData] as object) || {}),
        [field]: value
      }
    }));
  };

  const updateCalibrationField = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      analyzing_instrument: {
        ...prev.analyzing_instrument,
        calibration: {
          ...prev.analyzing_instrument?.calibration,
          [field]: value
        }
      }
    }));
  };

  const handleSave = () => {
    if (!formData.variable_type) return;
    onSave(formData as VariableFormData);
  };

  // Handle accordion section click - auto-collapse others unless using chevron
  const handleSectionClick = useCallback(
    (sectionValue: string, isChevronClick: boolean) => {
      if (isChevronClick) {
        // Toggle without auto-collapse
        setOpenSections((prev) =>
          prev.includes(sectionValue)
            ? prev.filter((s) => s !== sectionValue)
            : [...prev, sectionValue]
        );
      } else {
        // Auto-collapse: only this section open
        setOpenSections((prev) =>
          prev.includes(sectionValue) ? [] : [sectionValue]
        );
      }
    },
    []
  );

  const isEditing = !!initialData?.variable_type;

  // Determine which sections to show based on selections
  const isMeasured = formData.measurement_method === "measured";
  const isCalculated = formData.measurement_method === "calculated";
  const isDiscrete = formData.measurement_type === "discrete";
  const isPH = formData.variable_type === "PHVariable";

  // Show full pH calibration only for discrete + measured pH
  const showFullPHCalibration = isPH && isDiscrete && isMeasured;

  // Determine which accordion sections to show
  const showSamplingSection = isMeasured;
  const showAnalysisSection = isMeasured;
  const showInstrumentSection = isMeasured;
  const showCalibrationSection = showFullPHCalibration;
  const showCalculationSection = isCalculated;

  // Get section configs
  const sectionConfigs = getSectionConfigs(isMeasured, showFullPHCalibration);

  // Custom accordion control with progress badge
  const AccordionControlWithProgress: React.FC<{
    sectionKey: string;
    icon: React.ReactNode;
    label: string;
  }> = ({ sectionKey, icon, label }) => {
    const config = sectionConfigs[sectionKey];
    const progress = getSectionProgress(formData, config);
    const isOpen = openSections.includes(sectionKey);

    return (
      <Box
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleSectionClick(sectionKey, false);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          cursor: "pointer"
        }}
      >
        <Group gap="xs" style={{ flex: 1 }}>
          {icon}
          <Text fw={500}>{label}</Text>
        </Group>
        {!isOpen && (
          <ProgressBadge
            filled={progress.filled}
            total={progress.total}
            allOptional={progress.allOptional}
            complete={progress.complete}
          />
        )}
        <Box
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSectionClick(sectionKey, true);
          }}
          style={{
            marginLeft: "0.5rem",
            padding: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center"
          }}
        >
          <IconChevronDown
            size={18}
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms ease"
            }}
          />
        </Box>
      </Box>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? "Edit Variable" : "Add Variable"}
      size="xl"
      centered
    >
      <ScrollArea h={550} offsetScrollbars>
        <Accordion
          multiple
          value={openSections}
          variant="separated"
          chevron={null}
        >
          {/* Basic Information Section */}
          <Accordion.Item value="basic">
            <Accordion.Control>
              <AccordionControlWithProgress
                sectionKey="basic"
                icon={<IconInfoCircle size={18} />}
                label="Basic Information"
              />
            </Accordion.Control>
            <Accordion.Panel key={`basic-panel-${formData.measurement_method || "none"}`}>
              <Stack gap="sm">
                {/* Row 1: Variable full name | Variable name in data files */}
                <Group grow>
                  <TextInput
                    label="Variable full name"
                    placeholder="Full descriptive name"
                    value={formData.long_name || ""}
                    onChange={(e) => updateField("long_name", e.target.value)}
                    required
                  />
                  <TextInput
                    label="Variable name in data files"
                    placeholder="e.g., pH_total, DIC, TA"
                    value={formData.dataset_variable_name || ""}
                    onChange={(e) =>
                      updateField("dataset_variable_name", e.target.value)
                    }
                    required
                  />
                </Group>

                {/* Row 2: What is the observed property? | Unit */}
                <Group grow>
                  <Select
                    label="What is the observed property?"
                    placeholder="Select variable type"
                    data={VARIABLE_TYPE_OPTIONS}
                    value={formData.variable_type || null}
                    onChange={(value) => updateField("variable_type", value)}
                    required
                  />
                  <TextInput
                    label="Unit"
                    placeholder="e.g., umol/kg, dimensionless"
                    value={formData.variable_unit || ""}
                    onChange={(e) =>
                      updateField("variable_unit", e.target.value)
                    }
                    required
                  />
                </Group>

                {/* Row 3: Measured or calculated */}
                <Select
                  label="Was this variable measured directly or calculated?"
                  placeholder="Select measurement method"
                  data={MEASUREMENT_METHOD_OPTIONS}
                  value={formData.measurement_method || null}
                  onChange={(value) => updateField("measurement_method", value)}
                  required
                />

                {/* Row 4: Discrete or continuous - only show for measured */}
                {isMeasured && (
                  <Select
                    label="Were the measurements taken from discrete bottles or continuous sensors?"
                    placeholder="Select measurement type"
                    data={MEASUREMENT_TYPE_OPTIONS}
                    value={formData.measurement_type || null}
                    onChange={(value) => updateField("measurement_type", value)}
                    required
                  />
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Sampling Section - Shown only if measured */}
          {showSamplingSection && (
            <Accordion.Item value="sampling">
              <Accordion.Control>
                <AccordionControlWithProgress
                  sectionKey="sampling"
                  icon={<IconFlask size={18} />}
                  label="Sampling"
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Textarea
                    label="Sampling method"
                    placeholder="Describe how samples were collected"
                    value={formData.sampling_method || ""}
                    onChange={(e) =>
                      updateField("sampling_method", e.target.value)
                    }
                    rows={3}
                  />
                  <TextInput
                    label="Field replicate information"
                    placeholder="e.g., triplicate samples"
                    value={formData.field_replicate_information || ""}
                    onChange={(e) =>
                      updateField("field_replicate_information", e.target.value)
                    }
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* Analysis Section - Shown if measured */}
          {showAnalysisSection && (
            <Accordion.Item value="analysis">
              <Accordion.Control>
                <AccordionControlWithProgress
                  sectionKey="analysis"
                  icon={<IconMicroscope size={18} />}
                  label="Analysis"
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Textarea
                    label="Analyzing method"
                    placeholder="Describe the analysis method used"
                    value={formData.analyzing_method || ""}
                    onChange={(e) =>
                      updateField("analyzing_method", e.target.value)
                    }
                    rows={3}
                  />
                  {isPH && (
                    <>
                      <Group grow>
                        <TextInput
                          label="Measurement temperature"
                          placeholder="Temperature at which pH was measured"
                          value={formData.measurement_temperature || ""}
                          onChange={(e) =>
                            updateField(
                              "measurement_temperature",
                              e.target.value
                            )
                          }
                        />
                        <TextInput
                          label="pH report temperature"
                          placeholder="Temperature at which pH is reported"
                          value={formData.ph_report_temperature || ""}
                          onChange={(e) =>
                            updateField("ph_report_temperature", e.target.value)
                          }
                          required={showFullPHCalibration}
                        />
                      </Group>
                      <TextInput
                        label="Temperature correction method"
                        placeholder="Method used to correct pH for temperature"
                        value={formData.temperature_correction_method || ""}
                        onChange={(e) =>
                          updateField(
                            "temperature_correction_method",
                            e.target.value
                          )
                        }
                      />
                    </>
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* Instrument Section - Shown if measured */}
          {showInstrumentSection && (
            <Accordion.Item value="instrument">
              <Accordion.Control>
                <AccordionControlWithProgress
                  sectionKey="instrument"
                  icon={<IconTool size={18} />}
                  label="Analyzing Instrument"
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <TextInput
                    label="Instrument type"
                    placeholder="e.g., Spectrophotometer, VINDTA"
                    value={formData.analyzing_instrument?.instrument_type || ""}
                    onChange={(e) =>
                      updateNestedField(
                        "analyzing_instrument",
                        "instrument_type",
                        e.target.value
                      )
                    }
                    required
                  />
                  <Group grow>
                    <TextInput
                      label="Manufacturer"
                      placeholder="e.g., Agilent"
                      value={formData.analyzing_instrument?.manufacturer || ""}
                      onChange={(e) =>
                        updateNestedField(
                          "analyzing_instrument",
                          "manufacturer",
                          e.target.value
                        )
                      }
                    />
                    <TextInput
                      label="Model"
                      placeholder="Model number"
                      value={formData.analyzing_instrument?.model || ""}
                      onChange={(e) =>
                        updateNestedField(
                          "analyzing_instrument",
                          "model",
                          e.target.value
                        )
                      }
                    />
                  </Group>
                  <TextInput
                    label="Serial number"
                    placeholder="Instrument serial number"
                    value={formData.analyzing_instrument?.serial_number || ""}
                    onChange={(e) =>
                      updateNestedField(
                        "analyzing_instrument",
                        "serial_number",
                        e.target.value
                      )
                    }
                  />
                  <Group grow>
                    <TextInput
                      label="Precision"
                      placeholder="Instrument precision"
                      value={formData.analyzing_instrument?.precision || ""}
                      onChange={(e) =>
                        updateNestedField(
                          "analyzing_instrument",
                          "precision",
                          e.target.value
                        )
                      }
                      required
                    />
                    <TextInput
                      label="Accuracy"
                      placeholder="Instrument accuracy"
                      value={formData.analyzing_instrument?.accuracy || ""}
                      onChange={(e) =>
                        updateNestedField(
                          "analyzing_instrument",
                          "accuracy",
                          e.target.value
                        )
                      }
                      required
                    />
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* Calibration Section - pH-specific, discrete + measured only */}
          {showCalibrationSection && (
            <Accordion.Item value="calibration">
              <Accordion.Control>
                <AccordionControlWithProgress
                  sectionKey="calibration"
                  icon={<IconAdjustments size={18} />}
                  label="pH Calibration"
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Text size="sm" fw={500} c="dimmed">
                    Dye Information
                  </Text>
                  <TextInput
                    label="Type of dye and manufacturer"
                    placeholder="e.g., m-cresol purple from Sigma-Aldrich"
                    value={
                      formData.analyzing_instrument?.calibration
                        ?.dye_type_and_manufacturer || ""
                    }
                    onChange={(e) =>
                      updateCalibrationField(
                        "dye_type_and_manufacturer",
                        e.target.value
                      )
                    }
                    required
                  />
                  <Checkbox
                    label="Dye has been purified"
                    checked={
                      formData.analyzing_instrument?.calibration
                        ?.dye_purified || false
                    }
                    onChange={(e) =>
                      updateCalibrationField(
                        "dye_purified",
                        e.currentTarget.checked
                      )
                    }
                  />
                  {!formData.analyzing_instrument?.calibration
                    ?.dye_purified && (
                    <TextInput
                      label="Correction for unpurified dye"
                      placeholder="Correction method applied"
                      value={
                        formData.analyzing_instrument?.calibration
                          ?.correction_for_unpurified_dye || ""
                      }
                      onChange={(e) =>
                        updateCalibrationField(
                          "correction_for_unpurified_dye",
                          e.target.value
                        )
                      }
                    />
                  )}
                  <TextInput
                    label="Dye correction method"
                    placeholder="Method used to correct for dye effects"
                    value={
                      formData.analyzing_instrument?.calibration
                        ?.dye_correction_method || ""
                    }
                    onChange={(e) =>
                      updateCalibrationField(
                        "dye_correction_method",
                        e.target.value
                      )
                    }
                  />

                  <Divider my="xs" />
                  <Text size="sm" fw={500} c="dimmed">
                    Calibration Details
                  </Text>

                  <Select
                    label="Calibration type"
                    placeholder="Select calibration type"
                    data={[
                      { value: "factory", label: "Factory calibration" },
                      { value: "lab", label: "Lab calibration" },
                      { value: "field", label: "Field calibration" }
                    ]}
                    value={
                      formData.analyzing_instrument?.calibration
                        ?.calibration_type || null
                    }
                    onChange={(value) =>
                      updateCalibrationField("calibration_type", value)
                    }
                    required
                  />
                  <Textarea
                    label="Calibration technique description"
                    placeholder="Details of the calibration technique"
                    value={
                      formData.analyzing_instrument?.calibration
                        ?.technique_description || ""
                    }
                    onChange={(e) =>
                      updateCalibrationField(
                        "technique_description",
                        e.target.value
                      )
                    }
                    rows={2}
                    required
                  />
                  <Group grow>
                    <TextInput
                      label="pH of standards"
                      placeholder="pH values of calibration standards"
                      value={
                        formData.analyzing_instrument?.calibration
                          ?.ph_of_standards || ""
                      }
                      onChange={(e) =>
                        updateCalibrationField(
                          "ph_of_standards",
                          e.target.value
                        )
                      }
                    />
                    <TextInput
                      label="Calibration temperature"
                      placeholder="Temperature of calibration"
                      value={
                        formData.analyzing_instrument?.calibration
                          ?.calibration_temperature || ""
                      }
                      onChange={(e) =>
                        updateCalibrationField(
                          "calibration_temperature",
                          e.target.value
                        )
                      }
                    />
                  </Group>
                  <Group grow>
                    <TextInput
                      label="Frequency of calibration"
                      placeholder="How often calibrated"
                      value={
                        formData.analyzing_instrument?.calibration?.frequency ||
                        ""
                      }
                      onChange={(e) =>
                        updateCalibrationField("frequency", e.target.value)
                      }
                    />
                    <TextInput
                      label="Last calibration date"
                      placeholder="YYYY-MM-DD"
                      value={
                        formData.analyzing_instrument?.calibration
                          ?.last_calibration_date || ""
                      }
                      onChange={(e) =>
                        updateCalibrationField(
                          "last_calibration_date",
                          e.target.value
                        )
                      }
                    />
                  </Group>
                  <TextInput
                    label="Calibration method reference"
                    placeholder="Citation for calibration method"
                    value={
                      formData.analyzing_instrument?.calibration
                        ?.method_reference || ""
                    }
                    onChange={(e) =>
                      updateCalibrationField("method_reference", e.target.value)
                    }
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* Calculation Section - Shown if calculated */}
          {showCalculationSection && (
            <Accordion.Item value="calculation">
              <Accordion.Control>
                <AccordionControlWithProgress
                  sectionKey="calculation"
                  icon={<IconCalculator size={18} />}
                  label="Calculation Details"
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Textarea
                    label="Calculation method"
                    placeholder="e.g., Using CO2SYS with Lueker et al. (2000) constants"
                    value={formData.calculation_method || ""}
                    onChange={(e) =>
                      updateField("calculation_method", e.target.value)
                    }
                    rows={3}
                    required
                  />
                  <TextInput
                    label="Calculation parameters"
                    placeholder="Parameters used in the calculation"
                    value={formData.calculation_parameters || ""}
                    onChange={(e) =>
                      updateField("calculation_parameters", e.target.value)
                    }
                  />
                  <Group grow>
                    <TextInput
                      label="Calculation software"
                      placeholder="e.g., CO2SYS, seacarb"
                      value={formData.calculation_software || ""}
                      onChange={(e) =>
                        updateField("calculation_software", e.target.value)
                      }
                    />
                    <TextInput
                      label="Software version"
                      placeholder="e.g., v3.2.1"
                      value={formData.calculation_software_version || ""}
                      onChange={(e) =>
                        updateField(
                          "calculation_software_version",
                          e.target.value
                        )
                      }
                    />
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* QC Section - Always shown (at end) */}
          {(showSamplingSection || showCalculationSection) && (
            <Accordion.Item value="qc">
              <Accordion.Control>
                <AccordionControlWithProgress
                  sectionKey="qc"
                  icon={<IconShieldCheck size={18} />}
                  label="Quality Control"
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Textarea
                    label="QC steps taken"
                    placeholder="Describe quality control steps"
                    value={formData.qc_steps_taken || ""}
                    onChange={(e) =>
                      updateField("qc_steps_taken", e.target.value)
                    }
                    rows={3}
                  />
                  <Group grow>
                    <TextInput
                      label="Uncertainty"
                      placeholder="e.g., ±0.01 pH units"
                      value={formData.uncertainty || ""}
                      onChange={(e) =>
                        updateField("uncertainty", e.target.value)
                      }
                    />
                    <TextInput
                      label="QC Researcher Institution"
                      placeholder="Institution name"
                      value={formData.qc_researcher_institution || ""}
                      onChange={(e) =>
                        updateField("qc_researcher_institution", e.target.value)
                      }
                    />
                  </Group>
                  <Textarea
                    label="How was uncertainty defined?"
                    placeholder="Description of uncertainty calculation"
                    value={formData.uncertainty_definition || ""}
                    onChange={(e) =>
                      updateField("uncertainty_definition", e.target.value)
                    }
                    rows={2}
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}

          {/* Additional Info Section - Always shown (at end) */}
          {(showSamplingSection || showCalculationSection) && (
            <Accordion.Item value="additional">
              <Accordion.Control>
                <AccordionControlWithProgress
                  sectionKey="additional"
                  icon={<IconFileDescription size={18} />}
                  label="Additional Information"
                />
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <TextInput
                    label="Missing value indicators"
                    placeholder="e.g., -999, NaN, NA"
                    value={formData.missing_value_indicators || ""}
                    onChange={(e) =>
                      updateField("missing_value_indicators", e.target.value)
                    }
                  />
                  <TextInput
                    label="Method reference"
                    placeholder="Citation for the method used"
                    value={formData.method_reference || ""}
                    onChange={(e) =>
                      updateField("method_reference", e.target.value)
                    }
                  />
                  <TextInput
                    label="Weather or climate quality"
                    placeholder="Weather or climate quality classification"
                    value={formData.weather_or_climate_quality || ""}
                    onChange={(e) =>
                      updateField("weather_or_climate_quality", e.target.value)
                    }
                  />
                  <Textarea
                    label="Other detailed information"
                    placeholder="Any additional information about this variable"
                    value={formData.other_detailed_information || ""}
                    onChange={(e) =>
                      updateField("other_detailed_information", e.target.value)
                    }
                    rows={3}
                  />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}
        </Accordion>
      </ScrollArea>

      <Group justify="flex-end" gap="sm" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            !formData.variable_type ||
            !formData.dataset_variable_name ||
            !formData.long_name
          }
        >
          {isEditing ? "Update Variable" : "Add Variable"}
        </Button>
      </Group>
    </Modal>
  );
}
