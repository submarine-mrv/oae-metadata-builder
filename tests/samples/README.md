# Compliance checker sample files

Drag these onto the drop zone at `http://localhost:3000/checker` (the page is not linked from any
menu — go to the URL directly). The same files back the unit tests in
`src/utils/__tests__/complianceChecker.test.ts`, so what you see by hand is what CI asserts.

| File | Expected result |
|---|---|
| `compliant.csv` | 4 passes, no warnings. A minimal Bottle-template file, 18 columns. |
| `bottle_template.csv` | Full Bottle template shape. 29 columns past the `#` preamble, 4 passes, no warnings. |
| `noncompliant.csv` | 1 pass, 2 warnings, **1 failure** — it has no units row. |
| `empty.csv` | 1 failure: "No column headers detected". |
| `compliant.xlsx` | The same columns and units as `compliant.csv`, typed **XLSX**. |
| `model_output_v3.nc` | 1 pass, 1 warning. All 11 variables declare units; names not judged (see below). |
| `model_output_v4.nc` | **Error.** See below — expected, not a broken file. |

## Tabular file shape

The protocol's Excel templates (`bottle`, `flow through`, `autonomous`, `physiological`) all look like
this, and the parser follows the same rules for CSV, TSV, and XLSX:

```
# Project ID: OAE-DEMO-01          <- "#" in column 1 marks a comment row, skipped
# Template version: 1.0.1
#                                  <- the templates end the preamble with a bare "#"
sample_id, latitude,         depth, temperature    <- first row that isn't "#" or blank
n.a.,      decimal degrees,  m,     deg_C          <- units row, immediately below
OAE-001,   36.8021,          5.0,   13.42          <- data
```

Comment rows may appear anywhere, including between the header and units rows, but the `#` must be in
the first column. A comment containing commas is quoted, as in
`"# Flag scheme: 0 = interpolated, 2 = acceptable"`.

`n.a.`, `n/a`, `none`, and `-` all mean "no units apply" and display as *not applicable*, distinct
from a blank cell (*not declared*).

**The units row is required.** Since no unit is a bare number, a numeric value directly below the
header means that row is the first data record and the file has no units row — that's a failure, not
a warning. `noncompliant.csv` covers it.

Anything below the data is ignored, including the WOCE reference block the `bottle` template appends
under its records.

## Why two NetCDF files

`netcdfjs`, the parser behind the NetCDF branch, reads **NetCDF v3 classic only**. NetCDF-4 is HDF5
underneath and it rejects the file outright. Since xarray and most ocean models write NetCDF-4 by
default, the checker will refuse most real model output. `model_output_v4.nc` is the same data as the
v3 file and exists to keep that limitation visible; a unit test asserts the current failure so it
flips green when the reader gains HDF5 support.

NetCDF carries units as a per-variable attribute rather than a units row, but both end up as the same
`ParsedColumn[]`, so the report's Columns and Units table looks identical either way.

## What the NetCDF samples contain

The quantities and units are the protocol's
[model data minimum set](https://www.carbontosea.org/oae-data-protocol/1-0-0/#model-data): dissolved
inorganic carbon and total alkalinity (µmol/kg), temperature (degC), salinity, the 2D air-sea CO₂
flux (mol/m²/s), and grid cell area and volume.

**The variable names are ours, not the protocol's.** `dic`, `talk`, `fgco2`, `area`, `volume` and the
`standard_name` attributes are CMIP/CF conventions we picked, because the protocol's Model Output
Variables naming table is not published in a form we can read. Nothing validates against them — they
are a fixture that exercises the NetCDF parser and the units check, and any names would serve. Do not
treat this file as a statement of what the protocol requires a variable to be called.

Recommended column names are derived from the four spreadsheet templates, so they say nothing about
NetCDF. The protocol's Model Output Variables naming table is not published in a form we can read, so
NetCDF variable names are listed but not judged, and the QC flag expectations are skipped too. Guessing
those names is what produced the previous hand-written list. Tracked in `oae-form-opb`.

## Regenerating

The CSVs are hand-written; edit them directly. The NetCDF pair comes from a one-off script:

```bash
uv run --with netCDF4 --with numpy scripts/make-netcdf-samples.py
```

`compliant.xlsx` is `compliant.csv` saved as a workbook:

```bash
node -e 'const X=require("xlsx"),fs=require("fs");X.writeFile(X.read(fs.readFileSync("tests/samples/compliant.csv","utf-8"),{type:"string",raw:true}),"tests/samples/compliant.xlsx")'
```
