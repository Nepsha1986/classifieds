import { api } from '../lib/endpoints';

export default async function HomePage() {
  const categories = await api.categories();

  return (
    <>
      <h1>Latest listings</h1>
      <ul className="category-list">
        {categories.map((category) => (
          <li key={category.id}>{category.name}</li>
        ))}
      </ul>
    </>
  );
}
