/** OpenAI Responses API text models (api.openai.com). Shared by admin UI and server. */
export type OpenAIModel = {
  id: string;
  label: string;
  /** Short tier hint for the admin select. */
  tier: "flagship" | "balanced" | "efficient" | "legacy";
  /** reasoning.effort values documented for the model. */
  reasoning: string[];
};

/** Curated catalog for storyboards / assist / admin insights (Responses API). */
export const OPENAI_MODELS: OpenAIModel[] = [
  {
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    tier: "flagship",
    reasoning: ["low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    tier: "balanced",
    reasoning: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    tier: "efficient",
    reasoning: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    tier: "legacy",
    reasoning: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-5.6",
    label: "GPT-5.6 (alias Sol)",
    tier: "legacy",
    reasoning: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    tier: "legacy",
    reasoning: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    tier: "legacy",
    reasoning: ["none", "low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gpt-5-mini",
    label: "GPT-5 Mini",
    tier: "legacy",
    reasoning: ["low", "medium", "high"],
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    tier: "legacy",
    reasoning: ["low", "medium", "high"],
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    tier: "legacy",
    reasoning: [],
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    tier: "legacy",
    reasoning: [],
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    tier: "legacy",
    reasoning: [],
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    tier: "legacy",
    reasoning: [],
  },
];

/** Balanced default for storyboards when an OpenAI key is set. */
export const DEFAULT_OPENAI_MODEL = "gpt-6-sol";

/** Tried after the configured OpenAI model on 404 / model-specific failures. */
export const DEFAULT_OPENAI_FALLBACKS = [
  "gpt-6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5-mini",
];

export const OPENAI_MODEL_IDS = new Set(OPENAI_MODELS.map((m) => m.id));
