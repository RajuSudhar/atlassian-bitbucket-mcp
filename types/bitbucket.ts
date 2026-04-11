/*
 * Bitbucket API types — curated from OpenAPI specs
 * When openapi-typescript codegen is wired, this file re-exports from generated/.
 * Until then, hand-maintained. Any change here MUST update openapi/*.yaml.
 */

export type BitbucketUser = {
  readonly name: string;
  readonly emailAddress: string;
  readonly displayName: string;
  readonly slug?: string;
  readonly id?: number;
  readonly active?: boolean;
};

export type BitbucketProject = {
  readonly key: string;
  readonly name: string;
  readonly description?: string;
  readonly public?: boolean;
  readonly id?: number;
};

export type BitbucketRepository = {
  readonly slug: string;
  readonly name: string;
  readonly project: BitbucketProject;
  readonly description?: string;
  readonly forkable?: boolean;
  readonly public?: boolean;
  readonly scmId?: string;
  readonly state?: string;
  readonly links?: BitbucketLinks;
};

export type BitbucketLinks = {
  readonly self?: ReadonlyArray<{ readonly href: string }>;
  readonly clone?: ReadonlyArray<{ readonly href: string; readonly name: string }>;
};

export type PullRequestState = 'OPEN' | 'MERGED' | 'DECLINED';

export type PullRequest = {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly state: PullRequestState;
  readonly author: BitbucketParticipant;
  readonly reviewers?: ReadonlyArray<BitbucketParticipant>;
  readonly fromRef: BitbucketRef;
  readonly toRef: BitbucketRef;
  readonly createdDate: number;
  readonly updatedDate: number;
  readonly closedDate?: number;
  readonly locked?: boolean;
  readonly links?: BitbucketLinks;
};

export type BitbucketParticipant = {
  readonly user: BitbucketUser;
  readonly role?: 'AUTHOR' | 'REVIEWER' | 'PARTICIPANT';
  readonly approved?: boolean;
  readonly status?: 'UNAPPROVED' | 'NEEDS_WORK' | 'APPROVED';
};

export type BitbucketRef = {
  readonly id: string;
  readonly displayId: string;
  readonly latestCommit?: string;
  readonly repository?: BitbucketRepository;
};

export type BitbucketBranch = {
  readonly id: string;
  readonly displayId: string;
  readonly type?: string;
  readonly latestCommit: string;
  readonly latestChangeset?: string;
  readonly isDefault?: boolean;
};

export type BitbucketCommit = {
  readonly id: string;
  readonly displayId: string;
  readonly message: string;
  readonly author: BitbucketUser;
  readonly authorTimestamp: number;
  readonly committer?: BitbucketUser;
  readonly committerTimestamp?: number;
  readonly parents?: ReadonlyArray<{ readonly id: string; readonly displayId: string }>;
};

export type BitbucketComment = {
  readonly id: number;
  readonly text: string;
  readonly author: BitbucketUser;
  readonly createdDate: number;
  readonly updatedDate: number;
  readonly severity?: 'NORMAL' | 'BLOCKER';
  readonly state?: 'OPEN' | 'RESOLVED';
  readonly anchor?: BitbucketCommentAnchor;
  readonly comments?: ReadonlyArray<BitbucketComment>;
};

export type BitbucketCommentAnchor = {
  readonly path: string;
  readonly line: number;
  readonly lineType: 'ADDED' | 'REMOVED' | 'CONTEXT';
  readonly fileType?: 'FROM' | 'TO';
};

export type BitbucketActivity = {
  readonly id: number;
  readonly createdDate: number;
  readonly action: string;
  readonly user: BitbucketUser;
  readonly comment?: BitbucketComment;
};

export type BitbucketDiff = {
  readonly diffs: ReadonlyArray<BitbucketDiffEntry>;
  readonly truncated?: boolean;
};

export type BitbucketDiffEntry = {
  readonly source?: { readonly toString: string };
  readonly destination?: { readonly toString: string };
  readonly hunks?: ReadonlyArray<BitbucketHunk>;
};

export type BitbucketHunk = {
  readonly sourceLine: number;
  readonly sourceSpan: number;
  readonly destinationLine: number;
  readonly destinationSpan: number;
  readonly segments: ReadonlyArray<BitbucketSegment>;
};

export type BitbucketSegment = {
  readonly type: 'ADDED' | 'REMOVED' | 'CONTEXT';
  readonly lines: ReadonlyArray<{ readonly line: number; readonly source: number; readonly destination: number }>;
};

export type BitbucketSearchResult = {
  readonly query: string;
  readonly limit: number;
  readonly count: number;
  readonly values: ReadonlyArray<BitbucketSearchHit>;
};

export type BitbucketSearchHit = {
  readonly file?: { readonly path: string; readonly name: string };
  readonly pathMatches?: ReadonlyArray<unknown>;
  readonly hitContexts?: ReadonlyArray<{ readonly context: string }>;
};

/** Paged API wrapper (Server/DC style) */
export type BitbucketPagedResponse<T> = {
  readonly size: number;
  readonly limit: number;
  readonly start: number;
  readonly isLastPage: boolean;
  readonly nextPageStart?: number;
  readonly values: ReadonlyArray<T>;
};
