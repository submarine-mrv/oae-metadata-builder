# Sample data files

Test files for the compliance checker at https://metadata.oaedata.org/checker, or
http://localhost:3000/checker if running the app locally.

The unit tests read the same files, so what you see here is what CI checks.

## Template files

Copies of the four [protocol templates](https://drive.google.com/drive/folders/1lrHXLBPoYUe3oiEAZtDY8ojw5x0n8Yjd) with the extra cells cleared out.

| File | Result |
|---|---|
| `template_bottle.xlsx` | passes |
| `template_flow_through.xlsx` | passes |
| `template_autonomous.xlsx` | passes |
| `template_physiological.xlsx` | passes |
| `template_physiological_uncleaned.xlsx` | fails, still has the `(example response variables)` note sitting above the header row |
| `template_bottle_uncleaned.xlsx` | passes, still has the WOCE reference block below the data, which is ignored |

## Smaller files

| File | Result |
|---|---|
| `compliant.csv`, `compliant.xlsx` | passes |
| `bottle_template.csv` | passes |
| `noncompliant.csv` | fails, no units row |
| `empty.csv` | fails, no headers |
| `model_output_v3.nc` | passes |
| `model_output_v4.nc` | won't open, see below |

## File shape

Rows starting with `#` in the first column are comments and get skipped. The first row after those is
the header, the row below it is units, and the data follows.

For tabular datasets (xlsx, csv, etc.) each column needs either a unit or `n.a.`. A blank unit cell results
in an error. If a file matches one of the templates, its units are compared against that template's and any
difference is flagged as a warning.

## NetCDF

`netcdfjs` only reads NetCDF 3, so NetCDF 4 files will not work with this version of the compliance checker.
`model_output_v4.nc` holds the same data in NetCDF 4 and is here to illustrate that limitation.

Variable names aren't checked. The protocol defers model output naming to CF, and CF puts its
vocabulary in the `standard_name` attribute rather than the variable name. The compliance checker
checks that `standard_name` attributes exist, but does not check against a live database of CF Standard Names.

## Regenerating

The CSVs are edited by hand. For the rest:

```bash
node scripts/make-template-samples.mjs
uv run --with netCDF4 --with numpy scripts/make-netcdf-samples.py
```
