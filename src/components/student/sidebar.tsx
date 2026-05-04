"use client"

import { LayoutDashboard, BookOpen, GraduationCap, Calendar, Clock, Trophy } from "lucide-react"
import { useLanguage } from "@/i18n"
import { RoleSidebar, type SidebarItem } from "@/components/shared/role-sidebar"

export function useStudentSidebarItems(): SidebarItem[] {
    const { t } = useLanguage()
    return [
        { icon: LayoutDashboard, label: t("student.sidebar.dashboard"), href: "/student" },
        { icon: Calendar, label: t("student.sidebar.schedule"), href: "/student/schedule" },
        { icon: BookOpen, label: t("student.sidebar.courses"), href: "/student/courses" },
        { icon: Clock, label: t("student.sidebar.homework"), href: "/student/homework" },
        { icon: Trophy, label: t("student.sidebar.quizzes"), href: "/student/quiz" },
        { icon: GraduationCap, label: t("student.sidebar.grades"), href: "/student/grades" },
    ]
}

export function StudentSidebar() {
    const { t } = useLanguage()
    const items = useStudentSidebarItems()

    return (
        <RoleSidebar
            items={items}
            logoIcon={GraduationCap}
            logoBgClass="bg-blue-600"
            roleLabel={t("common.student")}
            accent={{
                active: "bg-blue-500/10",
                activeText: "text-blue-400",
                activeIcon: "text-blue-500",
                bar: "bg-blue-500",
                accentText: "text-blue-500",
            }}
        />
    )
}
