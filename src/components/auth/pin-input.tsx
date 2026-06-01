'use client'

import { useRef, KeyboardEvent, ClipboardEvent } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PinInputProps {
    value: string
    onChange: (value: string) => void
    label?: string
    error?: string
    disabled?: boolean
    autoFocus?: boolean
}

export function PinInput({ value, onChange, label, error, disabled, autoFocus }: PinInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])
    const digits = value.padEnd(6, '').split('').slice(0, 6)

    const focusInput = (index: number) => {
        if (index >= 0 && index < 6) {
            inputRefs.current[index]?.focus()
        }
    }

    const handleChange = (index: number, digit: string) => {
        if (disabled) return
        // Only allow single digits
        const d = digit.replace(/\D/g, '').slice(-1)
        const newDigits = [...digits]
        newDigits[index] = d
        const newValue = newDigits.join('').replace(/\s/g, '')
        onChange(newValue)

        if (d && index < 5) {
            focusInput(index + 1)
        }
    }

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (!digits[index] && index > 0) {
                focusInput(index - 1)
                const newDigits = [...digits]
                newDigits[index - 1] = ''
                onChange(newDigits.join('').replace(/\s/g, ''))
            } else {
                const newDigits = [...digits]
                newDigits[index] = ''
                onChange(newDigits.join('').replace(/\s/g, ''))
            }
        } else if (e.key === 'ArrowLeft') {
            focusInput(index - 1)
        } else if (e.key === 'ArrowRight') {
            focusInput(index + 1)
        }
    }

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault()
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        onChange(pasted)
        focusInput(Math.min(pasted.length, 5))
    }

    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-medium text-foreground">{label}</label>
            )}
            <div className="flex gap-2 justify-center">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                    <motion.div
                        key={index}
                        initial={false}
                        animate={{
                            scale: digits[index] ? 1.05 : 1,
                            borderColor: error ? 'rgb(239 68 68)' : digits[index] ? 'rgb(99 102 241)' : 'rgba(255,255,255,0.1)',
                        }}
                        transition={{ duration: 0.15 }}
                    >
                        <input
                            ref={(el) => { inputRefs.current[index] = el }}
                            type="tel"
                            inputMode="numeric"
                            maxLength={1}
                            value={digits[index]?.trim() || ''}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            onPaste={handlePaste}
                            onFocus={(e) => e.target.select()}
                            disabled={disabled}
                            autoFocus={autoFocus && index === 0}
                            className={cn(
                                'w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-bold rounded-xl',
                                'bg-white/5 border-2 transition-all duration-200',
                                'focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500',
                                'text-foreground placeholder:text-muted-foreground/30',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                error ? 'border-red-500/50' : 'border-white/10 hover:border-white/20',
                            )}
                            placeholder="·"
                        />
                    </motion.div>
                ))}
            </div>
            {error && (
                <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-400 text-center"
                >
                    {error}
                </motion.p>
            )}
        </div>
    )
}
