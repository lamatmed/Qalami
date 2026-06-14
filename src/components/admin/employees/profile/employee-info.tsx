'use client'

import { useState } from 'react'
import { Phone, MapPin, Fingerprint, Pencil, Save, X, Loader2 } from 'lucide-react'
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
        full_name:   profile.full_name  || '',
        phone:       profile.phone      || '',
        national_id: profile.national_id || '',
        address:     profile.address    || '',
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
        { icon: Phone,       key: 'phone',       label: t('admin.employees.info.phone'), mono: false },
        { icon: Fingerprint, key: 'national_id',  label: t('admin.employees.info.nni'),   mono: true  },
        { icon: MapPin,      key: 'address',      label: t('admin.employees.info.address'), mono: false },
    ] as const

    return (
        <div className="bg-[#1A2530] rounded-3xl border border-white/5 p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">{t('admin.employees.info.title')}</h3>
                {!editing ? (
                    <button type="button" onClick={() => setEditing(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all">
                        <Pencil className="w-3.5 h-3.5" /> {t('admin.employees.info.edit')}
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { setEditing(false); setForm({ full_name: profile.full_name || '', phone: profile.phone || '', national_id: profile.national_id || '', address: profile.address || '' }) }}
                            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/5 border border-white/10 transition-all">
                            <X className="w-3.5 h-3.5" /> {t('common.cancel')}
                        </button>
                        <button type="button" onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white px-3 py-1.5 rounded-xl disabled:opacity-50 transition-all">
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {t('common.save')}
                        </button>
                    </div>
                )}
            </div>

            {/* Name */}
            <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{t('admin.employees.info.fullName')}</p>
                {editing ? (
                    <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                        className="w-full bg-[#0F1720] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-pink-500/50" />
                ) : (
                    <p className="text-white font-bold">{profile.full_name}</p>
                )}
            </div>

            <div className="divide-y divide-white/5">
                {fields.map(({ icon: Icon, key, label, mono }) => (
                    <div key={key} className="py-3 flex items-center gap-4">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">{label}</p>
                            {editing ? (
                                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                    className={cn("w-full bg-[#0F1720] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-pink-500/50", mono && "font-mono")} />
                            ) : (
                                <p className={cn("text-sm text-white", mono && "font-mono")}>
                                    {profile[key] || <span className="text-gray-600">—</span>}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Email (read-only) */}
            {profile.email && (
                <div className="bg-[#0F1720] rounded-2xl px-4 py-3">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Email</p>
                    <p className="text-sm text-gray-400">{profile.email}</p>
                </div>
            )}
        </div>
    )
}
