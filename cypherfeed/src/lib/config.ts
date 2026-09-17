// How long upstream feed responses are cached server-side (see
// liveFeedProvider.ts). The client's AutoRefresh interval is kept in sync
// with this so it never polls faster than new data can actually appear.
export const FEED_REVALIDATE_SECONDS = 60 * 15;
