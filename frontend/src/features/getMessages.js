import api from '../../utils/axios'

async function getMessages(id) {
    const { data } = await api.get(`/api/chat/get-messages/${id}`)
    return data
}

export default getMessages
