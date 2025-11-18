"use client";
import { WidgetProps } from "@rjsf/utils";
import IsoIntervalWidgetBase from "./IsoIntervalWidgetBase";

export default function IsoIntervalWidget(props: WidgetProps) {
  return <IsoIntervalWidgetBase {...props} orientation="horizontal" />;
}
