export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function hasPropertyLocation(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);
}
