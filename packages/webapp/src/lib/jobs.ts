import { JobPayloadProps } from '@/jobs/async-job-runner';

/**
 * Azure Functions の非同期ジョブ実行
 * 環境変数:
 * - AZURE_FUNCTION_URL: Azure Functions のエンドポイントURL
 * - AZURE_FUNCTION_KEY: Function Key (Function App の設定から取得)
 */
const functionUrl = process.env.AZURE_FUNCTION_URL;
const functionKey = process.env.AZURE_FUNCTION_KEY;

export async function runJob(props: JobPayloadProps) {
  if (!functionUrl) {
    console.warn('AZURE_FUNCTION_URL is not set. Job will not be executed.');
    return;
  }

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(functionKey && { 'x-functions-key': functionKey }),
      },
      body: JSON.stringify(props),
    });

    if (!response.ok) {
      throw new Error(`Azure Function returned ${response.status}: ${response.statusText}`);
    }

    console.log('Job successfully queued to Azure Functions');
  } catch (error) {
    console.error('Failed to run job on Azure Functions:', error);
    throw error;
  }
}
