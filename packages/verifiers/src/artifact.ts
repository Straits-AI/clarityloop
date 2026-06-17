import { z } from "zod";

export const QuoteLineItemSchema = z.object({
  sku: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
});

export const QuoteArtifactSchema = z.object({
  customer: z.string(),
  currency: z.string(),
  lineItems: z.array(QuoteLineItemSchema),
  total: z.number(),
  deliveryDate: z.string().nullable(),
});
export type QuoteArtifact = z.infer<typeof QuoteArtifactSchema>;
