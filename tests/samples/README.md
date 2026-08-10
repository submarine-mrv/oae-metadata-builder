# Compliance checker sample files

Drag these onto the drop zone at `http://localhost:3000/checker` (the page is not linked from any
menu — go to the URL directly). The same files back the unit tests in
`src/utils/__tests__/complianceChecker.test.ts`, so what you see by hand is what CI asserts.

| File | Expected result |
|---|---|
| `compliant.csv` | 3 passes, no warnings. 20 columns, 13 recommended names, 7 with QC flags. |
| `noncompliant.csv` | 1 pass, 3 warnings: 6 unrecognized columns, `depth` missing a QC flag, orphan `dissolved_oxygen_flag`. |
| `empty.csv` | 1 failure: "No column headers detected". |
| `compliant.xlsx` | Same as `compliant.csv`, and the header must read **XLSX file**. |
| `model_output_v3.nc` | 2 passes, 2 warnings. All 11 variables have units. |
| `model_output_v4.nc` | **Error.** See below — this is expected, not a broken file. |

## Why two NetCDF files

`netcdfjs`, the parser behind the NetCDF branch, reads **NetCDF v3 classic only**. NetCDF-4 is HDF5
underneath and it rejects the file outright. Since xarray and most ocean models write NetCDF-4 by
default, the checker will refuse most real model output. `model_output_v4.nc` is byte-for-byte the
same data as the v3 file and exists to keep that limitation visible; a unit test asserts the current
failure so it flips green when the reader gains HDF5 support.

## What the NetCDF samples contain

The OAE Data Protocol's [model data minimum set](https://www.carbontosea.org/oae-data-protocol/1-0-0/#model-data):
`dic` and `talk` (µmol/kg), `temperature` (degC), `salinity`, the 2D air-sea CO₂ flux `fgco2`
(mol/m²/s), grid cell `area` and `volume`, plus time/depth/lat/lon coordinates. Every variable carries
`units`, `standard_name`, and `long_name`.

Worth noting when you run it: this conformant file still draws a warning that `talk`, `fgco2`, `area`,
and `volume` are "not in recommended list" — `RECOMMENDED_VARIABLES` doesn't cover the model-data
variables the protocol requires.

## Regenerating

The CSVs are hand-written; edit them directly. The NetCDF pair comes from a one-off script:

```bash
uv run --with netCDF4 --with numpy scripts/make-netcdf-samples.py
```

`compliant.xlsx` is `compliant.csv` saved as a workbook:

```bash
node -e 'const X=require("xlsx"),fs=require("fs");X.writeFile(X.read(fs.readFileSync("tests/samples/compliant.csv","utf-8"),{type:"string",raw:true}),"tests/samples/compliant.xlsx")'
```
