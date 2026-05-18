"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { deletePropertyMedia } from "../media-actions";

type MediaRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  status: string;
};

type LocalMedia = MediaRow & { signedUrl?: string | null };
type UploadItem = {
  id: string;
  name: string;
  previewUrl: string;
  status: "sending" | "success" | "error";
  error?: string;
};

export function MediaSection(props: {
  propertyId: string;
  media: MediaRow[];
  signedUrls: Record<string, string>;
  maxImages: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [media, setMedia] = useState<LocalMedia[]>(
    props.media.map((item) => ({ ...item, signedUrl: props.signedUrls[item.id] })),
  );
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});

  const mediaVisible = useMemo(
    () => media.filter((item) => item.status !== "deleted"),
    [media],
  );
  const count = mediaVisible.length;
  const availableSlots = Math.max(0, props.maxImages - count);
  const canAdd = availableSlots > 0;

  function scrollToNotice() {
    setTimeout(
      () => noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      50,
    );
  }

  async function uploadSingleFile(file: File, uploadId: string) {
    const body = new FormData();
    body.append("files", file);

    try {
      const response = await fetch(`/api/properties/${encodeURIComponent(props.propertyId)}/media`, {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        error?: string;
        uploaded?: Array<{ id: string; storage_path: string; signedUrl?: string | null }>;
        failed?: Array<{ name: string; error: string }>;
      };

      if (!response.ok || !payload.uploaded?.length) {
        const error = payload.error ?? payload.failed?.[0]?.error ?? "Falha ao enviar imagem.";
        setUploads((current) =>
          current.map((item) => (item.id === uploadId ? { ...item, status: "error", error } : item)),
        );
        return;
      }

      const uploaded = payload.uploaded[0];
      setMedia((current) => [
        ...current,
        {
          id: uploaded.id,
          storage_path: uploaded.storage_path,
          mime_type: file.type,
          status: "ready",
          signedUrl: uploaded.signedUrl ?? null,
        },
      ]);
      setUploads((current) =>
        current.map((item) => (item.id === uploadId ? { ...item, status: "success" } : item)),
      );
    } catch (error) {
      setUploads((current) =>
        current.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                status: "error",
                error: error instanceof Error ? error.message : "Falha ao enviar imagem.",
              }
            : item,
        ),
      );
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNotice(null);
    const selected = Array.from(e.currentTarget.files ?? []).filter((file) => file.size > 0);
    e.currentTarget.value = "";
    if (!selected.length) return;

    if (availableSlots <= 0) {
      setNotice("Limite de imagens atingido para este plano.");
      scrollToNotice();
      return;
    }

    const accepted = selected.slice(0, availableSlots);
    const skipped = selected.length - accepted.length;
    if (skipped > 0) {
      setNotice(`${skipped} imagem(ns) ficaram fora do limite de ${props.maxImages}.`);
      scrollToNotice();
    }

    const uploadItems = accepted.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "sending" as const,
    }));

    setUploads((current) => [...uploadItems, ...current]);
    setLoading(true);
    for (let index = 0; index < accepted.length; index += 1) {
      await uploadSingleFile(accepted[index], uploadItems[index].id);
    }
    setLoading(false);
    router.refresh();
  }

  async function onDelete(item: MediaRow) {
    setNotice(null);
    setLoading(true);
    const res = await deletePropertyMedia(props.propertyId, item.id, item.storage_path);
    setLoading(false);
    if (res && "error" in res && res.error) {
      setNotice(res.error);
      return;
    }
    setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id));
    router.refresh();
  }

  return (
    <div className="mt-10" data-testid="property-media-section">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Imagens</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400" data-testid="property-media-count">
        {count}/{props.maxImages} imagens (limite do plano de origem do imovel).
      </p>

      <div ref={noticeRef}>
        {notice ? (
          <div
            className="mt-3 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            role="alert"
          >
            <span className="mt-0.5 shrink-0 text-base">!</span>
            <span>{notice}</span>
          </div>
        ) : null}
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500" role="status" data-testid="property-media-status">
            Enviando imagem(ns) automaticamente...
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mediaVisible.map((item) => {
          const url = item.signedUrl ?? props.signedUrls[item.id];
          const broken = brokenIds[item.id] === true;
          return (
            <div
              key={item.id}
              data-testid="property-media-item"
              className="relative overflow-hidden rounded-none border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {url && !broken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  className="h-40 w-full object-cover"
                  onError={() => setBrokenIds((current) => ({ ...current, [item.id]: true }))}
                />
              ) : (
                <div className="flex h-40 items-center justify-center px-2 text-center text-xs text-zinc-500">
                  Pre-visualizacao indisponivel
                </div>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={() => onDelete(item)}
                data-testid="property-media-remove"
                className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                Remover
              </button>
            </div>
          );
        })}
      </div>

      {uploads.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="property-media-upload-status-list">
          {uploads.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt="" className="h-28 w-full object-cover" />
              <div className="p-2 text-xs">
                <p className="truncate text-zinc-700 dark:text-zinc-200">{item.name}</p>
                <p
                  className={
                    item.status === "success"
                      ? "text-emerald-700"
                      : item.status === "error"
                        ? "text-red-700"
                        : "text-zinc-500"
                  }
                >
                  {item.status === "success"
                    ? "Enviada"
                    : item.status === "error"
                      ? `Falhou: ${item.error}`
                      : "Enviando..."}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {canAdd ? (
        <div className="mt-6 space-y-2" data-testid="property-media-upload-form">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={onFileChange}
            data-testid="property-media-files-input"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            data-testid="property-media-files-button"
            className="rounded-none bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Escolher arquivos
          </button>
          <p className="text-xs text-zinc-500">
            Selecione ate {availableSlots} imagem(ns). O upload comeca automaticamente apos confirmar a selecao.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
          Limite de imagens atingido. Remova uma imagem ou faca upgrade para PRO.
        </p>
      )}
    </div>
  );
}
