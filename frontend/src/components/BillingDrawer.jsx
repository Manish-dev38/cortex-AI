import { useState } from 'react'
import { motion, AnimatePresence } from "motion/react"
import { Crown, X } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { createOrder } from '../features/createOrder.js'
import { verifyPayment } from '../features/verifyPayment.js'
import getCurrentUser from '../features/getCurrentUser.js'
import { setUserData } from '../redux/userSlice.js'

function BillingDrawer({ open, onClose }) {

    const { userData } = useSelector(state => state.user)
    const dispatch = useDispatch()
    const [pendingPlan, setPendingPlan] = useState(null)
    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")

    const refreshUser = async () => {
        const user = await getCurrentUser()
        if (user) dispatch(setUserData(user))
    }

    const handleUpgrade = async (plan) => {
        setError("")
        setNotice("")
        setPendingPlan(plan)

        try {
            const data = await createOrder(plan)

            if (!data?.order?.id) {
                setError("The payment provider did not return a valid order. Please try again.")
                return
            }

            const options = {
                key: import.meta.env.VITE_RAZOR_KEY_ID,
                amount: data?.order?.amount,
                currency: data?.order?.currency,
                name: "CortexAI",
                description: `${data?.payment?.plan || plan} Plan`,
                order_id: data?.order?.id,
                handler: async (response) => {
                    try {
                        const result = await verifyPayment(response)
                        if (result?.payment?.creditStatus === "pending" || result?.code === "CREDIT_PENDING") {
                            setNotice("Payment received. Credits are still being applied — refresh in a moment.")
                        } else {
                            setNotice("Payment successful. Your plan and credits are updated.")
                        }
                        await refreshUser()
                    } catch (verifyError) {
                        setError(verifyError?.message || "Payment succeeded but verification failed. Contact support with your order id.")
                    } finally {
                        setPendingPlan(null)
                    }
                },
                modal: {
                    ondismiss: () => setPendingPlan(null)
                },
                theme: {
                    color: "#4F46E5"
                }
            }

            const razorpay = new window.Razorpay(options)
            razorpay.open()
        } catch (err) {
            setError(err?.message || "Unable to start checkout. Please try again.")
            setPendingPlan(null)
        }
    }

    const credits = userData?.credits ?? 100
    const totalCredits = userData?.totalCredits ?? 100
    const creditPercent = totalCredits > 0 ? Math.min(100, Math.max(0, (credits / totalCredits) * 100)) : 0

    return (
        <AnimatePresence>
            {open && <>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: .5 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className='fixed inset-0 bg-black z-40'
                />
                <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ duration: .25 }}
                    className='fixed right-0 top-0 z-50 h-screen w-[380px] max-w-[100vw] bg-[#0f1117] border border-white/10 shadow-2xl flex flex-col '
                >

                    <div className='flex items-center justify-between p-5 border-b border-white/10'>
                        <div>
                            <div className='text-white text-lg font-semibold'>
                                Billing
                            </div>
                            <div className='text-slate-400 text-sm'>
                                Plans and Credits
                            </div>
                        </div>
                        <button type='button' onClick={onClose} aria-label='Close billing'
                            className='w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center'
                        >
                            <X className='text-slate-300 cursor-pointer' />
                        </button>
                    </div>

                    <div className='p-5 '>
                        <div className='rounded-xl bg-white/[0.04] border border-white/10 p-4 '>
                            <div className='flex justify-between items-center '>
                                <div>
                                    <p className='text-slate-400 text-sm'>
                                        Current Plan
                                    </p>
                                    <h3 className='text-white text-xl font-bold'>
                                        {userData?.plan || "Free"}
                                    </h3>
                                </div>
                                <Crown className='text-yellow-400' />
                            </div>

                            <div className='mt-5'>
                                <div className='flex justify-between text-xs text-slate-400 mb-2'>
                                    <span>Credits</span>
                                    <span> {credits}/{totalCredits} </span>
                                </div>

                                <div className='h-2 rounded-full bg-white/10 overflow-hidden '>
                                    <div className='h-full bg-indigo-500 transition-all duration-500' style={{
                                        width: `${creditPercent}%`
                                    }}>
                                    </div>
                                </div>

                            </div>

                        </div>
                    </div>

                    <div className='px-5 flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-4'>
                        {error && <p className='rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300' role='alert'>{error}</p>}
                        {notice && <p className='rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300'>{notice}</p>}

                        <div className='rounded-xl border border-white/10 p-4'>
                            <h3 className='text-white font-semibold'>Starter Plan</h3>
                            <p className='text-indigo-400 text-2xl font-bold mt-2'>₹199</p>
                            <p className='text-slate-400 text-sm mt-1'>500 Credits</p>
                            <button type='button' disabled={pendingPlan !== null} className='mt-4 w-full rounded-lg cursor-pointer bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed py-2 text-white' onClick={() => handleUpgrade("starter")}>
                                {pendingPlan === "starter" ? "Starting checkout..." : "Upgrade"}
                            </button>
                        </div>

                        <div className='rounded-xl border border-white/10 p-4'>
                            <h3 className='text-white font-semibold'>Pro Plan</h3>
                            <p className='text-indigo-400 text-2xl font-bold mt-2'>₹499</p>
                            <p className='text-slate-400 text-sm mt-1'>1000 Credits</p>
                            <button type='button' disabled={pendingPlan !== null} className='mt-4 w-full rounded-lg cursor-pointer bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed py-2 text-white' onClick={() => handleUpgrade("pro")}>
                                {pendingPlan === "pro" ? "Starting checkout..." : "Upgrade"}
                            </button>
                        </div>
                    </div>


                </motion.div>
            </>
            }
        </AnimatePresence>
    )
}

export default BillingDrawer
