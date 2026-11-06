import { createSlice } from '@reduxjs/toolkit'

const messageSlice = createSlice({
    name: "message",
    initialState: {
        messages: [],
        artifacts: [],
        isLoading: false,
        draft: "",
    },
    // upadte the  initialState
    reducers: {
        setMessages: (state, action) => {
            state.messages = action.payload
        },
        addMessages: (state, action) => {
            state.messages.push(action.payload)
        },
        removeLastMessage: (state) => {
            state.messages.pop()
        },
        setArtifacts: (state, action) => {
            state.artifacts = action.payload
        },
        setDraft: (state, action) => {
            state.draft = action.payload
        },
        setIsLoading: (state, action) => {
            state.isLoading = action.payload
        },
    }
})

export const { setMessages, addMessages, removeLastMessage, setArtifacts, setDraft, setIsLoading } = messageSlice.actions
export default messageSlice.reducer