// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { PagedAsyncIterableIterator, PageSettings, PagedResult, getPagedAsyncIterator } from "@azure/core-paging";
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

export async function getEmbeddings(
    context: Client,
    input: string | string[],
    deploymentId: string,
    options: GetEmbeddingsOptions = {}
  ): Promise<PagedAsyncIterableIterator<DeploymentEmbeddingsOptionsEmbeddings, DeploymentEmbeddingsOptionsEmbeddings[], PageSettings>>{
    const initialResponse = await context
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

      let firstRun = true;
      const pagedResult: PagedResult<DeploymentEmbeddingsOptionsEmbeddings[]> = {
        firstPageLink: "",
        getPage: async (pageLink: string) => {
                const result = firstRun ? initialResponse : await context.pathUnchecked(pageLink).get();
                firstRun = false;
                const nextLink = "nextLink";
                const values = result.body["values"] ?? [];
                return {
                  page: values,
                  nextPageLink: nextLink,
                };
              },
      };

      return getPagedAsyncIterator(pagedResult);
  }


function _foo(input: string | string[]) {
  console.log(input);
}
export function foo(input: string): void;
export function foo(input: string[]): void;
export function foo(input: string | string[]): void {
   const flatInput = typeof input ===  "string" ? input : input.join();
   _foo(flatInput);
}