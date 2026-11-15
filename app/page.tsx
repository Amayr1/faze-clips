"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, Flame, Grid2X2, ListVideo, LoaderCircle, Pause, Play, Plus, Search, Settings2, Share2, Heart, Link as LinkIcon, X, Zap } from "lucide-react";
import GlobalSearch from "@/components/global-search";
import ClipComments from "@/components/clip-comments";
import CreatorAffiliationBadge,{CreatorBadgeLegend} from "@/components/creator-affiliation-badge";
import StreamerLink,{FullVideoLink} from "@/components/streamer-link";
import {useFanExperience,FanGateway,FaZeOrigins,CommunitySpotlight,FanCommerce} from "@/components/faze-experience";
import CreatorStudio from "@/components/creator-studio";
import DeveloperApi from "@/components/developer-api";
import WatchTracker from "@/components/watch-tracker";
import {rankClips} from "@/lib/ranking.mjs";
import CommunityFeed from "@/components/community-feed";
import { trustedClipUrl } from "@/lib/kick.mjs";
import {cleanReel} from "@/lib/reel-validation.mjs";
import {useReelSocial,ClipImport} from "@/components/reel-social";

type Clip = { id: string; title: string; thumbnail: string; videoUrl: string; channel: string; channelName: string; category: string; duration: number; views: number; createdAt: string; url: string; isMature?: boolean; provider?: string; externalId?: string; externalLikes?:number; externalViews?:number; externalSyncedAt?:number;streamUrl?:string;sourceVideoUrl?:string };
type Feed = { clips: Clip[]; sources?: { channel: string; status: string; count: number }[]; errors?: { channel: string; message: string }[]; mode?: string; capturedAt?: string };
const DEFAULT_CHANNELS = ["fazerain", "eslcs", "valorant", "xqc", "yourrage", "saab", "sennadobone", "ninja"];
const CHANNELS = [
  { id: "fazerain", name: "FaZe Rain", initials: "F", color: "#ed3448", detail: "From the OG era to your live feed.", tag: "LEGACY + VARIETY" },
  { id: "xqc", name: "xQc", initials: "X", color: "#a399ff", detail: "Games. Reactions. Absolute chaos.", tag: "VARIETY" },
  { id: "yourrage", name: "YourRage", initials: "YR", color: "#ff858c", detail: "Funny moments. Zero chill.", tag: "IRL + GAMES" },
  { id: "saab", name: "Saab", initials: "S", color: "#ffac69", detail: "GTA RP. Main character energy.", tag: "GTA V" },
];
const HERO = "https://cdn.fastly.steamstatic.com/apps/csgo/videos/csgo_react/cs2/competitive_clip.mp4";
const POSTER = "https://i.ytimg.com/vi/GHAlIBCY3p4/maxresdefault.jpg";
const FILM_URL = "https://www.youtube-nocookie.com/embed/GHAlIBCY3p4?autoplay=1&rel=0";
const compact = (v: number) => Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0);
const duration = (v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;
function isStoredClip(c:unknown):c is Clip {try {if((c as Clip)?.provider==="upload")return /^upload:[a-f0-9-]{36}$/.test((c as Clip).id)&&/^\/api\/media\/[a-f0-9-]{36}\.(mp4|webm|mov)$/.test((c as Clip).videoUrl)&&typeof (c as Clip).title==="string";const r=cleanReel(c);return r.id===(c as Clip).id&&["title","thumbnail","videoUrl","channel","channelName","category","createdAt","url"].every(k=>typeof (c as Record<string,unknown>)[k]==="string")&&["duration","views"].every(k=>typeof (c as Record<string,unknown>)[k]==="number");}catch{return false;}}
function Brand({ small = false }: { small?: boolean }) { return <a className={"brand faze-brand "+(small?"brand-small":"")} href="#" aria-label="FaZe Clips home"><img src="/brand/faze-white.png" alt="FaZe Clan logo"/><span>FAZE<span>CLIPS</span></span></a>; }

function ClipVideo({clip}:{clip:Clip}){const [host,setHost]=useState("");useEffect(()=>setHost(window.location.hostname),[]);if(clip.provider==="twitch"||clip.provider==="youtube"){const id=clip.externalId||clip.id.split(":").slice(1).join(":");const src=clip.provider==="twitch"?"https://clips.twitch.tv/embed?clip="+encodeURIComponent(id)+"&parent="+encodeURIComponent(host)+"&autoplay=true":"https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?autoplay=1&rel=0";return <div className="external-player">{host&&<iframe src={src} title={clip.title} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen/>}<a href={clip.url} target="_blank" rel="noreferrer">Having trouble? Watch on {clip.provider==="twitch"?"Twitch":"YouTube"} ↗</a></div>;}return <NativeClipVideo clip={clip}/>;}

function NativeClipVideo({ clip }: { clip: Clip }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let cancelled = false;
    let destroy = () => {};
    setFailed(false); setLoading(true);
    const ready = () => { setLoading(false); void video.play().catch(() => {}); };
    const error = () => { setLoading(false); setFailed(true); };
    video.addEventListener("canplay", ready); video.addEventListener("error", error);
    if (/\.mp4(?:\?|$)/.test(clip.videoUrl)||clip.provider==="upload") video.src = clip.videoUrl;
    else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) { if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = clip.videoUrl; else { console.warn("Clip playback: HLS is unavailable in this browser."); error(); } return; }
        const hls = new Hls({ maxBufferLength: 25 });
        hls.loadSource(clip.videoUrl); hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { console.warn("Clip playback:", data.type, data.details, data.error?.message); error(); } });
        destroy = () => hls.destroy();
      }).catch(error);
    }
    const timeout = setTimeout(() => { if (video.readyState < 2) error(); }, 20000);
    return () => { cancelled = true; clearTimeout(timeout); video.pause(); destroy(); video.removeEventListener("canplay", ready); video.removeEventListener("error", error); video.removeAttribute("src"); video.load(); };
  }, [clip.id, clip.videoUrl]);
  return <div className="clip-video-wrap"><div className="video-blur" style={{ backgroundImage: `url("${clip.thumbnail}")` }} /><video key={clip.id} ref={ref} controls autoPlay playsInline poster={clip.thumbnail} onLoadedData={() => setLoading(false)} />{loading && !failed && <div className="video-loading"><LoaderCircle className="spin" size={28} /><span>Loading the moment…</span></div>}{failed && <div className="video-failure"><Play size={30} /><h3>This clip is taking a timeout.</h3><p>The video may have expired or be unavailable in this browser.</p><a className="button lime" href={clip.url} target="_blank" rel="noreferrer">Watch on Kick <ArrowUpRight size={16} /></a></div>}</div>;
}

