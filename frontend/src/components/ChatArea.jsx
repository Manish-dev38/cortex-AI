import { useEffect } from 'react'
import Nav from './Nav'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import { useDispatch, useSelector } from 'react-redux'
import getMessages from '../features/getMessages.js'
import { setArtifacts, setMessages } from '../redux/messageSlice.js'

const ChatArea = () => {
    const { selectedConversation } = useSelector(state => state.conversation)
    const dispatch = useDispatch()

    useEffect(() => {
        let cancelled = false

        const loadMessages = async () => {
            // Always reset when switching chats: previously the previous
            // conversation's messages leaked into a brand-new chat.
            if (!selectedConversation || selectedConversation.title === "New Chat") {
                dispatch(setMessages([]))
                dispatch(setArtifacts([]))
                return
            }

            try {
                const data = await getMessages(selectedConversation?._id)
                if (cancelled) return

                const messages = Array.isArray(data) ? data : []
                dispatch(setMessages(messages))

                const latestArtifactMessage = [...messages].reverse().find(msg => msg.artifacts && msg.artifacts.length > 0)
                dispatch(setArtifacts(latestArtifactMessage?.artifacts || []))
            } catch {
                if (cancelled) return
                dispatch(setMessages([]))
                dispatch(setArtifacts([]))
            }
        }

        loadMessages()
        return () => { cancelled = true }
    }, [selectedConversation, dispatch])

    return (
        <div className='flex-1 flex flex-col min-w-0'>
            <Nav />
            <MessageList />
            <ChatInput />
        </div>
    )
}

export default ChatArea
