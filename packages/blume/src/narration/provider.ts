import { z } from "zod";

import { GATEWAY_API_KEY_ENV, sharedOptions } from "../ai/ask.ts";
import { adapterDescriptorSchema } from "../core/adapter.ts";

/** The speech model narration uses when `gateway()` names none. */
export const DEFAULT_NARRATION_MODEL = "openai/tts-1-hd";

/** The voice narration uses when `gateway()` names none. */
export const DEFAULT_NARRATION_VOICE = "alloy";

/**
 * `narration.provider`: the `gateway()` descriptor from `blume/ai`, read with
 * speech defaults. `reasoning` is an assistant option and is rejected here;
 * `voice` and `instructions` are narration options and are rejected by the
 * assistant.
 */
export const narrationProviderSchema = adapterDescriptorSchema(
  "gateway",
  z.strictObject({
    ...sharedOptions(GATEWAY_API_KEY_ENV),
    instructions: z.string().min(1).optional(),
    model: z.string().min(1).default(DEFAULT_NARRATION_MODEL),
    voice: z.string().min(1).default(DEFAULT_NARRATION_VOICE),
  })
);

/** A validated narration provider, defaults filled in. */
export type NarrationProvider = z.output<typeof narrationProviderSchema>;
