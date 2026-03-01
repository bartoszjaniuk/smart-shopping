/**
 * Frontend zod schema for the reusable ListForm component.
 * Mirrors API constraints from lib/schemas/lists.ts but adds
 * client-side validation for the pastel color palette.
 */

import { z } from "zod";

import { DEFAULT_LIST_COLOR } from "../../types";
import { PASTEL_LIST_COLORS } from "../constants/listColors";

const allowedColors = PASTEL_LIST_COLORS.map((option) => option.value);

export const listFormSchema = z.object({
  name: z
    .string({ required_error: "Nazwa listy jest wymagana" })
    .trim()
    .min(1, "Nazwa listy jest wymagana")
    .max(100, "Nazwa listy może mieć maksymalnie 100 znaków"),
  color: z
    .string()
    .max(20, "Kolor ma nieprawidłowy format")
    .optional()
    .refine((value) => value === undefined || allowedColors.includes(value), "Wybierz kolor z dostępnej palety")
    .default(DEFAULT_LIST_COLOR),
});

export type ListFormSchemaInput = z.infer<typeof listFormSchema>;
