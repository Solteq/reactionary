const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two coordinates in kilometers, using the
 * haversine formula.
 */
export function haversineDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLatitude = toRadians(latitude2 - latitude1);
  const deltaLongitude = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
