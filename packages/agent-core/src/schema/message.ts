import { ModelType } from './model';

export type MessageItem = {
  /**
   * Cosmos DB unique identifier
   */
  id: string;
  /**
   * message-${workerId}`
   */
  PK: `message-${string}`;
  /**
   * chronologically-sortable key (usually stringified timestamp)
   */
  SK: string;
  /**
   * messsage.content in json string
   */
  content: string;
  role: string;
  tokenCount: number;
  messageType: string;
  /**
   * Thinking budget in tokens when ultrathink is enabled
   */
  thinkingBudget?: number;
  modelOverride?: ModelType;
};
