import { Code2, Copy, Eye, PanelRightClose, PanelRightOpen, Check, X } from 'lucide-react'
import { useSelector } from 'react-redux'
import { AnimatePresence, easeInOut, motion } from "motion/react"
import { useState } from 'react'
import Editor from '@monaco-editor/react';

const detectLanguage = (fileName = "") => {
    const name = fileName.toLowerCase()
    if (name.endsWith(".html")) return "html";
    if (name.endsWith(".css")) return "css";
    if (name.endsWith(".js")) return "javascript";
    if (name.endsWith(".jsx")) return "javascript";
    if (name.endsWith(".ts")) return "typescript";
    if (name.endsWith(".tsx")) return "typescript";
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".md")) return "markdown";
    if (name.endsWith(".xml")) return "xml";
    if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
    if (name.endsWith(".sql")) return "sql";
    if (name.endsWith(".py")) return "python";
    if (name.endsWith(".java")) return "java";
    if (name.endsWith(".cpp")) return "cpp";
    if (name.endsWith(".c")) return "c";
    if (name.endsWith(".cs")) return "csharp";
    if (name.endsWith(".go")) return "go";
    if (name.endsWith(".php")) return "php";
    if (name.endsWith(".rb")) return "ruby";
    if (name.endsWith(".rs")) return "rust";
    if (name.endsWith(".sh")) return "shell";
    if (name.endsWith(".txt")) return "plaintext";

    return "plaintext"
}

