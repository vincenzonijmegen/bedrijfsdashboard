import PrognoseVerdeling from "@/components/PrognoseVerdeling";

export default function PrognosePage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Omzetprognose per maand</h1>
      <PrognoseVerdeling />
    </main>
  );
}
