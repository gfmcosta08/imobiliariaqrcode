import { GET as handlePropertyImportJobGet } from "@/features/properties/server/import-job-route";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  return handlePropertyImportJobGet(request, context);
}