const buildPreviewDoc = (files = []) => {
    const htmlFile = files[0];
    const cssFile = files[1];
    const jsFile = files[2];

    const html = (htmlFile?.content || "")
        .replace(/<link[^>]*href=["'].*?\.css["'][^>]*>/gi, "")
        .replace(/<script[^>]*src=["'].*?\.js["'][^>]*><\/script>/gi, "");

    return `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
    ${cssFile?.content || ""}
    </style>
</head>
<body>
${html}
    <script>

${jsFile?.content || ""}

</script>
</body>
</html>
    `
}

function PanelContent({
    artifacts,
    collapsed,
    setCollapsed,
    tab,
    setTab,
    activeFile,
    setActiveFile,
    copied,
    handleCopy,
    onClose,
}) {
    const files = artifacts[0]?.files || []
    const file = files[activeFile]
    const canPreview = files.length > 0
    const previewDoc = canPreview ? buildPreviewDoc(files) : ""

    return (
        <>
            {!collapsed ? <div className='flex flex-col h-full bg-[#0d0f14] '>
                <div className='h-14 px-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0 '>
                    <button type='button' className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0 ' onClick={onClose ?? (() => setCollapsed(true))} aria-label='Close panel'>
                        {onClose ? <X size={14} /> : <PanelRightClose size={14} />}
                    </button>
                    <div className='flex items-center gap-2 flex-1 min-w-0 '>
                        <div className='flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 shrink-0'>
                            <Code2 className='text-indigo-400' size={14} />
                        </div>
                        <div className='text-[13px] font-medium text-slate-200 truncate ' >
                            {artifacts[0]?.title}
                        </div>
                    </div>
                    <div className='flex items-center gap-1 shrink-0'>
                        <button
                            type='button'
                            onClick={handleCopy}
                            className='flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] rounded-lg transition-colors duration-150 bg-transparent border-none cursor-pointer '
                            aria-label='Copy file contents'>
                            {copied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                    </div>
                    <div className='flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] p-1 rounded-lg shrink-0'>
                        <button
                            type='button'
                            onClick={() => setTab("code")}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 cursor-pointer border-none ${tab === "code" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200 bg-transparent"}`}>
                            <Code2 size={13} /> Code
                        </button>
                        <button
                            type='button'
                            onClick={() => setTab("preview")}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 cursor-pointer border-none ${tab === "preview" ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-slate-200 bg-transparent"}`}>
                            <Eye size={13} /> Preview
                        </button>
                    </div>
                </div>

                {tab === "code" && <div className='flex h-auto border-b border-white/[0.06] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 '>
                    {
                        files.map((f, index) => (

                            <button type='button' key={index}
                                onClick={() => setActiveFile(index)}
                                className={`px-4 py-2.5 text-[11px] font-medium whitespace-nowrap transition-colors border-r border-white/[0.05] relative cursor-pointer bg-transparent border-none ${activeFile === index ? "text-indigo-400" : "text-slate-300 hover:text-slate-100"} `}>
                                {f?.name}
                                {activeFile === index && <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-t-full ' />}
                            </button>

                        ))
                    }
                </div>}


                <div className='flex-1 overflow-hidden h-full'>
                    {(tab === "preview" && canPreview) ?
                        <motion.div
                            className="w-full h-full"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <iframe
                                title='preview'
                                srcDoc={previewDoc}
                                className='w-full h-full bg-white '
                                sandbox='allow-scripts'
                            />
                        </motion.div>
                        :
                        <motion.div
                            className='w-full h-full'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        >

                            <Editor
                                height="100%"
                                theme='vs-dark'
                                language={detectLanguage(file?.name)}
                                value={file?.content ?? ""}
                                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, wordWrap: "on", automaticLayout: true, scrollBeyondLastLine: false, padding: { top: 16 }, lineNumbers: "on", renderLineHighlight: "none" }}
                            />

                        </motion.div>
                    }
                </div>

            </div>
                : <div className='hidden lg:flex h-full border-l border-white/[0.06] bg-[#0d0f14] flex-col items-center py-4 gap-3 shrink-0 '>
                    <button type='button' className='flex items-center justify-center w-7 h-7 -ml-8 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0 ' onClick={() => setCollapsed(false)} aria-label='Open panel'>
                        <PanelRightOpen />
                    </button>
                    <div className='flex items-center gap-2 flex-1 min-w-0 '>

                        <div className='text-[10px] font-medium text-slate-600 tracking-widest uppercase whitespace-nowrap'
                            style={{
                                writingMode: "vertical-lr",
                                transform: "rotate(180deg)"
                            }} >
                            {artifacts[0]?.title}
                        </div>
                    </div>
                </div>
            }
        </>
    )
}

const Artifact = () => {

    const [collapsed, setCollapsed] = useState(false)
    const [tab, setTab] = useState("code")
    const [activeFile, setActiveFile] = useState(0)
    const [copied, setCopied] = useState(false)
    const { artifacts } = useSelector(state => state.message)
    const [mobileOpen, setMobileOpen] = useState(false)

    const files = artifacts[0]?.files || []
    const file = files[activeFile]

    if (!artifacts.length) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(file?.content || "")
            setCopied(true)
            setTimeout(() => {
                setCopied(false)
            }, 2000)
        } catch {
            setCopied(false)
        }
    }

    return (

        <>

            <button type='button' className='lg:hidden fixed bottom-24 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-[12px] font-medium shadow-lg shadow-indigo-500/20 border-none cursor-pointer transition-colors duration-150 ' onClick={() => setMobileOpen(true)}>
                <Code2 size={13} />
                View Code
            </button>

            <AnimatePresence>
                {mobileOpen && <> <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.02 }} onClick={() => setMobileOpen(false)} className='lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm' />

                    <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.25, ease: "easeInOut" }} className='lg:hidden fixed inset-y-0 right-0 z-50 w-[88vw] max-w-[420px] border-l border-white/[0.06] overflow-hidden ' >
                        <PanelContent
                            artifacts={artifacts}
                            collapsed={collapsed}
                            setCollapsed={setCollapsed}
                            tab={tab}
                            setTab={setTab}
                            activeFile={activeFile}
                            setActiveFile={setActiveFile}
                            copied={copied}
                            handleCopy={handleCopy}
                            onClose={() => setMobileOpen(false)}
                        />
                    </motion.div>

                </>
                }
            </AnimatePresence>

            <motion.div
                initial={{ width: 300 }}
                animate={{ width: collapsed ? 48 : 300 }}
                transition={{
                    duration: 0.25,
                    ease: easeInOut
                }}
                className='hidden lg:flex h-full border-l border-white/[0.06] flex-col overflow-hidden shrink-0'>

                <PanelContent
                    artifacts={artifacts}
                    collapsed={collapsed}
                    setCollapsed={setCollapsed}
                    tab={tab}
                    setTab={setTab}
                    activeFile={activeFile}
                    setActiveFile={setActiveFile}
                    copied={copied}
                    handleCopy={handleCopy}
                />

            </motion.div>
        </>
    )
}

export default Artifact
