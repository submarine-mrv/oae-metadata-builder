"use client";
import { WidgetProps } from "@rjsf/utils";
import IsoIntervalWidgetBase from "./IsoIntervalWidgetBase";

export default function IsoIntervalWidgetVertical(props: WidgetProps) {
  return <IsoIntervalWidgetBase {...props} orientation="vertical" />;
}
