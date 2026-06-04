/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Globe, FileSearch, Terminal, Loader2, Link2, Sparkles, LayoutDashboard, Heading, Image as ImageIcon, Link as LinkIcon, Code2, Clock, Download, Copy, Check, Film, PlayCircle, Activity, Cpu, AlertTriangle, CheckCircle2, XCircle, Database, Menu, X, Settings } from 'lucide-react';

function LinkItem({ link, type }: { link: any, type: 'internal' | 'external' }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; statusText: string; contentType: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const testLink = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/check?url=${encodeURIComponent(link.href)}`);
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, status: 0, statusText: 'Network Error', contentType: 'Unknown' });
    } finally {
      setTesting(false);
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(link.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  return (
    <li className="px-5 py-4 group hover:bg-neutral-800/40 transition-colors min-w-0">
      <div className="text-sm font-medium text-neutral-200 truncate mb-1" title={link.text}>{link.text}</div>
      <a href={link.href} target="_blank" rel="noreferrer" className={`text-[11px] font-mono hover:underline truncate block w-full bg-neutral-950 p-2 rounded-lg border border-neutral-800/50 mb-3 overflow-hidden text-ellipsis ${type === 'internal' ? 'text-indigo-400/90' : 'text-emerald-400/90'}`} title={link.href}>
        {link.href}
      </a>
      <div className="flex items-center gap-2">
        <button 
          onClick={testLink}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-50 text-[11px] font-medium tracking-wide border border-neutral-700/50 text-neutral-300 rounded-lg transition-colors shadow-sm active:scale-95"
        >
          {testing ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
          Test Route
        </button>
        <button 
          onClick={copyUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-[11px] font-medium tracking-wide border border-neutral-700/50 text-neutral-300 rounded-lg transition-colors shadow-sm active:scale-95"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          {copied ? 'Copied URL' : 'Copy'}
        </button>
      </div>
      
      {testResult && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }} 
          animate={{ opacity: 1, height: 'auto' }}
          className={`mt-3 p-2.5 rounded-lg text-xs font-mono border backdrop-blur-md transition-all ${testResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400/90' : 'bg-rose-500/10 border-rose-500/20 text-rose-400/90'}`}
        >
          <div className="flex justify-between items-center bg-black/20 p-1.5 rounded text-white shadow-inner">
            <span className="font-semibold flex items-center gap-2">
              {testResult.ok ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />}
              {testResult.status} {testResult.statusText}
            </span>
            <span className="opacity-70 text-[10px] bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">{testResult.contentType}</span>
          </div>
        </motion.div>
      )}
    </li>
  );
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [scrapeData, setScrapeData] = useState<any | null>(null);
  const [mode, setMode] = useState<'proxy' | 'scrape' | 'interactive' | null>(null);
  const [interactiveMedia, setInteractiveMedia] = useState<string[]>([]);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'MEDIA_FOUND' && e.data.src) {
        setInteractiveMedia(prev => {
          if (!prev.includes(e.data.src)) return [...prev, e.data.src];
          return prev;
        });
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);
  const [subTab, setSubTab] = useState<'overview' | 'insights' | 'headings' | 'images' | 'links' | 'media' | 'deep' | 'ai' | 'raw'>('overview');
  const [copied, setCopied] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const savedKey = localStorage.getItem('vpsai_gemini_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const saveKey = (val: string) => {
    setApiKey(val);
    localStorage.setItem('vpsai_gemini_key', val);
  };

  const fetchAction = async (action: 'proxy' | 'scrape' | 'interactive') => {
    if (!url) return;
    
    const validUrl = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `https://${url}`;

    setLoading(true);
    setMode(action);
    setOutput(null);
    setScrapeData(null);
    setSubTab('overview');
    
    if (action === 'interactive') {
       setInteractiveMedia([]);
       setLoading(false);
       return;
    }

    try {
      let endpoint = `/api/${action}?url=${encodeURIComponent(validUrl)}`;
      if (action === 'scrape') endpoint += '&deep=true';
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
      }
      
      if (action === 'scrape') {
        const data = await response.json();
        // If data is returned but there's a scraped error string
        if (data.error) {
           throw new Error(data.error);
        }
        setScrapeData(data);
      } else {
        const text = await response.text();
        setOutput(text);
      }
    } catch (err: any) {
      setOutput(`Failed to process request: ${err.message}

⚠️ Common reasons for failure:
1. Anti-Bot Protection (Cloudflare, Distil, etc.) restricts automated requests.
2. The site relies heavily on Client-Side Rendering (CSR) and requires a real browser (JavaScript enabled).
3. The server timed out or blocked our IP.

Our scraper uses standard HTTP requests. If a site actively blocks non-browser traffic, it cannot be scraped this way.`);
      setMode('proxy'); // Fallback to terminal view for errors
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  const exportAsJSON = () => {
    if (!scrapeData) return;
    const blob = new Blob([JSON.stringify(scrapeData, null, 2)], { type: 'application/json' });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob;
    a.download = `spectral-scrape-data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlBlob);
  };

  const runAiAnalysis = async () => {
    if (!scrapeData) return;
    setAnalyzing(true);
    setAiAnalysis(null);
    try {
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-gemini-key': apiKey } : {})
        },
        body: JSON.stringify(scrapeData)
      });
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAiAnalysis(data.analysis);
    } catch (err: any) {
      setAiAnalysis(`⚠️ AI Analysis Failed: ${err.message}\n\nPlease ensure your GEMINI_API_KEY is configured in Cloudflare Workers secrets.`);
    } finally {
      setAnalyzing(false);
    }
  };

  const renderScrapeView = () => {
    if (!scrapeData) return null;

    return (
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        {/* Sub Navigation */}
        <div className="flex items-center gap-1.5 p-3 border-b border-neutral-800/80 bg-neutral-900/30 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] sticky top-0 z-10 backdrop-blur-sm">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'ai', icon: Sparkles, label: 'AI Review ✨' },
            { id: 'insights', icon: Cpu, label: 'SEO & Tech' },
            { id: 'headings', icon: Heading, label: 'Headings' },
            { id: 'images', icon: ImageIcon, label: 'Images' },
            { id: 'media', icon: Film, label: 'Media & Video' },
            { id: 'links', icon: LinkIcon, label: 'Links' },
            { id: 'deep', icon: Database, label: 'Deep Scan Data' },
            { id: 'raw', icon: Code2, label: 'Raw Output' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 border ${
                subTab === tab.id 
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20 shadow-sm shadow-indigo-900/10' 
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80 border-transparent hover:border-neutral-700/50'
              }`}
            >
              <tab.icon size={14} className={subTab === tab.id ? 'text-indigo-400' : 'text-neutral-500'} />
              {tab.label}
            </button>
          ))}
          
          <div className="flex-1 min-w-[20px]" />
          <button 
            onClick={exportAsJSON}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors whitespace-nowrap shrink-0 border border-emerald-400/20 shadow-sm shadow-emerald-900/10"
          >
            <Download size={14} />
            Export
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[650px] relative">
          {subTab === 'ai' && (
            <div className="flex flex-col h-full space-y-6">
              <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border border-indigo-500/20 rounded-2xl p-6 sm:p-8 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 p-8 opacity-10 blur-xl pointer-events-none">
                   <Sparkles size={120} className="text-indigo-400" />
                </div>
                <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 flex items-center gap-2 mb-2">
                      <Sparkles size={24} className="text-indigo-400" />
                      AI Review & Analysis
                    </h3>
                    <p className="text-sm font-medium text-indigo-200/70 max-w-xl">
                      Let our AI analyze this page's SEO performance, content quality, and technical health based on the extracted metadata.
                    </p>
                  </div>
                  <button
                    onClick={runAiAnalysis}
                    disabled={analyzing}
                    className="flex shrink-0 items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-indigo-900/20 font-medium transition-all"
                  >
                    {analyzing ? (
                      <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                    ) : (
                      <><Sparkles size={16} /> {aiAnalysis ? 'Regenerate Analysis' : 'Run AI Analysis'}</>
                    )}
                  </button>
                </div>
              </div>

              {aiAnalysis && (
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-5 sm:p-8 flex-1">
                  <div className="prose prose-invert prose-sm sm:prose-base prose-indigo max-w-none 
                    prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base 
                    prose-strong:text-indigo-300 prose-a:text-indigo-400
                    prose-p:text-neutral-300 prose-li:text-neutral-300">
                    <Markdown>{aiAnalysis}</Markdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-emerald-900/10 border border-emerald-900/30 rounded-xl p-4 flex flex-col justify-center transition-colors hover:bg-emerald-900/20">
                  <div className="text-[10px] text-emerald-400/70 uppercase tracking-widest mb-1.5 font-semibold">Pages Crawled</div>
                  <div className="text-xl sm:text-2xl font-medium text-emerald-300 tracking-tight">{scrapeData.stats.pagesCrawled || 1}</div>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl min-w-0 p-4 flex flex-col justify-center transition-colors hover:bg-neutral-900">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-semibold">HTML Size</div>
                  <div className="text-xl sm:text-2xl font-light text-white tracking-tight">{(scrapeData.stats.htmlLength / 1024).toFixed(1)} <span className="text-xs text-neutral-500 font-medium tracking-normal">KB</span></div>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl min-w-0 p-4 flex flex-col justify-center transition-colors hover:bg-neutral-900">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-semibold">Images</div>
                  <div className="text-xl sm:text-2xl font-light text-white tracking-tight">{scrapeData.stats.imageCount}</div>
                </div>
                <div className="bg-indigo-900/10 border border-indigo-900/30 rounded-xl min-w-0 p-4 flex flex-col justify-center transition-colors hover:bg-indigo-900/20">
                  <div className="text-[10px] text-indigo-400/70 uppercase tracking-widest mb-1.5 font-semibold">Media Files</div>
                  <div className="text-xl sm:text-2xl font-medium text-indigo-300 tracking-tight">{scrapeData.stats.mediaCount || 0}</div>
                </div>
                <div className="bg-purple-900/10 border border-purple-900/30 rounded-xl min-w-0 p-4 flex flex-col justify-center transition-colors hover:bg-purple-900/20">
                  <div className="text-[10px] text-purple-400/70 uppercase tracking-widest mb-1.5 font-semibold">Iframes</div>
                  <div className="text-xl sm:text-2xl font-medium text-purple-300 tracking-tight">{scrapeData.stats.iframeCount || 0}</div>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl min-w-0 p-4 flex flex-col justify-center transition-colors hover:bg-neutral-900">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-semibold">Int. Links</div>
                  <div className="text-xl sm:text-2xl font-light text-white tracking-tight">{scrapeData.stats.internalLinkCount}</div>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl min-w-0 p-4 flex flex-col justify-center transition-colors hover:bg-neutral-900">
                  <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-semibold">Ext. Links</div>
                  <div className="text-xl sm:text-2xl font-light text-white tracking-tight">{scrapeData.stats.externalLinkCount}</div>
                </div>
              </div>

              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl max-w-full overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Sparkles size={14} className="text-neutral-400" />
                  Meta Information
                </div>
                <div className="p-5 space-y-5">
                  <div>
                    <div className="text-xs text-neutral-500 font-mono mb-1.5">Site Title</div>
                    <div className="text-white text-sm sm:text-base font-medium">{scrapeData.metadata.title || <span className="text-neutral-600 italic">Not found</span>}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 font-mono mb-1.5">Description</div>
                    <div className="text-neutral-300 text-sm leading-relaxed">{scrapeData.metadata.description || <span className="text-neutral-600 italic">Not found</span>}</div>
                  </div>
                  {scrapeData.metadata.keywords && (
                    <div>
                      <div className="text-xs text-neutral-500 font-mono mb-1.5">Keywords</div>
                      <div className="flex flex-wrap gap-1.5">
                        {scrapeData.metadata.keywords.split(',').map((kw: string, i: number) => (
                           <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-neutral-800/80 border border-neutral-700/50 text-neutral-300">{kw.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl max-w-full overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Globe size={14} className="text-neutral-400" />
                  Open Graph (Social Card)
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-5">
                    <div>
                      <div className="text-xs text-neutral-500 font-mono mb-1.5">og:title</div>
                      <div className="text-white text-sm font-medium">{scrapeData.openGraph.title || <span className="text-neutral-600 italic">Not found</span>}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-500 font-mono mb-1.5">og:description</div>
                      <div className="text-neutral-300 text-sm leading-relaxed">{scrapeData.openGraph.description || <span className="text-neutral-600 italic">Not found</span>}</div>
                    </div>
                  </div>
                  <div className="md:col-span-1">
                    <div className="text-xs text-neutral-500 font-mono mb-1.5">og:image</div>
                    {scrapeData.openGraph.image ? (
                      <div className="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950 aspect-[1.9/1] relative">
                        <img 
                          src={scrapeData.openGraph.image} 
                          alt="Open Graph Preview" 
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center -z-10 text-xs text-neutral-600">Failed to load preview</div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-neutral-800 border-dashed bg-neutral-900/30 aspect-[1.9/1] flex flex-col items-center justify-center text-neutral-600 text-xs text-center p-4">
                        <ImageIcon size={20} className="mb-2 opacity-20" />
                        No Open Graph Image
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {subTab === 'insights' && (
            <div className="space-y-6">
              {(scrapeData.technologies?.includes('React') || scrapeData.technologies?.includes('Vue.js') || scrapeData.technologies?.includes('Angular') || scrapeData.technologies?.includes('Next.js') || scrapeData.technologies?.includes('Nuxt.js')) && (
                <div className="bg-amber-900/10 border border-amber-900/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-amber-500 mb-1">Client-Side Rendered (CSR) Site Detected</h4>
                    <p className="text-xs text-amber-200/70">
                      This site relies on JavaScript frameworks to render its content. Our scraper relies on static HTML parsing, which means some internal links, dynamic text, and lazy-loaded images might not be fully visible. Consider providing a pre-rendered or server-side rendered (SSR) version if available.
                    </p>
                  </div>
                </div>
              )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tech Stack detection */}
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden self-start">
                <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center gap-2">
                  <Cpu size={16} className="text-indigo-400" />
                  <span className="text-sm font-medium text-neutral-200">Technology Stack</span>
                </div>
                <div className="p-5">
                  {scrapeData.technologies && scrapeData.technologies.length > 0 ? (
                    <div className="flex flex-wrap gap-2.5">
                      {scrapeData.technologies.map((tech: string, i: number) => (
                        <span key={i} className={`text-xs px-3 py-1.5 rounded-lg border font-medium shadow-sm ${
                          tech.startsWith('Server:') || tech.startsWith('Powered By:') 
                            ? 'bg-neutral-800/80 border-neutral-700/60 text-neutral-300'
                            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
                        }`}>
                          {tech.replace('Server: ', '').replace('Powered By: ', '')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-neutral-500 italic p-2 items-center flex gap-2">
                      <AlertTriangle size={14} />
                      No specific technologies detected in HTML.
                    </div>
                  )}
                </div>
              </div>

              {/* Basic SEO */}
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden self-start">
                <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center gap-2">
                  <LayoutDashboard size={16} className="text-emerald-400" />
                  <span className="text-sm font-medium text-neutral-200">On-Page SEO Metrics</span>
                </div>
                <div className="p-5 space-y-6">
                  {/* Title */}
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      {(scrapeData.seo?.titleLength > 10 && scrapeData.seo?.titleLength < 60) 
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : <AlertTriangle size={18} className="text-amber-500" />
                      }
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white mb-1">Title Length: {scrapeData.seo?.titleLength || 0} chars</div>
                      <div className="text-xs text-neutral-400 leading-relaxed">
                        {(scrapeData.seo?.titleLength > 10 && scrapeData.seo?.titleLength < 60) 
                          ? 'Optimal length (between 10 and 60 characters).'
                          : scrapeData.seo?.titleLength === 0 ? 'Missing page title.' : 'Suboptimal length. SEO best practices suggest 10-60 chars.'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      {(scrapeData.seo?.descriptionLength > 50 && scrapeData.seo?.descriptionLength < 160) 
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : <AlertTriangle size={18} className="text-amber-500" />
                      }
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white mb-1">Meta Description: {scrapeData.seo?.descriptionLength || 0} chars</div>
                      <div className="text-xs text-neutral-400 leading-relaxed">
                        {(scrapeData.seo?.descriptionLength > 50 && scrapeData.seo?.descriptionLength < 160) 
                          ? 'Optimal length (between 50 and 160 characters).'
                          : scrapeData.seo?.descriptionLength === 0 ? 'Missing meta description.' : 'Suboptimal length. Should be 50-160 chars.'
                        }
                      </div>
                    </div>
                  </div>

                  {/* H1 Count */}
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      {scrapeData.seo?.h1Count === 1 
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : scrapeData.seo?.h1Count === 0 ? <XCircle size={18} className="text-rose-500" /> : <AlertTriangle size={18} className="text-amber-500" />
                      }
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white mb-1">H1 Headings: {scrapeData.seo?.h1Count || 0}</div>
                      <div className="text-xs text-neutral-400 leading-relaxed">
                        {scrapeData.seo?.h1Count === 1 
                          ? 'Perfect. Exactly one primary H1 tag found.'
                          : scrapeData.seo?.h1Count === 0 ? 'Missing H1 heading. Crucial for structure and SEO.' : 'Multiple H1 tags found. Stick to one.'
                        }
                      </div>
                    </div>
                  </div>

                  {/* Images Alt */}
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      {scrapeData.seo?.imagesMissingAlt === 0 
                        ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : <AlertTriangle size={18} className="text-amber-500" />
                      }
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white mb-1">Images Missing Alt: {scrapeData.seo?.imagesMissingAlt}</div>
                      <div className="text-xs text-neutral-400 leading-relaxed">
                        {scrapeData.seo?.imagesMissingAlt === 0 
                          ? 'All valid images have descriptive alt texts.'
                          : `${scrapeData.seo?.imagesMissingAlt} image(s) missing alt descriptive tags, penalizing accessibility.`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {subTab === 'headings' && (
            <div className="space-y-6">
              {['h1', 'h2', 'h3'].map((level) => (
                <div key={level} className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold text-neutral-300 flex justify-between items-center">
                    <span className="uppercase tracking-widest">{level}</span>
                    <span className="text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-950/50 border border-neutral-800">{scrapeData.headings[level].length}</span>
                  </div>
                  <ul className="divide-y divide-neutral-800/50">
                    {scrapeData.headings[level].length > 0 ? (
                      scrapeData.headings[level].map((text: string, i: number) => (
                        <li key={i} className="px-5 py-3.5 text-sm text-neutral-200 hover:bg-neutral-800/30 transition-colors leading-relaxed">{text}</li>
                      ))
                    ) : (
                      <li className="px-5 py-4 text-sm text-neutral-600 italic">No {level} tags found on this page.</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {subTab === 'images' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon size={16} className="text-neutral-500" />
                <p className="text-xs text-neutral-400">Displaying top {scrapeData.images.length} extracted media assets.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {scrapeData.images.length > 0 ? (
                  scrapeData.images.map((img: any, i: number) => (
                    <div key={i} className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl overflow-hidden group shadow-sm hover:shadow-indigo-500/5 transition-all hover:border-neutral-700">
                      <div className="aspect-[4/3] bg-neutral-950 flex items-center justify-center p-3 relative overflow-hidden">
                         <img 
                          src={img.src} 
                          alt={img.alt} 
                          className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1MjUyNTIiIHN0cm9rZS13aWR0aD0iMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGxpbmUgeDE9IjEiIHkxPSIxIiB4Mj0iMjMiIHkyPSIyMyI+PC9saW5lPjxwYXRoIGQ9Ik0yMSAyMWgtMThhMiAyIDAgMCAxIC0yIC0ydi0xNGEyIDIgMCAwIDEgMiAtMmgzbTRuLTIuNDY0VjNhMiAyIDAgMCAxIDIgLTJoM200bi0yLjQ2NFYzYTIgMiAwIDAgMSAyIC0yaDMiPjwvcGF0aD48L3N2Zz4=';
                            (e.target as HTMLImageElement).className = 'opacity-50 w-8 h-8';
                          }}
                        />
                      </div>
                      <div className="p-3 border-t border-neutral-800/80 bg-neutral-900/80">
                        <div className="text-[10px] font-mono text-neutral-500 truncate mb-1.5 px-1.5 py-0.5 rounded bg-neutral-950 overflow-hidden" title={img.src}>{img.src.split('/').pop()}</div>
                        <div className="text-xs text-neutral-300 line-clamp-2 leading-relaxed" title={img.alt}>{img.alt || <span className="italic text-neutral-600">Unlabeled asset</span>}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-neutral-500 text-sm border border-neutral-800/80 border-dashed rounded-xl bg-neutral-900/30">
                    <ImageIcon size={24} className="mb-3 opacity-30" />
                    No extractable images
                  </div>
                )}
              </div>
            </div>
          )}

          {subTab === 'media' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Film size={16} className="text-indigo-400" />
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Extracted Video & Streams</p>
                </div>
              </div>
              
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold text-neutral-300 flex justify-between items-center">
                  <span>Detected Media Manifests</span>
                  <span className="text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-950/50 border border-neutral-800">{scrapeData.media?.length || 0}</span>
                </div>
                <ul className="divide-y divide-neutral-800/50 max-h-[500px] overflow-y-auto">
                  {scrapeData.media && scrapeData.media.length > 0 ? (
                    scrapeData.media.map((item: any, i: number) => (
                      <li key={i} className="px-5 py-4 flex gap-4 items-start hover:bg-neutral-800/30 transition-colors">
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                          <PlayCircle size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white mb-2">{item.type} stream detected</div>
                          <div className="text-xs font-mono text-neutral-400 break-all bg-neutral-950 p-3 rounded-lg border border-neutral-800/80 mb-3 selection:bg-neutral-800">
                            {item.url}
                          </div>
                          <div className="flex gap-2.5">
                            <button 
                              onClick={() => copyToClipboard(item.url)}
                              className="text-xs px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white transition-all flex items-center gap-1.5 font-medium shadow-sm"
                            >
                              {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14} />}
                              {copied ? 'Copied' : 'Copy Source URL'}
                            </button>
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs px-3.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 transition-all flex items-center gap-1.5 font-medium shadow-sm"
                            >
                              <LinkIcon size={12} />
                              Open Direct Stream
                            </a>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="px-5 py-12 flex flex-col items-center text-center text-sm text-neutral-500 border-dashed">
                      <Film size={24} className="mb-3 opacity-30" />
                      No embedded .mp4 or .m3u8 sources detected.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {subTab === 'links' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
                <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold uppercase tracking-wider text-neutral-300 flex justify-between items-center shrink-0">
                  <span className="flex items-center gap-2"><LinkIcon size={14} className="text-indigo-400" /> Internal Routes</span>
                  <span className="text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-950/50 border border-neutral-800">{scrapeData.internalLinks.length}</span>
                </div>
                <ul className="divide-y divide-neutral-800/50 overflow-y-auto w-full flex-1">
                  {scrapeData.internalLinks.length > 0 ? (
                    scrapeData.internalLinks.map((link: any, i: number) => (
                      <LinkItem key={i} link={link} type="internal" />
                    ))
                  ) : (
                    <li className="px-5 py-8 text-center text-sm text-neutral-600 italic">No internal routed links available.</li>
                  )}
                </ul>
              </div>
              <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[600px]">
                <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold uppercase tracking-wider text-neutral-300 flex justify-between items-center shrink-0">
                  <span className="flex items-center gap-2"><Globe size={14} className="text-emerald-400" /> External Outbounds</span>
                  <span className="text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-950/50 border border-neutral-800">{scrapeData.externalLinks.length}</span>
                </div>
                <ul className="divide-y divide-neutral-800/50 overflow-y-auto w-full flex-1">
                  {scrapeData.externalLinks.length > 0 ? (
                    scrapeData.externalLinks.map((link: any, i: number) => (
                      <LinkItem key={i} link={link} type="external" />
                    ))
                  ) : (
                    <li className="px-5 py-8 text-center text-sm text-neutral-600 italic">No external outbound links found.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {subTab === 'deep' && scrapeData.deepData && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-indigo-400" />
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-widest">Deep Scanning Architecture</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
                {/* Structured Data */}
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col max-h-[500px]">
                  <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold text-neutral-300 flex justify-between items-center shrink-0">
                    <span className="flex items-center gap-2 tracking-wider uppercase"><Code2 size={14} className="text-blue-400" /> Schema.org (JSON-LD)</span>
                    <span className="text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-950/50 border border-neutral-800">{scrapeData.deepData.jsonLd?.length || 0}</span>
                  </div>
                  <div className="p-5 overflow-y-auto flex-1 w-full relative">
                    {scrapeData.deepData.jsonLd && scrapeData.deepData.jsonLd.length > 0 ? (
                      <div className="space-y-4">
                        {scrapeData.deepData.jsonLd.map((data: any, i: number) => (
                           <pre key={i} className="font-mono text-[11px] leading-relaxed text-blue-300/90 whitespace-pre-wrap break-words bg-neutral-950 p-4 rounded-lg border border-neutral-800/80 w-full overflow-hidden">
                             {JSON.stringify(data, null, 2)}
                           </pre>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500 italic p-6 text-center border border-neutral-800/50 border-dashed rounded-lg bg-neutral-900/30">No Schema.org structured data embedded on this page.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-6 w-full flex flex-col">
                  {/* API Endpoints */}
                  <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1 max-h-[240px]">
                    <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold text-neutral-300 flex justify-between items-center shrink-0">
                      <span className="flex items-center gap-2 tracking-wider uppercase"><Activity size={14} className="text-orange-400" /> Surface API Endpoints</span>
                      <span className="text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-950/50 border border-neutral-800">{scrapeData.deepData.apiEndpoints?.length || 0}</span>
                    </div>
                    <div className="p-0 overflow-y-auto flex-1 w-full bg-neutral-950/30">
                      {scrapeData.deepData.apiEndpoints && scrapeData.deepData.apiEndpoints.length > 0 ? (
                        <ul className="divide-y divide-neutral-800/50 w-full">
                          {scrapeData.deepData.apiEndpoints.map((ep: string, i: number) => (
                            <li key={i} className="px-5 py-3 text-xs font-mono text-neutral-300 break-all flex items-start gap-2 hover:bg-neutral-800/40 transition-colors w-full">
                               <div className="pt-0.5 shrink-0"><LinkIcon size={12} className="text-neutral-600" /></div>
                               <span className="text-orange-300/90 selection:bg-orange-900/50">{ep}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-neutral-500 italic p-6 text-center flex h-full items-center justify-center">No inline API declarations detected.</div>
                      )}
                    </div>
                  </div>

                  {/* Iframes */}
                  <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1 max-h-[236px]">
                    <div className="px-5 py-3.5 border-b border-neutral-800/80 bg-neutral-900/40 text-xs font-semibold text-neutral-300 flex justify-between items-center shrink-0">
                      <span className="flex items-center gap-2 tracking-wider uppercase"><LayoutDashboard size={14} className="text-purple-400" /> External Embeds (Iframes)</span>
                      <span className="text-neutral-500 font-mono px-2 py-0.5 rounded bg-neutral-950/50 border border-neutral-800">{scrapeData.deepData.iframes?.length || 0}</span>
                    </div>
                    <div className="p-0 overflow-y-auto flex-1 w-full">
                      {scrapeData.deepData.iframes && scrapeData.deepData.iframes.length > 0 ? (
                        <ul className="divide-y divide-neutral-800/50 w-full">
                          {scrapeData.deepData.iframes.map((ifr: any, i: number) => (
                             <li key={i} className="px-5 py-4 hover:bg-neutral-900 transition-colors w-full">
                               {ifr.title && <div className="text-[11px] text-neutral-400 font-medium mb-1.5 uppercase tracking-wider">{ifr.title}</div>}
                               <div className="text-xs font-mono text-purple-300/80 break-all bg-neutral-950 p-3 rounded-lg border border-neutral-800/80 selection:bg-purple-900/50">
                                 {ifr.src}
                               </div>
                             </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-neutral-500 italic p-6 text-center h-full flex items-center justify-center">No foreign iframes embedded.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Next.js Alert Overlay */}
              {scrapeData.deepData?.hasNextJsState && (
                <div className="bg-gradient-to-r from-indigo-900/20 via-neutral-900/60 to-transparent border border-indigo-500/20 rounded-xl p-5 w-full flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <Sparkles size={20} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white mb-0.5">Hydration State Object Identified</div>
                    <p className="text-xs text-neutral-400">The scraper detected injected <code className="font-mono text-[10px] bg-neutral-950 px-1 py-0.5 rounded">__NEXT_DATA__</code>. The full tree is available under the Raw Output tab.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {subTab === 'raw' && (
            <div className="relative group w-full h-full min-h-[400px]">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button 
                  onClick={() => copyToClipboard(JSON.stringify(scrapeData, null, 2))}
                  className="px-3 py-1.5 bg-neutral-800/80 backdrop-blur-md hover:bg-neutral-700 border border-neutral-700 rounded-lg text-neutral-300 hover:text-white transition-all shadow-xl flex items-center gap-1.5 text-xs font-medium"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copied ? 'Copied to Clipboard' : 'Copy Payload'}
                </button>
              </div>
              <pre className="font-mono text-xs leading-relaxed text-emerald-300/90 whitespace-pre-wrap break-all bg-neutral-950/80 p-5 rounded-xl border border-neutral-800/80 h-full overflow-y-auto">
                {JSON.stringify(scrapeData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      {/* Settings Modal (VPSAI R2 Config) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-medium">
                  <Settings size={18} className="text-neutral-400" />
                  Settings
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1 rounded-md text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Gemini API Key (VPSAI)</label>
                  <div className="relative">
                    <input 
                      type="password"
                      value={apiKey}
                      onChange={(e) => saveKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full bg-neutral-950 border border-neutral-800 text-white px-4 py-2.5 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 text-sm font-mono placeholder:text-neutral-600 transition-all"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Key is securely saved in your browser's local storage and passed directly to the backend analysis engine.
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 bg-neutral-950/50 border-t border-neutral-800/50 flex justify-end">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-indigo-900/20"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-white/10 bg-neutral-900/50 backdrop-blur-md px-4 sm:px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button 
          onClick={() => setShowSettings(true)}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors mr-1 sm:mr-2"
        >
          <Menu size={22} />
        </button>
        <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
          <Globe size={18} />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wide text-neutral-100">Spectral Web Inspector</h1>
          <p className="text-xs text-neutral-500 tracking-tight">Advanced Proxy & Scrape Service</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col gap-8 mt-4 sm:mt-12">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-medium text-neutral-300 mb-2">
            <Sparkles size={14} className="text-indigo-400" />
            <span>Deep inspection engine</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-medium tracking-tight text-white mb-2">
            Inspect the web deeply.
          </h2>
          <p className="text-neutral-400 max-w-lg mx-auto text-sm sm:text-base">
            Bypass CORS constraints or extract structured metadata, headings, images, and links instantly.
          </p>
        </motion.div>

        {/* Input Bar */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-3xl mx-auto shadow-2xl relative z-20 group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-lg opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-2 sm:p-3 relative flex flex-col sm:flex-row gap-3 shadow-inner">
            <div className="flex-1 relative flex items-center">
              <Link2 className="absolute left-4 text-neutral-500" size={20} />
              <input
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchAction('scrape');
                }}
                className="w-full bg-transparent border-none text-white px-12 py-3 outline-none placeholder:text-neutral-600 focus:ring-0 font-mono text-sm"
                spellCheck={false}
              />
            </div>
            
            <div className="flex shrink-0 gap-2 px-2 sm:px-0 overflow-x-auto">
              <button
                onClick={() => fetchAction('interactive')}
                disabled={loading || !url}
                className="flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 transition-colors text-white shadow-md shadow-emerald-900/20 text-sm font-medium"
              >
                <LayoutDashboard size={16} />
                Interactive
              </button>
              <button
                onClick={() => fetchAction('proxy')}
                disabled={loading || !url}
                className="flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed border border-white/5 transition-colors text-sm font-medium"
              >
                <Globe size={16} />
                Proxy
              </button>
              <button
                onClick={() => fetchAction('scrape')}
                disabled={loading || !url}
                className="flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-indigo-900/20 transition-all text-sm font-medium"
              >
                <FileSearch size={16} />
                Deep Scrape
              </button>
            </div>
          </div>
        </motion.div>

        {/* Output Area */}
        <AnimatePresence>
          {mode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="w-full mx-auto rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden flex flex-col"
            >
              <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-400">
                  {mode === 'interactive' ? <LayoutDashboard size={16} /> : mode === 'proxy' || !scrapeData ? <Terminal size={16} /> : <FileSearch size={16} />}
                  <span className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                    {mode === 'interactive' ? 'Interactive Browser Proxy' : mode === 'proxy' || !scrapeData ? 'Terminal Output' : 'Scrape Results'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
              </div>

              <div className="flex-1 w-full">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-32 text-neutral-500 gap-4">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                    <p className="text-sm font-mono animate-pulse">Running advanced inspection...</p>
                  </div>
                ) : (
                  <>
                    {mode === 'interactive' ? (
                       <div className="flex flex-col h-[700px]">
                           {interactiveMedia.length > 0 && (
                               <div className="bg-emerald-950/30 border-b border-emerald-900/50 p-3">
                                   <div className="text-emerald-400 font-mono text-sm mb-2 flex items-center gap-2">
                                       <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                       Media Sniffed:
                                   </div>
                                   <div className="flex flex-col gap-2">
                                       {interactiveMedia.map((m, i) => (
                                           <div key={i} className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5">
                                               <span className="text-xs truncate font-mono select-all text-neutral-300 w-4/5">{m}</span>
                                               <a href={m} target="_blank" rel="noreferrer" className="text-xs bg-emerald-600/20 text-emerald-300 px-2 py-1 rounded hover:bg-emerald-600/40">Open</a>
                                           </div>
                                       ))}
                                   </div>
                               </div>
                           )}
                           <iframe 
                             className="flex-1 w-full border-none bg-white" 
                             src={`/d-proxy${new URL("http://" + url.replace(/^https?:\/\//, '')).pathname + new URL("http://" + url.replace(/^https?:\/\//, '')).search}`}
                             sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                           />
                       </div>
                    ) : mode === 'scrape' && scrapeData ? (
                      renderScrapeView()
                    ) : (
                      <div className="p-4 sm:p-6 w-full min-w-0 overflow-y-auto max-h-[600px] overflow-hidden">
                        <pre className="font-mono text-xs sm:text-sm leading-relaxed text-blue-200/90 whitespace-pre-wrap break-all break-words min-w-0 w-full">
                          {output}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

