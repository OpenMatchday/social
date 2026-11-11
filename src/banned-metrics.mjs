/** Field names that must never appear on drafts or export (AC-11.7). */
export const BANNED_ENGAGEMENT_FIELDS = Object.freeze([
  "likes",
  "views",
  "shares",
  "comments",
  "followers",
  "impressions",
  "reach",
  "engagement",
  "engagement_rate",
  "fake_metrics",
])

const bannedSet = new Set(BANNED_ENGAGEMENT_FIELDS)

export const collectBannedKeys = (value, path = "") => {
  const hits = []
  if (value === null || value === undefined) {
    return hits
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...collectBannedKeys(item, `${path}[${index}]`))
    })
    return hits
  }
  if (typeof value !== "object") {
    return hits
  }
  for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key
    if (bannedSet.has(key)) {
      hits.push(next)
    }
    hits.push(...collectBannedKeys(child, next))
  }
  return hits
}

export const assertNoFakeMetrics = (value, label = "payload") => {
  const hits = collectBannedKeys(value)
  if (hits.length > 0) {
    throw new Error(`${label}: banned engagement fields: ${hits.join(", ")}`)
  }
}
