"use client"

import { LayoutDashboard, Users, CreditCard, FileText, Settings, HeartHandshake } from "lucide-react"
import { useLanguage } from "@/i18n"
import { RoleSidebar, type SidebarItem } from "@/components/shared/role-sidebar"

export function useParentSidebarItems(): SidebarItem[] {
    const { t } = useLanguage()
    return [
        { icon: LayoutDashboard, label: t("parent.sidebar.dashboard"), href: "/parent" },
        { icon: Users, label: t("parent.sidebar.children"), href: "/parent/children" },
        { icon: CreditCard, label: t("parent.sidebar.finances"), href: "/parent/finances" },
        { icon: FileText, label: t("parent.sidebar.documents"), href: "/parent/documents" },
        { icon: HeartHandshake, label: t("parent.sidebar.requests"), href: "/parent/requests" },
        { icon: Settings, label: t("parent.sidebar.settings"), href: "/parent/settings" },
    ]
}

export function ParentSidebar() {
    const { t } = useLanguage()
    const items = useParentSidebarItems()

    return (
        <RoleSidebar
            items={items}
            logoIcon={Users}
            logoBgClass="bg-amber-600"
            roleLabel={t("common.parent")}
            accent={{
                active: "bg-amber-500/10",
                activeText: "text-amber-500",
                activeIcon: "text-amber-500",
                bar: "bg-amber-500",
                accentText: "text-amber-500",
            }}
        />
    )
}
