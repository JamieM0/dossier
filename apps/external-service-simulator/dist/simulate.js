"use strict";
const API_BASE = "http://127.0.0.1:34250";
const ALLOWED_ORIGIN = "https://getperspectives.app";
const SERVICE_ID = "getperspectives-app";
async function call(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "content-type": "application/json",
            ...(options.headers ?? {})
        }
    });
    const body = (await response.json());
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
    }
    return body;
}
async function run() {
    const pairingStart = (await call("/v1/pairing/start", { method: "POST" }));
    const pairing = (await call("/v1/pairing/complete", {
        method: "POST",
        body: JSON.stringify({
            code: pairingStart.code,
            service_id: SERVICE_ID,
            allowed_origin: ALLOWED_ORIGIN
        })
    }));
    const nonce = `nonce-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const consent = await call("/v1/consent-requests", {
        method: "POST",
        headers: {
            authorization: `Bearer ${pairing.token}`,
            origin: ALLOWED_ORIGIN,
            "x-dossier-client": "perspectives"
        },
        body: JSON.stringify({
            purpose: "Personalized recommendations",
            requested_item_ids: [],
            requested_compartment_ids: [],
            nonce
        })
    });
    console.log("Consent request created:");
    console.log(JSON.stringify(consent, null, 2));
}
void run();
//# sourceMappingURL=simulate.js.map