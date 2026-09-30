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

function haversineMeters(from: Coordinate, to: Coordinate) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function fetchOrs(from: Coordinate, to: Coordinate, apiKey: string) {
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
          [from.longitude, from.latitude],
          [to.longitude, to.latitude],
        ],
      }),
    },
  );
  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }
  return { ok: true as const, body: await response.json() };
}

/** Public OSRM demo — road geometry when ORS is missing or fails. */
async function fetchOsrm(from: Coordinate, to: Coordinate) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json() as {
    routes?: { distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }[];
  };
  const route = payload.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          summary: {
            distance: route?.distance ?? haversineMeters(from, to),
            duration: route?.duration ?? 0,
          },
        },
        geometry: {
          type: "LineString",
          coordinates,
        },
      },
    ],
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { from?: unknown; to?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!valid(body.from) || !valid(body.to)) {
    return json({ error: "invalid_coordinates" }, 400);
  }

  const from = body.from;
  const to = body.to;
  const apiKey = Deno.env.get("OPENROUTESERVICE_API_KEY");

  if (apiKey) {
    const ors = await fetchOrs(from, to, apiKey);
    if (ors.ok) return json(ors.body);
    if (ors.status === 429) {
      const fallback = await fetchOsrm(from, to);
      if (fallback) return json(fallback);
      return json({ error: "routing_rate_limited" }, 429);
    }
  }

  const osrm = await fetchOsrm(from, to);
  if (osrm) return json(osrm);

  return json(
    { error: apiKey ? "routing_failed" : "routing_not_configured" },
    apiKey ? 502 : 503,
  );
});
