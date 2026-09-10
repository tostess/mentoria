import { notFound } from "next/navigation";
import { DesignGallery } from "@/app/design/DesignGallery";

/** Galeria do sistema de design. Só existe em desenvolvimento. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
