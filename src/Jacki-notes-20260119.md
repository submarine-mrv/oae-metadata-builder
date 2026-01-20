
# Linus Call

1. The following two fields are only for "sensor" data. We think this came from LiQing,
can linus confirm if that's still necessary. They definitely should be only for Measured,
but maybe SENSOR and DISCRETE both, and required for SENSOR data. Software version optional.
- Method to calculate reported values from raw data
- Software version for the calculation

2. Check in on their appetite for working with JSON / switching
3. Why is "Observation Type" required? This list is weird to have an enum for, as sometimes multiple
  values apply

# Jacki UI Notes

- "What is the observed property" question should be "What is the variable type?"

pH - Calculated
- Sampling section:
  - Drop "Field replicate information" from Calculated variables. It should only be needed for all Measured variables
- QC Section:
  - for "calculated", all QC fields should be optional
  - For "Uncertainty" update it to be required, and update description to ask for _uncert column header name in input

pH - Measured - Discrete
- make "Observation Type" optional for all measured variables
- In "instrument type" make the following enum values all caps:
    - CTD, DIC, CO2, TA, pH, Sea-Bird SeaFET
    - Split seaFET into 2 options (V1 & V2) with the following IRIs:
        - http://vocab.nerc.ac.uk/collection/L22/current/TOOL1292/
        - http://vocab.nerc.ac.uk/collection/L22/current/TOOL1293/
- Analysis section
  - Measurement temperuatere & pH reported tempature should be "Temp at which pH was reported/measured"
  - Get subset of "Analyzing instrument" and "Sampling instrument" from Jacki (she will label each enum value in InstrumentType)
- Analyzing Instrument section
  - Make "Instrument Type" required, and make "instrument type (custom)" only display when "Other is selected"
- Calibration section
  - Wait for feedback from Jacki on how to revise pH calibration section
- Quality Control section
  - Make weather or climate quality tooltip a pop up

Observed Property
- Calibration
  - make "Calibration location" optional