import { z } from "zod";

export const updateLanguageSchema = z.object({
  language: z.enum(["en", "ar"]),
});

export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
