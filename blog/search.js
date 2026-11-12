export function searchPosts(posts, query) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return posts.filter(({ slug, title, description, tags }) => {
    const text = [slug, title, description, ...tags].join(" ").toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
