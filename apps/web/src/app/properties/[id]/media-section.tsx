"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ImageBatchPicker } from "../image-batch-picker";
import { deletePropertyMedia, uploadPropertyMedia } from "../media-actions";

type MediaRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  status: string;
};

type UploadResult =
  | { kind: "sending"; count: number }
  | { kind: "success"; uploaded: number }
  | { kind: "partial"; uploaded: number; failed: string[] }
  | { kind: "error"; message: string }
  | null;

export function MediaSection(props: {
  propertyId: string;
  media: MediaRow[];
  signedUrls: Record<string, string>;
  maxImages: number;
}) {
  const router = useRouter();
  const [result, setResult] = useState<UploadResult>(null);
  const [loading, setLoading] = useState(false);
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});
  const noticeRef = useRef<HTMLDivElement>(null);
  const count = props.media.filter((m) => m.status !== "deleted").length;
  const availableSlots = Math.max(0, props.maxImages - count);
  const canAdd = availableSlots > 0;

  const mediaVisible = useMemo(
    () => props.media.filter((m) => m.status !== "deleted"),
    [props.media],
  );

  function scrollToNotice() {
    setTimeout(() => noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const files = formData.getAll("files").filter((v) => v instanceof File && v.size > 0);
    if (!files.length) {
      setResult({ kind: "error", message: "Selecione pelo menos uma imagem." });
      return;
    }
    setLoading(true);
    setResult({ kind: "sending", count: files.length });
    formData.set("propertyId", props.propertyId);

    const res = await uploadPropertyMedia(formData);
    setLoading(false);

    if (res && "error" in res && res.error) {
      setResult({ kind: "error", message: res.error });
      scrollToNotice();
      return;
    }

    if (res && "uploaded" in res) {
      const failedNames = Array.isArray(res.failed) ? res.failed : [];
      if (failedNames.length > 0) {
        setResult({ kind: "partial", uploaded: res.uploaded, failed: failedNames });
      } else {
        setResult({ kind: "success", uploaded: res.uploaded });
      }
      e.currentTarget.reset();
      scrollToNotice();
      router.refresh();
    }
  }

  async function onDelete(media: MediaRow) {
    setError(null);
    setNotice(null);
    setLoading(true);
    const res = await deletePropertyMedia(props.propertyId, media.id, media.storage_path);
    setLoading(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Imagens</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {count}/{props.maxImages} imagens (limite do plano de origem do imovel).
      </p>

      <div ref={noticeRef}>
        {result?.kind === "error" && (
          <div className="mt-3 flex items-start gap-2 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="mt-0.5 shrink-0 text-base">✗</span>
            <span>{result.message}</span>
          </div>
        )}
        {result?.kind === "sending" && (
          <p className="mt-3 text-sm text-zinc-500" role="status">
            Enviando {result.count} imagem(ns)...
          </p>
        )}
        {result?.kind === "success" && (
          <div className="mt-3 flex items-start gap-2 rounded border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            <span className="mt-0.5 shrink-0 text-base">✓</span>
            <span>Upload concluído: {result.uploaded} imagem(ns) enviada(s) com sucesso.</span>
          </div>
        )}
        {result?.kind === "partial" && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
            <p className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-base">⚠</span>
              <span>{result.uploaded} imagem(ns) enviada(s). {result.failed.length} falha(s):</span>
            </p>
            <ul className="mt-1 list-disc pl-8 text-xs">
              {result.failed.map((name) => <li key={name}>{name}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mediaVisible.map((m) => {
          const url = props.signedUrls[m.id];
          const broken = brokenIds[m.id] === true;
          return (
            <div
              key={m.id}
              className="relative overflow-hidden rounded-none border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {url && !broken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  className="h-40 w-full object-cover"
                  onError={() => setBrokenIds((curr) => ({ ...curr, [m.id]: true }))}
                />
              ) : (
                <div className="flex h-40 items-center justify-center px-2 text-center text-xs text-zinc-500">
                  Pre-visualizacao indisponivel
                </div>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => onDelete(m)}
                className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>

      {canAdd ? (
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <ImageBatchPicker
            inputName="files"
            label="Selecione varias imagens de uma vez"
            helperText={`Clique em Escolher arquivos e selecione ate ${availableSlots} imagem(ns).`}
            disabled={loading}
            maxFiles={availableSlots}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-none bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "Enviando..." : "Enviar imagens"}
            </button>
            {loading && (
              <span className="text-xs text-zinc-500">Aguarde, fazendo upload...</span>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
          Limite de imagens atingido. Remova uma imagem ou faca upgrade para PRO.
        </p>
      )}
    </div>
  );
}
