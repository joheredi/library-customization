// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { TokenCredential, AzureKeyCredential } from "@azure/core-auth";
import {
  DeploymentEmbeddingsOptionsEmbeddings,
  createOpenAI,
  OpenAIContext,
  getEmbeddings,
  GetEmbeddingsOptions,
} from "./api/index.js";

export interface ClientOptions  {}

export class OpenAI {
  private _client: OpenAIContext;

  /** Azure OpenAI APIs for completions and search */
  constructor(
    endpoint: string,
    credential: AzureKeyCredential | TokenCredential,
    options: ClientOptions = {}
  ) {
    this._client = createOpenAI(endpoint, credential, options);
  }

  getEmbeddings(
    input: string | string[],
    deploymentId: string,
    options: GetEmbeddingsOptions = { requestOptions: {} }
  ): Promise<DeploymentEmbeddingsOptionsEmbeddings> {
    return getEmbeddings(this._client, input, deploymentId, options);
  }
}
