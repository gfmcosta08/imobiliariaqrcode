import { createProperty } from "../actions";
import { PropertyEditorForm } from "../property-editor-form";

export function PropertyForm() {
  return <PropertyEditorForm mode="create" action={createProperty} />;
}
