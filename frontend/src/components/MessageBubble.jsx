import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, ExternalLink, Check, Copy, Download } from 'lucide-react'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

const MessageBubble = ({ role, content, images }) => {

    const isUser = role === "user"
    const [lightBox, setLightBox] = useState(null)
    const [copiedCode, setCopiedCode] = useState("")

    const copyCodes = async (code) => {
        await navigator.clipboard.writeText(code)
        setCopiedCode(code)
        setTimeout(() => {
            setCopiedCode("")
        }, 2000)
    }

    const handleDownload = async (url) => {
        try {
            const res = await fetch(url)
            const blob = await res.blob()
            const blobUrl = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = blobUrl
            a.download = `cortexai-image-${Date.now()}.png`
            a.click()
            URL.revokeObjectURL(blobUrl)
        } catch {
            window.open(url, "_blank")
        }
    }



    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-[13.5px] leading-relaxed 
                ${isUser
                    ? "bg-gradient-to-br from-indigo-500 to-violet-700 text-white rounded-tr-sm"
                    : "bg-white/[0.04] border border-white/[0.07] text-slate-200 rounded-tl-sm"
                }`}>

                {images?.length > 0 && (
                    <div className='flex flex-wrap gap-3 mt-4 '>
                        {images?.map((img, i) => (
                            <img
                                key={i}
                                src={img}
                                onClick={() => setLightBox(img)}
                                loading="lazy"
                                onError={(e) => e.currentTarget.remove()}
                                className='w-40 h-28 rounded-xl object-cover border border-white/10 cursor-zoom-in hover:opacity-90 transition' />
                        ))}
                    </div>
                )}

                <Markdown remarkPlugins={[remarkGfm]}
                    components={{
                        h1: ({ children }) => (
                            <h1 className='text-2xl font-bold mt-5 mb-3 '> {children} </h1>
                        ),
                        h2: ({ children }) => (
                            <h2 className='text-xl font-semibold mt-4 mb-2 '> {children} </h2>
                        ),
                        h3: ({ children }) => (
                            <h3 className='text-lg font-semibold mt-3 mb-2 '> {children} </h3>
                        ),
                        h4: ({ children }) => (
                            <h4 className="text-lg font-semibold mt-3 mb-2">
                                {children}
                            </h4>
                        ),

                        h5: ({ children }) => (
                            <h5 className="text-base font-semibold mt-3 mb-2">
                                {children}
                            </h5>
                        ),

                        h6: ({ children }) => (
                            <h6 className="text-sm font-semibold uppercase mt-3 mb-2 text-slate-400">
                                {children}
                            </h6>
                        ),
                        strong: ({ children }) => (
                            <strong className="font-bold text-white">
                                {children}
                            </strong>
                        ),

                        em: ({ children }) => (
                            <em className="italic">
                                {children}
                            </em>
                        ),

                        del: ({ children }) => (
                            <del className="line-through opacity-70">
                                {children}
                            </del>
                        ),

                        blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-indigo-500 pl-4 italic my-4 text-slate-300">
                                {children}
                            </blockquote>
                        ),
                        li: ({ children }) => (
                            <li className="leading-7">
                                {children}
                            </li>
                        ),

                        hr: () => (
                            <hr className="my-6 border-white/10" />
                        ),

                        a: ({ href, children }) => (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 underline hover:text-indigo-300"
                            >
                                {children}
                                <ExternalLink size={14} />
                            </a>
                        ),


                        p: ({ children }) => (
                            <p className='mb-3 whitespace-pre-wrap break-words'>{children}</p>
                        ),
                        ul: ({ children }) => (
                            <ul className='list-disc pl-5 space-y-1 my-2'>{children}</ul>
                        ),
                        ol: ({ children }) => (
                            <ol className='list-decimal pl-5 space-y-1 my-2'>{children}</ol>
                        ),
                        table: ({ children }) => (
                            <div className="overflow-x-auto my-4">
                                <table className="min-w-full border border-white/10">
                                    {children}
                                </table>
                            </div>
                        ),

                        thead: ({ children }) => (
                            <thead className="bg-white/5">
                                {children}
                            </thead>
                        ),
                        tbody: ({ children }) => (
                            <tbody>
                                {children}
                            </tbody>
                        ),

                        tr: ({ children }) => (
                            <tr className="border-b border-white/10">
                                {children}
                            </tr>
                        ),

                        th: ({ children }) => (
                            <th className="px-4 py-2 text-left font-semibold border border-white/10">
                                {children}
                            </th>
                        ),

                        td: ({ children }) => (
                            <td className="px-4 py-2 border border-white/10">
                                {children}
                            </td>
                        ),
                        // code: ({ inline, children }) =>
                        //     inline ? (
                        //         <code className="bg-white/10 text-pink-400 px-1.5 py-0.5 rounded text-sm font-mono">
                        //             {children}
                        //         </code>
                        //     ) : (
                        //         <code className="block bg-[#111827] text-slate-200 p-4 rounded-xl overflow-x-auto font-mono text-sm">
                        //             {children}
                        //         </code>
                        //     ),

                        pre: ({ children }) => (
                            <>
                                {children}
                            </>
                        ),

                        code: ({ className, children }) => {
                            const value = String(children)
                                .trim();

                            if (!className) {
                                return (
                                    <code className='px-1.5 py-0.5 rounded bg-black/10 text-orange-600 '>
                                        {value}
                                    </code>
                                )
                            }

                            const language = className?.replace("language-", "")

                            return (
                                <div className='my-4 overflow-hidden rounded-xl border border-white/10 bg-[#111318] '>
                                    <div className='flex items-center justify-between bg-[#1b1d24] border-b border-white/10 px-4 py-2  '>
                                        <span className='uppercase text-xs text-slate-400'>
                                            {language}
                                        </span>
                                        <button className='flex items-center gap-1 text-xs' onClick={() => copyCodes(value)} >
                                            {
                                                copiedCode == value ?
                                                    <>
                                                        <Check size={14} />
                                                        Copied
                                                    </> :
                                                    <><Copy size={14} />Copy </>
                                            }
                                        </button>
                                    </div>

                                    <SyntaxHighlighter
                                        language={language}
                                        style={oneDark}
                                        wrapLongLines
                                        showLineNumbers
                                        customStyle={{
                                            margin: 0,
                                            padding: "16px",
                                            background: "#0d1117",
                                            fontSize: "13px"
                                        }}
                                    >
                                        {value}
                                    </SyntaxHighlighter>

                                </div>
                            )
                        },

                        img: ({ src }) => {
                            if (!src) return null;
                            return (
                                <div className='relative inline-block group'>
                                    <img
                                        src={src}
                                        onClick={() => setLightBox(src)}
                                        loading="lazy"
                                        onError={(e) => e.currentTarget.parentElement?.remove()}
                                        className='w-40 h-28 rounded-xl object-cover border border-white/10 cursor-zoom-in hover:opacity-90 transition'
                                    />
                                    <button
                                        onClick={() => handleDownload(src)}
                                        className='absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 border-none cursor-pointer'
                                        title='Download image'
                                    >
                                        <Download size={13} />
                                    </button>
                                </div>
                            )
                        }

                    }}
                >
                    {content}
                </Markdown>

            </div>

            {lightBox &&
                <div className='fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6' onClick={() => setLightBox(null)}>
                    <button className='absolute right-5 top-5 text-white/80 hover:text-white bg-white/10 rounded-full p-2 border-none cursor-pointer'
                        onClick={() => setLightBox(null)}>
                        <X className='cursor-pointer' />
                    </button>
                    <button
                        className='absolute right-16 top-5 text-white/80 hover:text-white bg-white/10 rounded-full p-2 border-none cursor-pointer'
                        onClick={(event) => { event.stopPropagation(); handleDownload(lightBox) }}
                        title='Download image'
                    >
                        <Download size={20} />
                    </button>
                    <img
                        src={lightBox}
                        onClick={(event) => event.stopPropagation()}
                        className='max-w-[90vw] max-h-[85vh] rounded-2xl border border-white/10 shadow-2xl object-contain '
                    />
                </div>
            }

        </div>
    )
}

export default MessageBubble