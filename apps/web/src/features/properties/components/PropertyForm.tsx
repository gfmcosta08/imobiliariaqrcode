import { createProperty } from "../actions";
import { PropertyEditorForm } from "./PropertyEditorForm";

export function PropertyForm() {
  return <PropertyEditorForm mode="create" action={createProperty} />;
}
