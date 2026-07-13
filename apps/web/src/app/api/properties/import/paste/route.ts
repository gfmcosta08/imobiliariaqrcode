import { POST as handlePropertyImportPastePost } from "@/features/properties/server/import-paste-route";

export async function POST(request: Request) {
  return handlePropertyImportPastePost(request);
}
