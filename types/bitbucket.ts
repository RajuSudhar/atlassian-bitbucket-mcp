/*
 * Bitbucket API types — curated re-exports from OpenAPI-generated declarations.
 * The YAMLs under `openapi/` are the single source of truth; this module only
 * picks the slice that tools consume and aliases it to the names used by src/.
 *
 * Server / DC schemas drive the existing call sites; Cloud schemas are exposed
 * for parity and future tool implementations. Any change here MUST land in the
 * same commit as the matching `openapi/*.yaml` update (CI enforces drift).
 */

import type { components as CloudComponents } from './generated/bitbucket-cloud';
import type { components as ServerComponents } from './generated/bitbucket-server';

type ServerSchemas = ServerComponents['schemas'];
type CloudSchemas = CloudComponents['schemas'];

export type BitbucketUser = ServerSchemas['User'];
export type BitbucketProject = ServerSchemas['Project'];
export type BitbucketRepository = ServerSchemas['Repository'];
export type BitbucketLinks = ServerSchemas['Links'];

export type PullRequestState = ServerSchemas['PullRequestState'];
export type PullRequest = ServerSchemas['PullRequest'];

export type BitbucketParticipant = ServerSchemas['Participant'];
export type BitbucketRef = ServerSchemas['Ref'];
export type BitbucketBranch = ServerSchemas['Branch'];
export type BitbucketCommit = ServerSchemas['Commit'];
export type BitbucketComment = ServerSchemas['Comment'];
export type BitbucketCommentAnchor = ServerSchemas['CommentAnchor'];
export type BitbucketActivity = ServerSchemas['Activity'];

export type BitbucketDiff = ServerSchemas['Diff'];
export type BitbucketDiffEntry = ServerSchemas['DiffEntry'];
export type BitbucketHunk = ServerSchemas['DiffHunk'];
export type BitbucketSegment = ServerSchemas['DiffSegment'];

export type BitbucketSearchResult = ServerSchemas['SearchResult'];
export type BitbucketSearchHit = ServerSchemas['SearchHit'];

/**
 * Paged API wrapper (Server/DC style). OpenAPI 3 doesn't support TypeScript
 * generics, so the meta block lives in the YAML (`PagedResponseMeta`) while
 * the typed `values` array is composed here.
 */
export type BitbucketPagedResponse<T> = ServerSchemas['PagedResponseMeta'] & {
  readonly values: ReadonlyArray<T>;
};

export type BitbucketCloudAccount = CloudSchemas['Account'];
export type BitbucketCloudRepository = CloudSchemas['Repository'];
export type BitbucketCloudPullRequest = CloudSchemas['PullRequest'];
export type BitbucketCloudPullRequestState = CloudSchemas['PullRequestState'];
export type BitbucketCloudComment = CloudSchemas['Comment'];
export type BitbucketCloudActivity = CloudSchemas['Activity'];
export type BitbucketCloudCommit = CloudSchemas['Commit'];
export type BitbucketCloudSearchCodeHit = CloudSchemas['SearchCodeHit'];

/** Paginated wrapper (Cloud REST 2.0 style). */
export type BitbucketCloudPaginated<T> = Omit<CloudSchemas['Paginated'], 'values'> & {
  readonly values: ReadonlyArray<T>;
};
