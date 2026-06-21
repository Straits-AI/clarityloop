import { z } from "zod";
import { SupplierQuoteSchema, type SupplierQuote } from "@clarityloop/tools";
import { extractJson, imageMessage, type ChatMessage, type ModelProvider } from "@clarityloop/qwen";
import { PRICE_SHEET_DATA_URL } from "./price-sheet";

export const ParseDocumentInputSchema = z.object({
  /** Optional data-URL image to parse; defaults to the seeded supplier price sheet. */
  image: z.string().optional(),
});
export type ParseDocumentInput = z.infer<typeof ParseDocumentInputSchema>;

const SYSTEM =
  "You are a document parser. Read the supplier price-sheet IMAGE and extract its contents as JSON: " +
  "{ lineItems: [{ sku, description, quantity, unitPrice }], total, currency }. Use the numbers exactly " +
  "as printed. Return ONLY the JSON object.";

/** A REAL multimodal message: the price-sheet image is sent to qwen-vl-plus as an image_url part. */
function parseMessages(imageUrl: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    imageMessage(
      "Extract every line item (SKU, description, quantity, unit price), the grand total, and the currency from this supplier price sheet.",
      imageUrl,
    ),
  ];
}

export type ParseDocEvent = { type: "token"; token: string } | { type: "quote"; quote: SupplierQuote };

/**
 * Streams the qwen-vl-plus tokens as it READS THE IMAGE, then yields the parsed SupplierQuote.
 * The image is transmitted as a genuine `image_url` content part — this is real multimodal Qwen,
 * not text masquerading as vision.
 */
export async function* parseDocumentStream(
  provider: ModelProvider,
  input: ParseDocumentInput,
): AsyncGenerator<ParseDocEvent> {
  const imageUrl = input.image && input.image.trim() ? input.image.trim() : PRICE_SHEET_DATA_URL;
  const messages = parseMessages(imageUrl);
  let raw = "";
  if (provider.completeStream) {
    for await (const tok of provider.completeStream(messages, { task: "document_parse" })) {
      raw += tok;
      yield { type: "token", token: tok };
    }
  } else {
    raw = await provider.complete(messages, { task: "document_parse" });
    yield { type: "token", token: raw };
  }
  yield { type: "quote", quote: SupplierQuoteSchema.parse(extractJson(raw)) };
}
