"use client";

import { useEffect, useRef, useState } from "react";

type LocalPreview = {
  id: string;
  file: File;
  url: string;
  broken: boolean;
};

type ImageBatchPickerProps = {
  inputName: string;
  label: string;
  helperText?: string;
  disabled?: boolean;
  maxFiles?: number;
};

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function ImageBatchPicker(props: ImageBatchPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previews, setPreviews] = useState<LocalPreview[]>([]);

  useEffect(() => {
    return () => {
      for (const p of previews) {
        URL.revokeObjectURL(p.url);
      }
    };
  }, [previews]);

  function setFilesToInput(files: File[]) {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    for (const f of files) {
      dt.items.add(f);
    }
    inputRef.current.files = dt.files;
  }

  function replacePreviews(files: File[]) {
    setPreviews((curr) => {
      for (const p of curr) {
        URL.revokeObjectURL(p.url);
      }
      return files.map((file) => ({
        id: fileKey(file),
        file,
        url: URL.createObjectURL(file),
        broken: false,
      }));
    });
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      replacePreviews([]);
      return;
    }
    const max = props.maxFiles && props.maxFiles > 0 ? props.maxFiles : files.length;
    const clipped = files.slice(0, max);
    setFilesToInput(clipped);
    replacePreviews(clipped);
  }

  function removeOne(targetId: string) {
    setPreviews((curr) => {
      const target = curr.find((p) => p.id === targetId);
      if (target) {
        URL.revokeObjectURL(target.url);
      }
      const next = curr.filter((p) => p.id !== targetId);
      setFilesToInput(next.map((p) => p.file));
      return next;
    });
  }

  function markBroken(id: string) {
    setPreviews((curr) => curr.map((p) => (p.id === id ? { ...p, broken: true } : p)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={props.disabled}
          onClick={() => inputRef.current?.click()}
          className="rounded-none bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Escolher arquivos
        </button>
        <span className="text-sm text-zinc-700 dark:text-zinc-300">{props.label}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {previews.length} selecionada(s)
          {props.maxFiles ? ` / ${props.maxFiles} permitidas` : ""}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        name={props.inputName}
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        disabled={props.disabled}
        onChange={onChange}
        className="hidden"
      />

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {props.helperText ?? "Selecione varias imagens de uma vez."}
      </p>

      {previews.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((p) => (
            <div
              key={p.id}
              className="relative overflow-hidden rounded-none border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {!p.broken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={p.file.name}
                  className="h-28 w-full object-cover"
                  onError={() => markBroken(p.id)}
                />
              ) : (
                <div className="flex h-28 items-center justify-center px-2 text-center text-[11px] text-zinc-500">
                  Pre-visualizacao indisponivel
                </div>
              )}
              <button
                type="button"
                disabled={props.disabled}
                onClick={() => removeOne(p.id)}
                className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
              >
                Remover
              </button>
              <p className="truncate px-2 py-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                {p.file.name}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
