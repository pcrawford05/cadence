import ContactForm from "@/components/ContactForm";
import { PageHeader } from "@/components/ui";

export default function NewContactPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add a person" />
      <div className="rounded-3xl border border-line bg-card p-5 sm:p-7">
        <ContactForm />
      </div>
    </div>
  );
}
