import { POST as handlePropertyImportPost } from "@/features/properties/server/import-route";

export const maxDuration = 300;

export async function POST(request: Request) {
  return handlePropertyImportPost(request);
}
