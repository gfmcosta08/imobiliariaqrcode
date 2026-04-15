"use client";

import { useEffect, useMemo, useState } from "react";

type LocalPreview = {
  id: string;
  file: File;
  url: string;
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
  const [selected, setSelected] = useState<File[]>([]);

  const previews = useMemo<LocalPreview[]>(
    () =>
      selected.map((file) => ({
        id: fileKey(file),
        file,
        url: URL.createObjectURL(file),
      })),
    [selected],
  );

  useEffect(() => {
    return () => {
      for (const p of previews) {
        URL.revokeObjectURL(p.url);
      }
    };
  }, [previews]);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) {
      setSelected([]);
      return;
    }

    const max = props.maxFiles && props.maxFiles > 0 ? props.maxFiles : files.length;
    setSelected(files.slice(0, max));
  }

  function removeOne(target: File) {
    setSelected((curr) => curr.filter((f) => fileKey(f) !== fileKey(target)));
  }

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">{props.label}</span>
        <input
          type="file"
          name={props.inputName}
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={props.disabled}
          onChange={onChange}
          className="text-sm"
        />
      </label>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {props.helperText ?? "Você pode selecionar várias imagens de uma vez."}
      </p>

      {previews.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {previews.map((p) => (
            <div
              key={p.id}
              className="relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.file.name} className="h-28 w-full object-cover" />
              <button
                type="button"
                disabled={props.disabled}
                onClick={() => removeOne(p.file)}
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
