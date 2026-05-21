'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function TestPaymentPage() {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()
        supabase
            .from('payments')
            .select('*')
            .order('due_date', { ascending: false })
            .then(({ data, error }) => {
                if (error) setData({ error })
                else setData(data)
                setLoading(false)
            })
    }, [])

    return (
        <div className="p-8 bg-slate-900 text-white font-mono min-h-screen">
            <h1 className="text-xl font-bold mb-4">Payments Raw Data</h1>
            {loading ? <p>Loading...</p> : <pre className="text-xs bg-black p-4 rounded overflow-auto max-h-[80vh]">{JSON.stringify(data, null, 2)}</pre>}
        </div>
    )
}
