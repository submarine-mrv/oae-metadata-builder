# Compliance checker sample files

Drag these onto the drop zone at `http://localhost:3000/checker` (the page is not linked from any
menu — go to the URL directly). The same files back the unit tests in
`src/utils/__tests__/complianceChecker.test.ts`, so what you see by hand is what CI asserts.

| File | Expected result |
|---|---|
| `compliant.csv` | 5 passes, no warnings. 20 columns; 8 declare units, 5 marked not applicable. |
| `bottle_template.csv` | Protocol template shape. 29 columns past the `#` preamble, 4 passes, 3 warnings. |
| `noncompliant.csv` | 1 pass, 4 warnings: unrecognized columns, missing QC flag, orphan flag, no units row. |
| `empty.csv` | 1 failure: "No column headers detected". |
| `compliant.xlsx` | Byte-for-byte the same columns and units as `compliant.csv`, typed **XLSX**. |
| `model_output_v3.nc` | 2 passes, 2 warnings. All 11 variables declare units. |
| `model_output_v4.nc` | **Error.** See below — expected, not a broken file. |

## Tabular file shape

The protocol's Excel templates (`bottle`, `underway`, `autonomous`, `physiological`) all look like this,
and the parser follows the same rules for CSV, TSV, and XLSX:

```
# Project ID: OAE-DEMO-01          <- "#" lines are metadata, skipped
# Template version: 1.0.1
sample_id, latitude,         depth, temperature    <- first row that isn't "#" or blank
n.a.,      decimal degrees,  m,     deg_C          <- units row
OAE-001,   36.8021,          5.0,   13.42          <- data
```

`n.a.`, `n/a`, `none`, and `-` all mean "no units apply" and display as *not applicable*, which is
distinct from a blank cell (*not declared*).

A plain CSV with no units row still works: the row under the header is only read as units when it
doesn't look like data. `noncompliant.csv` covers that path.

## Why two NetCDF files

`netcdfjs`, the parser behind the NetCDF branch, reads **NetCDF v3 classic only**. NetCDF-4 is HDF5
underneath and it rejects the file outright. Since xarray and most ocean models write NetCDF-4 by
default, the checker will refuse most real model output. `model_output_v4.nc` is the same data as the
v3 file and exists to keep that limitation visible; a unit test asserts the current failure so it
flips green when the reader gains HDF5 support.

NetCDF carries units as a per-variable attribute rather than a units row, but both end up as the same
`ParsedColumn[]`, so the report's Columns and Units table looks identical either way.

## What the NetCDF samples contain

The OAE Data Protocol's [model data minimum set](https://www.carbontosea.org/oae-data-protocol/1-0-0/#model-data):
`dic` and `talk` (µmol/kg), `temperature` (degC), `salinity`, the 2D air-sea CO₂ flux `fgco2`
(mol/m²/s), grid cell `area` and `volume`, plus time/depth/lat/lon coordinates.

Worth noting when you run it: this conformant file still draws a warning that `talk`, `fgco2`, `area`,
and `volume` are "not in recommended list" — `RECOMMENDED_VARIABLES` doesn't cover the model-data
variables the protocol requires. Tracked in `oae-form-opb`.

## Regenerating

The CSVs are hand-written; edit them directly. The NetCDF pair comes from a one-off script:

```bash
uv run --with netCDF4 --with numpy scripts/make-netcdf-samples.py
```

`compliant.xlsx` is `compliant.csv` saved as a workbook:

```bash
node -e 'const X=require("xlsx"),fs=require("fs");X.writeFile(X.read(fs.readFileSync("tests/samples/compliant.csv","utf-8"),{type:"string",raw:true}),"tests/samples/compliant.xlsx")'
```
