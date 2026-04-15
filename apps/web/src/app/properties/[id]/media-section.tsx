"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deletePropertyMedia, uploadPropertyMedia } from "../media-actions";
import { ImageBatchPicker } from "../image-batch-picker";

type MediaRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  status: string;
};

export function MediaSection(props: {
  propertyId: string;
  media: MediaRow[];
  signedUrls: Record<string, string>;
  maxImages: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const count = props.media.filter((m) => m.status !== "deleted").length;
  const canAdd = count < props.maxImages;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("propertyId", props.propertyId);
    const res = await uploadPropertyMedia(formData);
    setLoading(false);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    if (res && "uploaded" in res) {
      const failedCount = Array.isArray(res.failed) ? res.failed.length : 0;
      if (failedCount > 0) {
        setNotice(`Upload concluido com ressalvas: ${res.uploaded} enviada(s), ${failedCount} falha(s).`);
      } else {
        setNotice(`Upload concluido: ${res.uploaded} imagem(ns).`);
      }
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function onDelete(media: MediaRow) {
    setError(null);
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
        {count}/{props.maxImages} imagens (limite do plano de origem do imóvel).
      </p>

      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {props.media.map((m) => {
          const url = props.signedUrls[m.id];
          return (
            <div
              key={m.id}
              className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center text-xs text-zinc-500">
                  Sem pré-visualização
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
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="w-full">
            <ImageBatchPicker
              inputName="files"
              label="Adicionar imagens"
              helperText="Selecione varias imagens de uma vez. As miniaturas aparecem antes de enviar."
              disabled={loading}
              maxFiles={Math.max(1, props.maxImages - count)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Enviando…" : "Enviar"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
          Limite de imagens atingido. Remova uma imagem ou faça upgrade para PRO.
        </p>
      )}
    </div>
  );
}
