/**
 * Column sets from the OAE Data Protocol's downloadable data file templates.
 *
 * Transcribed verbatim from the template workbooks, quirks included — the point
 * is to match what people actually submit, so "Pressue_ATM_LICOR" and
 * "Aragonite_sauration_state" keep their upstream spelling and
 * "Number _of_individuals" keeps its stray space.
 */

export type TemplateId = "bottle" | "flow_through" | "autonomous" | "physiological";

export interface DataFileTemplate {
  id: TemplateId;
  label: string;
  columns: string[];
}

export const DATA_FILE_TEMPLATES: DataFileTemplate[] = [
  {
    id: "bottle",
    label: "Bottle",
    columns: [
      "Exp_ID",
      "Cruise_ID",
      "Section_ID",
      "Station_ID",
      "Cast_number",
      "Rosette_position",
      "Niskin_ID",
      "Niskin_flag",
      "Sample_ID",
      "Year_UTC",
      "Month_UTC",
      "Day_UTC",
      "Time_UTC",
      "Yearday_UTC",
      "Latitude",
      "Longitude",
      "Depth_bottom",
      "CTDPRES",
      "Depth",
      "TEMP_ITS90",
      "TEMP_flag",
      "SAL_PSS78",
      "SAL_flag",
      "Salinity_PSS78",
      "Salinity_flag",
      "Doxy",
      "Doxy_flag",
      "Oxygen",
      "Oxygen_flag",
      "DIC",
      "DIC_flag",
      "TA",
      "TA_flag",
      "pH_T_measured",
      "TEMP_PH",
      "pH_flag",
      "Carbonate_measured",
      "TEMP_Carbonate",
      "Carbonate_flag",
      "fCO2_measured",
      "TEMP_fCO2",
      "fCO2_flag",
      "Silicate",
      "Silicate_flag",
      "Phosphate",
      "Phosphate_flag",
      "Nitrate",
      "Nitrate_flag",
      "Nitrite",
      "Nitrite_flag",
      "Nitrate_and_Nitrite",
      "Nitrate_and_Nitrite_flag",
      "Ammonium",
      "Ammonium_flag",
    ],
  },
  {
    id: "flow_through",
    label: "Flow through (underway)",
    columns: [
      "Exp_ID",
      "Cruise_ID",
      "Year_UTC",
      "Month_UTC",
      "Day_UTC",
      "Time_UTC",
      "Yearday_UTC",
      "Latitude",
      "Longitude",
      "Depth",
      "temp_ITS90",
      "sal_PSS78",
      "Pressure_ATM",
      "Temperature_EQU_ITS90",
      "Pressure_EQU",
      "xCO2_EQU",
      "xCO2_ATM",
      "xCO2_ATM_interpolated",
      "fCO2_SW_SST",
      "fCO2_SW_flag",
      "fCO2_ATM_interpolated",
      "dfCO2",
      "pH_T_insitu",
      "pH_flag",
      "doxy",
      "doxygen_flag",
      "Percent_O2",
      "Percent_O2_flag",
      "chl_stmif",
      "chl_stmif_flag",
    ],
  },
  {
    id: "autonomous",
    label: "Autonomous vehicle",
    columns: [
      "Exp_ID",
      "WMO",
      "Platform_type",
      "Platform_name",
      "Year_UTC",
      "Month_UTC",
      "Day_UTC",
      "Time_UTC",
      "Yearday_UTC",
      "Latitude",
      "Longitude",
      "Depth",
      "temp_ITS90",
      "sal_PSS78",
      // Upstream typo, kept so real files match.
      "Pressue_ATM_LICOR",
      "Temperature_LICOR_ITS90",
      "xCO2_SW_wet",
      "xCO2_SW_flag",
      "xCO2_ATM_wet",
      "xCO2_ATM_flag",
      "xH2O_SW",
      "xH2O_ATM",
      "xCO2_SW_dry",
      "xCO2_ATM_dry",
      "fCO2_SW_sat",
      "fCO2_ATM_sat",
      "dfCO2",
      "pH_T_insitu",
      "pH_flag",
      "doxy",
      "doxy_flag",
      "percent_O2",
      "percent_O2_flag",
      "chl_stimf",
      "chl_stimf_flag",
      "rhodamine_fl",
      "rhodamine_fl_flag",
      "rhodamine_concentration",
    ],
  },
  {
    id: "physiological",
    label: "Physiological",
    columns: [
      "Exp_ID",
      "Measurement_ID",
      "Type_of_study",
      "Treatment_type",
      "Treatment_method",
      "Treatment_details",
      "Biological_subject",
      "Species_identification_code",
      "Life_stage",
      "Location_biological_subject_collected",
      "Northernmost_latitude",
      "Southernmost_latitude",
      "Westernmost_longitude",
      "Easternmost_longitude",
      "Date_biological_subject_collected",
      "Time_biological_subject_collected",
      "Experiment_location",
      "Tank_ID",
      "Tank_type",
      "Tank_volume",
      "Natural_or_artificial_seawater",
      "Location_seawater_collection",
      "Flow-through_or_static",
      "Flow_rate",
      "Target_treatment_level_fCO2",
      "Target_treatment_level_pHT",
      "Target_treatment_level_TA",
      "Exposure_type",
      // Upstream stray space, kept so real files match.
      "Number _of_individuals",
      "Date_experiment_start",
      "Time_experiment_start",
      "Date_sampling",
      "Time_sampling",
      "Experiment_duration",
      "Temperature_ITS90",
      "Salinity_PSS78",
      "DIC",
      "TA",
      "pH_T_insitu",
      "fCO2",
      // Upstream typo ("sauration"), kept so real files match.
      "Aragonite_sauration_state",
      "Calcite_saturation_state",
      "Oxygen",
      "Silicate",
      "Phosphate",
      "Nitrate",
      "Percent_hatched",
      "Percent_not_hatched",
      "Percent_abnormal",
      "Percent_live",
      "Percent_dead",
      "Date_death",
      "Organism_length",
      "Organism_weight",
      "Shell_length",
    ],
  },
];

const byId = new Map(DATA_FILE_TEMPLATES.map((t) => [t.id, t]));

export const getTemplate = (id: TemplateId): DataFileTemplate | undefined => byId.get(id);

const normalize = (name: string) => name.trim().toLowerCase();

export interface TemplateMatch {
  template: DataFileTemplate;
  /** Column names present in both the file and the template. */
  matched: string[];
  /** File columns the template does not define. */
  extra: string[];
  /** Template columns the file does not carry. */
  absent: string[];
}

export function matchTemplate(headers: string[], template: DataFileTemplate): TemplateMatch {
  const templateNames = new Set(template.columns.map(normalize));
  const fileNames = new Set(headers.map(normalize));

  return {
    template,
    matched: headers.filter((h) => templateNames.has(normalize(h))),
    extra: headers.filter((h) => !templateNames.has(normalize(h))),
    absent: template.columns.filter((c) => !fileNames.has(normalize(c))),
  };
}

/**
 * Guess which template a file follows. Requires a clear majority of the file's
 * columns to belong to one template, so an unrelated CSV matches nothing.
 */
export function detectTemplate(headers: string[]): TemplateMatch | undefined {
  if (headers.length === 0) return undefined;

  const best = DATA_FILE_TEMPLATES.map((t) => matchTemplate(headers, t)).sort(
    (a, b) => b.matched.length - a.matched.length,
  )[0];

  return best && best.matched.length * 2 > headers.length ? best : undefined;
}
