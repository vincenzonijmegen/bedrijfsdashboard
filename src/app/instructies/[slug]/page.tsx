interface SlugParams {
  params: {
    slug: string;
  };
}

export default async function Page(props: SlugParams) {
  const slug = props.params.slug;
  const result = await db.query("SELECT * FROM instructies WHERE slug = $1", [slug]);
  const instructie = result.rows[0];

  if (!instructie) {
    return <div className="p-6 text-red-700">❌ Instructie niet gevonden</div>;
  }

  return <StapVoorStapMetToets html={instructie.inhoud} />;
}
