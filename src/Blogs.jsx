import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Nav } from './teas/Nav.jsx';
import { Footer } from './teas/Footer.jsx';
import { sortedPosts, findPost, formatDate } from './blogs/posts.js';

const CARD = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-lg p-8';
const LINK = 'text-blue-600 dark:text-blue-400 hover:underline';

function Hero({ title, children }) {
  return (
    <div className="bg-gradient-to-b from-white dark:from-slate-800 to-slate-50 dark:to-slate-900 py-14 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100" style={{ lineHeight: 1.2 }}>{title}</h1>
        {children && <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{children}</p>}
      </div>
    </div>
  );
}

function Meta({ post }) {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      {formatDate(post.date)}
      {post.authors?.length ? <> · {post.authors.join(', ')}</> : null}
    </p>
  );
}

// List page at /blogs.
export default function Blogs() {
  const posts = sortedPosts();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Nav />
      <Hero title="Blogs">
        Notes from the TEAS team on measurements, methods and what we learn from running the benchmark.
      </Hero>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        {posts.length === 0 && (
          <div className={`${CARD} text-center`}>
            <p className="text-slate-600 dark:text-slate-300">No posts yet. Check back soon.</p>
          </div>
        )}
        {posts.map((post) => {
          const external = !post.Body && post.href;
          return (
            <article key={post.slug} className={CARD}>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                {external ? (
                  <a href={post.href} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
                    {post.title} <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <Link to={`/blogs/${post.slug}`} className="hover:underline">{post.title}</Link>
                )}
              </h2>
              <div className="mb-3"><Meta post={post} /></div>
              {post.summary && (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">{post.summary}</p>
              )}
              {external ? (
                <a href={post.href} target="_blank" rel="noopener noreferrer" className={`text-sm font-semibold ${LINK}`}>Read on external site</a>
              ) : (
                <Link to={`/blogs/${post.slug}`} className={`text-sm font-semibold ${LINK}`}>Read more</Link>
              )}
            </article>
          );
        })}
      </div>
      <Footer />
    </div>
  );
}

// Single post at /blogs/:slug.
export function BlogPost() {
  const { slug } = useParams();
  const post = findPost(slug);
  if (!post) return <Navigate to="/blogs" replace />;
  if (!post.Body && post.href) {
    window.location.replace(post.href);
    return null;
  }
  const { Body } = post;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Nav />
      <Hero title={post.title}>
        {formatDate(post.date)}
        {post.authors?.length ? <> · {post.authors.join(', ')}</> : null}
      </Hero>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link to="/blogs" className={`inline-flex items-center gap-1 text-sm font-semibold mb-6 ${LINK}`}>
          <ArrowLeft className="w-4 h-4" /> All posts
        </Link>
        <article className={`${CARD} prose-teas`}>
          {Body ? <Body /> : <p className="text-slate-600 dark:text-slate-300">This post has no content yet.</p>}
        </article>
      </div>
      <Footer />
    </div>
  );
}
