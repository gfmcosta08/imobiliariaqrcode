"use client";

import { useFormState, useFormStatus } from "react-dom";

import { updateProfile, type UpdateProfileState } from "./actions";

type ProfileFormProps = {
  fullName: string;
  whatsapp: string;
  email: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "Salvando..." : "Salvar perfil"}
    </button>
  );
}

export function ProfileForm(props: ProfileFormProps) {
  const [state, action] = useFormState<UpdateProfileState, FormData>(updateProfile, null);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Nome</span>
          <input
            name="full_name"
            defaultValue={props.fullName}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">WhatsApp</span>
          <input
            name="whatsapp_number"
            type="tel"
            defaultValue={props.whatsapp}
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">E-mail</span>
        <input
          value={props.email}
          disabled
          className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
        />
      </label>

      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {state.success}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <SubmitButton />
      </div>
    </form>
  );
}
