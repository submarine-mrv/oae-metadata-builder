/**
 * IsoIntervalWidgetVertical - Vertical layout date interval widget
 *
 * This is a thin wrapper around IsoIntervalWidget with layout="vertical".
 * Maintained for backwards compatibility with existing uiSchema configurations.
 *
 * For new code, prefer using IsoIntervalWidget directly with:
 * ```json
 * { "ui:options": { "layout": "vertical" } }
 * ```
 */
"use client";

import * as React from "react";
import { WidgetProps } from "@rjsf/utils";
import IsoIntervalWidget from "./IsoIntervalWidget";

const IsoIntervalWidgetVertical: React.FC<WidgetProps> = (props) => {
  return <IsoIntervalWidget {...props} layoutOverride="vertical" />;
};

export default IsoIntervalWidgetVertical;
