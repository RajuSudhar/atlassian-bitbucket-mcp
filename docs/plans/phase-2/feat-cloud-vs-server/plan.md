# feat-cloud-vs-server

Phase: 2  |  Status: [ ] todo
Depends on: feat-client-core
Ref: `claude-ref/client.md`, `claude-ref/openapi.md`

## Goal
Detect Cloud vs Server/DC and branch endpoint/payload handling inside the client.

## In scope
- Instance detection at client init.
- Per-API shim layer that normalizes request paths and response shapes to shared curated types.

## Out of scope
- Multi-instance simultaneous support.
- Automatic API version negotiation beyond Cloud/Server split.

## Design
- Detection order:
  1. Domain match `api.bitbucket.org` or `bitbucket.org` → Cloud.
  2. Else probe `GET /rest/api/1.0/application-properties` → Server/DC.
  3. Else fail fast with actionable error.
- `type BitbucketFlavor = 'cloud' | 'server'`.
- Resource modules get `flavor` and switch paths internally.
- Curated types abstract over the two flavors; raw differences stay generated.

## Tasks
- [ ] `detectFlavor(url): Promise<BitbucketFlavor>`
- [ ] cache result on client instance
- [ ] path tables per resource per flavor
- [ ] response normalizers where shapes diverge (e.g., PR `id` vs `pullRequestId`)
- [ ] tests: cloud domain, server probe success, server probe fail, ambiguous URL

## Definition of done
- [ ] tools remain flavor-agnostic (no `if (flavor)` outside client)
- [ ] ≥ 80% coverage
- [ ] TRACK.md updated
