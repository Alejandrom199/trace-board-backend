export interface Investigation { id: string; name: string; description: string; createdAt: string; updatedAt: string }
export class InvalidInvestigationError extends Error {}
export class InvestigationNotFoundError extends Error {}
export class RepositoryUnavailableError extends Error {}
export function makeInvestigation(id: string, name: string, description: string, now: string): Investigation {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 120 || description.length > 2000) throw new InvalidInvestigationError('Revisa el nombre y la descripción de la investigación');
  return { id, name: trimmed, description, createdAt: now, updatedAt: now };
}