export default function Home() {
  const fan=useFanExperience();
  const [feed, setFeed] = useState<Feed>({ clips: [] });
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [draftChannels, setDraftChannels] = useState(DEFAULT_CHANNELS);
  const [channelInput, setChannelInput] = useState("");
  const [channelError, setChannelError] = useState("");
  const [settings, setSettings] = useState(false);
  const [sort, setSort] = useState("for-you");
  const [platform,setPlatform]=useState("all");
  const [creator,setCreator]=useState("all");
  const [likedOnly,setLikedOnly]=useState(false);
  const social=useReelSocial();
  const [searchResults,setSearchResults]=useState<Clip[]>([]);
  const [discoveryQuery,setDiscoveryQuery]=useState("");
  const [searchLoading,setSearchLoading]=useState(false);
  const [signals,setSignals]=useState<any[]>([]);
  const [historyVersion,setHistoryVersion]=useState(0);
  useEffect(()=>{const update=()=>setHistoryVersion(v=>v+1);window.addEventListener("faze-history-updated",update);window.addEventListener("faze-refresh",update);return()=>{window.removeEventListener("faze-history-updated",update);window.removeEventListener("faze-refresh",update);};},[]);
  useEffect(()=>{const c=new AbortController();fetch("/api/recommendations",{signal:c.signal}).then(r=>r.json()).then((d:any)=>setSignals(d.signals||[])).catch(()=>{});return()=>c.abort();},[historyVersion]);
  const [time, setTime] = useState("all");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [saved, setSaved] = useState<Clip[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [reelLayout, setReelLayout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [playing, setPlaying] = useState<Clip | null>(null);
  const [film, setFilm] = useState(false);
  const [toast, setToast] = useState("");
  const [heroPaused, setHeroPaused] = useState(false);
  const [limit, setLimit] = useState(8);
  const heroRef = useRef<HTMLVideoElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchY = useRef(0);

  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem("overtime-saved") || "[]"); if (Array.isArray(stored)) setSaved(stored.filter(isStoredClip).slice(0, 150)); } catch {}
    try { const stored = JSON.parse(localStorage.getItem("overtime-channels") || "null"); if (Array.isArray(stored) && stored.length && stored.length <= 12 && stored.every(c => typeof c === "string" && /^[a-z0-9][a-z0-9_-]{0,29}$/.test(c))) setChannels(stored); } catch {}
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setHeroPaused(true); heroRef.current?.pause(); }
  }, []);
  const sourceSort=sort==="date"?"date":"view";
  useEffect(() => {
    if(discoveryQuery){setLoading(false);return;}
    const controller = new AbortController();
    setLoading(true); setFetchError(""); setFeed({ clips: [] });
    fetch(`/api/clips?channels=${channels.join(",")}&sort=${sourceSort}&time=${time}`, { signal: controller.signal })
      .then(async r => { if (!r.ok) throw Error("The feed couldn’t connect. Try refreshing in a moment."); return await r.json() as Feed; })
      .then((data: Feed) => { setFeed(data); if (!data.clips?.length && data.errors?.length) setFetchError("These channels are unavailable right now. Try another channel or time range."); })
      .catch(e => { if (e.name !== "AbortError") setFetchError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [channels, sourceSort, time, discoveryQuery]);
  useEffect(() => { setLimit(discoveryQuery?24:8); }, [tab, search, channels, savedOnly, sort, time, platform, creator, likedOnly,discoveryQuery]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  const feedBusy=loading||searchLoading;
  const modalOpen = !!playing || film || settings;
  useEffect(() => {
    if (!modalOpen) return;
    const before = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => closeRef.current?.focus(), 0);
    return () => { clearTimeout(t); document.body.style.overflow = ""; before?.focus(); };
  }, [modalOpen]);

  const deepLinkOpened=useRef("");
  useEffect(()=>{const open=()=>{const id=window.location.hash.match(/^#clip=([a-f0-9-]{36})$/)?.[1];if(!id||deepLinkOpened.current===id)return;const clip=social.reels.find(c=>c.id==="upload:"+id);if(clip){setPlaying(clip);deepLinkOpened.current=id;}};open();window.addEventListener("hashchange",open);return()=>window.removeEventListener("hashchange",open);},[social.reels]);
  const candidates=discoveryQuery?searchResults:[...feed.clips,...social.reels.filter(r=>!feed.clips.some(c=>c.id===r.id))];
  const pool=candidates.map(c=>({...c,externalLikes:social.reels.find(r=>r.id===c.id)?.externalLikes||0}));
  const visible = (savedOnly ? saved : pool).filter(c => {
    if(platform!=="all"&&(c.provider||"kick")!==platform)return false;
    if(creator!=="all"&&c.channel!==creator)return false;
    if(likedOnly&&!social.stats[c.id]?.liked)return false;
    if(time!=="all"&&(!c.createdAt||Date.parse(c.createdAt)<Date.now()-({day:86400000,week:604800000,month:2592000000}[time]||0)))return false;
    const cat=c.category.toLowerCase();
    const matchTab=tab==="all"||(tab==="faze"?/faze|broky|karrigan|ropz|frozen|rain/i.test(c.channel+" "+c.title):tab==="cs2"?/counter|cs2/.test(cat):tab==="valorant"?/valorant/.test(cat):tab==="funny"?/chatting|irl|funny|variety/.test(cat)||/ishowspeed|stableronaldo/.test(c.channel):tab==="gta"?/grand theft|gta/.test(cat):tab==="fifa"?/fifa|ea.?sports.?fc|ea fc/.test(cat):cat===tab);
    return matchTab && (c.title+" "+c.channelName+" "+c.category).toLowerCase().includes(search.toLowerCase());
  });
  const ranked=rankClips(visible,sort,social.stats,signals);
  const nextClip = useCallback((delta: number) => {
    if (!playing || !ranked.length) return;
    const i = ranked.findIndex(c => c.id === playing.id);
    setPlaying(ranked[(i + delta + ranked.length) % ranked.length]);
  }, [playing, ranked]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPlaying(null); setFilm(false); setSettings(false); setSearchOpen(false); }
      if (playing && !(e.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]") && ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) { e.preventDefault(); nextClip(e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1); }
      if (e.key === "/" && !modalOpen && !["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" }); document.getElementById("creator-search-input")?.focus(); }
      if (e.key === "Tab" && modalOpen) {
        const els = document.querySelector('[role="dialog"]')?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, select, iframe, video[controls]');
        if (els?.length) { const first = els[0], last = els[els.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
      }
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [playing, nextClip, modalOpen]);

  function toggleSave(clip: Clip) { setSaved(current => { const next = current.some(c => c.id === clip.id) ? current.filter(c => c.id !== clip.id) : [...current, clip].slice(-150); try { localStorage.setItem("overtime-saved", JSON.stringify(next)); } catch { setToast("Browser storage is full. Saves will last for this visit."); } return next; }); }
  function openSettings() { setDraftChannels(channels); setChannelInput(""); setChannelError(""); setSettings(true); }
  function addChannel() { const slug = channelInput.trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?kick\.com\//, "").replace(/\/$/, ""); if (!/^[a-z0-9][a-z0-9_-]{0,29}$/.test(slug)) { setChannelError("Enter a Kick username of up to 30 characters, such as fazerain."); return; } if (draftChannels.length >= 12) { setChannelError("Choose up to 12 channels. Remove one to add another."); return; } if (!draftChannels.includes(slug)) setDraftChannels([...draftChannels, slug]); setChannelInput(""); setChannelError(""); }
  function applyChannels() { if (!draftChannels.length) { setChannelError("Choose at least one channel."); return; } setChannels(draftChannels); try { localStorage.setItem("overtime-channels", JSON.stringify(draftChannels)); } catch {} setSettings(false); setTab("all"); setSavedOnly(false); setToast("Your feed, your lineup."); }
  async function share(clip: Clip) { try { await navigator.clipboard.writeText(new URL(clip.url,window.location.origin).href); setToast("Clip link copied."); } catch { setToast("Use “Open on Kick” to share this clip."); } }
  function startReels() { setReelLayout(true); if (ranked.length) setPlaying(ranked[0]); else document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" }); }
  function toggleHero() { if (heroPaused) { void heroRef.current?.play().then(() => setHeroPaused(false)).catch(() => {}); } else { heroRef.current?.pause(); setHeroPaused(true); } }

  return <>
    <a className="skip-link" href="#feed">Skip to clips</a>
    <header className="site-header"><div className="header-inner"><Brand /><nav aria-label="Main navigation"><a className="nav-active" href="#feed">Clips <span /></a><a href="#faze-origins">Origins</a><a href="#spotlight">Spotlight</a><a href="/schedule">Schedule</a><button onClick={startReels}>Reels <span className="tiny-new">NEW</span></button><a href="#developer-api">Developer API</a><button onClick={() => window.dispatchEvent(new Event("faze-mine"))}>My clips</button></nav><div className="header-actions"><a className="api-mobile-link" href="#developer-api" aria-label="Developer API">API</a><button aria-label="Show saved clips" className={`saved-nav ${savedOnly ? "active" : ""}`} onClick={() => { setSavedOnly(!savedOnly); setTab("all"); document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" }); }}><Bookmark size={16} /> <span>Saved</span>{saved.length > 0 && <b>{saved.length}</b>}</button><button aria-label="Upload a clip" className="button header-cta" onClick={() => window.dispatchEvent(new Event("faze-upload"))}><span>Upload clip</span> <ArrowUpRight size={16} /></button></div></div></header>

    <main>
      <section className="hero" aria-label="Esports at full volume"><video className="hero-video" ref={heroRef} src={HERO} poster={POSTER} autoPlay loop muted playsInline onError={() => setHeroPaused(true)} /><div className="hero-shade" /><div className="hero-grain" /><img className="hero-faze-mark" src="/brand/faze-outline.png" alt=""/>
        <div className="hero-topline"><span><i /> HACKUTA 2026 / FAZE CHALLENGE PROTOTYPE</span><span>MADE FOR THEN. BUILT FOR NEXT. <ArrowUpRight size={13} /></span></div>
        <div className="hero-content"><div className="hero-eyebrow"><span className="lime-line" /> FROM THE FIRST CLIP TO YOUR NEXT FAVORITE</div><h1>YOUR ERA.<br /><span>YOUR NEXT UP.</span><i>↗</i></h1><p>The legends you remember. The names you haven’t found yet.<br className="desktop-break" /> Watch the moment. Learn the story. Make your own.</p><div className="hero-buttons"><a href="#feed" className="button lime">Find your next favorite <ArrowRight size={18} /></a><button className="text-button" onClick={() => {fan.record("story_open","esports");setFilm(true);}}><span className="small-play"><Play size={12} fill="currentColor" /></span> Watch the FaZe Esports film</button></div></div>
        <button className="hero-film" onClick={() => {fan.record("story_open","esports");setFilm(true);}} aria-label="Play the official FaZe Copenhagen film"><span className="circle-play"><Play size={28} fill="currentColor" /></span><span>CULTURE IN<br />EVERY FRAME.</span><ArrowUpRight size={20} /></button>
        <div className="hero-bottom"><div className="hero-caption"><span className="caption-line" /><div><b>IT STARTED WITH A CLIP.</b><span>Clutches · Funny moments · Creator culture</span></div></div><div className="hero-controls"><span>THE HYPE NEVER STOPS</span><button onClick={toggleHero} aria-label={heroPaused ? "Play promo video" : "Pause promo video"}>{heroPaused ? <Play size={16} /> : <Pause size={16} />}</button></div></div>
      </section>

      <div className="culture-strip"><span>EST. 2010 / BUILT BY THE COMMUNITY</span><div className="culture-names"><b>TRICKSHOTS.</b><b>CREATORS.</b><b>CHAMPIONS.</b><b>YOU.</b></div><span className="strip-end">THE STORY KEEPS GOING <ArrowUpRight size={15}/></span></div>

      <FanGateway fan={fan}/>
      <CommunityFeed />
      <section id="feed" className="feed-section page-width"><div className="section-heading"><div><div className="eyebrow"><Flame size={13} /> CLUTCHES, CHAOS & EVERYTHING BETWEEN</div><h2>{savedOnly ? "YOUR COLLECTION" : "THE NEXT MOMENT."}<span className="heading-dot">✳</span></h2></div><p>{savedOnly ? "The moments you came back for." : <>Funny clips. Big plays. Your next favorite.<br />Twitch, Kick, YouTube. One feed.</>}</p></div>
        <GlobalSearch onBusy={setSearchLoading} sort={sort} time={time} onResults={(clips,q,fresh)=>{setSearchResults(clips);setDiscoveryQuery(q);social.ingest(clips);if(fresh){setPlatform("all");setCreator("all");setTab("all");setSearch("");setTime("all");setSavedOnly(false);setLikedOnly(false);setSort(q?"view":"for-you");setLimit(q?24:8);}}}/>
        <div className="ranking-tabs" role="group" aria-label="Shared feed ranking">{[{id:"for-you",name:"For you"},{id:"view",name:"Most viewed"},{id:"hot",name:"Hot"},{id:"top",name:"All time · likes"},{id:"date",name:"New"}].map(t=><button key={t.id} aria-pressed={sort===t.id} className={sort===t.id?"selected":""} onClick={()=>{setSort(t.id);if(t.id==="top")setTime("all");}}>{t.name}</button>)}</div><p className="recommendation-note">All creators. Uploads + discovered clips. {sort==="view"?"Ranked by source views, highest first. FaZe hearts stay separate.":sort==="for-you"?(signals.length?"Recommended from your watch history and likes, with fresh creators mixed in.":"A fresh mix to start. Watch native clips and like moments to shape your feed."):"FaZe likes power shared rankings. Verified social engagement adds a separate discovery signal."}<button onClick={async()=>{const r=await fetch("/api/recommendations",{method:"DELETE"});if(r.ok){setSignals([]);setToast("Watch history reset. Your likes are unchanged.");}else setToast("Sign in to manage watch history.");}}>Reset watch history</button></p>
        <div className="discovery-sources"><div className="source-tabs" role="group" aria-label="Clip platform">{["all","upload","kick","twitch","youtube"].map(v=><button key={v} aria-pressed={platform===v} className={platform===v?"selected":""} onClick={()=>setPlatform(v)}>{v==="all"?"All platforms":v==="upload"?"Creator uploads":v==="youtube"?"YouTube":v.charAt(0).toUpperCase()+v.slice(1)}</button>)}</div><div className="creator-tools"><label><span className="sr-only">Filter by creator</span><select value={creator} onChange={e=>setCreator(e.target.value)}><option value="all">All creators</option>{[...new Map(pool.map(c=>[c.channel,c.channelName])).entries()].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label><span className="sr-only">All games</span><select value={tab} onChange={e=>setTab(e.target.value)}><option value="all">All games</option>{["funny","gta","fifa","cs2","faze","valorant"].includes(tab)&&<option value={tab}>{tab.toUpperCase()}</option>}{[...new Set(pool.map(c=>c.category.toLowerCase()))].sort().map(g=><option key={g} value={g}>{g}</option>)}</select></label><button aria-pressed={likedOnly} className={likedOnly?"selected":""} onClick={()=>setLikedOnly(!likedOnly)}><Heart size={13}/> Liked</button><button onClick={()=>social.setImportOpen(true)}><LinkIcon size={13}/> Add clip link</button></div></div><p className="platform-like-note">Hearts are FaZe Clips likes. Source views belong to Twitch or Kick. <span>Twitch clips can be shared by link; automatic discovery connects when a Twitch app is configured.</span></p><CreatorBadgeLegend/>{social.error&&<p role="status" className="feed-notice">{social.error} {!social.signedIn&&<a href="/signin-with-chatgpt?return_to=/%23feed" target="_top">Sign in →</a>}</p>}
        <div className="feed-toolbar"><div className="game-tabs" role="group" aria-label="Filter clips">{[{ id: "all", text: "Everything" }, { id: "funny", text: "Funny / IRL" }, { id: "gta", text: "GTA V" }, { id: "fifa", text: "FIFA / EA FC" }, { id: "cs2", text: "CS2" }, { id: "faze", text: "FaZe" }, { id: "valorant", text: "VALORANT" }].map(t => <button key={t.id} aria-pressed={tab === t.id} className={tab === t.id ? "selected" : ""} onClick={() => setTab(t.id)}>{t.id === "all" && <Zap size={13} fill="currentColor" />}{t.text}</button>)}</div><div className="toolbar-controls"><button className={`icon-button ${searchOpen ? "active" : ""}`} aria-label="Search clips" onClick={() => {document.getElementById("creator-search-input")?.focus();}}><Search size={17} /></button><span className="toolbar-divider" /><label className="sort-label"><span className="sr-only">Sort clips</span><select value={sort} onChange={e => {setSort(e.target.value);if(e.target.value==="top")setTime("all");}}><option value="for-you">For you</option><option value="hot">Hot · all creators</option><option value="top">Top likes · all time</option><option value="view">Source views</option><option value="date">Newest first</option></select><ChevronDown size={13} /></label><button className={`icon-button ${reelLayout ? "active" : ""}`} onClick={() => setReelLayout(!reelLayout)} aria-label={reelLayout ? "Show landscape cards" : "Show reel cards"}>{reelLayout ? <Grid2X2 size={17} /> : <ListVideo size={17} />}</button></div></div>
        {searchOpen && <div className="search-bar"><Search size={18} /><input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter the clips already loaded…" aria-label="Search clip titles, channels and games" /><button aria-label="Clear search" onClick={() => setSearch("")}><X size={17} /></button><kbd>ESC</kbd></div>}
        <div className="feed-meta"><div><span className={`status-dot ${feedBusy ? "loading" : ""}`} />{feedBusy ? "Finding the good stuff…" : savedOnly ? `${saved.length} saved ${saved.length === 1 ? "moment" : "moments"}` : `${visible.length} moments · ${feed.mode === "cached" ? "Includes cached Kick clips" : "From Twitch, Kick & YouTube"}`}{feed.mode === "cached" && !savedOnly && feed.capturedAt && <span className="cache-date"> · captured {new Date(feed.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}</div><div><label className="time-label"><span className="sr-only">Clip time range</span><select value={time} onChange={e => setTime(e.target.value)}><option value="all">All time</option><option value="month">This month</option><option value="week">This week</option><option value="day">Today</option></select><ChevronDown size={12} /></label><button onClick={openSettings}><Settings2 size={13} /> Edit sources</button></div></div>
        {fetchError && <div className="feed-notice" role="status">{fetchError}</div>}
        {!feedBusy && feed.errors && feed.errors.length > 0 && feed.clips.length > 0 && <div className="feed-notice subtle">Some sources couldn’t refresh. Available clips are still ready to watch.</div>}
        <div className={`clip-grid ${reelLayout ? "reel-grid" : ""}`} aria-busy={feedBusy}>{feedBusy ? Array.from({ length: 8 }, (_, i) => <div className="clip-skeleton" key={i}><div /><span /><span /></div>) : ranked.slice(0, limit).map((clip, i) => <article className="clip-card" key={clip.id}>
          <div className="clip-image"><button className="clip-play" onClick={() => setPlaying(clip)} aria-label={`Play ${clip.title}`}>{clip.provider==="upload"?<video src={clip.videoUrl+"#t=0.1"} muted playsInline preload="metadata"/>:<img src={clip.thumbnail} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />}<div className="clip-image-shade" /><span className="clip-category">{clip.channel.toLowerCase().includes("faze") ? "FAZE" : /counter/i.test(clip.category) ? "CS2" : clip.category || "ESPORTS"}</span>{i === 0 && !savedOnly && <span className="hot-badge"><Flame size={11} fill="currentColor" /> TOP PLAY</span>}<span className="hover-play"><Play size={24} fill="currentColor" /></span><span className="clip-time">{clip.duration?duration(clip.duration):(clip.provider==="twitch"?"TWITCH":clip.provider==="upload"?"UPLOAD":"SHORT")}</span>{clip.views>0&&<span className="clip-views" title="Source platform views"><Eye size={12} />{compact(clip.views)}</span>}{reelLayout && <strong className="reel-card-title">{clip.title}</strong>}</button><button className={`save-clip ${saved.some(c => c.id === clip.id) ? "is-saved" : ""}`} aria-label={`${saved.some(c => c.id === clip.id) ? "Unsave" : "Save"} ${clip.title}`} onClick={() => toggleSave(clip)}><Bookmark size={15} fill={saved.some(c => c.id === clip.id) ? "currentColor" : "none"} /></button><button className={"reel-like "+(social.stats[clip.id]?.liked?"liked":"")} aria-label={(social.stats[clip.id]?.liked?"Unlike reel ":"Like reel ")+clip.title} aria-pressed={!!social.stats[clip.id]?.liked} disabled={social.pending.includes(clip.id)} onClick={()=>social.like(clip)}><Heart size={14} fill={social.stats[clip.id]?.liked?"currentColor":"none"}/>{social.stats[clip.id]?.likes||0}</button></div>
          <div className="clip-info"><div className="channel-line"><span className={`mini-avatar ${clip.channel.includes("faze") ? "faze-avatar" : ""}`}>{clip.channel.includes("faze") ? "F" : clip.channelName.slice(0, 2).toUpperCase()}</span><span className="creator-display-name">{clip.channelName}</span><CreatorAffiliationBadge clip={clip}/><span className={"provider-mark "+(clip.provider||"kick")}>{clip.provider==="twitch"?"TW":clip.provider==="youtube"?"YT":clip.provider==="upload"?"FZ":"K"}</span><ArrowUpRight size={12} /></div><button className="clip-title" onClick={() => setPlaying(clip)}>{clip.title}</button><span className="clip-game">{clip.category || "Variety"}</span>{!!clip.externalLikes&&<span className="external-engagement">{compact(clip.externalLikes)} verified social likes</span>}</div>
        </article>)}</div>
        {!feedBusy && !visible.length && <div className="empty-feed"><Search size={28} /><h3>{savedOnly ? "Your next favorite is out there." : "No clips in this corner. Yet."}</h3><p>{savedOnly ? "Tap the bookmark on a clip to keep it here." : "Try another game, a wider time range, or add a Kick channel."}</p><button className="button outline" onClick={() => { setTab("all"); setSearch(""); setSavedOnly(false); setTime("all");setPlatform("all");setCreator("all");setLikedOnly(false); }}>Back to all clips <ArrowRight size={15} /></button></div>}
        {!feedBusy && visible.length > limit && <button className="load-more button outline" onClick={() => setLimit(limit + 8)}>{discoveryQuery?"Show more collected clips":"There’s more where that came from"} <Plus size={15} /></button>}
      </section>

      <section className="reel-banner page-width" aria-label="Watch the reel feed"><div className="reel-banner-copy"><span className="eyebrow"><span className="status-dot" /> ONE MORE. THEN ONE MORE.</span><h2>LESS SCROLL.<br /><span>MORE HOLY SH*T.</span></h2><p>Your next “did you see that?” is one swipe away.<br />Drop into reels. Stay for the ridiculous.</p><button className="button lime" onClick={startReels}>Enter the rabbit hole <ArrowUpRight size={18} /></button></div><div className="reel-visual" aria-hidden="true"><div className="reel-orbit" /><span className="reel-word">REPLAY<br />REPLAY<br />REPLAY</span>{feed.clips.slice(0, 3).map((c, i) => <div key={c.id} className={`phone-card phone-${i}`}><img src={c.thumbnail} alt="" loading="lazy" /><div /><Play size={25} fill="currentColor" /><b>{c.title}</b><span><span className="provider-mark">{c.provider==="twitch"?"TW":c.provider==="youtube"?"YT":c.provider==="upload"?"FZ":"K"}</span> <span className="creator-display-name">{c.channelName}</span><CreatorAffiliationBadge clip={c}/></span></div>)}<span className="reel-sticker">100%<br />UNSKIPPABLE.</span></div></section>

      <CommunitySpotlight fan={fan} onPlay={c=>{social.ingest([c]);setPlaying(c);}}/>
      <FaZeOrigins fan={fan} onPlay={c=>setPlaying(c)}/>
      <section className="creators-section page-width" id="creators"><div className="section-heading"><div><div className="eyebrow">GOOD PEOPLE. INSANE PLAYS.</div><h2>THE USUAL SUSPECTS.</h2></div><button className="text-button" onClick={openSettings}>Build your lineup <ArrowUpRight size={17} /></button></div><div className="creators-grid">{CHANNELS.map(c => <article className="creator-card" key={c.id}><div className="creator-top"><span className={`creator-avatar avatar-${c.id}`} style={{ color: c.color }}>{c.initials}</span><span className="creator-tag">{c.tag}</span></div><h3>{c.name}</h3><p>{c.detail}</p><div className="creator-bottom"><a href={`https://kick.com/${c.id}`} target="_blank" rel="noreferrer">On Kick <ArrowUpRight size={12} /></a><button aria-label={`${channels.includes(c.id) ? "Remove" : "Add"} ${c.name} ${channels.includes(c.id) ? "from" : "to"} feed`} className={channels.includes(c.id) ? "following" : ""} onClick={() => { if (channels.includes(c.id) && channels.length === 1) { setToast("Keep at least one channel in your feed."); return; } if (!channels.includes(c.id) && channels.length >= 12) { setToast("Your lineup has 12 channels. Edit sources to swap one."); return; } const next = channels.includes(c.id) ? channels.filter(id => id !== c.id) : [...channels, c.id]; setChannels(next); try { localStorage.setItem("overtime-channels", JSON.stringify(next)); } catch {} }}>{channels.includes(c.id) ? <Check size={13} /> : <Plus size={13} />}{channels.includes(c.id) ? "In your feed" : "Add to feed"}</button></div></article>)}</div></section>

      <CreatorStudio />
      <FanCommerce fan={fan}/>
      <DeveloperApi />
      <section className="closing-line page-width"><span>THE ROUND ENDS.<br /><em>THE HYPE DOESN’T.</em></span><a href="#feed" aria-label="Back to clips"><ArrowUpRight strokeWidth={1} /></a></section>
    </main>
    <footer className="site-footer page-width"><div className="footer-top"><Brand small /><span>BUILT FOR THE MOMENTS BETWEEN GG.</span><button className="text-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Back to top <ArrowUpRight size={14} /></button></div><div className="footer-bottom"><span>© {new Date().getFullYear()} FaZe Clips. Independent HackUTA prototype. Not an official FaZe or HardScope product.</span><span>Sources: <a href="https://drive.google.com/drive/folders/1psDncTeLcDKOevLuHOMkGzt_BeA1jzr-?usp=sharing" target="_blank" rel="noreferrer">FaZe Brand Toolkit ↗</a><i>·</i><a href="https://kick.com" target="_blank" rel="noreferrer">Kick ↗</a> <a href="https://www.twitch.tv" target="_blank" rel="noreferrer">Twitch ↗</a> <a href="https://www.youtube.com/@LiveSpeedy" target="_blank" rel="noreferrer">Live Speedy ↗</a><i>·</i><a href="https://www.counter-strike.net/" target="_blank" rel="noreferrer">Promo footage: Counter-Strike ↗</a><i>·</i><a href="https://www.youtube.com/watch?v=GHAlIBCY3p4" target="_blank" rel="noreferrer">Film: FaZe Esports ↗</a></span></div><p className="footer-disclaimer">Created for the FaZe hackathon track. Community project; not an official FaZe product. All footage and trademarks belong to their respective owners. Reel likes stay with your account. Bookmarks and your lineup stay in this browser.</p></footer>

    {playing && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setPlaying(null); }}><section className="player-dialog" role="dialog" aria-modal="true" aria-label={`Playing ${playing.title}`} onTouchStart={e => { touchY.current = (e.target as HTMLElement).closest(".clip-comments")?NaN:e.touches[0].clientY; }} onTouchEnd={e => { const delta = touchY.current - e.changedTouches[0].clientY; if (Math.abs(delta) > 70) nextClip(delta > 0 ? 1 : -1); }}><div className="player-header"><span><Zap size={16} fill="currentColor" /> FAZE REPLAYS <i>{visible.findIndex(c => c.id === playing.id) + 1} / {visible.length}</i></span><button ref={closeRef} className="icon-button" onClick={() => setPlaying(null)} aria-label="Close player"><X size={23} /></button></div><div className="player-body"><WatchTracker clip={playing}/><ClipVideo clip={playing} /><aside className="player-details"><span className="eyebrow">RUN. IT. BACK.</span><h2>{playing.title}</h2><div className="channel-line"><span className="mini-avatar">{playing.channelName.slice(0, 2).toUpperCase()}</span><span className="creator-display-name">{playing.channelName}</span><CreatorAffiliationBadge clip={playing}/><span className={"provider-mark "+(playing.provider||"kick")}>{playing.provider==="twitch"?"TW":playing.provider==="youtube"?"YT":"K"}</span></div><p>{playing.category} {playing.views>0&&<><span>·</span> {compact(playing.views)} source views</>}{playing.isMature && <span> · Mature channel</span>}</p><div className="player-actions"><button className={"button outline platform-heart "+(social.stats[playing.id]?.liked?"liked":"")} aria-label={(social.stats[playing.id]?.liked?"Unlike reel ":"Like reel ")+playing.title} aria-pressed={!!social.stats[playing.id]?.liked} disabled={social.pending.includes(playing.id)} onClick={()=>social.like(playing)}><Heart size={16} fill={social.stats[playing.id]?.liked?"currentColor":"none"}/>{social.stats[playing.id]?.likes||0} likes here</button><button className="button outline" onClick={() => toggleSave(playing)}><Bookmark size={16} fill={saved.some(c => c.id === playing.id) ? "currentColor" : "none"} />{saved.some(c => c.id === playing.id) ? "Saved" : "Save clip"}</button><button className="icon-button" aria-label="Copy clip link" onClick={() => share(playing)}><Share2 size={18} /></button></div>{social.error&&<p className="player-social-error" role="status">{social.error} {!social.signedIn&&<a href="/signin-with-chatgpt?return_to=/%23feed" target="_top">Sign in →</a>}</p>}<FullVideoLink clip={playing}/><StreamerLink clip={playing}/><a className="kick-link" href={playing.url} target="_blank" rel="noreferrer">Open on {playing.provider==="twitch"?"Twitch":playing.provider==="youtube"?"YouTube":playing.provider==="upload"?"FaZe Clips":"Kick"} <ArrowUpRight size={14} /></a><div className="player-nav"><button className="button outline" onClick={() => nextClip(-1)} aria-label="Previous clip"><ChevronLeft size={20} /></button><button className="button lime" onClick={() => nextClip(1)}>Next moment <ChevronRight size={19} /></button></div><span className="keyboard-hint">↑ ↓ to skip · swipe on mobile · Esc to close</span></aside></div><ClipComments key={playing.id} clip={playing}/></section></div>}
    {film && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setFilm(false); }}><section className="film-dialog" role="dialog" aria-modal="true" aria-label="Official FaZe Copenhagen film"><div className="player-header"><span>FAZE ESPORTS / THE COPENHAGEN STORY</span><button className="icon-button" ref={closeRef} onClick={() => setFilm(false)} aria-label="Close film"><X size={23} /></button></div><iframe src={FILM_URL} title="What Really Happened to FaZe at Copenhagen CS2 Major — FaZe Esports" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /><div className="film-footer">What Really Happened to FaZe at Copenhagen CS2 Major <a href="https://www.youtube.com/watch?v=GHAlIBCY3p4" target="_blank" rel="noreferrer">Watch on YouTube <ArrowUpRight size={13} /></a></div></section></div>}
    {settings && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setSettings(false); }}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="player-header"><span><Settings2 size={15} /> YOUR FEED, YOUR RULES.</span><button ref={closeRef} className="icon-button" onClick={() => setSettings(false)} aria-label="Close feed settings"><X size={21} /></button></div><div className="settings-content"><h2 id="settings-title">PICK YOUR LINEUP.</h2><p>Up to 12 Kick channels. We pull gaming, funny and IRL clips and keep the good stuff in one place.</p><div className="channel-options">{Array.from(new Set([...DEFAULT_CHANNELS, ...draftChannels])).map(id => <button key={id} className={draftChannels.includes(id) ? "chosen" : ""} onClick={() => { if (draftChannels.includes(id)) setDraftChannels(draftChannels.filter(c => c !== id)); else if (draftChannels.length < 12) setDraftChannels([...draftChannels, id]); else setChannelError("Choose up to 12 channels."); }}><span className="channel-checkbox">{draftChannels.includes(id) && <Check size={13} />}</span>{CHANNELS.find(c => c.id === id)?.name || id}<span>@{id}</span></button>)}</div><form className="add-channel" onSubmit={e => { e.preventDefault(); addChannel(); }}><input aria-label="Kick channel username" placeholder="Add a Kick username…" value={channelInput} onChange={e => setChannelInput(e.target.value)} maxLength={100} /><button aria-label="Add channel" type="submit"><Plus size={18} /></button></form>{channelError && <p className="form-error" role="alert">{channelError}</p>}<div className="settings-note">Kick usernames go here. All games, Just Chatting and IRL are welcome. Use Add clip link for Twitch clips and YouTube Shorts.</div><button className="button lime settings-save" onClick={applyChannels}>Let’s run it <ArrowRight size={17} /></button></div></section></div>}
    {social.importOpen&&<ClipImport signedIn={social.signedIn} onClose={()=>social.setImportOpen(false)} onAdded={()=>{social.refresh();setPlatform("all");setTab("all");setCreator("all");setTime("all");setHistoryVersion(v=>v+1);}}/>}
    {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
  </>;
}
