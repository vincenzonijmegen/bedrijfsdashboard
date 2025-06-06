// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function InstructieBewerkPagina({ params }: any) {
  const { slug } = params;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Instructie: {slug}</h1>
      <p>Hier komt straks de editor voor deze instructie.</p>
    </div>
  );
}
