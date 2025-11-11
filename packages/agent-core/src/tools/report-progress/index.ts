import { z } from 'zod';
import { ToolDefinition, zodToJsonSchemaBody } from '../../private/common/lib';

const inputSchema = z.object({
  progress: z.string().describe('A brief summary of your current progress or status update.'),
});

const name = 'report_progress';

export const reportProgressTool: ToolDefinition<z.infer<typeof inputSchema>> = {
  name,
  handler: async (input: z.infer<typeof inputSchema>) => {
    // This tool simply logs progress and returns acknowledgment
    console.log(`Progress report: ${input.progress}`);
    return 'Progress report received. Continue with your work.';
  },
  schema: inputSchema,
  toolSpec: async () => ({
    name,
    description: `Use this tool to report your current progress or status to the user. 
This is especially useful when:
- A long time has passed since your last message
- You need to keep the user informed about what you're working on
- You want to provide a status update before continuing with complex tasks
The tool doesn't perform any actions but ensures communication with the user.`,
    inputSchema: {
      json: zodToJsonSchemaBody(inputSchema),
    },
  }),
};
