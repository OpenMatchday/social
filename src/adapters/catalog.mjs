import { createAdapter } from "./base.mjs"

/**
 * Official publish surfaces cited in D8 / providers/registry.json.
 * Adapters only shape requests for those documented APIs.
 */
export const ADAPTER_DEFINITIONS = [
  {
    providerId: "youtube",
    officialEndpoint: "https://www.googleapis.com/upload/youtube/v3/videos",
    buildPublishBody: ({ approval, scopes }) => ({
      api: "youtube.data.v3.videos.insert",
      part: "snippet,status",
      snippet: {
        title: approval.content.caption.slice(0, 100),
        description: approval.content.caption,
      },
      status: {
        privacyStatus:
          approval.visibility === "public"
            ? "public"
            : approval.visibility === "unlisted"
              ? "unlisted"
              : "private",
      },
      media_refs: approval.content.media_refs,
      oauth_scopes: scopes,
      source:
        "https://developers.google.com/youtube/v3/docs/videos/insert",
    }),
  },
  {
    providerId: "meta_instagram",
    officialEndpoint:
      "https://graph.facebook.com/v21.0/{ig-user-id}/media_publish",
    buildPublishBody: ({ approval, scopes }) => ({
      api: "instagram.content_publishing",
      caption: approval.content.caption,
      media_refs: approval.content.media_refs,
      visibility: approval.visibility,
      oauth_scopes: scopes,
      constraint: "media must be publicly reachable URL at publish time",
      source:
        "https://developers.facebook.com/docs/instagram-platform/content-publishing/",
    }),
  },
  {
    providerId: "meta_facebook_pages",
    officialEndpoint: "https://graph.facebook.com/v21.0/{page-id}/feed",
    buildPublishBody: ({ approval, scopes }) => ({
      api: "facebook.graph.page_publish",
      message: approval.content.caption,
      media_refs: approval.content.media_refs,
      visibility: approval.visibility,
      oauth_scopes: scopes,
      source:
        "https://developers.facebook.com/docs/graph-api/reference/page/photos/",
    }),
  },
  {
    providerId: "tiktok",
    officialEndpoint: "https://open.tiktokapis.com/v2/post/publish/video/init/",
    buildPublishBody: ({ approval, scopes }) => ({
      api: "tiktok.content_posting",
      post_info: {
        title: approval.content.caption.slice(0, 150),
        privacy_level:
          approval.visibility === "public"
            ? "PUBLIC_TO_EVERYONE"
            : approval.visibility === "followers"
              ? "FOLLOWER_OF_CREATOR"
              : "SELF_ONLY",
      },
      media_refs: approval.content.media_refs,
      oauth_scopes: scopes,
      source:
        "https://developers.tiktok.com/doc/content-posting-api-get-started",
    }),
  },
  {
    providerId: "x",
    officialEndpoint: "https://api.x.com/2/tweets",
    buildPublishBody: ({ approval, scopes }) => ({
      api: "x.api.v2.create_post",
      text: approval.content.caption.slice(0, 280),
      media_refs: approval.content.media_refs,
      visibility: approval.visibility,
      oauth_scopes: scopes,
      source: "https://docs.x.com/x-api/posts/create-post",
    }),
  },
  {
    providerId: "bluesky",
    officialEndpoint: "https://bsky.social/xrpc/com.atproto.repo.createRecord",
    buildPublishBody: ({ approval, scopes }) => ({
      api: "atproto.repo.createRecord",
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: approval.content.caption,
        createdAt: approval.approved_at,
      },
      media_refs: approval.content.media_refs,
      visibility: approval.visibility,
      oauth_scopes: scopes,
      source: "https://atproto.com/guides/writing-data",
    }),
  },
]

export const buildAdapterMap = () => {
  const map = new Map()
  for (const def of ADAPTER_DEFINITIONS) {
    map.set(def.providerId, createAdapter(def))
  }
  return map
}

export const listAdapterProviderIds = () =>
  ADAPTER_DEFINITIONS.map((def) => def.providerId)
