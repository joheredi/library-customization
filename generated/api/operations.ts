// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  Client,
  DeploymentEmbeddingsOptionsEmbeddings,
} from "./models.js";

export interface GetEmbeddingsOptions {
  requestOptions?: Record<string, any>;
  /**
   * An identifier for the caller or end user of the operation. This may be used for tracking
   * or rate-limiting purposes.
   */
  user?: string;
  /**
   * The model name to provide as part of this embeddings request.
   * Not applicable to Azure OpenAI, where deployment information should be included in the Azure
   * resource URI that's connected to.
   */
  model?: string;
  /** Accept header. */
  accept?: "application/json";
  /** Body parameter Content-Type. Known values are: application/json. */
  content_type?: string;
}

/** Return the embeddings for a given prompt. */
export async function getEmbeddings(
  context: Client,
  input: string | string[],
  deploymentId: string,
  options: GetEmbeddingsOptions = {}
): Promise<DeploymentEmbeddingsOptionsEmbeddings> {
  const result = await context
    .path("/deployments/{deploymentId}/embeddings", deploymentId)
    .post({
      contentType: (options.content_type as any) ?? "application/json",
      headers: {
        Accept: "application/json",
        ...options.requestOptions?.headers,
      },
      body: {
        ...(options.user && { user: options.user }),
        ...(options.model && { model: options.model }),
        input: input,
      },
    });
  return {
    data: (result.body["data"] ?? []).map((p: any) => ({
      embedding: p["embedding"],
      index: p["index"],
    })),
    usage: {
      promptTokens: result.body.usage["prompt_tokens"],
      totalTokens: result.body.usage["total_tokens"],
    },
  };
}


export function foo(input: string | string[]) {
  console.log(input);
}