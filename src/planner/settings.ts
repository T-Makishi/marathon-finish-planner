export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export type PlannerSettings = { openingBackground: string | null };
export function validOpeningImage(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 40) return false;
  const match = value.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/);
  return !!match && match[2].length % 4 === 0 && (match[1] === 'jpeg' ? match[2].startsWith('/9j/') : match[2].startsWith('iVBORw0KGgo'));
}
export function validSettings(value: unknown): value is PlannerSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const image = (value as PlannerSettings).openingBackground;
  return image === null || validOpeningImage(image);
}
