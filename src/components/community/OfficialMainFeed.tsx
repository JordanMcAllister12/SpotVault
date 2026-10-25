import { useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, X } from 'lucide-react';
import { fetchPublishedMainFeed, sanitizeArticleHtml, type MainFeedPost } from '@/lib/mainFeed';

const publisherLabels = { spotvault: 'SpotVault', spotvault_news: 'SpotVault News', staff: 'Staff' } as const;
const typeLabels = { news: 'NEWS', announcement: 'ANNOUNCEMENT', platform_update: 'PLATFORM UPDATE', feature: 'FEATURE', education: 'EDUCATION', promotion: 'PROMOTION', community: 'COMMUNITY' } as const;

export function OfficialMainFeed({ onArticleOpen }: { onArticleOpen?: (post: MainFeedPost) => void }) {
  const [posts, setPosts] = useState<MainFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MainFeedPost | null>(null);

  useEffect(() => {
    fetchPublishedMainFeed()
      .then((data) => { setPosts(data); })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  const openArticle = (post: MainFeedPost) => {
    if (onArticleOpen) onArticleOpen(post);
    else setSelected(post);
  };

  if (loading) {
    return (
      <div className="mb-3 flex items-center justify-center border-b border-[#d4a52c]/20 pb-3">
        <div className="flex items-center gap-2 px-1 py-4">
          <div className="h-3 w-3 animate-spin rounded-full border border-[#d4a52c]/30 border-t-[#d4a52c]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f5e6b0]/60">Loading SpotVault Info…</span>
        </div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <>
      <div className="mb-3 border-b border-[#d4a52c]/20 pb-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <BadgeCheck className="h-4 w-4 text-[#d4a52c]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f5e6b0]">SpotVault Info</span>
        </div>
        <div className="space-y-2">
          {posts.map((post) => (
            <button key={post.id} onClick={() => openArticle(post)} className="block w-full rounded-xl border border-[#d4a52c]/20 bg-[#110f0b]/85 p-3 text-left backdrop-blur-[14px] transition hover:border-[#d4a52c]/45">
              {post.feature_image_url && <img src={post.feature_image_url} alt="" className="mb-3 max-h-44 w-full rounded-lg object-cover" />}
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[#d4a52c]">
                <span>{post.label ?? typeLabels[post.post_type]}</span><span className="text-white/20">·</span><span>{publisherLabels[post.publish_as]}</span>
              </div>
              <h3 className="mt-1 text-[14px] font-semibold leading-snug text-white">{post.title}</h3>
              {post.subtitle && <p className="mt-1 text-[11px] leading-relaxed text-white/55">{post.subtitle}</p>}
              {post.published_at && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/35">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              )}
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#e0b540]">Read article <ArrowRight className="h-3 w-3" /></span>
            </button>
          ))}
        </div>
      </div>
      {selected && <ArticleModal post={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ArticleModal({ post, onClose }: { post: MainFeedPost; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" onClick={onClose}>
      <article className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#d4a52c]/30 bg-[#0b0d0f] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-end border-b border-white/[0.06] bg-[#0b0d0f]/95 p-3 backdrop-blur">
          <button onClick={onClose} className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-white" aria-label="Close article"><X className="h-4 w-4" /></button>
        </div>
        {post.feature_image_url && <img src={post.feature_image_url} alt="" className="max-h-80 w-full object-cover" />}
        <div className="p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-[#d4a52c]"><span>{post.label ?? typeLabels[post.post_type]}</span><span className="text-white/20">·</span><span>{publisherLabels[post.publish_as]}</span></div>
          <h1 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">{post.title}</h1>
          {post.subtitle && <p className="mt-3 text-[14px] leading-relaxed text-white/60">{post.subtitle}</p>}
          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-white/30"><CalendarDays className="h-3.5 w-3.5" />{post.published_at ? new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</div>
          <div className="article-body mt-7 text-[13px] leading-[1.8] text-white/75" dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(post.body_html) }} />
          {post.cta_label && post.cta_url && <a href={post.cta_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0]">{post.cta_label}<ArrowRight className="h-3.5 w-3.5" /></a>}
        </div>
      </article>
    </div>
  );
}
