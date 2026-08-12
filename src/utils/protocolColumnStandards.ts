/**
 * Column header standards from the OAE Data Protocol's published tables.
 *
 * Transcribed from the three expandable tables at
 * https://www.carbontosea.org/oae-data-protocol/1-0-0/#column-header-names
 * (general and chemical oceanographic, sensor-observed, underway pCO2).
 *
 * Generated from the rendered page rather than typed by hand. There is no
 * equivalent table for physiological data or for model output; model output
 * defers to CF conventions instead.
 */

export type StandardSection = "general" | "sensor" | "underway";

export interface StandardColumn {
  name: string;
  /** Unit as the protocol writes it. "N/A" where the protocol says so. */
  unit: string;
  section: StandardSection;
}

export const PROTOCOL_COLUMN_STANDARDS: StandardColumn[] = [
  // General and chemical oceanographic — 47 names
  { name: "station_id", unit: "N/A", section: "general" },
  { name: "cast_number", unit: "N/A", section: "general" },
  { name: "rosette_position", unit: "N/A", section: "general" },
  { name: "niskin_id", unit: "N/A", section: "general" },
  { name: "niskin_flag", unit: "N/A", section: "general" },
  { name: "sample_id", unit: "N/A", section: "general" },
  { name: "year_utc", unit: "YYYY", section: "general" },
  { name: "month_utc", unit: "MM", section: "general" },
  { name: "day_utc", unit: "DD", section: "general" },
  { name: "time_utc", unit: "HHMMSS", section: "general" },
  { name: "yearday_utc", unit: "N/A", section: "general" },
  { name: "latitude", unit: "decimal degrees", section: "general" },
  { name: "longitude", unit: "decimal degrees", section: "general" },
  { name: "depth_bottom", unit: "m", section: "general" },
  { name: "ctdpres", unit: "dbar", section: "general" },
  { name: "depth", unit: "m", section: "general" },
  { name: "salinity_pss78", unit: "N/A", section: "general" },
  { name: "oxygen", unit: "umol/kg", section: "general" },
  { name: "dic", unit: "umol/kg", section: "general" },
  { name: "ta", unit: "umol/kg", section: "general" },
  { name: "ph_t_measured", unit: "N/A", section: "general" },
  { name: "temp_ph", unit: "deg_C", section: "general" },
  { name: "ph_t_insitu", unit: "N/A", section: "general" },
  { name: "carbonated_measured", unit: "umol/kg", section: "general" },
  { name: "temp_carbonate", unit: "deg_C", section: "general" },
  { name: "fco2_measured", unit: "uatm", section: "general" },
  { name: "temp_fco2", unit: "deg_C", section: "general" },
  { name: "pco2_insitu", unit: "", section: "general" },
  { name: "omega_aragonite", unit: "none", section: "general" },
  { name: "omega_calcite", unit: "none", section: "general" },
  { name: "pic", unit: "mol/m^3", section: "general" },
  { name: "poc", unit: "mg/m^3", section: "general" },
  { name: "toc", unit: "umol/kg", section: "general" },
  { name: "toc_l", unit: "umol/L", section: "general" },
  { name: "tic", unit: "", section: "general" },
  { name: "pim", unit: "mg/L", section: "general" },
  { name: "pom", unit: "mg/L", section: "general" },
  { name: "spm", unit: "mg/L", section: "general" },
  { name: "turbidity", unit: "NTU", section: "general" },
  { name: "silicate", unit: "umol/kg", section: "general" },
  { name: "phosphate", unit: "umol/kg", section: "general" },
  { name: "nitrate", unit: "umol/kg", section: "general" },
  { name: "nitrite", unit: "umol/kg", section: "general" },
  { name: "nitrate_and_nitrite", unit: "umol/kg", section: "general" },
  { name: "ammonium", unit: "umol/kg", section: "general" },
  { name: "wave_height", unit: "meters", section: "general" },
  { name: "wind_speed", unit: "m/s", section: "general" },
  // Sensor-observed — 26 names
  { name: "year_utc", unit: "YYYY", section: "sensor" },
  { name: "month_utc", unit: "MM", section: "sensor" },
  { name: "day_utc", unit: "DD", section: "sensor" },
  { name: "time_utc", unit: "HHMMSS", section: "sensor" },
  { name: "yearday_utc", unit: "N/A", section: "sensor" },
  { name: "latitude", unit: "decimal degree", section: "sensor" },
  { name: "longitude", unit: "decimal degree", section: "sensor" },
  { name: "depth", unit: "meter", section: "sensor" },
  { name: "temp_its90", unit: "degrees Celsius", section: "sensor" },
  { name: "sal_pss78", unit: "N/A", section: "sensor" },
  { name: "pressure_atm", unit: "hPa", section: "sensor" },
  { name: "pressure_atm_licor", unit: "hPa", section: "sensor" },
  { name: "temperature_licor_its90", unit: "degrees Celsius", section: "sensor" },
  { name: "xco2_sw_wet", unit: "μmol/mol", section: "sensor" },
  { name: "xco2_atm_wet", unit: "μmol/mol", section: "sensor" },
  { name: "xh2o_sw", unit: "μmol/mol", section: "sensor" },
  { name: "xh2o_atm", unit: "μmol/mol", section: "sensor" },
  { name: "xco2_sw_dry", unit: "μmol/mol", section: "sensor" },
  { name: "xco2_atm_dry", unit: "μmol/mol", section: "sensor" },
  { name: "fco2_sw_sat", unit: "μatm", section: "sensor" },
  { name: "fco2_atm_sat", unit: "μatm", section: "sensor" },
  { name: "dfco2", unit: "μatm", section: "sensor" },
  { name: "doxy", unit: "μmol/kg", section: "sensor" },
  { name: "percent_o2", unit: "N/A", section: "sensor" },
  { name: "chl_stimf", unit: "mg/m^3", section: "sensor" },
  { name: "rhodamine_fl", unit: "", section: "sensor" },
  // Underway pCO2 — 7 names
  { name: "temperature_equ_its90", unit: "degree Celsius", section: "underway" },
  { name: "pressure_equ", unit: "hPa", section: "underway" },
  { name: "xco2_equ", unit: "μmol/mol", section: "underway" },
  { name: "xco2_atm", unit: "μmol/mol", section: "underway" },
  { name: "xco2_atm_interpolated", unit: "μmol/mol", section: "underway" },
  { name: "fco2_sw_sst", unit: "μatm", section: "underway" },
  { name: "fco2_atm_interpolated", unit: "μatm", section: "underway" },
];
