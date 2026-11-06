import { Paperclip, Mic, Send, Zap, MessageSquare, Code2, FileText, Presentation, Globe, ImageIcon, X } from 'lucide-react'
import { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import sendMessage from '../features/sendMessage.js'
import { createConversation } from '../features/createCoversation.js'
import { addConversation, setSelectedConversation, setConvTitle } from '../redux/conversationSlice.js'
import { addMessages, removeLastMessage, setArtifacts, setDraft, setIsLoading } from '../redux/messageSlice.js'
import { updateConversation } from '../features/updateConversation.js'
import getCurrentUser from '../features/getCurrentUser.js'
import { setUserData } from '../redux/userSlice.js'


const ChatInput = () => {
    const [value, setValue] = useState("")
    const [selectedAgent, setSelectedAgent] = useState("auto")
    const [isSending, setIsSending] = useState(false)
    const [error, setError] = useState("")
    const { draft } = useSelector(state => state.message)
    const [selectedFile, setSelectedFile] = useState(null)
    const fileRef = useRef(null)
    const textareaRef = useRef(null)
    const dispatch = useDispatch()
    const { selectedConversation } = useSelector(state => state.conversation)

    // Suggestion chips write into the draft slot. It is read as part of the
    // controlled value, so no effect (and no cascading render) is needed.
    const inputValue = draft || value

    const resetFile = () => {
        setSelectedFile(null)
        if (fileRef.current) fileRef.current.value = ""
    }

    const handleSendMessage = async () => {
        const prompt = inputValue.trim()
        if (!prompt || isSending) return

        setError("")
        dispatch(setIsLoading(true))
        dispatch(setDraft(""))

        let conversation = selectedConversation
        let succeeded = false
        let optimisticMessageAdded = false

        try {
            if (!conversation) {
                conversation = await createConversation()
                dispatch(setSelectedConversation(conversation))
                dispatch(addConversation(conversation))
            }

            if (conversation?.title === "New Chat") {
                await updateConversation({ id: conversation?._id, title: prompt })
                dispatch(setConvTitle({ conversationId: conversation?._id, title: prompt.slice(0, 38) }))
            }

            setIsSending(true)
            dispatch(addMessages({ role: "user", content: prompt }))
            optimisticMessageAdded = true
            setValue("")

            const formData = new FormData()
            formData.append("prompt", prompt)
            formData.append("conversationId", conversation?._id)
            formData.append("agent", selectedAgent)

            if (selectedFile) {
                formData.append("file", selectedFile)
            }

            const response = await sendMessage(formData)

            if (response) {
                succeeded = true
                dispatch(setArtifacts(response.artifacts || []))
                dispatch(addMessages({
                    role: "assistant",
                    content: response?.answer,
                    images: response?.images
                }))

                // Credits change on every generation; refresh so the sidebar
                // and billing drawer never show a stale balance.
                getCurrentUser().then((user) => {
                    if (user) dispatch(setUserData(user))
                })
            }
        } catch (err) {
            setError(err?.message || "Something went wrong. Please try again.")
            // The optimistic user bubble was never persisted; drop it and put
            // the prompt back so the user can retry.
            if (optimisticMessageAdded) dispatch(removeLastMessage())
            if (!succeeded) {
                setValue((current) => current || prompt)
            }
        } finally {
            setIsSending(false)
            dispatch(setIsLoading(false))
            if (succeeded) resetFile()
        }
    }

    const agents = [
        {
            id: "auto",
            icon: Zap,
            label: "Auto"
        },
        {
            id: "chat",
            icon: MessageSquare,
            label: "Chat"
        },
        {
            id: "coding",
            icon: Code2,
            label: "Coding"
        },
        {
            id: "pdf",
            icon: FileText,
            label: "PDF"
        },
        {
            id: "ppt",
            icon: Presentation,
            label: "PPT"
        },
        {
            id: "vision",
            icon: ImageIcon,
            label: "vision"
        },
        {
            id: "search",
            icon: Globe,
            label: "Search"
        },
    ]

    return (
        <div className='w-full overflow-hidden px-3 md:px-5 py-4 border-t border-white/[0.06] bg-[#0d0f14] '>
            <div className='flex flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 pt-3.5 pb-3 '>

                <div className='flex w-[80%] gap-2 pr-2 flex-wrap '>
                    {agents.map((agent) => {
                        const isActive = selectedAgent === agent.id
                        const Icon = agent.icon
                        return (
                            <div
                                key={agent.id}
                                onClick={() => setSelectedAgent(agent.id)}
                                className={`
                            flex-shrink-0
                            cursor-pointer
                            inline-flex
                            items-center
                            gap-1.5
                            px-3
                            py-2
                            rounded-full
                            text-xs
                            font-medium
                            border
                            transition-all 

                            ${isActive
                                        ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-[0_1px_8px_rgba(99,102,241,0.35)]"
                                        : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.07] "
                                    }
                            `}>

                                <Icon size={14}
                                    className={
                                        isActive
                                            ? "text-white"
                                            : "text-slate-500"
                                    }
                                />

                                {agent.label}

                            </div>
                        )
                    })}
                </div>

                {selectedFile &&
                    <div className='my-3'>
                        <div className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 '>
                            {
                                selectedFile?.type === "application/pdf" ? <FileText size={16} className='text-red-400' /> : selectedFile.type.startsWith("image/") && <img src={URL.createObjectURL(selectedFile)} alt={selectedFile.name} className='h-10 w-10 rounded-xl object-cover ' />
                            }

                            <div>
                                <p className='text-xs text-white'>
                                    {selectedFile?.name}
                                </p>
                                <p className='text-[10px] text-slate-500 '>
                                    {Math.max(1, Math.round((selectedFile?.size || 0) / 1024))}KB
                                </p>
                                <button type='button' className='ml-2 text-slate-500 hover:text-white' onClick={resetFile} aria-label='Remove attachment'><X size={14} /></button>
                            </div>

                        </div>

                    </div>
                }

                <textarea placeholder='Ask Anything....'
                    ref={textareaRef}
                    onChange={(e) => {
                        setValue(e.target.value)
                        if (draft) dispatch(setDraft(""))
                    }}
                    value={inputValue}
                    disabled={isSending}
                    className='w-full bg-transparent outline-none resize-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50 ' rows={3} />

                {error && <p className='text-[12px] text-red-400' role='alert'>{error}</p>}

                <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1 '>

                        <input type="file" accept='.pdf,image/*' hidden ref={fileRef} onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                                setSelectedFile(file)
                            }
                        }} />
                        <button type='button' className='flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer' onClick={() => fileRef.current?.click()} aria-label='Attach file'>
                            <Paperclip size={16} />
                        </button>
                        <button type='button' className='flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-slate-400 hover:bg-white/[0.05] border border-transparent hover:border-white/[0.06] transition-all duration-150 bg-transparent cursor-pointer ' title='Voice input is not available yet'>
                            <Mic size={16} />
                        </button>
                    </div>
                    <button
                        type='button'
                        disabled={!inputValue.trim() || isSending}
                        onClick={handleSendMessage}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-all duration-150 ${inputValue.trim() && !isSending ? "bg-gradient-to-br from-indigo-500 to-violet-700 hover:opacity-90 text-white" : "bg-white/[0.05] text-slate-600 cursor-not-allowed "} `}>
                        <Send size={15} />
                    </button>
                </div>
            </div>

        </div>
    )
}

export default ChatInput
