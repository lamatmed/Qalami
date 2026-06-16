'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Phone, MessageSquare, Mail, MapPin, X, Banknote, User, ShieldAlert, Plus, KeyRound, FileText, Pencil, Trash2, UserPlus, UserMinus, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { ParentDocuments } from './parent-documents'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n'
import { StudentPayments } from '@/components/admin/students/profile/student-payments'
import { createClient } from '@/utils/supabase/client'
import { StatusBadge } from '@/components/admin/shared/status-badge'
import { ChangeStatusDialog } from '@/components/admin/shared/change-status-dialog'
import { ChangePasswordDialog } from '@/components/admin/shared/change-password-dialog'
import { EditParentDialog } from './edit-parent-dialog'
import { AddChildDialog } from './add-child-dialog'
import { removeChildFromParent, deleteParentPermanently } from '@/app/admin/parents/actions'

interface ParentProfileProps {
    parent: any
    schoolId?: string
    onClose?: () => void
    onParentUpdated?: () => void
}




export function ParentProfile({ parent, schoolId = '', onClose, onParentUpdated }: ParentProfileProps) {
    const { t } = useLanguage()
    const [statusDialogOpen, setStatusDialogOpen] = useState(false)
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
    const [editParentOpen, setEditParentOpen] = useState(false)
    const [addChildOpen, setAddChildOpen] = useState(false)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [removingChild, setRemovingChild] = useState<string | null>(null)
    const [localParent, setLocalParent] = useState(parent)
    const [currentStatus, setCurrentStatus] = useState<string>(parent?.status || 'active')
    const [activeTab, setActiveTab] = useState<'info' | 'finance' | 'documents'>('info')
    // Sync localParent when parent prop updates (e.g., after adding a child)
    useEffect(() => {
        setLocalParent(parent)
    }, [parent])

    if (!localParent) return null

    const handleDeleteParent = async () => {
        setDeleting(true)
        const result = await deleteParentPermanently(localParent.id)
        setDeleting(false)
        if (result.error) { toast.error(result.error); return }
        toast.success(t('admin.parents.parentDeleted'))
        onClose?.()
        onParentUpdated?.()
    }

    const handleRemoveChild = async (childId: string, childName: string) => {
        if (!confirm(`Retirer ${childName} du compte de ce parent ?`)) return
        setRemovingChild(childId)
        const result = await removeChildFromParent(localParent.id, childId)
        setRemovingChild(null)
        if (result.error) { toast.error(result.error); return }
        toast.success(t('admin.parents.childRemoved', { childName }))
        setLocalParent((prev: typeof parent) => ({ ...prev, children: prev.children.filter((c: { id: string }) => c.id !== childId) }))
        onParentUpdated?.()
    }

    if (!parent) return null

    // Format phone for links (remove spaces, ensure country code)
    const formatPhoneForLink = (phone: string) => {
        const cleaned = phone?.replace(/[\s\-\(\)]/g, '') || ''
        // If starts with 0, replace with +222 (Mauritania)
        if (cleaned.startsWith('0')) return '+222' + cleaned.substring(1)
        // If no country code, add +222
        if (!cleaned.startsWith('+')) return '+222' + cleaned
        return cleaned
    }

    const parentPhone = parent.phone || parent.father_phone || ''
    const phoneLink = formatPhoneForLink(parentPhone)

    const handleCall = () => {
        if (!parentPhone) {
            toast.error(t('admin.parents.noPhoneRecorded'))
            return
        }
        window.open(`tel:${phoneLink}`, '_self')
    }

    const handleWhatsApp = () => {
        if (!parentPhone) {
            toast.error(t('admin.parents.noPhoneRecorded'))
            return
        }
        // Remove + for wa.me link
        const waNumber = phoneLink.replace('+', '')
        window.open(`https://wa.me/${waNumber}`, '_blank')
    }

    const handleMessage = () => {
        const email = parent.email || parent.mother_email || ''
        if (!email) {
            toast.error(t('admin.parents.noEmailRecorded'))
            return
        }
        window.open(`mailto:${email}`, '_self')
    }

    return (
        <div className="h-full flex flex-col bg-[#161B22] rounded-3xl border border-white/5 overflow-hidden animate-in fade-in duration-300">
            {/* Header / Cover */}
            <div className={cn(
                "relative transition-all duration-300",
                activeTab === 'info' ? "h-32 bg-gray-900/40" : "h-24 bg-indigo-900/20"
            )}>
                <div className="absolute top-4 right-4 flex gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-white bg-black/20 backdrop-blur-sm rounded-full lg:hidden"
                        onClick={onClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Profile Info - Compact in Finance View */}
            <div className={cn("px-6 -mt-12 flex flex-col items-center transition-all", activeTab !== 'info' && "-mt-8")}>
                <div className="relative">
                    <Avatar className={cn("border-4 border-[#161B22] shadow-xl transition-all", activeTab === 'finance' ? "w-16 h-16" : "w-24 h-24")}>
                        <AvatarImage src={parent.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${parent.name}`} />
                        <AvatarFallback>{parent.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                </div>

                <div className="mt-2 text-center space-y-1">
                    <h2 className={cn("font-bold text-white transition-all", activeTab === 'finance' ? "text-lg" : "text-xl")}>{parent.name}</h2>
                    {parentPhone && (
                        <p className="text-xs text-gray-400 font-mono">{parentPhone}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                        <StatusBadge status={currentStatus} />
                        {parentPhone && parentPhone !== 'Non renseigné' && (
                            <button type="button"
                                onClick={() => setPasswordDialogOpen(true)}
                                className="text-gray-500 hover:text-emerald-400 transition-colors"
                                title={t('admin.users.changePassword') || 'Modifier le mot de passe'}
                            >
                                <KeyRound className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button type="button"
                            onClick={() => setStatusDialogOpen(true)}
                            className="text-gray-500 hover:text-orange-400 transition-colors"
                            title="Changer le statut"
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                        <button type="button"
                            onClick={() => setEditParentOpen(true)}
                            className="text-gray-500 hover:text-blue-400 transition-colors"
                            title="Modifier les informations"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button"
                            onClick={() => setDeleteConfirmOpen(true)}
                            className="text-gray-500 hover:text-red-500 transition-colors"
                            title="Supprimer définitivement"
                        >
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-[#0D1117] rounded-xl border border-white/5 mt-4 mb-2">
                    <TabButton
                        active={activeTab === 'info'}
                        label={t('admin.parents.information')}
                        icon={User}
                        onClick={() => setActiveTab('info')}
                    />
                    <TabButton
                        active={activeTab === 'finance'}
                        label={t('admin.parents.finances')}
                        icon={Banknote}
                        onClick={() => setActiveTab('finance')}
                    />
                    <TabButton
                        active={activeTab === 'documents'}
                        label={t('admin.parents.documentsTab')}
                        icon={FileText}
                        onClick={() => setActiveTab('documents')}
                    />
                </div>

                {/* Actions Grid - Only Show Call/Msg in Info Tab */}
                {activeTab === 'info' && (
                    <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-4">
                        <ActionBtn icon={Phone} label={t('admin.parents.call')} color="text-emerald-400" bg="bg-emerald-500/5 group-hover:bg-emerald-500/10" onClick={handleCall} />
                        <ActionBtn icon={MessageSquare} label="WhatsApp" color="text-green-400" bg="bg-green-500/5 group-hover:bg-green-500/10" onClick={handleWhatsApp} />
                        <ActionBtn icon={Mail} label={t('admin.parents.message')} color="text-blue-400" bg="bg-blue-500/5 group-hover:bg-blue-500/10" onClick={handleMessage} />
                    </div>
                )}

            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                {activeTab === 'documents' ? (
                    <ParentDocuments
                        parentId={parent.id}
                        parentName={parent.name}
                        schoolId={schoolId}
                    />
                ) : activeTab === 'info' ? (
                    <>
                        {/* Linked Children */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white">{t('admin.parents.linkedChildrenTitle')}</h3>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] border-white/10">{localParent.children.length} {t('admin.parents.children')}</Badge>
                                    <button type="button"
                                        onClick={() => setAddChildOpen(true)}
                                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 rounded-md px-2 py-1 transition-colors"
                                    >
                                        <UserPlus className="w-3 h-3" /> {t('admin.parents.addChild')}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {localParent.children.length === 0 ? (
                                    <div className="py-6 text-center rounded-xl bg-[#0D1117] border border-white/5">
                                        <p className="text-xs text-gray-500">{t('admin.parents.noStudentsLinked')}</p>
                                        <button type="button" onClick={() => setAddChildOpen(true)}
                                            className="text-[11px] text-emerald-400 hover:text-emerald-300 mt-1 underline">
                                            {t('admin.parents.addChildToAccount')}
                                        </button>
                                    </div>
                                ) : (
                                    localParent.children.map((child: any) => (
                                        <div key={child.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D1117] border border-white/5 hover:border-white/10 transition-colors group">
                                            <Link href={`/admin/students/${child.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                                                <Avatar className="w-10 h-10 rounded-lg border border-white/5">
                                                    <AvatarImage src={child.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.name}`} />
                                                    <AvatarFallback>{child.name[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-semibold text-gray-200 group-hover:text-emerald-400 transition-colors">{child.fullName || child.name}</h4>
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                                                        {child.class_name && <span className="text-xs text-emerald-400 font-medium">{child.class_name}</span>}
                                                        {child.national_id && <span className="text-xs text-gray-400 font-mono">NNI: {child.national_id}</span>}
                                                    </div>
                                                </div>
                                            </Link>
                                            <button type="button"
                                                onClick={() => handleRemoveChild(child.id, child.fullName || child.name)}
                                                disabled={removingChild === child.id}
                                                className="shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1"
                                                title="Retirer du compte"
                                            >
                                                {removingChild === child.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Info Section */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-white">{t('admin.parents.information')}</h3>
                            <div className="p-4 rounded-xl bg-[#0D1117] border border-white/5 space-y-4">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">{t('admin.parents.address')}</p>
                                        <p className="text-sm text-gray-300">
                                            {parent.address || <span className="italic text-gray-500">{t('admin.parents.addressNotProvided')}</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {!parent.children || parent.children.length === 0 ? (
                            <div className="py-12 text-center rounded-2xl bg-[#0D1117] border border-white/5">
                                <p className="text-sm text-gray-500">{t('admin.parents.noStudentsLinked') || 'Aucun élève associé'}</p>
                            </div>
                        ) : (
                            parent.children.map((child: any) => (
                                <div key={child.id} className="bg-[#0D1117] border border-white/5 rounded-3xl p-6 space-y-4">
                                    <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                                        <Avatar className="w-10 h-10 border border-white/5 bg-[#161B22]">
                                            <AvatarImage src={child.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${child.name}`} />
                                            <AvatarFallback>{child.name[0]}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <Link href={`/admin/students/${child.id}`} className="text-sm font-bold text-white hover:text-emerald-400 transition-colors">
                                                {child.fullName || child.name}
                                            </Link>
                                            <Badge variant="secondary" className="text-[10px] h-4 bg-white/5 text-gray-400">
                                                {child.class_name || t('admin.students.list.unassigned') || 'Sans classe'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <StudentPayments studentId={child.id} studentName={child.fullName || child.name} schoolId={schoolId} />
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <ChangeStatusDialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
                userId={localParent.id}
                currentStatus={currentStatus}
                userName={localParent.name}
                onSuccess={(newStatus) => setCurrentStatus(newStatus)}
            />
            <ChangePasswordDialog
                open={passwordDialogOpen}
                onOpenChange={setPasswordDialogOpen}
                userId={localParent.id}
                userName={localParent.name}
                userPhone={parentPhone && parentPhone !== 'Non renseigné' ? parentPhone : null}
            />
            <EditParentDialog
                open={editParentOpen}
                onOpenChange={setEditParentOpen}
                parentId={localParent.id}
                initialData={{ full_name: localParent.name, address: localParent.address, email: localParent.email }}
                onSuccess={() => { onParentUpdated?.() }}
            />
            <AddChildDialog
                open={addChildOpen}
                onOpenChange={setAddChildOpen}
                parentId={localParent.id}
                parentName={localParent.name}
                onSuccess={() => { onParentUpdated?.() }}
            />
            {/* Confirmation suppression définitive */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteConfirmOpen(false)} />
                    <div className="relative w-full max-w-sm bg-[#161B22] rounded-2xl border border-red-500/30 shadow-2xl p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white">{t('admin.parents.deleteParentTitle')}</h3>
                                <p className="text-sm text-gray-400 mt-1">{t('admin.parents.deleteParentDesc')}</p>
                                <p className="text-sm font-bold text-white mt-2">{localParent.name}</p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white"
                                onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>{t('admin.parents.deleteParentCancel')}</Button>
                            <Button type="button" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                                onClick={handleDeleteParent} disabled={deleting}>
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                                {t('admin.parents.deleteParentConfirm')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function ActionBtn({ icon: Icon, label, color, bg, onClick }: { icon: any, label: string, color: string, bg: string, onClick: () => void }) {
    return (
        <button className="group flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-[#0D1117] border border-white/5 hover:border-white/10 transition-all" onClick={onClick}>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-colors", bg, color)}>
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">{label}</span>
        </button>
    )
}

function TabButton({ active, label, icon: Icon, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                active
                    ? "bg-[#161B22] text-white shadow-sm border border-white/5"
                    : "text-gray-500 hover:text-gray-300"
            )}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    )
}
