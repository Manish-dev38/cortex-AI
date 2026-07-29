import { createSlice } from '@reduxjs/toolkit'

const messageSlice = createSlice({
    name: "message",
    initialState: {
        messages: [],
        artifacts: [],
        isLoading: false,
    },
    // upadte the  initialState
    reducers: {
        setMessages: (state, action) => {
            state.messages = action.payload
        },
        addMessages: (state, action) => {
            state.messages.push(action.payload)
        },
        setArtifacts: (state, action) => {
            state.artifacts = action.payload
        },
        setIsLoading: (state, action) => {
            state.isLoading = action.payload
        },
    }
})

export const { setMessages, addMessages, setArtifacts, setIsLoading } = messageSlice.actions
export default messageSlice.reducer