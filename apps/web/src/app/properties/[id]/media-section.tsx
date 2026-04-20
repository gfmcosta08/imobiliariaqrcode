"use client";

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
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});
  const count = props.media.filter((m) => m.status !== "deleted").length;
  const availableSlots = Math.max(0, props.maxImages - count);
  const canAdd = availableSlots > 0;

  const mediaVisible = useMemo(
    () => props.media.filter((m) => m.status !== "deleted"),
    [props.media],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const formData = new FormData(e.currentTarget);
    const selectedCount = formData
      .getAll("files")
      .filter((v) => v instanceof File && v.size > 0).length;
    if (!selectedCount) {
      setError("Selecione pelo menos uma imagem.");
      return;
    }
    setLoading(true);
    setNotice(`Enviando ${selectedCount} imagem(ns)...`);
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
        setNotice(
          `Upload finalizado com ressalvas: ${res.uploaded} enviada(s), ${failedCount} falha(s).`,
        );
      } else {
        setNotice(`Upload concluido: ${res.uploaded} imagem(ns).`);
      }
    }

    e.currentTarget.reset();
    router.refresh();
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
              {loading ? "Enviando..." : "Enviar"}
            </button>
            {loading ? (
              <span className="text-xs text-zinc-500">Aguarde, fazendo upload...</span>
            ) : null}
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
