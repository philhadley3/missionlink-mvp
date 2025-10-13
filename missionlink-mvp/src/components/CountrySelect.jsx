import { useEffect, useState } from "react";
import { fetchCountries } from "@/lib/api";

export function CountrySelect({ value, onChange, ...props }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCountries()
      .then((list) =>
        setCountries(list.sort((a, b) => a.name.localeCompare(b.name)))
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <select {...props}>
        <option>Loading countries…</option>
      </select>
    );
  }

  return (
    <select value={value} onChange={onChange} {...props}>
      <option value="">Select a country</option>
      {countries.map((c) => (
        <option key={c.alpha2} value={c.alpha2}>
          {c.flag ? `${c.flag} ` : ""}
          {c.name}
        </option>
      ))}
    </select>
  );
}
