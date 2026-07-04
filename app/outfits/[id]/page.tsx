import { OutfitBuilderPageShell } from "@/components/outfits/outfit-builder";

type EditOutfitPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditOutfitPage({ params }: EditOutfitPageProps) {
  const { id } = await params;

  return (
    <OutfitBuilderPageShell
      title="Edit outfit"
      description="Update slots, metadata, or replace items in this saved outfit."
      outfitId={id}
    />
  );
}
