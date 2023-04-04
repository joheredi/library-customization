import {EmbeddingItem, EmbeddingsUsage} from "../../generated/api/models";

export interface DeploymentEmbeddingsOptionsEmbeddings {
    /** Embedding values for the prompts submitted in the request. */
    data2: EmbeddingItem[];
    /** Usage counts for tokens input using the embeddings API. */
    usage: EmbeddingsUsage;
  }