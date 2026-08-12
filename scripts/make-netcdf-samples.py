#!/usr/bin/env python3
"""Write the two NetCDF sample files in tests/samples/.

One-off script, kept for provenance. Not wired into any npm script.

    uv run --with netCDF4 scripts/make-netcdf-samples.py

Writes the same data twice:
  model_output_v3.nc  NETCDF3_CLASSIC  - netcdfjs can read this
  model_output_v4.nc  NETCDF4          - netcdfjs cannot; documents the gap

The quantities and units come from the protocol's model data minimum set:
https://www.carbontosea.org/oae-data-protocol/1-0-0/#model-data

The variable names and standard_name attributes below are CMIP/CF conventions we
chose, not protocol-specified names — the protocol's Model Output Variables table
is not published in a readable form. Nothing validates against them.
"""

from pathlib import Path

import numpy as np
from netCDF4 import Dataset

OUT_DIR = Path(__file__).resolve().parent.parent / "tests" / "samples"

NT, NZ, NY, NX = 2, 2, 2, 2

# (name, dims, units, standard_name, long_name)
VARIABLES = [
    ("time", ("time",), "days since 2026-01-01 00:00:00", "time", "time"),
    ("depth", ("depth",), "m", "depth", "depth below sea surface"),
    ("latitude", ("lat",), "degrees_north", "latitude", "latitude"),
    ("longitude", ("lon",), "degrees_east", "longitude", "longitude"),
    ("dic", ("time", "depth", "lat", "lon"), "umol/kg",
     "mole_concentration_of_dissolved_inorganic_carbon_in_sea_water",
     "dissolved inorganic carbon"),
    ("talk", ("time", "depth", "lat", "lon"), "umol/kg",
     "sea_water_alkalinity_expressed_as_mole_equivalent", "total alkalinity"),
    ("temperature", ("time", "depth", "lat", "lon"), "degC",
     "sea_water_potential_temperature", "sea water potential temperature"),
    ("salinity", ("time", "depth", "lat", "lon"), "1",
     "sea_water_practical_salinity", "sea water practical salinity"),
    ("fgco2", ("time", "lat", "lon"), "mol/m2/s",
     "surface_downward_mole_flux_of_carbon_dioxide", "air-sea CO2 flux"),
    ("area", ("lat", "lon"), "m2", "cell_area", "grid cell area"),
    ("volume", ("depth", "lat", "lon"), "m3", "cell_volume", "grid cell volume"),
]

SIZES = {"time": NT, "depth": NZ, "lat": NY, "lon": NX}


def write(path: Path, fmt: str) -> None:
    with Dataset(path, "w", format=fmt) as ds:
        ds.title = "OAE compliance checker sample model output"
        ds.Conventions = "CF-1.8"
        ds.source = "synthetic; scripts/make-netcdf-samples.py"
        ds.comment = "Not real data. Shape and attributes only."

        for name, size in SIZES.items():
            ds.createDimension(name, size)

        for name, dims, units, standard_name, long_name in VARIABLES:
            var = ds.createVariable(name, "f4", dims)
            var.units = units
            var.standard_name = standard_name
            var.long_name = long_name
            # Ascending values so the file is non-degenerate; the checker only
            # reads names and attributes.
            shape = tuple(SIZES[d] for d in dims)
            var[...] = np.arange(np.prod(shape), dtype="f4").reshape(shape)

    print(f"wrote {path.name} ({fmt}, {path.stat().st_size} bytes)")


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write(OUT_DIR / "model_output_v3.nc", "NETCDF3_CLASSIC")
    write(OUT_DIR / "model_output_v4.nc", "NETCDF4")
