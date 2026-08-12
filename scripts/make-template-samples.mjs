/**
 * Write template-derived sample workbooks into tests/samples/.
 *
 * These mirror the protocol's downloadable templates — the same `#` preamble,
 * header row and units row — but with the extraneous cells a submitter is
 * expected to clear removed:
 *
 *   - physiological drops the "(example response variables)" note that sits
 *     above the header row, several columns over, with no "#"
 *   - bottle drops the WOCE WHP reference block the template appends below the
 *     data rows
 *
 * `template_physiological_uncleaned.xlsx` keeps the note, so the failure the
 * checker raises for it can be seen by hand.
 *
 *   node scripts/make-template-samples.mjs
 */

import { writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const OUT = path.resolve("tests/samples");

// The autonomous template packs two units into one cell, "ppb, ug/L"; a plain
// comma split would tear it apart, so it travels as a token.
const TWO_UNIT_CELL = "__PPB_UGL__";
const split = (s) => s.split(",").map((c) => (c === TWO_UNIT_CELL ? "ppb, ug/L" : c));

const TEMPLATES = {
  bottle: {
    sheet: "bottle",
    preamble: [
      "# Project ID: carbondive_20250805_Hvalfjordur",
      "# Experiment ID: carbondive_20250805_Hvalfjordur_intervention01",
      "# mCDR experiment type: Intervention",
      "# Template version: 1.0.1",
      "# File last updated on: 2026-08-12",
      "# File prepared by: Firstname Lastname (Institution)",
      "# For questions please send a message to: <example@xxx.edu>",
      "# Lead PI: Firstname Lastname (institution)",
      "# Flag scheme: 0 = interpolated, 1 = not evaluated/quality unknown, 2 = acceptable, 9 = missing value",
      "# Link to the metadata:",
      "#",
    ],
    header: split(
      "Exp_ID,Cruise_ID,Section_ID,Station_ID,Cast_number,Rosette_position,Niskin_ID,Niskin_flag,Sample_ID,Year_UTC,Month_UTC,Day_UTC,Time_UTC,Yearday_UTC,Latitude,Longitude,Depth_bottom,CTDPRES,Depth,TEMP_ITS90,TEMP_flag,SAL_PSS78,SAL_flag,Salinity_PSS78,Salinity_flag,Doxy,Doxy_flag,Oxygen,Oxygen_flag,DIC,DIC_flag,TA,TA_flag,pH_T_measured,TEMP_PH,pH_flag,Carbonate_measured,TEMP_Carbonate,Carbonate_flag,fCO2_measured,TEMP_fCO2,fCO2_flag,Silicate,Silicate_flag,Phosphate,Phosphate_flag,Nitrate,Nitrate_flag,Nitrite,Nitrite_flag,Nitrate_and_Nitrite,Nitrate_and_Nitrite_flag,Ammonium,Ammonium_flag",
    ),
    units: split(
      "n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,hh:mm:ss,n.a.,decimal degrees,decimal degrees,m,dbar,m,deg_C,n.a.,n.a.,n.a.,n.a.,n.a.,umol/kg,n.a.,umol/kg,n.a.,umol/kg,n.a.,umol/kg,n.a.,n.a.,deg_C,n.a.,umol/kg,deg_C,n.a.,uatm,deg_C,n.a.,umol/kg,n.a.,umol/kg,n.a.,umol/kg,n.a.,umol/kg,n.a.,umol/kg,n.a.,umol/kg,n.a.",
    ),
    rows: [
      split(
        "33RO20200318,A16N2020,A16N,1,1,12,12,2,10112,2020,3,18,15:41,78.65,24.4673,-82.866,280,10.0,9.9,29.73,2,35.98,2,35.99,2,196.1,2,195.8,2,-999.0,9,-999.0,9,-999.000,-999.00,9,-999.0,-999.00,9,-999,20,9,-999.00,9,-999.00,9,-999.00,9,-999.00,9,-999.00,9,0.03,2",
      ),
      split(
        "33RO20200318,A16N2020,A16N,1,1,3,3,2,10103,2020,3,18,14:25,78.60,24.4673,-82.866,280,121.0,120.2,21.73,2,35.98,2,35.99,2,187.0,9,-999,9,2037.6,6,2378.9,6,8.084,25.00,2,241.5,25.00,2,295.15,20,2,0.40,2,0.03,2,0.00,2,0.00,2,0.00,2,0.06,2",
      ),
    ],
  },

  flow_through: {
    sheet: "flow_through",
    preamble: [
      "# Project ID: carbondive_20250805_Hvalfjordur",
      "# Experiment ID: carbondive_20250805_Hvalfjordur_intervention01",
      "# Template version: 1.0.1",
      "# Platform type: SOOP",
      "# Lead PI: Firstname Lastname (institution)",
      "# Notes: Unless labeled otherwise, all variables are measured from autonomous sensors",
    ],
    header: split(
      "Exp_ID,Cruise_ID,Year_UTC,Month_UTC,Day_UTC,Time_UTC,Yearday_UTC,Latitude,Longitude,Depth,temp_ITS90,sal_PSS78,Pressure_ATM,Temperature_EQU_ITS90,Pressure_EQU,xCO2_EQU,xCO2_ATM,xCO2_ATM_interpolated,fCO2_SW_SST,fCO2_SW_flag,fCO2_ATM_interpolated,dfCO2,pH_T_insitu,pH_flag,doxy,doxygen_flag,Percent_O2,Percent_O2_flag,chl_stmif,chl_stmif_flag",
    ),
    units: split(
      "n.a.,n.a.,n.a.,n.a.,n.a.,hh:mm:ss,n.a.,decimal degrees,decimal degrees,m,degrees Celsius,n.a.,hPa,degrees Celsius,hPa,umol/mol,umol/mol,umol/mol,uatm,n.a.,uatm,uatm,n.a.,n.a.,umol/kg,n.a.,n.a.,n.a.,ug/L,n.a.",
    ),
    rows: [
      split(
        "33RO20200318,RB1203,2020,2,26,0:17,57.01,36.998,-76.088,5.0,16.027,33.325,1018.0,16.39,1022.2,377.7,394,394.1,367.2,3,387.6,-20.4,-999,9,-999,9,101.52,2,-999,9",
      ),
      split(
        "33RO20200318,RB1203,2020,2,26,3:17,57.14,36.998,-76.088,5.0,16.045,33.315,1017.9,16.3,1021.7,376.8,394,394.1,367.9,2,387.6,-19.7,-999,9,-999,9,101.48,2,-999,9",
      ),
    ],
  },

  autonomous: {
    sheet: "autonomous",
    preamble: [
      "# Project ID: carbondive_20250805_Hvalfjordur",
      "# Experiment ID: carbondive_20250805_Hvalfjordur_intervention01",
      "# Template version: 1.0.1",
      "# Lead PI: Firstname Lastname (institution)",
      "# Notes: Unless labeled otherwise, all variables are measured from autonomous sensors",
    ],
    header: split(
      "Exp_ID,WMO,Platform_type,Platform_name,Year_UTC,Month_UTC,Day_UTC,Time_UTC,Yearday_UTC,Latitude,Longitude,Depth,temp_ITS90,sal_PSS78,Pressue_ATM_LICOR,Temperature_LICOR_ITS90,xCO2_SW_wet,xCO2_SW_flag,xCO2_ATM_wet,xCO2_ATM_flag,xH2O_SW,xH2O_ATM,xCO2_SW_dry,xCO2_ATM_dry,fCO2_SW_sat,fCO2_ATM_sat,dfCO2,pH_T_insitu,pH_flag,doxy,doxy_flag,percent_O2,percent_O2_flag,chl_stimf,chl_stimf_flag,rhodamine_fl,rhodamine_fl_flag,rhodamine_concentration",
    ),
    units: split(
      "n.a.,n.a.,n.a.,n.a.,YYYY,MM,DD,hh:mm:ss,n.a.,decimal degrees,decimal degrees,m,degrees Celsius,n.a.,hPa,degrees Celsius,umol/mol,n.a.,umol/mol,n.a.,mmol/mol,mmol/mol,umol/mol,umol/mol,uatm,uatm,uatm,n.a.,n.a.,umol/kg,n.a.,n.a.,n.a.,ug/L,n.a.,RFU,n.a.,__PPB_UGL__",
    ),
    rows: [
      split(
        "cd2025_02_intervention,302,Mooring,skippy,2025,2,26,0:17,57.01,36.998,-76.088,5.0,20.5,35.1,1010.7,11,249.3,2,409.4,2,2.42,2.32,249.9,410.4,-999,-999,-999,-999,9,-999,9,101.52,2,-999,9,-999,9,",
      ),
      split(
        "cd2025_02_intervention,558,Surface glider,glidie,2025,2,26,6:17,57.26,36.998,-76.088,5.0,20.5,35.1,1010.9,10,254.8,2,415.8,2,2.54,2.45,255.5,416.8,-999,-999,-999,-999,9,-999,9,101.47,2,-999,9,-999,9,",
      ),
    ],
  },

  physiological: {
    sheet: "physiological",
    preamble: [
      "# Project ID: carbondive_20250805_Hvalfjordur",
      "# Experiment ID: carbondive_20250805_Hvalfjordur_intervention01",
      "# Template version: 1.0.1",
      "# Lead PI: Firstname Lastname (institution)",
      "# Notes: For pH, T stands for total scale.",
    ],
    header: split(
      "Exp_ID,Measurement_ID,Type_of_study,Treatment_type,Treatment_method,Treatment_details,Biological_subject,Species_identification_code,Life_stage,Location_biological_subject_collected,Northernmost_latitude,Southernmost_latitude,Westernmost_longitude,Easternmost_longitude,Date_biological_subject_collected,Time_biological_subject_collected,Experiment_location,Tank_ID,Tank_type,Tank_volume,Natural_or_artificial_seawater,Location_seawater_collection,Flow-through_or_static,Flow_rate,Target_treatment_level_fCO2,Target_treatment_level_pHT,Target_treatment_level_TA,Exposure_type,Number _of_individuals,Date_experiment_start,Time_experiment_start,Date_sampling,Time_sampling,Experiment_duration,Temperature_ITS90,Salinity_PSS78,DIC,TA,pH_T_insitu,fCO2,Aragonite_sauration_state,Calcite_saturation_state,Oxygen,Silicate,Phosphate,Nitrate,Percent_hatched,Percent_not_hatched,Percent_abnormal,Percent_live,Percent_dead,Date_death,Organism_length,Organism_weight,Shell_length",
    ),
    units: split(
      "n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,n.a.,decimal degrees,decimal degrees,decimal degrees,decimal degrees,YYYY-MM-DD,hh:mm,n.a.,n.a.,n.a.,L,n.a.,n.a.,n.a.,L/min,uatm,n.a.,umol/kg,n.a.,n.a.,YYYY-MM-DD,[hh:mm:ss],YYYY-MM-DD,[hh:mm:ss],days,deg_C,n.a.,umol/kg,umol/kg,n.a.,uatm,n.a.,n.a.,umol/kg,umol/kg,umol/kg,umol/kg,n.a.,n.a.,n.a.,n.a.,n.a.,YYYY-MM-DD,mm,gram,mm",
    ),
    rows: [
      split(
        "33RO20200318,1,Laboratory experiment,Acidification,Bubbling CO2,,Pseudopleuronectes americanus,ITIS-172905,egg,Puget Sound,35.2,-15.8,-123,-110,2020-05-12,13:45,Northwest Fisheries Science Center,1,polypropylene plastic tank,800,natural,Puget Sound,static,5,300,8.2,2400,dark,25,2020-05-12,13:50,2020-05-27,13:50,15,25.73,35.99,2037.6,2378.9,8.08,295,2.53,3.70,195.8,-999.0,-999.0,-999.0,5%,5%,5%,5%,5%,2020-02-15,3.0,2.2,n.a.",
      ),
    ],
    /** The note the submitter is expected to delete, several columns over. */
    strayNote: (() => {
      const row = Array(55).fill("");
      row[46] = "(example response variables)";
      return row;
    })(),
  },
};

/** The WOCE reference block bottle.xlsx appends below its data. */
const BOTTLE_FOOTER = [
  [
    "(For reference, below are their corresponding WOCE WHP column headers, please feel free to delete them when you prepare your data files)",
  ],
  split(
    "EXPOCODE,N/A,SECT_ID,STNNBR,CASTNO,BTLNBR,N/A,BTLNBR_FLAG_W,SAMPNO,DATE,DATE,DATE,TIME,N/A,LATITUDE,LONGITUDE,DEPTH (METERS),CTDPRS (DBAR),N/A,CTDTMP (ITS-90),N/A,CTDSAL (PSS-78),CTDSAL_FLAG_W,SALNTY (PSS-78),SALNTY_FLAG_W,CTDOXY (UMOL/KG),CTDOXY_FLAG_W,OXYGEN (UMOL/kg),OXYGEN_FLAG_W,TCARBN (UMOL/kg),TCARBN_FLAG_W,ALKALI (UMOL/kg),ALKALI_FLAG_W,PH_TOT,PH_TMP (DEG_C),PH_TOT_FLAG_W,N/A,N/A,N/A,FCO2 (UATM),FCO2TMP (DEG_C),FCO2_FLAG_W,SILCAT (UMOL/KG),SILCAT_FLAG_W,PHSPHT (UMOL/KG),PHSPHT_FLAG_W,NITRAT (UMOL/KG),NITRAT_FLAG_W,NITRIT (UMOL/KG),NITRIT_FLAG_W,NO2+NO3 (UMOL/KG),NO2+NO3_FLAG_W,NH4 (UMOL/KG),NH4_FLAG_W",
  ),
];

function write(filename, sheetName, rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheetName);
  // SheetJS's ESM build has no fs bound, so write the buffer ourselves.
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  writeFileSync(path.join(OUT, filename), buffer);
  console.log(`wrote ${filename} (${rows.length} rows, ${rows[rows.length - 1].length} columns)`);
}

for (const [id, t] of Object.entries(TEMPLATES)) {
  if (t.header.length !== t.units.length) {
    throw new Error(`${id}: header has ${t.header.length} cells, units row has ${t.units.length}`);
  }
  const preamble = t.preamble.map((line) => [line]);
  write(`template_${id}.xlsx`, t.sheet, [...preamble, t.header, t.units, ...t.rows]);
}

// Uncleaned variants, kept so the failures can be seen by hand.
write("template_physiological_uncleaned.xlsx", "physiological", [
  ...TEMPLATES.physiological.preamble.map((line) => [line]),
  TEMPLATES.physiological.strayNote,
  TEMPLATES.physiological.header,
  TEMPLATES.physiological.units,
  ...TEMPLATES.physiological.rows,
]);

write("template_bottle_uncleaned.xlsx", "bottle", [
  ...TEMPLATES.bottle.preamble.map((line) => [line]),
  TEMPLATES.bottle.header,
  TEMPLATES.bottle.units,
  ...TEMPLATES.bottle.rows,
  ...BOTTLE_FOOTER,
]);

writeFileSync(
  path.join(OUT, ".template-samples-source"),
  "Generated by scripts/make-template-samples.mjs\n",
);
