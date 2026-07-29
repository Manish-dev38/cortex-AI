import { signInWithPopup } from 'firebase/auth'
import { useCallback, useState } from 'react'
import { auth, googleProvider } from "../../utils/firebase.js"
import api from '../../utils/axios.js'
import { FcGoogle } from "react-icons/fc";
import { useDispatch, useSelector } from 'react-redux';
import { setUserData } from '../redux/userSlice.js';
import SlideBar from '../components/SlideBar.jsx';
import ChatArea from '../components/ChatArea.jsx';
import Artifact from '../components/Artifact.jsx';

const Home = () => {

    const { userData } = useSelector(state => state.user)
    const dispatch = useDispatch()
    const [isLoggingIn, setIsLoggingIn] = useState(false)
    const [loginError, setLoginError] = useState('')

    const handleLogin = useCallback(async (token) => {
        const { data } = await api.post("/api/auth/login", { token })
        dispatch(setUserData(data))
    }, [dispatch])

    const showLoginError = useCallback((error) => {
        setLoginError(
            error.response?.data?.message ||
            error.message ||
            'Unable to sign in. Please try again.'
        )
    }, [])

    const googleLogin = async () => {
        setIsLoggingIn(true)
        setLoginError('')

        try {
            const credential = await signInWithPopup(auth, googleProvider)
            const token = await credential.user.getIdToken()
            await handleLogin(token)
        } catch (error) {
            showLoginError(error)
        } finally {
            setIsLoggingIn(false)
        }
    }

    return (
        <div className='h-screen flex bg-[#0d0f14] text-white overflow-hidden'>

            <SlideBar />
            <ChatArea />
            <Artifact />

            {!userData && <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur'>
                <div className='w-[340px] bg-[#13151c] border border-white/[0.08] rounded-2xl p-7 flex flex-col gap-5'>
                    <div className='flex flex-col gap-1'>
                        <h2 className='text-[17px] font-semibold text-slate-100 tracking-tight'>Welcome to CortexAI</h2>
                        <p className='text-[13px] text-slate-500'>Please login to continue using this app</p>
                    </div>
                    {loginError && <p className='text-[13px] text-red-400'>{loginError}</p>}
                    <button
                        className='w-full flex items-center justify-center gap-3 py-[11px] rounded-xl text-sm font-medium text-white bg-linear-to-br from-indigo-500 to-violet-700 hover:from-indigo-400 hover:to-violet-600 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
                        onClick={googleLogin}
                        disabled={isLoggingIn}
                    >
                        <FcGoogle size={20} />
                        {isLoggingIn ? 'Signing in...' : 'Continue With Google'}
                    </button>
                </div>
            </div>}

        </div>
    )
}

export default Home
