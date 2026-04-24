const [loading, setLoading] = React.useState(false);

<button
  onClick={async () => {
    setLoading(true);
    await fetch("/api/calendly/sync", { method: "POST" });
    setLoading(false);
    location.reload();
  }}
>
  {loading ? "Bezig..." : "🔄 Afspraken verversen"}
</button>