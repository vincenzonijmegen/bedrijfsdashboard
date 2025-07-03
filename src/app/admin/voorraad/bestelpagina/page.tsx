'use client';

export default function BestelPagina() {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // ...
  };

  return <input type="text" onChange={handleChange} />;
}
