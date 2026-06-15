'use client'

import { useState } from 'react'
import { Phone, MapPin, Fingerprint, Pencil, Save, X, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateEmployeeInfoAction } from '@/app/admin/employees/actions'
import { useLanguage } from '@/i18n'

interface Props {
    profileId: string
    profile: any
    onUpdated: (p: any) => void
}

export function EmployeeInfo({ profileId, profile, onUpdated }: Props) {
    const { t } = useLanguage()
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        full_name:   profile.full_name   || '',
        phone:       profile.phone       || '',
        national_id: profile.national_id || '',
        address:     profile.address     || '',
    })

    const handleSave = async () => {
        setSaving(true)
        const res = await updateEmployeeInfoAction(profileId, form)
        setSaving(false)
        if (res.error) { toast.error(res.error); return }
        toast.success(t('admin.employees.info.updated'))
        onUpdated({ ...profile, ...form })
        setEditing(false)
    }

    const fields = [
        { icon: Phone,       key: 'phone',       label: t('admin.employees.info.phone'),   mono: false },
        { icon: Fingerprint, key: 'national_id',  label: t('admin.employees.info.nni'),     mono: true  },
        { icon: MapPin,      key: 'address',      label: t('admin.employees.info.address'), mono: false },
    ] as const

    return (
        <div className="bg-[#161B22] rounded-2xl border border-white/5 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                <p className="text-xs text-gray-500 font-medium">
                    {t('admin.employees.info.title')}
                </p>
                {!editing ? (
                    <button type="button" onClick={() => setEditing(true)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-all">
                        <Pencil className="w-3 h-3" />
                        {t('admin.employees.info.edit')}
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setEditing(false)
                                setForm({ full_name: profile.full_name || '', phone: profile.phone || '', national_id: profile.national_id || '', address: profile.address || '' })
                            }}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-all"
                        >
                            <X className="w-3 h-3" />
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-all">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            {t('common.save')}
                        </button>
                    </div>
                )}
            </div>

            {/* Full name */}
            <div className="px-5 py-4 border-b border-white/5">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5">
                    {t('admin.employees.info.fullName')}
                </p>
                {editing ? (
                    <input
                        title={t('admin.employees.info.fullName')}
                        value={form.full_name}
                        onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                        className="w-full bg-[#0F1720] border border-white/5 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-white/15 transition-colors"
                    />
                ) : (
                    <p className="text-base font-bold text-white">{profile.full_name}</p>
                )}
            </div>

            {/* Fields */}
            {fields.map(({ icon: Icon, key, label, mono }) => (
                <div key={key} className="flex items-center gap-3.5 px-5 py-4 border-b border-white/5 last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">{label}</p>
                        {editing ? (
                            <input
                                title={label}
                                value={form[key]}
                                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                className={cn(
                                    "w-full bg-[#0F1720] border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/15 transition-colors",
                                    mono && "font-mono tracking-widest"
                                )}
                            />
                        ) : (
                            <p className={cn("text-sm text-white", mono && "font-mono tracking-widest")}>
                                {profile[key] || <span className="text-white/20">—</span>}
                            </p>
                        )}
                    </div>
                </div>
            ))}

            {/* Email */}
            {profile.email && (
                <div className="flex items-center gap-3.5 px-5 py-4 border-t border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Email</p>
                        <p className="text-sm text-gray-400">{profile.email}</p>
                    </div>
                </div>
            )}
        </div>
    )
}
