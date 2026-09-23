import { corsHeaders } from "../_shared/cors.ts";

type Coordinate = { latitude: number; longitude: number };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function valid(point: unknown): point is Coordinate {
  if (!point || typeof point !== "object") return false;
  const value = point as Coordinate;
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("OPENROUTESERVICE_API_KEY");
  if (!apiKey) return json({ error: "routing_not_configured" }, 503);

  let body: { from?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!valid(body.from) || !valid(body.to)) {
    return json({ error: "invalid_coordinates" }, 400);
  }

  const response = await fetch(
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    {
      method: "POST",
      headers: {
        Accept: "application/geo+json",
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [body.from.longitude, body.from.latitude],
          [body.to.longitude, body.to.latitude],
        ],
      }),
    },
  );

  if (!response.ok) {
    return json(
      { error: response.status === 429 ? "routing_rate_limited" : "routing_failed" },
      response.status === 429 ? 429 : 502,
    );
  }

  return json(await response.json());
});
