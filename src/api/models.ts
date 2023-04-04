// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export type Client = any;

export interface DeploymentEmbeddingsOptionsEmbeddings {
    /** Embedding values for the prompts submitted in the request. */
    data2: EmbeddingItem[];
    /** Usage counts for tokens input using the embeddings API. */
    usage: EmbeddingsUsage;
  }

/** Representation of a single embeddings relatedness comparison. */
export interface EmbeddingItem {
  /**
   * List of embeddings value for the input prompt. These represent a measurement of the
   * vector-based relatedness of the provided input.
   */
  embedding: number[];
  /** Index of the prompt to which the EmbeddingItem corresponds. */
  index: number;
}

/** Measurement of the amount of tokens used in this request and response. */
export interface EmbeddingsUsage {
  /** Number of tokens sent in the original request. */
  promptTokens: number;
  /** Total number of tokens transacted in this request/response. */
  totalTokens: number;
}
