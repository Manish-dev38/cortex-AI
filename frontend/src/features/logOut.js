import api from '../../utils/axios.js'

async function logOut() {
    await api.get("/api/auth/logout")
}

export default logOut
