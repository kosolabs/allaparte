export async function fetchEnsembleName(
  id: string,
): Promise<string | undefined> {
  const response = await fetch(`/api/ensembles/${id}`);
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(`Loading the ensemble failed: ${response.status}`);
  const { name } = await response.json();
  return name;
}
