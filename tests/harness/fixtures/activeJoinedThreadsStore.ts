/*
 * REAL Discord client source, extracted from the local Discord cache
 * (Chromium cache chunk of Discord app-1.0.9267).
 *
 * Provenance: minified `ActiveJoinedThreadsStore` class and the channel-row
 * thread-list helper from Discord's renderer bundle. The test suite uses this
 * to prove our patch regex matches real Discord code.
 *
 * DO NOT import this at runtime in the plugin.
 */

export const ACTIVE_JOINED_THREADS_STORE_CLASS = `class q extends a.Ay.Store{static displayName="ActiveJoinedThreadsStore";initialize(){this.waitFor(A.A,d.A,c.A,h.A,u.Ay,_.Ay),this.syncWith([_.Ay],x)}hasActiveJoinedUnreadThreads(e,t){return e in m&&t in m[e]}getActiveUnjoinedThreadsForParent(e,t){return e in T?T[e][t]??z:z}getActiveJoinedThreadsForParent(e,t){return e in p?p[e][t]??$:$}getAllActiveJoinedThreads(){return p}getActiveJoinedThreadsForGuild(e){return p[e]??Y}getActiveJoinedUnreadThreadsForGuild(e){return m[e]??Y}getActiveJoinedUnreadThreadsForParent(e,t){return this.getActiveJoinedUnreadThreadsForGuild(e)[t]??$}getActiveJoinedRelevantThreadsForGuild(e){return S[e]??Y}getActiveJoinedRelevantThreadsForParent(e,t){return this.getActiveJoinedRelevantThreadsForGuild(e)[t]??$}getActiveUnjoinedThreadsForGuild(e){return T[e]??K}getActiveUnjoinedUnreadThreadsForGuild(e){return g[e]??Y}getActiveUnjoinedUnreadThreadsForParent(e,t){return this.getActiveUnjoinedUnreadThreadsForGuild(e)[t]??$}getNewThreadCountsForGuild(e){return N[e]??X}computeAllActiveJoinedThreads(e){let t=[];for(let n in p)if(n===e||null==e)for(let e in p[n])for(let i in p[n][e])t.push(p[n][e][i].channel);return t}getNewThreadCount(e,t){return N[e]?.[t]??0}getActiveThreadCount(e,t){return r().size(p[e]?.[t]??{})+r().size(T[e]?.[t]??{})}}`;

export const CHANNEL_THREAD_LIST_HELPER = `function eC(e,t,n,i,r){let a=null!=n&&(n.id===e.id||i===e.id),l=null!=n&&n.isThread()&&n.parent_id===e.id;if(x.wE.has(e.type)){let e=s().sortBy(Object.values(t),e=>-e.joinTimestamp).map(e=>e.channel.id);return a?e:l?(n.id in t||e.unshift(n.id),e):r?e.filter(e=>!G.A.isMuted(e)||H.Ay.getMentionCount(e)>0):e}return[]}function eO(e,t){return e.favoriteChannelIds.has(t.id)}function eR(e,t){let{selectedChannel:n,activeJoinedRelevantThreads:i}=t;if(H.Ay.getMentionCount(e.id)>0)return!0;for(let t in i[e.id])if(H.Ay.getMentionCount(t)>0)return!0;if(null!=n&&(n.id===e.id||n.isThread()&&n.parent_id===e.id))return!0;let r=P.A.getNewChannelIds(e.category.guild.id);if(r.size>ee);else if(r.has(e.id))return!0;return!1}function eL(e,t,n){let{selectedChannel:i,activeJoinedRelevantThreads:r}=n;if(t.type===q.rbe.GUILD_DIRECTORY||!e`;
