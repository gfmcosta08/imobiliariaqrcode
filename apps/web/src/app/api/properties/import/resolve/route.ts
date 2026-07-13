import { GET as handlePropertyImportResolveGet } from "@/features/properties/server/import-resolve-route";

export async function GET(request: Request) {
  return handlePropertyImportResolveGet(request);
}
