'use client'

import { useState, useEffect } from 'react'

export function useReadNotifications(userId: string | null) {
    const [readIds, setReadIds] = useState<string[]>([])

    useEffect(() => {
        if (!userId) return
        const stored = localStorage.getItem(`qalami_read_${userId}`)
        if (stored) {
            try {
                setReadIds(JSON.parse(stored))
            } catch {}
        }
    }, [userId])

    const markAsRead = (id: string) => {
        if (!userId) return
        setReadIds(prev => {
            if (prev.includes(id)) return prev
            const newIds = [...prev, id]
            localStorage.setItem(`qalami_read_${userId}`, JSON.stringify(newIds))
            return newIds
        })
    }

    return { readIds, markAsRead }
}
