/** Labeled mock HTTP/API transport. Never hits the network. */
export const MOCK_LABEL = "MOCK"

export const createLabeledMockTransport = ({ responses = {} } = {}) => {
  const calls = []
  return {
    label: MOCK_LABEL,
    live: false,
    calls: () => [...calls],
    async request(operation, payload = {}) {
      calls.push({ operation, payload, at: new Date().toISOString() })
      const canned = responses[operation]
      return {
        mock_label: MOCK_LABEL,
        live: false,
        operation,
        ok: true,
        ...(canned ?? { status: "accepted", provider_post_id: `mock-${operation}` }),
      }
    },
  }
}

export const assertLabeledMock = (result) => {
  if (!result || result.mock_label !== MOCK_LABEL || result.live !== false) {
    throw new Error("expected labeled MOCK result (live=false)")
  }
  return result
}
