import { foo as _foo } from "../../generated/api/operations";
import { GetEmbeddingsOptions } from "../../generated/api";
import { Client, DeploymentEmbeddingsOptionsEmbeddings } from "../../generated/api/models";
import {getPagedAsyncIterator, PagedAsyncIterableIterator, PagedResult, PageSettings} from "@azure/core-paging"

export interface Page<T> {
    page: T;
}
/** Return the embeddings for a given prompt. */
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

  

export function foo(input: string): void;
export function foo(input: string[]): void;
export function foo(input: string | string[]): void {
   const flatInput = typeof input ===  "string" ? input : input.join();
   _foo(flatInput);
}