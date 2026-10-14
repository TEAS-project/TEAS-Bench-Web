// Blog posts shown on /blogs. Add a new post by appending an entry here.
//
// Each entry:
//   slug     URL segment, so '/blogs/<slug>'. Lower-case letters, digits and hyphens.
//   title    Post title.
//   date     ISO date 'YYYY-MM-DD'. The list is sorted newest first.
//   authors  Array of author names.
//   summary  One or two sentences shown on the list page.
//   Body     React component rendered on the post page. Write it in its own
//            file under src/blogs/ and import it here, e.g.
//              import HelloTeas from './HelloTeas.jsx';
//   href     Optional. An external URL used instead of Body, opened in a new tab.
//
// Example:
//   {
//     slug: 'hello-teas',
//     title: 'Hello TEAS',
//     date: '2026-10-07',
//     authors: ['Liang Cheng'],
//     summary: 'Why we built a live benchmark for LLM inference cost, accuracy, performance and energy.',
//     Body: HelloTeas,
//   },

export const POSTS = [
];

// Newest first.
export function sortedPosts() {
  return [...POSTS].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function findPost(slug) {
  return POSTS.find((p) => p.slug === slug);
}

export function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
