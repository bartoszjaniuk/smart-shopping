/**
 * Zod schemas and parsers for auth-related API request bodies.
 * Used by POST /api/auth/* endpoints.
 */

import { z } from "zod";

const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 72;

const emailSchema = z.string().trim().min(1, "E-mail jest wymagany").email("Nieprawidłowy format e-mail");

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków`)
  .max(PASSWORD_MAX_LENGTH, `Hasło może mieć co najwyżej ${PASSWORD_MAX_LENGTH} znaków`);

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Hasło jest wymagane"),
});

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

export const changePasswordBodySchema = z.object({
  current_password: z.string().min(1, "Aktualne hasło jest wymagane"),
  new_password: passwordSchema,
});

export const deleteAccountBodySchema = z.object({
  confirmation: z.literal(true, {
    errorMap: () => ({ message: "Wymagane potwierdzenie usunięcia konta (checkbox)" }),
  }),
});

export type RegisterBodyInput = z.infer<typeof registerBodySchema>;
export type LoginBodyInput = z.infer<typeof loginBodySchema>;
export type ForgotPasswordBodyInput = z.infer<typeof forgotPasswordBodySchema>;
export type ChangePasswordBodyInput = z.infer<typeof changePasswordBodySchema>;
export type DeleteAccountBodyInput = z.infer<typeof deleteAccountBodySchema>;

export function parseRegisterBody(raw: unknown): RegisterBodyInput {
  return registerBodySchema.parse(raw);
}

export function parseLoginBody(raw: unknown): LoginBodyInput {
  return loginBodySchema.parse(raw);
}

export function parseForgotPasswordBody(raw: unknown): ForgotPasswordBodyInput {
  return forgotPasswordBodySchema.parse(raw);
}

export function parseChangePasswordBody(raw: unknown): ChangePasswordBodyInput {
  return changePasswordBodySchema.parse(raw);
}

export function parseDeleteAccountBody(raw: unknown): DeleteAccountBodyInput {
  return deleteAccountBodySchema.parse(raw);
}
