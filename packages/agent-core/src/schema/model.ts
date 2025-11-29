import { z } from 'zod';

export const modelTypeList = ['gpt-4o'] as const;
export const modelTypeSchema = z.enum(modelTypeList);
export type ModelType = z.infer<typeof modelTypeSchema>;

const criRegionSchema = z.enum(['global', 'us', 'eu', 'apac', 'jp', 'au']);
export const criRegion = criRegionSchema
  .catch('us')
  .parse(process.env.NEXT_PUBLIC_BEDROCK_CRI_REGION_OVERRIDE || process.env.BEDROCK_CRI_REGION_OVERRIDE || 'us');

const modelConfigSchema = z.object({
  name: z.string(),
  modelId: z.string(),
  deploymentName: z.string().optional(), // Azure OpenAI deployment name
  maxOutputTokens: z.number(),
  maxInputTokens: z.number(),
  cacheSupport: z.array(z.enum(['system', 'tool', 'message'])),
  reasoningSupport: z.boolean(),
  toolChoiceSupport: z.array(z.enum(['any', 'auto', 'tool'])),
  isHidden: z.boolean().optional(),
  interleavedThinkingSupport: z.boolean().optional(),
  supportedCriProfiles: z.array(criRegionSchema),
  pricing: z.object({
    input: z.number(),
    output: z.number(),
    cacheRead: z.number(),
    cacheWrite: z.number(),
  }),
});

export const modelConfigs: Record<ModelType, z.infer<typeof modelConfigSchema>> = {
  'gpt-4o': {
    name: 'GPT-4o',
    modelId: 'gpt-4o',
    deploymentName: 'gpt-4o',
    maxOutputTokens: 16_384,
    maxInputTokens: 128_000,
    cacheSupport: [],
    reasoningSupport: false,
    toolChoiceSupport: ['auto', 'tool'],
    supportedCriProfiles: ['global', 'us', 'eu', 'apac', 'jp', 'au'],
    pricing: { input: 0.0025, output: 0.01, cacheRead: 0, cacheWrite: 0 },
  },
};

export const getAvailableModelTypes = (): ModelType[] => {
  return Object.entries(modelConfigs)
    .filter(([_, config]) => !config.isHidden && config.supportedCriProfiles.includes(criRegion))
    .map(([type, _]) => type as ModelType);
};
